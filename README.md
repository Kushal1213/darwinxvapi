# Veyra

Veyra is a knowledge-grounded voice intelligence platform for customer conversations. It combines live voice interaction, retrieval-augmented answers, source citations, real-time conversation signals, and localized agents in one operational workspace.

## What Veyra Does

- Runs browser-based voice conversations with live transcription and spoken responses.
- Grounds answers in an indexed knowledge base and displays supporting citations.
- Detects conversation signals such as customer frustration, compliance risk, buying intent, and escalation requests.
- Streams transcripts and insights to a live mission-control view.
- Supports localized agents for India, the Philippines, and Indonesia.
- Provides knowledge, analytics, architecture, and service-health views for operators.

## Product Areas

| Area | Purpose |
|---|---|
| Dashboard | Operational overview and service status |
| Voice Studio | Live customer-agent conversations with RAG citations |
| Live Insights | Transcript monitoring, signal detection, and agent nudges |
| Knowledge Hub | Source-document discovery and grounding visibility |
| Analytics | Conversation and retrieval performance views |
| Architecture | Runtime topology and service relationships |

Veyra currently includes four market agents:

| Agent | Market | Language |
|---|---|---|
| Aria | India loans | English (`en-IN`) |
| Priya | India insurance | English (`en-IN`) |
| Maria | Philippines bancassurance | English/Taglish (`en-PH`) |
| Dewi | Indonesia consumer finance | Bahasa Indonesia (`id`) |

## Architecture

```text
Browser (React + Vite, :3000)
            |
            v
Express API Gateway + Socket.IO (:3001)
       |              |               |
       v              v               v
RAG Service      Ingestion       Realtime Insights
(FastAPI, :8001) (FastAPI, :8002) (FastAPI, :8003)
       |              |
       +------ Knowledge Base ------+
```

The frontend talks to the gateway through Vite's local proxy. The gateway coordinates voice turns, RAG requests, transcript events, CRM actions, and service health. Python services handle retrieval, document ingestion, and realtime signal analysis.

## Technology

- React 18, Vite, Tailwind CSS, Framer Motion, and Recharts
- Express, Socket.IO, and Node.js
- FastAPI, FAISS, and Google Gemini
- Browser Web Speech APIs and optional Vapi integration
- Local document ingestion for PDF and text sources

## Getting Started

### Requirements

- Node.js 18 or newer
- Python 3.10 or newer
- Chrome or Edge for browser microphone and speech-recognition support
- A Gemini API key for live model-backed responses

### Install

```powershell
git clone https://github.com/Kushal1213/darwinxvapi.git
cd darwinxvapi

npm install
python -m pip install -r services/requirements.txt
Copy-Item .env.example .env
```

Set at least the following value in `.env`:

```env
GEMINI_API_KEY=your_gemini_api_key
```

The default local service URLs and ports in `.env.example` work with the included startup scripts. Vapi and Deepgram credentials are optional unless those providers are used.

### Run

Start the complete local stack from the repository root:

```powershell
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The command starts the frontend, API gateway, RAG service, ingestion service, and realtime-insights service together. Press `Ctrl+C` to stop them.

To run services independently:

```powershell
npm run dev:frontend
npm run dev:gateway
npm run dev:rag
npm run dev:ingestion
npm run dev:realtime
```

## Using Voice Studio

1. Open **Voice Studio**.
2. Select a market agent.
3. Start a voice call and allow microphone access.
4. Ask a question covered by the knowledge base.
5. Review the live transcript, grounded response, and source citation.

Example: `What is the minimum income required for a personal loan?`

The experience degrades gracefully when an external voice provider is unavailable. Browser speech and server-side fallback paths remain available for local development.

## Live Insights

Live Insights receives transcript events from the gateway and displays conversation telemetry, detected signals, recommended actions, and escalation state. Built-in scenarios can be used to exercise the signal pipeline without placing a real call.

## Configuration

Important environment variables are documented in `.env.example`.

| Variable | Purpose | Default |
|---|---|---|
| `GEMINI_API_KEY` | Gemini generation access | Required for live Gemini responses |
| `GEMINI_MODEL` | Generation model | `gemini-2.5-flash` |
| `PORT` | API gateway port | `3001` |
| `RAG_SERVICE_URL` | RAG service address | `http://localhost:8001` |
| `INGESTION_SERVICE_URL` | Ingestion service address | `http://localhost:8002` |
| `REALTIME_AI_URL` | Realtime-insights address | `http://localhost:8003` |
| `VAPI_API_KEY` | Optional Vapi integration | Unset |
| `DEEPGRAM_API_KEY` | Optional Deepgram integration | Unset |

Never commit `.env` or provider credentials.

## API Overview

### Gateway

```text
GET  /api/health
POST /api/voice/query
POST /api/rag/query
```

### RAG service

```text
GET  /health
POST /query
```

### Ingestion service

```text
GET  /health
POST /ingest
```

Interactive FastAPI documentation is available at `/docs` on each Python service while it is running.

## Repository Layout

```text
apps/
  frontend/              React application
  api-gateway/           Express and Socket.IO gateway
services/
  rag-service/           Retrieval and grounded response generation
  ingestion-service/     Document parsing and indexing
  realtime-insights/     Signal detection and live recommendations
knowledge-base/
  raw/                   Source documents
  embeddings/            Local index and metadata
scripts/                 Cross-platform local startup helpers
shared/                  Shared schemas and utilities
evaluation/              Reproducible retrieval and signal checks
```

## Verification

Build the frontend before opening a pull request:

```powershell
npm run build --workspace apps/frontend
```

Check the running stack through:

```text
http://localhost:3001/api/health
```

The health endpoint reports each service separately and returns a degraded status when an optional dependency is unavailable.

## License

MIT
