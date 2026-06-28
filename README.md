# Box Agent — End-to-End RAG Chatbot


An enterprise-grade Retrieval-Augmented Generation (RAG) platform that ingests content from Box, transcribes multimedia using Whisper, indexes documents with local embeddings and ChromaDB, and delivers context-aware answers through Amazon Bedrock Claude with source citations.

RAG pipeline: **Box** → **Whisper** (local) → **Amazon Bedrock Claude** → **ChromaDB** → **React Chat UI**

Embeddings run **fully locally** via `sentence-transformers` (no third-party embedding API needed).


## Quick Start

### 1. Prerequisites
- Python 3.10+
- Node.js 18+
- [ffmpeg](https://ffmpeg.org/download.html) installed and on PATH (required for Whisper audio)

### 2. Configure Environment

```bash
# Copy and fill in your credentials
cp backend/.env.example backend/.env
```

Edit `backend/.env`:
```
BOX_CLIENT_ID=your_client_id
BOX_CLIENT_SECRET=your_client_secret
BOX_DEVELOPER_TOKEN=your_developer_token  # Generate from Box Developer Console (valid 60 min)
BOX_ROOT_FOLDER_ID=0                      # "0" = root, or paste a specific folder ID
AWS_ACCESS_KEY_ID=your_access_key         # IAM user key or from `aws configure`
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_SESSION_TOKEN=your_session_token      # Only if using temporary STS credentials
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0  # Requires Bedrock model access
EMBED_MODEL=all-MiniLM-L6-v2             # local sentence-transformers model, no key needed
WHISPER_MODEL=base                       # tiny | base | small | medium
```

### 3. Install & Start Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend runs at: http://localhost:8000
API docs at:     http://localhost:8000/docs

### 4. Install & Start Frontend

```bash
# From the project root (d:\Box_agent)
npm install
npm run dev
```

Frontend runs at: http://localhost:3000

---

## Usage

### Step 1: Index Your Box Content
1. Open http://localhost:3000
2. Log in (any credentials work in this demo)
3. Switch to **Developer** mode (top-right toggle)
4. Click **"Run Ingestion Pipeline"** in the System Control panel
5. Watch progress in the Logs panel — it will fetch files, transcribe audio/video, embed chunks, and store in ChromaDB

### Step 2: Chat
1. Switch back to **User** mode
2. Type your question in the chat bar
3. Get answers with source file citations

---

## Architecture

```
Box API (OAuth2)
  └── box_client.py          # Recursive folder scan + download
        │
        ├── .txt / .vtt / .srt / .json  ──→  Read directly
        └── .mp3 / .mp4 / .wav / ...   ──→  transcriber.py (Whisper)
                                                    │
                                              ingestion.py
                                              (chunking + orchestration)
                                                    │
                                             embedder.py
                                          (sentence-transformers local)
                                                    │
                                           vector_store.py
                                           (ChromaDB local)
                                                    │
                                            rag_agent.py
                                      (Amazon Bedrock Claude + top-k search)
                                                    │
                                            FastAPI /api/chat
                                                    │
                                          React Frontend (ChatView)
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| POST | `/api/chat` | RAG query → answer + citations |
| POST | `/api/ingest` | Trigger ingestion pipeline |
| GET | `/api/ingest/status` | Live pipeline progress |
| GET | `/api/stats` | ChromaDB statistics |
| GET | `/api/folders` | Box folder tree |
| GET | `/api/logs` | Recent pipeline logs |

---

## Notes on Developer Tokens

Developer Tokens are short-lived access tokens valid for 60 minutes. They are ideal for quick development. For a production environment, you should transition to OAuth 2.0 with the standard authorization code grant to generate long-lived refresh tokens.

---

## Whisper Model Sizes

| Model | Size | Speed | Accuracy |
|-------|------|-------|----------|
| tiny  | 75MB | Very fast | Lower |
| base  | 145MB | Fast | Good |
| small | 460MB | Medium | Better |
| medium | 1.5GB | Slow | High |
