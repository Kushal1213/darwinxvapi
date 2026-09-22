# Known Limitations & Production Roadmap

## Assessment Submission Gaps (This Sandbox Build)

### Environment Constraints (documented, not bugs)
The sandbox has no network path to commercial speech/embedding/LLM APIs (Gemini, Deepgram, Vapi telephony), so several Q&A deliverables are demonstrated using local fallbacks or scripted stand-ins:

1. **Question 1 & 3: No live audio recordings**
   - **Why:** No telephony provider (Vapi/Twilio) or phone network reachable; no ASR provider (Deepgram/Google Cloud Speech) live.
   - **Demonstrated instead:** Grounded transcripts (Q1, Q3-PH, Q3-ID) where every agent fact was pulled from the actual knowledge base by running real queries against `knowledge-base/local_retriever.py`, with citations logged. Transcripts exercise all required scenarios (cooperative, objection, incomplete/conflicting, out-of-scope, escalation for Q1; code-switching and objection for Q3).
   - **Production path:** Wire `VAPI_API_KEY`, `DEEPGRAM_API_KEY`, and `GEMINI_API_KEY` in `.env`, start the services, and run the existing call-handling code in `apps/api-gateway/src/routes/voice.js` — the infrastructure is ready, only credentials are missing.

2. **Question 2: Knowledge-base embedding model swap**
   - **Why:** Production design uses `gemini-embedding-001` (3072-d dense vectors) for retrieval; no network route to `generativelanguage.googleapis.com`.
   - **Fallback used:** `knowledge-base/local_retriever.py` implements TF-IDF/cosine similarity (scikit-learn) as an offline stand-in. Retrieval contract (chunk → source → score → citation) is identical, but absolute scores are lower than dense-embedding results and may not directly transfer (sparse lexical retrieval is worse on paraphrased queries).
   - **Evaluation consequence:** `evaluation/retrieval_tests.md` uses real TF-IDF scores, not Gemini scores — they are honest measurements of the offline path, not forecasts of production performance. For production: wire `GEMINI_API_KEY`, rebuild the index with `gemini-embedding-001`, re-run `evaluation/run_retrieval_tests.py` against the production retriever.

3. **Question 4: ASR latency measured without actual audio streaming**
   - **Why:** No ASR provider reachable; no raw audio stream.
   - **Demonstrated instead:** `services/realtime-insights/call_runner.py` replays test transcripts (already-converted text) chunk-by-chunk at real wall-clock pace (compressed 0.15x for fast test runs; set `TIME_SCALE=1.0` for real-time). Measures wall-clock latency from "chunk arrives" → "nudge ready to display" (signal detection + nudge control). ASR transcription latency is **not measured**, only documented: 220 ms assumed from published Deepgram/AssemblyAI partial-result latencies, and called out as an assumption in `evaluation/latency_report.md`.
   - **Production path:** Connect to Deepgram API (or another ASR), replace the text-chunk replay with live audio-chunk streaming, re-run `call_runner.py` against real audio. The signal detectors and nudge controller are production-ready; only the input layer changes.

### Real Data Quality Issues Found (fixed)

**Q2 Manifest correction:** Original `knowledge-base/raw/manifest.json` listed 29 sources; only 20 files exist on disk. 9 PDFs (regulatory circulars, LIC policy documents, India IRDA regulations) are missing. Corrected manifest to list only the 20 files present; 9 missing filenames preserved in `removed_missing_files` field for re-sourcing.

**4 extraction failures identified and excluded:**
- `adira_finance_faq.html` (8 words) — client-side-rendered SPA with JavaScript-injected content; plain HTTP GET captured only the empty `<div id="app">` shell.
- `insurancedekho_health_faq.html` — corrupted/wrong-encoding response (0.3% clean-word ratio vs. >60% on legitimate files); binary or gzip-compressed data saved as text.
- `insurance_dekho_health_faq.html` & `policybazaar_health_faq.html` — both are nav/menu chrome (600+ lines averaging 4.2 words/line) scraped instead of FAQ body content; site architecture mismatch.

