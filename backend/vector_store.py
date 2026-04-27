"""
vector_store.py
───────────────
ChromaDB local persistent vector store.
Handles storing, searching, and managing transcript chunk embeddings.
"""

import os
import logging
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

CHROMA_DB_PATH   = os.getenv("CHROMA_DB_PATH", "./chroma_db")
COLLECTION_NAME  = os.getenv("CHROMA_COLLECTION", "box_agent_transcripts")


@lru_cache(maxsize=1)
def _get_client():
    import chromadb
    return chromadb.PersistentClient(path=CHROMA_DB_PATH)


def _get_collection():
    client = _get_client()
    return client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


def add_chunks(chunks: list[dict]) -> None:
    """
    Insert a list of chunks into ChromaDB.

    Each chunk dict must have:
        id        : str — unique identifier
        text      : str — raw text content
        embedding : list[float] — precomputed embedding
        metadata  : dict — e.g. {box_file_id, file_name, folder_path, chunk_id, timestamp}
    """
    collection = _get_collection()
    collection.add(
        ids        = [c["id"]        for c in chunks],
        embeddings = [c["embedding"] for c in chunks],
        documents  = [c["text"]      for c in chunks],
        metadatas  = [c["metadata"]  for c in chunks],
    )
    logger.info("Stored %d chunks in ChromaDB collection '%s'", len(chunks), COLLECTION_NAME)


def search_similar(
    query_embedding: list[float],
    top_k: int = 5,
) -> list[dict]:
    """
    Return the top-k most similar chunks to the query embedding.

    Returns list of:
        {text, metadata, score}   where score ∈ [0,1], 1 = perfect match
    """
    collection = _get_collection()
    count      = collection.count()
    if count == 0:
        return []

    n = min(top_k, count)
    results = collection.query(
        query_embeddings = [query_embedding],
        n_results        = n,
        include          = ["documents", "metadatas", "distances", "embeddings"],
    )

    output = []
    docs      = results["documents"][0]
    metas     = results["metadatas"][0]
    distances = results["distances"][0]
    embs      = results["embeddings"][0]

    for doc, meta, dist, emb in zip(docs, metas, distances, embs):
        output.append({
            "text":      doc,
            "metadata":  meta,
            "score":     round(1.0 - dist, 4),  # cosine distance → similarity
            "embedding": emb,
        })

    return output


def clear_collection() -> None:
    """Delete and recreate the collection for a fresh re-index."""
    client = _get_client()
    try:
        client.delete_collection(name=COLLECTION_NAME)
        logger.info("Cleared collection '%s'", COLLECTION_NAME)
    except Exception:
        pass  # Didn't exist yet
    # Recreate via _get_collection
    _get_collection()


def get_all_indexed_file_ids() -> set[str]:
    """Return a set of all unique box_file_ids currently indexed in ChromaDB."""
    try:
        collection = _get_collection()
        count = collection.count()
        if count == 0:
            return set()
        
        # Read metadata for chunks
        data = collection.get(include=["metadatas"])
        metas = data.get("metadatas", [])
        return {m.get("box_file_id") for m in metas if m and m.get("box_file_id")}
    except Exception as exc:
        logger.error("Could not fetch indexed file IDs: %s", exc)
        return set()


def get_stats() -> dict:
    """Return basic stats about the vector store."""
    try:
        collection = _get_collection()
        count = collection.count()

        # Get unique file names from metadata (sample up to 1000)
        if count > 0:
            sample = collection.get(limit=min(count, 1000), include=["metadatas"])
            metas  = sample.get("metadatas", [])
            unique_files = len({m.get("file_name", "") for m in metas if m})
            last_ts = max(
                (m.get("timestamp", "") for m in metas if m and m.get("timestamp")),
                default=None,
            )
        else:
            unique_files = 0
            last_ts      = None

        return {
            "total_chunks":   count,
            "indexed_files":  unique_files,
            "collection":     COLLECTION_NAME,
            "db_path":        CHROMA_DB_PATH,
            "last_indexed":   last_ts,
        }
    except Exception as exc:
        logger.error("Stats error: %s", exc)
        return {"total_chunks": 0, "indexed_files": 0, "error": str(exc)}
