"""
ingestion.py
────────────
Full data ingestion pipeline: Box → Transcription → Chunking → Embedding → ChromaDB.

Designed to run as a FastAPI background task; exposes:
    ingestion_status  — live progress dict polled by the frontend
    ingestion_logs    — ring buffer of log messages for the Logs panel
    run_ingestion_pipeline()  — the async orchestrator
"""

import os
import re
import asyncio
import tempfile
import logging
from datetime import datetime
from pathlib import Path

from box_client import (
    get_all_files,
    download_file,
    TRANSCRIPT_EXTENSIONS,
    AUDIO_EXTENSIONS,
    VIDEO_EXTENSIONS,
)
from transcriber import transcribe_audio
from embedder import get_embeddings_batch
from vector_store import add_chunks, get_all_indexed_file_ids

logger = logging.getLogger(__name__)

CHUNK_SIZE    = int(os.getenv("CHUNK_SIZE",    2000))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP",  200))
MAX_LOG_LINES = 200

# ── Shared state (polled by /api/ingest/status and /api/logs) ─────────────────
ingestion_status: dict = {
    "status":          "idle",   # idle | running | completed | error
    "progress":        0,
    "message":         "Pipeline has not run yet.",
    "files_processed": 0,
    "total_files":     0,
    "total_chunks":    0,
    "started_at":      None,
    "completed_at":    None,
    "error":           None,
}

ingestion_logs: list[dict] = []


# ── Internal helpers ──────────────────────────────────────────────────────────

def _log(level: str, msg: str) -> None:
    """Append to the in-memory log ring buffer and Python logger."""
    entry = {
        "time":  datetime.now().strftime("%H:%M:%S"),
        "level": level,
        "msg":   msg,
    }
    ingestion_logs.append(entry)
    if len(ingestion_logs) > MAX_LOG_LINES:
        ingestion_logs.pop(0)

    getattr(logger, level.lower(), logger.info)(msg)


def _chunk_text(text: str) -> list[str]:
    """
    Split text into overlapping character-based chunks.
    ~2000 chars ≈ 500 tokens; 200-char overlap preserves context at boundaries.
    """
    chunks, start = [], 0
    while start < len(text):
        end   = start + CHUNK_SIZE
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start = end - CHUNK_OVERLAP
    return chunks


def _clean_subtitles(text: str) -> str:
    """Strip VTT/SRT timing markers and sequence numbers."""
    text = re.sub(r"WEBVTT.*?\n\n", "", text, flags=re.DOTALL)
    text = re.sub(r"\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[.,]\d{3}", "", text)
    text = re.sub(r"^\d+\s*$", "", text, flags=re.MULTILINE)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _extract_json_transcript(raw: str) -> str:
    """
    Best-effort extraction of text from JSON transcript files.
    Handles common formats: {text}, [{text}], [{transcript}], etc.
    Falls back to the raw string if parsing fails.
    """
    import json
    try:
        data = json.loads(raw)
        if isinstance(data, str):
            return data
        if isinstance(data, dict) and "text" in data:
            return data["text"]
        if isinstance(data, list):
            parts = []
            for item in data:
                if isinstance(item, dict):
                    parts.append(
                        item.get("text", "")
                        or item.get("transcript", "")
                        or item.get("content", "")
                    )
                elif isinstance(item, str):
                    parts.append(item)
            return "\n".join(p for p in parts if p).strip()
    except Exception:
        pass
    return raw  # Return raw if all parsing fails


# ── Main pipeline ─────────────────────────────────────────────────────────────