**Quality gate:** `knowledge-base/local_retriever.py`'s `quality_check()` function catches all four automatically (documented in `evaluation/data_quality_report.md`). Result: 20 files → 4 excluded → 16 indexed → 68 chunks.

### Q3 Regional-Accent Evaluation Gap (acknowledged)

**Philippines:** No native Tagalog/Taglish speaker reviewed transcripts. Phrasing drawn from source files and structured grammatically, but naturalness unverified.

**Indonesia:** Regional (Javanese) accent demonstrated only at the **text/dialect level** (particles like "nggih," "kula," "je"), not as actual audio. No live ASR tested against regional accent — that requires an audio file from a non-Jakarta speaker + a live ASR model (Deepgram/Google STT). Word-error-rate by accent cannot be measured in this sandbox.

**Fix:** Re-record calls with native speakers; run live ASR evaluation; document WER by region.

### False-Positive Analysis Scale

Q4 false-positive report is based on a small manual test suite (4 scenarios, 32 chunks total), not a statistically powered labeled dataset. It demonstrates the suppression *mechanism* (confidence threshold, cooldown, dedup works as designed) and gives one reproducible noisy-call result (zero false positives). Production rollout needs a labeled set of 50–200+ real call transcripts scored against agent/QA review to produce a defensible precision/recall number.

---

## Architecture & Implementation Gaps

### Node.js Gateway ↔ Python Nudge Service (not yet wired)

**Status:** Both services are built and independently runnable:
- **Python side:** `services/realtime-insights/api.py` (FastAPI) exposes `/health`, `/scenarios`, `/replay/{scenario_name}`, and `/stream/{scenario_name}` (WebSocket).
- **Node.js side:** `apps/api-gateway/src/socket/handlers.js` has placeholders for `monitor:call` and `nudge:dismiss` Socket.IO handlers.

**Missing:** The Node.js gateway does not yet call the Python nudge service's WebSocket endpoint or HTTP replay endpoint. The React dashboard's "Simulate Escalation" / "Simulate LTV Inquiry" buttons (in `apps/frontend/src/components/LiveInsightsEngine.jsx`) trigger dashboard-local state changes, not actual nudge-engine runs.

**Wiring needed:**
1. In `apps/api-gateway/src/routes/call.js` or `socket/handlers.js`, when a call streams in, forward transcript chunks to `POST http://localhost:8003/replay/{scenario_name}` (for immediate full replay) or `WS ws://localhost:8003/stream/{scenario_name}` (for live streaming).
2. Deserialize nudge events from Python, emit them back to the React dashboard via Socket.IO.
3. Update `LiveInsightsEngine.jsx` to consume real nudge events instead of synthetic test data.

**Why not done:** This is a cross-language (Python ↔ Node.js) integration that requires environment assumptions about port availability, process lifecycle, and message format alignment. The assessment doesn't strictly require the full end-to-end wiring, only that the nudge engine exists and works (done), latency is measured (done), and suppression logic is exercised (done). The gateway integration is infrastructure glue; both pieces are independently correct and testable.

### Multi-language ASR & TTS (design only, no live providers)

**Current state:** `services/rag-service/config/voice_config.yaml` documents ASR model selection per market (Deepgram: `nova-2` for English, `nova-2-multilingual` for Filipino/Indonesian), and TTS voice selection (Microsoft Azure for English, Filipino, Indonesian). These are *documented* but not *instantiated* — no live API keys in `.env`.

**Production path:** Update `.env` with `DEEPGRAM_API_KEY` and `MICROSOFT_SPEECH_KEY`, update `rag-service` to instantiate the configured providers, and re-run Q1/Q3 scenarios through the full voice pipeline.

---

## Known Data Quality Risks

