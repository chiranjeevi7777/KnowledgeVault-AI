"""
embedder.py
───────────
Local sentence-transformers embeddings — no API key required.
Uses 'all-MiniLM-L6-v2' by default (384-dim, fast, runs on CPU).

Why local embeddings?
  Amazon Bedrock (Claude) handles LLM inference but we use local embeddings
  for speed, privacy, and zero cost. sentence-transformers runs fully
  on-machine — free, private, no rate limits.
"""

import os
import asyncio
import logging
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

EMBED_MODEL_NAME = os.getenv("EMBED_MODEL", "all-MiniLM-L6-v2")


@lru_cache(maxsize=1)
def _load_model():
    """Load the SentenceTransformer model once and cache it in memory."""
    from sentence_transformers import SentenceTransformer
    logger.info("Loading embedding model '%s'…", EMBED_MODEL_NAME)
    model = SentenceTransformer(EMBED_MODEL_NAME)
    logger.info("Embedding model loaded. Dimension: %d", model.get_sentence_embedding_dimension())
    return model


def _embed_sync(text: str) -> list[float]:
    """Synchronous embed call (wrapped in asyncio.to_thread for async use)."""
    model = _load_model()
    embedding = model.encode(text, normalize_embeddings=True)
    return embedding.tolist()


def _embed_batch_sync(texts: list[str]) -> list[list[float]]:
    """Batch embed — much faster than calling encode() one-by-one."""
    model = _load_model()
    embeddings = model.encode(texts, normalize_embeddings=True, batch_size=32, show_progress_bar=False)
    return [e.tolist() for e in embeddings]


async def get_embedding(text: str, **_kwargs) -> list[float]:
    """
    Generate a single embedding asynchronously.
    Extra kwargs (e.g. task_type) are accepted but ignored for API compatibility.
    """
    return await asyncio.to_thread(_embed_sync, text)


async def get_embeddings_batch(
    texts: list[str],
    batch_size: int = 64,
    **_kwargs,
) -> list[list[float]]:
    """
    Embed a list of texts using the local model.
    sentence-transformers handles batching internally; batch_size is passed through.
    """
    logger.info("Batch-embedding %d texts with model '%s'…", len(texts), EMBED_MODEL_NAME)
    result = await asyncio.to_thread(_embed_batch_sync, texts)
    logger.info("Batch embedding complete.")
    return result
