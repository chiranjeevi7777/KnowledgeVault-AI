"""
main.py
───────
FastAPI application — all HTTP endpoints for the Box Agent.

Routes:
  GET  /api/health           — health check
  POST /api/chat             — RAG query → answer + sources
  POST /api/ingest           — trigger ingestion pipeline (background)
  GET  /api/ingest/status    — live ingestion progress
  GET  /api/stats            — ChromaDB + ingestion stats
  GET  /api/folders          — Box folder tree for sidebar
  GET  /api/logs             — recent ingestion log entries
"""

import uuid
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

load_dotenv(override=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s — %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("box_agent")


# ── Lifespan: warm up Whisper model once at startup ───────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Box Agent API starting up…")
    import query_logger
    query_logger.init_db()
    logger.info("SQLite query history DB initialized.")
    yield
    logger.info("Box Agent API shutting down.")


app = FastAPI(
    title="Box Agent API",
    version="1.0.0",
    description="RAG pipeline: Box → Whisper → Gemini → ChromaDB → Chat",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic schemas ──────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    message:         str
    conversation_id: Optional[str] = None


class ChatResponse(BaseModel):
    answer:          str
    sources:         list
    chunks_used:     int
    conversation_id: str


# ── Health ────────────────────────────────────────────────────────────────────
@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "Box Agent API", "version": "1.0.0"}


# ── Chat / RAG ────────────────────────────────────────────────────────────────
@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    from rag_agent import get_answer

    if not request.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    result = await get_answer(request.message)

    conv_id = request.conversation_id or str(uuid.uuid4())

    # Log query
    import query_logger
    score_list = [s.get("score", 0) for s in result["sources"]]
    max_score = max(score_list) if score_list else 0.0
    accessed = [s.get("file", "unknown") for s in result["sources"]]
    status = "Success" if len(accessed) > 0 else "Fallback"
    
    # We use await asyncio.to_thread if we want to not block, but for sqlite simple inserts it is fine sync
    query_logger.log_query(
        conversation_id=conv_id,
        query=request.message,
        mode="RAG",
        score=max_score,
        sources=len(accessed),
        result=status,
        accessed_files=accessed
    )

    return ChatResponse(
        answer          = result["answer"],
        sources         = result["sources"],
        chunks_used     = result.get("chunks_used", 0),
        conversation_id = conv_id,
    )


# ── Ingestion ─────────────────────────────────────────────────────────────────
@app.post("/api/ingest")
async def trigger_ingestion(background_tasks: BackgroundTasks):
    from ingestion import ingestion_status, run_ingestion_pipeline

    if ingestion_status.get("status") == "running":
        return {
            "status":  "already_running",
            "message": "Ingestion pipeline is already in progress.",
        }

    background_tasks.add_task(run_ingestion_pipeline)
    return {"status": "started", "message": "Ingestion pipeline started in background."}


@app.get("/api/ingest/status")
async def ingestion_status_endpoint():
    from ingestion import ingestion_status
    return ingestion_status


@app.post("/api/ingest/clear")
async def clear_and_reingest(background_tasks: BackgroundTasks):
    """Clear ChromaDB collection and trigger a full fresh re-ingestion."""
    from vector_store import clear_collection
    from ingestion import ingestion_status, run_ingestion_pipeline

    if ingestion_status.get("status") == "running":
        return {"status": "already_running", "message": "Wait for current ingestion to complete."}

    clear_collection()
    background_tasks.add_task(run_ingestion_pipeline)
    return {"status": "started", "message": "Collection cleared. Full re-ingestion started."}


# ── Stats ─────────────────────────────────────────────────────────────────────
@app.get("/api/stats")
async def stats():
    from vector_store import get_stats
    from ingestion import ingestion_status
    import query_logger

    vs_stats  = get_stats()
    chart_data = query_logger.get_chart_data()

    return {
        "indexed_files":   vs_stats.get("indexed_files", 0),
        "total_chunks":    vs_stats.get("total_chunks", 0),
        "last_indexed":    vs_stats.get("last_indexed"),
        "pipeline_status": ingestion_status.get("status", "idle"),
        "files_processed": ingestion_status.get("files_processed", 0),
        "total_queries":   chart_data.get("total_queries", 0),
        "llm_model":       os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-sonnet-20240229-v1:0"),
    }

# ── Charts ────────────────────────────────────────────────────────────────────
@app.get("/api/stats/charts")
async def stats_charts():
    import query_logger
    return query_logger.get_chart_data()

# ── Health Env ────────────────────────────────────────────────────────────────
@app.get("/api/health/env")
async def health_env():
    return {
        "box_auth":       bool(os.getenv("BOX_DEVELOPER_TOKEN")),
        "box_folder":     os.getenv("BOX_ROOT_FOLDER_ID"),
        "bedrock_auth":   bool(os.getenv("AWS_ACCESS_KEY_ID")),
        "bedrock_model":  os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-sonnet-20240229-v1:0"),
        "aws_region":     os.getenv("AWS_REGION", "us-east-1"),
        "whisper":        os.getenv("WHISPER_MODEL", "base"),
        "chroma":         os.getenv("CHROMA_DB_PATH", "./chroma_db"),
    }


# ── Folders ───────────────────────────────────────────────────────────────────
@app.get("/api/folders")
async def get_folders():
    import asyncio
    from box_client import get_folder_structure

    try:
        folders = await asyncio.to_thread(get_folder_structure)
        return {"folders": folders}
    except Exception as exc:
        logger.warning("Could not fetch folder structure: %s", exc)
        return {"folders": [], "error": str(exc)}


# ── Logs ──────────────────────────────────────────────────────────────────────
@app.get("/api/logs")
async def get_logs():
    from ingestion import ingestion_logs
    return {"logs": ingestion_logs[-100:]}  # Latest 100 entries

# ── History ───────────────────────────────────────────────────────────────────
@app.get("/api/history/queries")
async def get_query_history():
    import query_logger
    # Format the id correctly
    history = query_logger.get_recent_queries(50)
    # The frontend expects a specific structure for QueryHistoryPanel
    formatted = []
    for h in history:
        # Time ago string is expected by frontend, but we can pass isoformat and let frontend deal, 
        # or just pass timestamp mapping to 'time' string.
        # Frontend QueryHistoryPanel expects:
        # { id, query, mode, score, sources, result, time }
        from datetime import datetime
        dt = datetime.fromisoformat(h["timestamp"])
        delta = datetime.now() - dt
        minutes = int(delta.total_seconds() / 60)
        time_str = f"{minutes}m ago" if minutes < 60 else f"{minutes // 60}h ago"
        if minutes == 0:
            time_str = "just now"
            
        formatted.append({
            "id": h["id"],
            "query": h["query"],
            "mode": h["mode"],
            "score": h["score"],
            "sources": h["sources"],
            "result": h["result"],
            "time": time_str,
            "title": h["query"],  # for the sidebar which uses title
        })
    return {"history": formatted}
