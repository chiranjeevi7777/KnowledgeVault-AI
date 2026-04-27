import os
import asyncio
import logging
from pathlib import Path
from datetime import datetime

from box_client import get_all_files, download_file
from embedder import get_embedding
from vector_store import add_chunks
from metadata import get_meta, upsert_meta
from whisper_transcribe import transcribe
from ingestion import ingestion_status, ingestion_logs, _log, process_single_file, get_embeddings_batch

logger = logging.getLogger(__name__)

# Directory for temporary downloads (cleaned after transcription)
DOWNLOAD_DIR = Path(os.getenv("DOWNLOAD_DIR", "./downloads"))
DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Semaphore to limit concurrent transcriptions (user requested one-at-a-time)
MAX_CONCURRENCY = 1
semaphore = asyncio.Semaphore(MAX_CONCURRENCY)

async def _process_file(file_meta: dict) -> None:
    file_id = file_meta["id"]
    name = file_meta["name"]
    existing = get_meta(file_id)
    last_modified = file_meta.get("modified_at") or datetime.utcnow().isoformat()
    
    if existing and existing["last_modified"] >= last_modified:
        _log("INFO", f"Skipping {name} (already indexed and unchanged).")
        ingestion_status["files_processed"] += 1
        return

    _log("INFO", f"Processing {name} ({file_meta.get('type_group', 'file')})…")
    
    # Use the robust parsing from ingestion.py
    chunks = await process_single_file(file_meta)
    
    if chunks:
        # Embed in batch for many chunks
        texts = [c["text"] for c in chunks]
        embeddings = await get_embeddings_batch(texts)
        
        for chunk, emb in zip(chunks, embeddings):
            chunk["embedding"] = emb
            
        add_chunks(chunks)
        _log("INFO", f"✅ Indexed {len(chunks)} chunks for {name}")
        upsert_meta(file_id, name, last_modified, file_meta.get("extension", ""))
        ingestion_status["total_chunks"] += len(chunks)
    else:
        _log("WARNING", f"No content extracted from {name}") 

    ingestion_status["files_processed"] += 1


async def trigger_dynamic_ingestion() -> None:
    """Entry point called after user login or dashboard entry."""
    if ingestion_status["status"] == "running":
        logger.debug("Dynamic sync already in progress, skipping trigger.")
        return

    _log("INFO", "🚀 Initializing Ellucian Agent dynamic record sweep...")
    ingestion_status["status"] = "running"
    ingestion_status["started_at"] = datetime.now().isoformat()
    ingestion_status["files_processed"] = 0
    
    try:
        files = await asyncio.to_thread(get_all_files)
        if not files:
            _log("INFO", "Records catalog is empty or unreachable.")
            ingestion_status["status"] = "idle"
            return

        ingestion_status["total_files"] = len(files)
        _log("INFO", f"Discovered {len(files)} files in Box record tree. Starting sync...")
        
        async def _throttle_process(f):
            async with semaphore:
                await _process_file(f)

        tasks = [_throttle_process(f) for f in files]
        await asyncio.gather(*tasks)
        
        _log("INFO", "🎉 Dynamic record sweep completed successfully.")
        ingestion_status["status"] = "completed"
        ingestion_status["completed_at"] = datetime.now().isoformat()
    except Exception as e:
        _log("ERROR", f"Dynamic sweep failed: {e}")
        ingestion_status["status"] = "error"
        ingestion_status["error"] = str(e)