async def process_single_file(file_info: dict) -> list[dict]:
    """Process a single file (download, transcribe/parse, chunk). Returns list of chunks before embedding."""
    name      = file_info["name"]
    file_id   = file_info["id"]
    ext       = file_info["extension"]
    grp       = file_info["type_group"]
    fpath     = file_info.get("path", "/")

    _log("INFO", f"Processing single file: {name} ({grp})")
    all_chunks = []
    text = ""
    
    try:
        if grp == "transcript":
            raw_bytes = await asyncio.to_thread(download_file, file_id)
            if ext == ".pdf":
                import io
                from PyPDF2 import PdfReader
                reader = PdfReader(io.BytesIO(raw_bytes))
                text = "\n".join([page.extract_text() for page in reader.pages if page.extract_text()])
            elif ext == ".docx":
                import io
                from docx import Document
                doc = Document(io.BytesIO(raw_bytes))
                text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
            else:
                raw_text  = raw_bytes.decode("utf-8", errors="replace")
                if ext in (".vtt", ".srt"):
                    text = _clean_subtitles(raw_text)
                elif ext == ".json":
                    text = _extract_json_transcript(raw_text)
                else:
                    text = raw_text

        elif grp in ("audio", "video"):
            raw_bytes = await asyncio.to_thread(download_file, file_id)

            with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
                tmp.write(raw_bytes)
                tmp_path = tmp.name

            try:
                _log("INFO", f"🎙 Running Whisper transcription on: {name} (this may take a while)…")
                ingestion_status["message"] = f"Transcribing {name} with Whisper…"
                try:
                    text = await asyncio.to_thread(transcribe_audio, tmp_path)
                except Exception as whisper_exc:
                    err_str = str(whisper_exc)
                    if "ffmpeg" in err_str.lower() or "no such file" in err_str.lower():
                        _log("ERROR", (
                            f"Whisper failed for {name}: ffmpeg is not installed or not on PATH. "
                            "Install it from https://ffmpeg.org/download.html and add it to your system PATH."
                        ))
                    else:
                        _log("ERROR", f"Whisper transcription failed for {name}: {whisper_exc}")
                    text = ""

                # Upload transcript back to Box if we got useful text
                if text.strip():
                    _log("INFO", f"Transcription complete for {name}: {len(text)} chars.")
                    from box_client import upload_file
                    transcript_name = f"{Path(name).stem}.txt"
                    folder_id = os.getenv("BOX_ROOT_FOLDER_ID", "0")
                    await asyncio.to_thread(upload_file, folder_id, transcript_name, text.encode("utf-8"))
                    _log("INFO", f"Uploaded transcript {transcript_name} to Box.")
            finally:
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass

        if not text.strip():
            _log("WARN", f"Empty content — skipping: {name}")
            return []

        # Chunk
        chunks = _chunk_text(text)
        for i, chunk_text in enumerate(chunks):
            # Include filename in the actual searchable text for better retrieval
            searchable_text = f"File: {name}\nContent: {chunk_text}"
            all_chunks.append({
                "id":       f"{file_id}_c{i}",
                "text":     searchable_text,
                "metadata": {
                    "box_file_id": file_id,
                    "file_name":   name,
                    "folder_path": fpath,
                    "chunk_id":    i,
                    "timestamp":   datetime.now().isoformat(),
                },
            })
    except Exception as exc:
        _log("ERROR", f"Failed to process {name}: {exc}")
        
    return all_chunks


async def ingest_dynamically(files: list[dict]) -> None:
    """
    On-the-fly ingestion for an array of file metadata.
    Filters by already-indexed files, processes them, embeds, and stores in ChromaDB.
    """
    if not files:
        return

    existing_ids = await asyncio.to_thread(get_all_indexed_file_ids)
    files_to_process = [f for f in files if f["id"] not in existing_ids]

    if not files_to_process:
        _log("INFO", "Dynamic ingestion: all files are already indexed.")
        return

    _log("INFO", f"Dynamic ingestion: processing {len(files_to_process)} new file(s)…")
    
    all_chunks = []
    for f in files_to_process:
        chunks = await process_single_file(f)
        all_chunks.extend(chunks)

    if not all_chunks:
        return

    texts = [c["text"] for c in all_chunks]
    embeddings = await get_embeddings_batch(texts, task_type="retrieval_document")

    for chunk, emb in zip(all_chunks, embeddings):
        chunk["embedding"] = emb

    await asyncio.to_thread(add_chunks, all_chunks)
    _log("INFO", f"Dynamic ingestion: indexed {len(all_chunks)} chunks for {len(files_to_process)} file(s).")

