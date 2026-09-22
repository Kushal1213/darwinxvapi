"""
api.py — FastAPI service exposing the Q4 real-time nudge engine, in the same
style as services/rag-service and services/ingestion-service.

Run:
    cd services/realtime-insights
    pip install fastapi uvicorn websockets
    uvicorn api:app --port 8003

Endpoints:
    GET  /health                      -> service status
    GET  /scenarios                   -> list available replay scenarios
    POST /replay/{scenario_name}      -> run a scenario synchronously, return
                                          the full event log + latency summary
                                          (same computation as call_runner.py)
    WS   /stream/{scenario_name}      -> live: emits each nudge event over the
                                          socket AS IT FIRES during real-time
                                          replay, for a dashboard to consume
                                          instead of polling a finished log.
                                          This is the literal "expose nudges
                                          through ... a WebSocket" deliverable.

apps/api-gateway's existing Socket.IO layer (src/socket/handlers.js) can
subscribe a browser session to this WS and re-broadcast to the React
dashboard — see known_limitations.md for the remaining Node<->Python wiring
that hasn't been done in this environment.
"""
from __future__ import annotations

import asyncio
import time

from fastapi import FastAPI, WebSocket
from nudge_engine import Chunk, NudgeController, detect_signals as detect_signals_impl
from test_calls import ALL_SCENARIOS

app = FastAPI(title="Darwix Real-Time Insights (Q4)")

TIME_SCALE = 0.15
CALL_STATES = {}  # call_id -> {controller, disclosures_seen, frustration_history}


@app.get("/health")
def health():
    return {"status": "ok", "scenarios_available": list(ALL_SCENARIOS.keys())}


@app.get("/scenarios")
def scenarios():
    return {name: len(chunks) for name, chunks in ALL_SCENARIOS.items()}


@app.post("/detect-signals")
def detect_signals(call_id: str, speaker: str, text: str):
    """Inline signal detection for a single transcript chunk.
    This is called from the Node.js gateway when live transcripts arrive.
    
    Args:
        call_id: unique call identifier
        speaker: "agent" or "customer" | "user"
        text: the text chunk to analyze
    
    Returns:
        {"nudges": [{"signal_type": "...", "priority": "...", "text": "...", ...}]}
    """
    chunk = Chunk(speaker=speaker.lower(), text=text, call_seconds=0.0)
    
    # Initialize per-call state if not present (in production, use Redis/Memcached)
    if call_id not in CALL_STATES:
        CALL_STATES[call_id] = {
            'controller': NudgeController(),
            'disclosures_seen': set(),
            'frustration_history': [],
        }
    
    state = CALL_STATES[call_id]
    t0 = time.perf_counter()
    signals = detect_signals_impl(chunk, 0, state['disclosures_seen'], state['frustration_history'])
    detect_ms = (time.perf_counter() - t0) * 1000
    
    nudges = []
    for sig in signals:
        nudge = state['controller'].process(sig, 0.0, detect_ms)
        if nudge.emitted:
            nudges.append({
                "signal_type": nudge.signal.type.value,
                "priority": nudge.priority,
                "text": nudge.text,
                "confidence": round(nudge.signal.confidence, 3),
                "end_to_end_latency_ms_excl_asr": round(nudge.detection_latency_ms, 3),
            })
    
    return {"call_id": call_id, "nudges": nudges}


@app.post("/replay/{scenario_name}")
def replay(scenario_name: str):
    from call_runner import run_scenario
    if scenario_name not in ALL_SCENARIOS:
        return {"error": f"unknown scenario '{scenario_name}'", "available": list(ALL_SCENARIOS.keys())}
    return run_scenario(scenario_name, ALL_SCENARIOS[scenario_name])


@app.websocket("/stream/{scenario_name}")
async def stream(websocket: WebSocket, scenario_name: str):
    await websocket.accept()
    if scenario_name not in ALL_SCENARIOS:
        await websocket.send_json({"error": f"unknown scenario '{scenario_name}'"})
        await websocket.close()
        return

    chunks = ALL_SCENARIOS[scenario_name]
    controller = NudgeController(confidence_threshold=0.65, cooldown_seconds=20.0)
    disclosures_seen: set[str] = set()
    running_frustration: list[float] = []
    prev_call_seconds = 0.0

    await websocket.send_json({"event": "call_started", "scenario": scenario_name, "chunks": len(chunks)})

    for i, chunk in enumerate(chunks):
        gap = max(0.0, (chunk.call_seconds - prev_call_seconds) * TIME_SCALE)
        await asyncio.sleep(gap)
        prev_call_seconds = chunk.call_seconds

        t_arrival = time.perf_counter()
        t0 = time.perf_counter()
        signals = detect_signals_impl(chunk, i, disclosures_seen, running_frustration)
        detect_ms = (time.perf_counter() - t0) * 1000

        await websocket.send_json({
            "event": "transcript_chunk",
            "chunk_index": i,
            "speaker": chunk.speaker,
            "text": chunk.text,
            "call_seconds": chunk.call_seconds,
        })

        for sig in signals:
            nudge = controller.process(sig, chunk.call_seconds, detect_ms)
            e2e_ms = (time.perf_counter() - t_arrival) * 1000
            await websocket.send_json({
                "event": "nudge",
                "signal_type": sig.type.value,
                "confidence": sig.confidence,
                "emitted": nudge.emitted,
                "suppressed_reason": nudge.suppressed_reason,
                "priority": nudge.priority,
                "text": nudge.text,
                "end_to_end_latency_ms_excl_asr": round(e2e_ms, 3),
            })

    await websocket.send_json({"event": "call_ended"})
    await websocket.close()
