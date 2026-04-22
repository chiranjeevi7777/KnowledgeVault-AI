"""
rag_agent.py
────────────
RAG query engine using Amazon Bedrock (Claude) + local sentence-transformer embeddings.

Pipeline:
  1. Embed user query  (sentence-transformers, local)
  2. Search ChromaDB for top-k relevant chunks
  3. Build a grounded prompt with retrieved context
  4. Generate answer via Amazon Bedrock (Claude)
  5. Return answer + source citations
"""

import os
import json
import asyncio
import logging
import boto3
from botocore.exceptions import BotoCoreError, ClientError
from dotenv import load_dotenv

from embedder import get_embedding
from vector_store import search_similar

load_dotenv()
logger = logging.getLogger(__name__)

# ── Amazon Bedrock configuration ───────────────────────────────────────────────
AWS_REGION        = os.getenv("AWS_REGION", "us-east-1")
BEDROCK_MODEL_ID  = os.getenv("BEDROCK_MODEL_ID", "anthropic.claude-3-sonnet-20240229-v1:0")
TOP_K             = 10

# Lazy-initialised Bedrock client (created once, reused across requests)
_bedrock_client = None


def _get_bedrock_client():
    """Return a cached boto3 bedrock-runtime client."""
    global _bedrock_client
    if _bedrock_client is None:
        _bedrock_client = boto3.client(
            service_name="bedrock-runtime",
            region_name=AWS_REGION,
            aws_access_key_id=os.getenv("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("AWS_SECRET_ACCESS_KEY"),
            aws_session_token=os.getenv("AWS_SESSION_TOKEN"),  # optional – for temp creds
        )
    return _bedrock_client


SYSTEM_PROMPT = (
    "You are a knowledgeable AI assistant that answers questions based on content "
    "retrieved from Box files (transcripts, documents, and media).\n\n"
    "Guidelines:\n"
    "- Base your answer ONLY on the provided context. Do not invent information.\n"
    "- If the context is insufficient, say: \"I couldn't find enough information in "
    "the indexed Box files to answer this question accurately.\"\n"
    "- Be concise, clear, and professional.\n"
    "- At the end of your answer, mention which source file(s) you used."
)


def _build_prompt(query: str, chunks: list[dict]) -> str:
    parts = []
    for i, chunk in enumerate(chunks, 1):
        fname = chunk["metadata"].get("file_name", "unknown")
        fpath = chunk["metadata"].get("folder_path", "")
        score = chunk.get("score", 0)
        parts.append(
            f"[Context {i} | File: {fname} | Path: {fpath} | Relevance: {score:.0%}]\n"
            f"{chunk['text']}"
        )
    context_block = "\n\n---\n\n".join(parts)
    return (
        f"Context from Box files:\n\n{context_block}\n\n"
        f"---\n\nUser Question: {query}\n\nAnswer:"
    )


def _call_bedrock(messages: list[dict]) -> str:
    """
    Synchronous Bedrock invocation using the Anthropic Claude Messages API format.
    Wrapped in asyncio.to_thread for non-blocking async usage.
    """
    client = _get_bedrock_client()

    # Separate system message from user messages (Claude on Bedrock requires this)
    system_content = ""
    user_messages = []
    for msg in messages:
        if msg["role"] == "system":
            system_content = msg["content"]
        else:
            user_messages.append({"role": msg["role"], "content": msg["content"]})

    payload = {
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": 1024,
        "temperature": 0.2,
        "messages": user_messages,
    }
    if system_content:
        payload["system"] = system_content

    try:
        response = client.invoke_model(
            modelId=BEDROCK_MODEL_ID,
            body=json.dumps(payload),
            accept="application/json",
            contentType="application/json",
        )
        response_body = json.loads(response["body"].read())
        return response_body["content"][0]["text"].strip()

    except (BotoCoreError, ClientError) as e:
        logger.error("Amazon Bedrock invocation failed: %s", e)
        raise RuntimeError(f"Bedrock call failed: {e}") from e


async def get_answer(query: str) -> dict:
    """
    Run the full RAG pipeline for a user query.

    Returns:
        {
            "answer":      str,
            "sources":     list[{file, path, box_file_id, score}],
            "chunks_used": int,
        }
    """
    # 0. Dynamic Box Search and Ingestion
    logger.info("Dynamically searching Box for files matching query: %s", query[:80])
    from box_client import search_box
    from ingestion import ingest_dynamically

    # Search Box for the user's query and ingest any new relevant files found.
    found_files = await asyncio.to_thread(search_box, query, 5)
    if found_files:
        await ingest_dynamically(found_files)

    # 1. Embed query
    logger.info("Embedding query: %s", query[:80])
    query_embedding = await get_embedding(query)

    # 2. Search ChromaDB broadly to prevent a large file from dominating
    raw_results = search_similar(query_embedding, top_k=50)

    if not raw_results:
        return {
            "answer": (
                "I couldn't find any relevant information in the indexed Box files. "
                "Please run the ingestion pipeline first to index your Box content."
            ),
            "sources":     [],
            "chunks_used": 0,
        }

    # Diverse chunk selection: max 3 chunks per file, up to TOP_K chunks total
    seen_files: dict[str, int] = {}
    results = []
    for r in raw_results:
        fname = r["metadata"].get("file_name", "")
        seen_files[fname] = seen_files.get(fname, 0) + 1

        if seen_files[fname] <= 3:
            results.append(r)

        if len(results) >= TOP_K:
            break

    # 3. Build messages for Bedrock
    user_prompt = _build_prompt(query, results)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",   "content": user_prompt},
    ]

    # 4. Call Amazon Bedrock (async-wrapped)
    logger.info(
        "Calling Amazon Bedrock model '%s' with %d diverse chunks…",
        BEDROCK_MODEL_ID, len(results)
    )
    answer = await asyncio.to_thread(_call_bedrock, messages)

    # 5. Deduplicate sources
    seen, sources = set(), []
    for r in results:
        fname = r["metadata"].get("file_name", "")
        if fname not in seen:
            seen.add(fname)
            sources.append({
                "file":        fname,
                "path":        r["metadata"].get("folder_path", ""),
                "box_file_id": r["metadata"].get("box_file_id", ""),
                "score":       r["score"],
            })

    logger.info(
        "Answer generated via Amazon Bedrock. Sources: %s",
        [s["file"] for s in sources]
    )

    return {
        "answer":      answer,
        "sources":     sources,
        "chunks_used": len(results),
    }