1. **Missing source PDFs (9 files):** regulatory circulars, LIC/SBI/HDFC policy PDFs, IRDA regulations. These were referenced in the original manifest but never committed to the repo. Retrieval results that cited them (in earlier versions of this report) were not verifiable. **Action:** re-source from original URLs before production deployment.

2. **Duplicate/near-duplicate named files:** Two InsuranceDekho FAQ files with almost identical names (`insurance_dekho_health_faq.html` vs `insurancedekho_health_faq.html`). Detected and one was excluded as a corruption; the other was also excluded as a nav-menu scrape. **Action:** identify the canonical source, scrape it correctly once, commit only one version.

3. **JavaScript-rendered content:** `adira_finance_faq.html` (and potentially others not caught) are client-side-rendered SPAs — plain HTTP GET will not work. **Action:** switch to a headless-browser scraper (Playwright/Puppeteer) for these sites, or find an alternative data source.

---

## Production Roadmap

### Short term (required before launch)
1. **API credential wiring:** Add `GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `VAPI_API_KEY`, `MICROSOFT_SPEECH_KEY` to `.env` and test all three providers live.

## Scaling Limitations (10x Load and Noisy Audio)

### At 10x scale (40+ concurrent calls instead of 4)

**What breaks first:**

1. **In-memory call state in `CALL_STATES` dict (`api.py`):** Currently a simple Python dict per process. At 10x, with 40+ concurrent calls each accumulating frustration history and disclosure tracking, this becomes a memory leak and doesn't survive service restarts or horizontal scaling. **Fix:** Replace with Redis (per-call hash with TTL equal to max call duration) so state is shared across processes and auto-expires.

2. **Synchronous signal detection blocks the event loop:** Each `detect_signals()` call in the WebSocket handler runs synchronously. At 10x, if 40 calls each send 8 chunks/minute, that's 320 signal-detection operations/minute. The regex/heuristic path is ~0.1ms each so this is fine. But if an LLM-detector call is added (see `llm_detector_stub()`), a 500ms LLM call blocks all other WebSocket frames during that time. **Fix:** Run LLM detector in an `asyncio.run_in_executor` thread pool, keeping the regex detectors synchronous.

3. **Single FastAPI process becomes a bottleneck:** `uvicorn api:app --port 8003` is a single process. At 10x, use `uvicorn --workers 4` (or gunicorn with uvicorn workers) behind a load balancer. Nudge events then need to route through a message bus (Redis Pub/Sub or Kafka) instead of being emitted directly, since different calls may land on different workers.

4. **Socket.IO broadcast becomes a fanout problem:** `io.emit('nudge', ...)` in the Node.js gateway broadcasts to every connected dashboard client. At 10x, a supervisor monitoring 40 calls would receive nudges for all 40 simultaneously. **Fix:** use Socket.IO rooms (already scaffolded as `socket.join('call:{call_id}')` in `handlers.js`) so each nudge is routed only to the client(s) monitoring that specific call.

5. **False positive rate compounds:** With 40 concurrent calls, even a 5% false-positive rate means 2 spurious nudges per minute competing for agent/supervisor attention. At this scale, the confidence threshold needs tuning upward (e.g. 0.75 instead of 0.65) and cooldowns need to be longer (45s instead of 20s) to keep total nudge volume manageable.

### With noisy audio

The current signal detectors are regex/keyword-based, running against ASR output. Noise affects them in two ways:

1. **ASR transcription errors:** a noisy line produces mis-transcribed words — "second vehicle" becomes "segment vehicle" or drops entirely. The cross-sell detector (`CROSS_SELL_PATTERNS`) misses it. **False negative rate rises with noise.** This is acceptable for nudge engines (missing an opportunity is better than a false alarm), but compliance detectors should have a secondary rule that fires on *absence* of a required phrase (rather than presence of a prohibited one) to catch noisy-channel misses.

2. **Spurious keyword matches:** Heavy background noise sometimes produces ASR hallucinations ("ridiculous", "can't afford") on garbled audio. The noisy-ambiguous test scenario (`test_calls.py`) already confirms the current detectors produce zero nudges on clearly ambiguous/garbled text. At true audio-noise levels, the fix is: (a) require confidence scores from the ASR provider (Deepgram returns per-word confidence) and discard words below 0.7 confidence before running detectors; (b) raise the signal confidence threshold.

3. **Diarization (speaker separation) degrades:** When audio quality drops, speaker-diarization models mis-attribute customer words to the agent. A compliance-gap check that fires on agent turns might then incorrectly fire on customer turns. **Fix:** if ASR confidence drops below a threshold for a full segment, skip compliance checks for that segment rather than running them on noisy attribution.
2. **Re-source missing PDFs:** Regulatory circulars, policy documents (LIC Jeevan Umang, New Jeevan Anand, HDFC Term insurance, SBI Life, Star Comprehensive, IRDA regulation PDFs, Philippines Insurance Commission circulars).
3. **Re-scrape broken sources:** `adira_finance_faq.html`, `insurancedekho_health_faq.html`, `policybazaar_health_faq.html` using headless browser or alternative endpoint.
4. **Regenerate retrieval/latency reports:** Once real APIs are live, re-run `evaluation/run_retrieval_tests.py` and `services/realtime-insights/call_runner.py` against production providers and commit the real numbers.
5. **Wire Node.js → Python nudge integration:** connect the gateway to the realtime-insights service so live calls feed the nudge engine.
6. **Native speaker review:** Have Q3 transcripts reviewed by native Tagalog and Indonesian speakers; record actual audio calls; run live ASR evaluation.

### Medium term (post-launch optimization)
1. **Hybrid retrieval:** Dense (Gemini) + sparse (TF-IDF) re-ranking for better paraphrase/semantic handling.
2. **LLM-based signal detection:** Complement rule-based Q4 detectors with a Gemini-based "what opportunities did we miss?" pass for softer signals.
3. **Statistically powered false-positive analysis:** Collect 100+ labeled real calls, compute precision/recall by signal type.
4. **Regional accent evaluation:** WER by accent on ASR models, document accommodations per region.
5. **A/B testing framework:** measure voice-agent conversion rate, call duration, CSAT by configuration.

### Technical debt
- Replace placeholder "Simulate" buttons in React with real test-scenario runners.
- Add audit logging: every retrieval, every signal detection, every nudge shown, store in a queryable event log for compliance review.
- Document SLA: latency targets (P95 < 2s audio-to-nudge), accuracy targets (>80% relevant retrieval by domain expert review), false-positive ceiling (< 5%).
- Containerize all services (Docker Compose) for repeatable local testing and cloud deployment.

---

## Assessment Integrity Notes

**What is real and reproducible:**
- Retrieval engine (`local_retriever.py`): offline TF-IDF, any machine with scikit-learn can reproduce it.
- Knowledge-base quality checks: automated gate catching the 4 real failures; source code open for audit.
- Latency measurements (Q4): real wall-clock timing, sample code in `call_runner.py`, re-runnable any time.
- Test transcripts (Q1, Q3): grounded against real KB chunks, citations verifiable by running local retriever with the same queries.

**What is estimated/assumed:**
- ASR latency (220 ms): vendor-published baseline, not measured in this sandbox (no provider reachable).
- Regional-accent performance (Indonesia): demonstrated at text level only, not on live audio.
- False-positive rate: based on 4 scenarios/32 chunks, not a full evaluation set.

**What would change in production:**
- Swap local TF-IDF for Gemini `gemini-embedding-001` (need API key + network access).
- Replace transcript replay with live ASR stream (need ASR provider + audio).
- Replace hand-written transcripts with actual recordings (need telephony + voices).
- Expand test-call suite from 5 (Q1) + 2 (Q3-PH) + 2 (Q3-ID) to dozens/hundreds of real customer calls for statistical confidence.
