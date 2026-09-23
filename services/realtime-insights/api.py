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

from fastapi import FastAPI, HTTPException, WebSocket
from pydantic import BaseModel, Field
from nudge_engine import Chunk, NudgeController, detect_signals as detect_signals_impl
from test_calls import ALL_SCENARIOS

app = FastAPI(title="Veyra Real-Time Insights")

TIME_SCALE = 0.15
CALL_STATES = {}  # call_id -> {controller, disclosures_seen, frustration_history, started_at}


class DetectSignalsRequest(BaseModel):
    """A final ASR segment received from the gateway.

    Keeping this as an explicit JSON body is important: FastAPI otherwise treats
    three scalar arguments as query parameters, which made the gateway's JSON
    POSTs fail with a 422 and silently disabled live nudges.
    """

    call_id: str = Field(min_length=1, max_length=128)
    speaker: str = Field(min_length=1, max_length=32)
    text: str = Field(min_length=1, max_length=8_000)


@app.get("/health")
def health():
    return {"status": "ok", "scenarios_available": list(ALL_SCENARIOS.keys())}


@app.get("/scenarios")
def scenarios():
    return {name: len(chunks) for name, chunks in ALL_SCENARIOS.items()}


@app.post("/detect-signals")
def detect_signals(body: DetectSignalsRequest):
    """Inline signal detection for a single transcript chunk.
    This is called from the Node.js gateway when live transcripts arrive.
    
    Args:
        call_id: unique call identifier
        speaker: "agent" or "customer" | "user"
        text: the text chunk to analyze
    
    Returns:
        {"nudges": [{"signal_type": "...", "priority": "...", "text": "...", ...}]}
    """
    call_id = body.call_id
    speaker = body.speaker.lower()
    text = body.text.strip()
    if speaker not in {"agent", "assistant", "customer", "user"}:
        raise HTTPException(422, "speaker must be agent, assistant, customer, or user")

    # The detector is written around `agent` and `customer`; normalize browser
    # and Vapi role names at the boundary.
    normalized_speaker = "customer" if speaker in {"customer", "user"} else "agent"

    # Initialize per-call state if not present (in production, use Redis/Memcached)
    if call_id not in CALL_STATES:
        CALL_STATES[call_id] = {
            'controller': NudgeController(),
            'disclosures_seen': set(),
            'frustration_history': [],
            'started_at': time.perf_counter(),
        }

    state = CALL_STATES[call_id]
    call_seconds = time.perf_counter() - state['started_at']
    chunk = Chunk(speaker=normalized_speaker, text=text, call_seconds=call_seconds)
    t0 = time.perf_counter()
    signals = detect_signals_impl(chunk, 0, state['disclosures_seen'], state['frustration_history'])
    detect_ms = (time.perf_counter() - t0) * 1000
    
    nudges = []
    for sig in signals:
        nudge = state['controller'].process(sig, call_seconds, detect_ms)
        if nudge.emitted:
            nudges.append({
                "signal_type": nudge.signal.type.value,
                "priority": nudge.priority,
                "text": nudge.text,
                "confidence": round(nudge.signal.confidence, 3),
                "end_to_end_latency_ms_excl_asr": round(nudge.detection_latency_ms, 3),
            })
    
    return {"call_id": call_id, "nudges": nudges}


@app.delete("/calls/{call_id}")
def close_call(call_id: str):
    """Discard transient per-call detector state after a call ends."""
    CALL_STATES.pop(call_id, None)
    return {"status": "closed", "call_id": call_id}


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
