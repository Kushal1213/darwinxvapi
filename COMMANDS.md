# Run Commands — Darwix Voice Intelligence Suite

All commands are copy-paste ready. Run each section in its own terminal tab.

---

## Prerequisites (one-time setup)

### System requirements
- **Python 3.10+** (tested on 3.12)
- **Node.js 18+** (tested on 22)
- **npm 9+**

### 1 — Copy environment file and add your keys

```bash
cp .env.example .env
```

Open `.env` and fill in:

```
GEMINI_API_KEY=your_key_here          # https://aistudio.google.com/app/apikey
DEEPGRAM_API_KEY=your_key_here        # https://console.deepgram.com
VAPI_API_KEY=your_key_here            # https://dashboard.vapi.ai
VAPI_PHONE_NUMBER_ID=your_id_here     # from Vapi dashboard → Phone Numbers
```

> **No keys?** The system still runs in offline/sandbox mode.
> Q2 retrieval and Q4 nudge engine work fully without any keys.
> Only live voice calls (Q1, Q3) and Gemini embeddings require credentials.

---

## Terminal 1 — RAG Service (Port 8001)

```bash
cd services

# Install Python dependencies (first time only)
pip install -r requirements.txt

# Start RAG service
cd rag-service
uvicorn main:app --reload --port 8001
```

Expected output:
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8001
```

---

## Terminal 2 — Ingestion Service (Port 8002)

```bash
cd services/ingestion-service

uvicorn main:app --reload --port 8002
```

Expected output:
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8002
```

---

## Terminal 3 — Real-Time Insights Engine / Q4 (Port 8003)

```bash
cd services/realtime-insights

# Install extra deps (first time only)
pip install fastapi uvicorn "websockets<13" --break-system-packages

uvicorn api:app --reload --port 8003
```

Expected output:
```
INFO:     Application startup complete.
INFO:     Uvicorn running on http://127.0.0.1:8003
```

Test it immediately in another shell:
```bash
curl http://localhost:8003/health
# → {"status":"ok","scenarios_available":["missed_cross_sell","compliance_gap","rising_frustration","noisy_ambiguous"]}

curl -X POST http://localhost:8003/replay/missed_cross_sell
# → full nudge event log with real latency numbers
```

---

## Terminal 4 — Express API Gateway (Port 3001)

```bash
cd apps/api-gateway

# Install Node dependencies (first time only)
npm install

npm run dev
```

Expected output:
```
🚀 API Gateway running on http://localhost:3001
📡 Dashboard client connected
```

---

## Terminal 5 — React Dashboard (Port 5173)

```bash
cd apps/frontend

# Install dependencies (first time only)
npm install

npm run dev
```

Expected output:
```
  VITE v5.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

Open **http://localhost:5173** in Chrome or Edge (required for Web Speech API).

---

## Standalone commands (no stack needed)

### Run Q4 nudge engine test — all 4 scenarios with real latency measurement

```bash
cd services/realtime-insights
python3 call_runner.py
```

Output: per-scenario signal/nudge counts + rewrites `evaluation/latency_report.md` and `evaluation/false_positive_analysis.md`.

### Run Q2 retrieval benchmark — 8 real queries, genuine scores

```bash
python3 evaluation/run_retrieval_tests.py
```

Output: rewrites `evaluation/retrieval_tests.md` with fresh results.

### Query the knowledge base directly (CLI)

```bash
python3 knowledge-base/local_retriever.py "minimum salary for personal loan"
python3 knowledge-base/local_retriever.py "DP down payment motor financing Indonesia"
python3 knowledge-base/local_retriever.py "premium rider bancassurance Philippines"
```

### Print data quality log (shows which files were excluded and why)

```bash
python3 -c "
import sys; sys.path.insert(0, '.')
from knowledge_base_utils import get_retriever
r = get_retriever()
print(f'Indexed: {len(r.chunks)} chunks from {len(set(c.source for c in r.chunks))} sources\n')
for q in r.quality_log:
    print(q['status'].upper(), '-', q['file'])
    if q['reason']:
        print('  ↳', q['reason'])
"
```

### Test individual Q4 signal detection (no server needed)

```bash
python3 -c "
import sys; sys.path.insert(0, 'services/realtime-insights')
from nudge_engine import Chunk, detect_signals, NudgeController

tests = [
    ('customer', 'I have a second vehicle too, can you help with that?'),
    ('agent',    'The rate is 10.5% per annum for your loan amount.'),
    ('customer', 'This is ridiculous, I want to speak to a manager now'),
    ('customer', 'yeah something [unintelligible] maybe not sure'),
]
ctrl = NudgeController()
disc = set(); frust = []
for speaker, text in tests:
    chunk = Chunk(speaker, text, 0)
    signals = detect_signals(chunk, 0, disc, frust)
    for s in signals:
        n = ctrl.process(s, 0, 1)
        status = '✓ EMITTED' if n.emitted else '✗ suppressed'
        print(f'{status} | {s.type.value} ({n.priority}) | \"{text[:55]}\"')
    if not signals:
        print(f'— no signal | \"{text[:55]}\"')
"
```

---

## Service health checks

Once all terminals are running:

```bash
# RAG service
curl http://localhost:8001/health

# Ingestion service
curl http://localhost:8002/health

# Insights engine
curl http://localhost:8003/health

# API Gateway
curl http://localhost:3001/api/health
```

All should return `{"status":"ok"}` or similar.

---

## Ingest the knowledge base (run once after keys are set)

Only needed if you have a `GEMINI_API_KEY` and want to rebuild the dense-vector FAISS index:

```bash
cd knowledge-base
python3 ingest_all.py
```

Without a key, the existing FAISS index (bundled in `knowledge-base/embeddings/`) is used, or the offline TF-IDF retriever in `knowledge-base/local_retriever.py` is used as fallback.

---

## Ports summary

| Service | Port | Command |
|---|---|---|
| RAG Service | 8001 | `uvicorn main:app --reload --port 8001` |
| Ingestion Service | 8002 | `uvicorn main:app --reload --port 8002` |
| Real-Time Insights (Q4) | 8003 | `uvicorn api:app --reload --port 8003` |
| Express Gateway | 3001 | `npm run dev` |
| React Dashboard | 5173 | `npm run dev` |

---

## Troubleshooting

**`ModuleNotFoundError: No module named 'faiss'`**
```bash
pip install faiss-cpu --break-system-packages
```

**`ModuleNotFoundError: No module named 'fastapi'`**
```bash
pip install -r services/requirements.txt --break-system-packages
```

**`Error: Cannot find module 'express'`**
```bash
cd apps/api-gateway && npm install
```

**Vite port already in use**
```bash
cd apps/frontend && npm run dev -- --port 3000
```

**`CORS error` in browser console**
Make sure `FRONTEND_URL=http://localhost:5173` is set in `.env` (matches the actual Vite port).

**Insights engine not wired to dashboard (nudge buttons show no events)**
Confirm port 8003 is running: `curl http://localhost:8003/health`
The dashboard buttons call `http://localhost:8003/replay/{scenario}` directly from the browser.