async def run_ingestion_pipeline() -> None:
    """
    Full ingestion pipeline run as a FastAPI background task.
    Updates ingestion_status and ingestion_logs throughout.
    """
    global ingestion_status, ingestion_logs

    ingestion_logs.clear()
    ingestion_status.update({
        "status":          "running",
        "progress":        0,
        "message":         "Connecting to Box…",
        "files_processed": 0,
        "total_files":     0,
        "total_chunks":    0,
        "started_at":      datetime.now().isoformat(),
        "completed_at":    None,
        "error":           None,
    })

    try:
        # ── 1. Fetch file list from Box ────────────────────────────────────────
        _log("INFO", "Fetching file list from Box…")
        files = await asyncio.to_thread(get_all_files)

        if not files:
            _log("WARN", "No supported files found in the Box folder.")
            ingestion_status.update({
                "status":       "completed",
                "progress":     100,
                "message":      "No supported files found. Check BOX_ROOT_FOLDER_ID.",
                "completed_at": datetime.now().isoformat(),
            })
            return

        # De-duplicate: if a transcript already exists for a given base name,
        # skip the corresponding audio/video file.
        transcript_bases = {
            Path(f["name"]).stem.lower()
            for f in files
            if f["type_group"] == "transcript"
        }
        deduplicated = []
        for f in files:
            if f["type_group"] in ("audio", "video"):
                stem = Path(f["name"]).stem.lower()
                if stem in transcript_bases:
                    _log("INFO", f"Skipping {f['name']} — transcript already exists.")
                    continue
            deduplicated.append(f)

        ingestion_status["total_files"] = len(deduplicated)
        _log("INFO", f"Will process {len(deduplicated)} file(s).")

        # ── 2. Filter out already-indexed files ────────────────────────────────
        _log("INFO", "Checking ChromaDB for existing files…")
        existing_ids = await asyncio.to_thread(get_all_indexed_file_ids)
        
        files_to_process = []
        for f in deduplicated:
            if f["id"] in existing_ids:
                _log("INFO", f"Skipping {f['name']} — already embedded in vector DB.")
            else:
                files_to_process.append(f)
                
        if not files_to_process:
            _log("INFO", "All found files are already indexed. Nothing new to process.")
            ingestion_status.update({
                "status":       "completed",
                "progress":     100,
                "message":      "All files are already up-to-date in the index.",
                "completed_at": datetime.now().isoformat(),
            })
            return

        # ── 3. Process each new file ───────────────────────────────────────────
        all_chunks: list[dict] = []

        for idx, file_info in enumerate(files_to_process):
            name      = file_info["name"]
            file_id   = file_info["id"]
            ext       = file_info["extension"]
            grp       = file_info["type_group"]
            # Process using the extracted function
            file_chunks = await process_single_file(file_info)
            if file_chunks:
                all_chunks.extend(file_chunks)
            ingestion_status["files_processed"] = idx + 1

        if not all_chunks:
            _log("WARN", "No chunks generated. Nothing to store.")
            ingestion_status.update({
                "status":       "completed",
                "progress":     100,
                "message":      "Processing complete but no text content found.",
                "completed_at": datetime.now().isoformat(),
            })
            return

        # ── 4. Embed ───────────────────────────────────────────────────────────
        _log("INFO", f"Generating Gemini embeddings for {len(all_chunks)} chunk(s)…")
        ingestion_status["message"]  = "Generating embeddings…"
        ingestion_status["progress"] = 75

        texts      = [c["text"] for c in all_chunks]
        embeddings = await get_embeddings_batch(texts, task_type="retrieval_document")

        for chunk, emb in zip(all_chunks, embeddings):
            chunk["embedding"] = emb

        _log("INFO", "Embeddings generated.")

        # ── 5. Store in ChromaDB ───────────────────────────────────────────────
        _log("INFO", f"Storing {len(all_chunks)} chunk(s) in ChromaDB…")
        ingestion_status["message"]  = "Storing in ChromaDB…"
        ingestion_status["progress"] = 92

        await asyncio.to_thread(add_chunks, all_chunks)

        # ── Done ───────────────────────────────────────────────────────────────
        ingestion_status.update({
            "status":          "completed",
            "progress":        100,
            "message":         f"Done! Indexed {ingestion_status['files_processed']} file(s) → {len(all_chunks)} chunk(s).",
            "total_chunks":    len(all_chunks),
            "completed_at":    datetime.now().isoformat(),
        })
        _log("INFO", ingestion_status["message"])

    except Exception as exc:
        err = str(exc)
        ingestion_status.update({
            "status":       "error",
            "message":      f"Pipeline failed: {err}",
            "error":        err,
            "completed_at": datetime.now().isoformat(),
        })
        _log("ERROR", f"Pipeline failed: {err}")
