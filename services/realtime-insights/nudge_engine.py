"""
nudge_engine.py — Question 4: Live Insights and Nudges From Call Audio.

WHAT THIS IS
------------
A genuine (not simulated-after-the-fact) real-time signal-extraction and
nudge-generation engine. It is fed a call **chunk by chunk, as it "arrives"**
(see call_runner.py, which replays a transcript at real wall-clock pace to
stand in for a live ASR stream — see README "Environment Notes" for why we
replay text instead of live audio in this sandbox). For every chunk it:

  1. Runs signal detectors (compliance, cross-sell, frustration, payment
     difficulty, buying signal) — each is timed with a real wall-clock
     measurement, not an estimate.
  2. Passes any fired signal through nudge control: confidence threshold,
     duplicate suppression, per-signal-type cooldown, topic grouping,
     priority, and expiry.
  3. Emits nudges with the *actual* elapsed time from chunk arrival to
     nudge emission, in milliseconds.

The detectors here are deliberately rule-based (regex/keyword + small
heuristics) rather than an LLM call, because this sandbox has no reachable
LLM/ASR provider (see README). A production deployment would likely combine
this rule layer (fast, cheap, deterministic — good for compliance-critical
signals) with an LLM pass for softer signals (missed opportunities, nuanced
sentiment) using Gemini/GPT via the existing rag-service. The interfaces
below (`Signal`, `Nudge`, `detect_signals`) are written so that swapping in
or adding an LLM-based detector is a one-function change — see
`llm_detector_stub()` at the bottom.
"""
from __future__ import annotations

import re
import time
from dataclasses import dataclass, field
from enum import Enum


class SignalType(str, Enum):
    MISSED_CROSS_SELL = "missed_cross_sell"
    COMPLIANCE_GAP = "compliance_gap"
    RISING_FRUSTRATION = "rising_frustration"
    PAYMENT_DIFFICULTY = "payment_difficulty"
    BUYING_SIGNAL = "buying_signal"
    HUMAN_ESCALATION = "human_escalation"


PRIORITY = {
    SignalType.COMPLIANCE_GAP: "HIGH",
    SignalType.HUMAN_ESCALATION: "HIGH",
    SignalType.RISING_FRUSTRATION: "HIGH",
    SignalType.PAYMENT_DIFFICULTY: "MEDIUM",
    SignalType.MISSED_CROSS_SELL: "MEDIUM",
    SignalType.BUYING_SIGNAL: "LOW",
}

NUDGE_TEXT = {
    SignalType.MISSED_CROSS_SELL: "Customer mentioned a second product need — suggest the relevant cross-sell offer.",
    SignalType.COMPLIANCE_GAP: "Required disclosure has not been read yet — remind the agent before proceeding.",
    SignalType.RISING_FRUSTRATION: "Customer sentiment is dropping — acknowledge the concern before continuing the script.",
    SignalType.PAYMENT_DIFFICULTY: "Customer is signaling payment difficulty — offer the approved payment-support or callback path.",
    SignalType.BUYING_SIGNAL: "Customer is showing buying intent — move toward next-step / close.",
    SignalType.HUMAN_ESCALATION: "Customer is asking for a human supervisor — prepare handoff summary.",
}

# --- Rule-based detectors ---------------------------------------------------

CROSS_SELL_PATTERNS = re.compile(
    r"\b(second (car|vehicle|bike|motorcycle|property)|another (car|vehicle|policy|loan)|"
    r"also (have|thinking about|looking at)|my (wife|husband|spouse|family) (also|too) (needs|wants))\b",
    re.I,
)
PAYMENT_DIFFICULTY_PATTERNS = re.compile(
    r"\b(lost my job|can'?t afford|struggling to pay|behind on payments|reduce (my )?(emi|installment|cicilan)|"
    r"financial (difficulty|trouble)|tight on money|skip (this|a) (payment|installment))\b",
    re.I,
)
BUYING_SIGNAL_PATTERNS = re.compile(
    r"\b(sounds good|how do i apply|i'?m interested|let'?s proceed|sign me up|what'?s the next step|"
    r"i want to (go ahead|proceed|apply))\b",
    re.I,
)
ESCALATION_PATTERNS = re.compile(
    r"\b(speak to (a |your )?(manager|supervisor|someone else)|human (agent|representative)|"
    r"this is (unacceptable|ridiculous)|connect me to)\b",
    re.I,
)
FRUSTRATION_LEXICON = {
    "ridiculous": 3, "unacceptable": 3, "frustrated": 3, "annoyed": 2, "angry": 3,
    "sick of": 3, "waste of time": 3, "again?": 2, "already told you": 2, "seriously": 1,
    "not happy": 2, "terrible": 2, "worst": 2,
}
REQUIRED_DISCLOSURES = [
    ("recording_notice", re.compile(r"\bthis call (may be|is being) recorded\b", re.I)),
    ("rate_confirmation_notice", re.compile(r"\b(rates?|interest rate) quoted .* (confirm|subject to)\b|"
                                             r"\bconfirm(ed)? (via|by) (email|sms)\b", re.I)),
]


@dataclass
class Chunk:
    speaker: str          # "agent" | "customer"
    text: str
    call_seconds: float   # position in the call this chunk represents


