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
from pathlib import Path
import logging
import boto3
from botocore.exceptions import BotoCoreError, ClientError
from dotenv import load_dotenv

from embedder import get_embedding
from vector_store import search_similar

load_dotenv(override=True)
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
        access_key = os.getenv("AWS_ACCESS_KEY_ID")
        secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
        session_token = os.getenv("AWS_SESSION_TOKEN")
        api_key = os.getenv("AWS_API_KEY")
        endpoint_url = os.getenv("AWS_BEDROCK_ENDPOINT")

        client_kwargs = {
            "service_name": "bedrock-runtime",
            "region_name": AWS_REGION,
            "aws_access_key_id": access_key,
            "aws_secret_access_key": secret_key,
        }
        
        if endpoint_url:
            client_kwargs["endpoint_url"] = endpoint_url
        
        # Session token is ONLY for temporary credentials (keys starting with ASIA)
        if access_key and access_key.startswith("ASIA") and session_token:
            client_kwargs["aws_session_token"] = session_token

        _bedrock_client = boto3.client(**client_kwargs)

        # If an API Key is provided, we inject it via a botocore event handler
        # This is common for Bedrock proxies/gateways that require an x-api-key header.
        if api_key:
            def add_api_key(request, **kwargs):
                request.headers.add_header('x-api-key', api_key)
            
            _bedrock_client.meta.events.register('request-created.bedrock-runtime', add_api_key)

    return _bedrock_client


import numpy as np

SYSTEM_PROMPT = (
    "You are the Ellucian Agent, a state-of-the-art AI assistant for collegiate data analysis.\n\n"
    "CRITICAL GUIDELINES:\n"
    "1. TRANSCRIPTION AWARENESS: You will often see context from files ending in .mp4, .mp3, etc. "
    "These are TRANSCRIPTIONS of the original media. Treat this text as the absolute ground truth of what was said or shown in those recordings.\n"
    "2. NO REJECTION: Do NOT tell the user you cannot 'process' or 'watch' video/audio files. You have been provided with their text transcriptions—use them to answer the query.\n"
    "3. ABSOLUTE GROUNDING: Answer ONLY based on the provided context. If unsure, state that the current records do not contain the answer.\n"
    "4. CITATION: Cite sources as [Source: <file_name>].\n"
    "5. TONE: Maintain a professional, elite, and helpful persona consistent with the Ellucian brand."
)


def _cosine_similarity(vec1, vec2):
    """Compute cosine similarity between two vectors."""
    v1 = np.array(vec1)
    v2 = np.array(vec2)
    dot = np.dot(v1, v2)
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    if norm1 == 0 or norm2 == 0:
        return 0.0
    return dot / (norm1 * norm2)


def maximal_marginal_relevance(query_emb, candidates, lambda_param=0.5, k=10):
    """
    Select diverse chunks using MMR algorithm.
    candidates: list of {text, metadata, score, embedding}
    """
    if not candidates:
        return []
    
    selected = []
    unselected = candidates[:]
    
    # Start with the most relevant chunk
    first_choice = max(unselected, key=lambda x: x["score"])
    selected.append(first_choice)
    unselected.remove(first_choice)
    
    while len(selected) < k and unselected:
        best_score = -float('inf')
        best_candidate = None
        
        for cand in unselected:
            # Relevance score (already cosine similarity from Chroma)
            relevance = cand["score"]
            
            # Diversity score: max similarity with already selected chunks
            redundancy = max([_cosine_similarity(cand["embedding"], s["embedding"]) for s in selected])
            
            # MMR Score
            mmr_score = lambda_param * relevance - (1 - lambda_param) * redundancy
            
            if mmr_score > best_score:
                best_score = mmr_score
                best_candidate = cand
        
        if best_candidate:
            selected.append(best_candidate)
            unselected.remove(best_candidate)
        else:
            break
            
    return selected


async def get_answer(query: str) -> dict:
    """
    Run the full RAG pipeline with MMR diversity re-ranking.
    """
    # 1. Embed query (No longer doing dynamic sync on every request for speed)
    query_embedding = await get_embedding(query)

    # 2. Search ChromaDB broadly
    raw_results = search_similar(query_embedding, top_k=50)

    if not raw_results:
        return {
            "answer": "I couldn't find any relevant information in the records catalog.",
            "sources": [],
            "chunks_used": 0,
        }

    # 3. Apply MMR for diversity (lambda=0.5 balances relevance and variety)
    results = maximal_marginal_relevance(query_embedding, raw_results, lambda_param=0.5, k=TOP_K)

    # 4. Build and Call LLM
    user_prompt = _build_prompt(query, results)
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user",   "content": user_prompt},
    ]

    logger.info("Calling Ellucian Agent (Bedrock) with %d MMR-selected chunks", len(results))
    answer = await asyncio.to_thread(_call_bedrock, messages)

    # 5. Format sources
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

    return {
        "answer":      answer,
        "sources":     sources,
        "chunks_used": len(results),
    }


def _build_prompt(query: str, chunks: list[dict]) -> str:
    """Build the final RAG prompt with retrieved context blocks."""
    parts = []
    for i, chunk in enumerate(chunks, 1):
        fname = chunk["metadata"].get("file_name", "unknown")
        # Identify if this is likely a transcription
        ext = Path(fname).suffix.lower()
        content_type = "Document Text"
        if ext in ('.mp4', '.mov', '.avi'): content_type = "Video Transcription"
        elif ext in ('.mp3', '.m4a', '.wav'): content_type = "Audio Transcription"

        parts.append(
            f"[RECORD {i} | Source: {fname} | Type: {content_type}]\n"
            f"{chunk['text']}"
        )
    context_block = "\n\n---\n\n".join(parts)
    return (
        f"Retrieved Records from Ellucian Box Metadata:\n\n{context_block}\n\n"
        f"--- USER QUESTION ---\n{query}\n\n"
        "Please provide a comprehensive answer based on the records above:"
    )


def _call_bedrock(messages: list[dict]) -> str:
    """
    Call Amazon Bedrock (Claude) using the Messages API.
    """
    client = _get_bedrock_client()

    # Separate system message from user messages
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

    except Exception as e:
        logger.error("Bedrock call failed: %s", e)
        raise RuntimeError(f"Amazon Bedrock error: {e}")
