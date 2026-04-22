import asyncio
from vector_store import search_similar
from embedder import get_embedding

async def main():
    query = "what is meeting1.txt about?"
    emb = await get_embedding(query)
    raw_results = search_similar(emb, top_k=50)

    TOP_K = 10
    seen_files = {}
    results = []
    for r in raw_results:
        fname = r["metadata"].get("file_name", "")
        seen_files[fname] = seen_files.get(fname, 0) + 1
        if seen_files[fname] <= 3:
            results.append(r)
        if len(results) >= TOP_K:
            break

    print(f"Total raw results: {len(raw_results)}")
    print(f"Final selected results: {len(results)}")
    for i, r in enumerate(results):
        print(f"[{i}] File: {r['metadata'].get('file_name')} Chunk: {r['metadata'].get('chunk_id')}")

if __name__ == "__main__":
    asyncio.run(main())