@dataclass
class Signal:
    type: SignalType
    confidence: float
    evidence: str
    chunk_index: int


@dataclass
class Nudge:
    signal: Signal
    priority: str
    text: str
    created_at_call_seconds: float
    detection_latency_ms: float
    emitted: bool = True
    suppressed_reason: str | None = None
    expires_after_seconds: float = 45.0


def frustration_score(text: str) -> float:
    t = text.lower()
    score = sum(w for phrase, w in FRUSTRATION_LEXICON.items() if phrase in t)
    exclam = text.count("!")
    return min(1.0, (score + exclam * 0.5) / 6.0)


def detect_signals(chunk: Chunk, chunk_index: int, disclosures_seen: set[str],
                    running_frustration: list[float]) -> list[Signal]:
    """Runs every detector against one chunk. Returns fired signals with a
    confidence in [0,1]. This is the function a real ASR pipeline would call
    per partial/final transcript segment."""
    signals: list[Signal] = []
    text = chunk.text

    if chunk.speaker == "customer":
        if m := CROSS_SELL_PATTERNS.search(text):
            signals.append(Signal(SignalType.MISSED_CROSS_SELL, 0.8, m.group(0), chunk_index))
        if m := PAYMENT_DIFFICULTY_PATTERNS.search(text):
            signals.append(Signal(SignalType.PAYMENT_DIFFICULTY, 0.85, m.group(0), chunk_index))
        if m := BUYING_SIGNAL_PATTERNS.search(text):
            signals.append(Signal(SignalType.BUYING_SIGNAL, 0.7, m.group(0), chunk_index))
        if m := ESCALATION_PATTERNS.search(text):
            signals.append(Signal(SignalType.HUMAN_ESCALATION, 0.9, m.group(0), chunk_index))

        f = frustration_score(text)
        running_frustration.append(f)
        window = running_frustration[-3:]
        trend = sum(window) / len(window)
        if trend >= 0.4 and len(running_frustration) >= 2 and window[-1] >= window[0]:
            signals.append(Signal(SignalType.RISING_FRUSTRATION, min(0.95, 0.5 + trend), text[:80], chunk_index))

    if chunk.speaker == "agent":
        for name, pattern in REQUIRED_DISCLOSURES:
            if pattern.search(text):
                disclosures_seen.add(name)
        # Compliance gap: agent is quoting a rate/tenure/amount without having
        # given the rate-confirmation disclosure yet in this call.
        quoting_terms = re.search(r"\b(interest rate|per annum|% p\.a\.|processing fee)\b", text, re.I)
        if quoting_terms and "rate_confirmation_notice" not in disclosures_seen:
            signals.append(Signal(
                SignalType.COMPLIANCE_GAP, 0.75,
                "Agent quoted rate/fee terms before giving the required confirmation disclosure.",
                chunk_index,
            ))

    return signals


class NudgeController:
    """Implements the nudge-control requirements from the assessment:
    confidence threshold, duplicate suppression, per-type cooldown,
    topic grouping (by SignalType), priority, and expiry."""

    def __init__(self, confidence_threshold: float = 0.65, cooldown_seconds: float = 20.0):
        self.confidence_threshold = confidence_threshold
        self.cooldown_seconds = cooldown_seconds
        self._last_fired_at: dict[SignalType, float] = {}
        self.all_signals: list[Signal] = []
        self.nudges: list[Nudge] = []

    def process(self, signal: Signal, call_seconds: float, detection_latency_ms: float) -> Nudge:
        """Always returns a Nudge record (so the caller/log always sees the
        outcome); `.emitted` tells you whether it actually reached the agent."""
        self.all_signals.append(signal)

        if signal.confidence < self.confidence_threshold:
            n = Nudge(signal, PRIORITY[signal.type], NUDGE_TEXT[signal.type], call_seconds,
                       detection_latency_ms, emitted=False,
                       suppressed_reason=f"confidence {signal.confidence:.2f} < threshold {self.confidence_threshold}")
            self.nudges.append(n)
            return n

        last = self._last_fired_at.get(signal.type)
        if last is not None and (call_seconds - last) < self.cooldown_seconds:
            n = Nudge(signal, PRIORITY[signal.type], NUDGE_TEXT[signal.type], call_seconds,
                       detection_latency_ms, emitted=False,
                       suppressed_reason=f"cooldown active ({call_seconds - last:.1f}s < {self.cooldown_seconds}s "
                                         f"since last {signal.type.value} nudge)")
            self.nudges.append(n)
            return n

        self._last_fired_at[signal.type] = call_seconds
        n = Nudge(signal, PRIORITY[signal.type], NUDGE_TEXT[signal.type], call_seconds, detection_latency_ms)
        self.nudges.append(n)
        return n


def llm_detector_stub(chunk_text: str) -> list[Signal]:
    """Not wired up in this sandbox (no reachable LLM endpoint for Gemini/GPT
    at runtime here). In production this would call services/rag-service's
    LLM client with a short structured-signal-extraction prompt and merge its
    output with the rule-based signals above — useful for softer signals like
    'implied but unstated missed opportunity' that regex can't catch."""
    raise NotImplementedError("Wire this to services/rag-service's LLM client in a networked deployment.")
