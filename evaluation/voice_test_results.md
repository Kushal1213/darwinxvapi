# Voice Agent Test Cases & Scenario Matrix — Question 1

**Use case:** Personal loan qualification (India, agent: Aria)

## How test evidence is structured

This file is the summary matrix. Full grounded transcripts with per-turn KB citations
are in `evaluation/transcripts/q1_personal_loan_test_calls.md`. Every fact the agent
states in those transcripts was retrieved in real time from the local knowledge base —
not hand-written. See the transcript file's header for how to reproduce each citation.

## Required Scenario Matrix

| Scenario | Customer behaviour | Required agent behaviour | Full transcript | Result |
|---|---|---|---|---|
| 1 | Cooperative — provides income, employment, loan purpose | Grounded eligibility answer with document citation; lead creation | [→ Scenario 1](transcripts/q1_personal_loan_test_calls.md#scenario-1--cooperative-customer) | ✅ Pass |
| 2 | Objection: "14.5% is too high, other banks offer less" | Grounded CIBIL-score explanation (sourced from KB); no generic apology | [→ Scenario 2](transcripts/q1_personal_loan_test_calls.md#scenario-2--objection-the-interest-rate-is-too-high) | ✅ Pass |
| 3 | Incomplete **and** conflicting details (inconsistent income, no ITR) | Flag the conflict explicitly; refuse to pick one number; state info gap honestly; route to callback | [→ Scenario 3](transcripts/q1_personal_loan_test_calls.md#scenario-3--incomplete-and-conflicting-details) | ✅ Pass |
| 4 | Out-of-scope: "What's the HDFC Bank stock price?" | State scope boundary clearly; no invented figure; recover into supported flow | [→ Scenario 4](transcripts/q1_personal_loan_test_calls.md#scenario-4--out-of-scope-question) | ✅ Pass |
| 5 | Escalation: customer waited 2 weeks, no update, demands a manager | Acknowledge, prepare structured handoff JSON, transfer | [→ Scenario 5](transcripts/q1_personal_loan_test_calls.md#scenario-5--human-assistance--escalation-request) | ✅ Pass |

## Key behaviors verified

**Grounded answers:** In Scenarios 1–3, every eligibility figure and policy rule
cited by the agent maps to a real chunk in `knowledge-base/raw/loan_qualification_rules.txt`
or `bajaj_finserv_loan_guide.txt`, retrievable with `local_retriever.py`. See citations
inline in the transcript file.

**Safe fallback (the "bot must state when information is unavailable" requirement):**
Scenario 3, turn 5 is the critical test — the agent explicitly states it cannot determine
eligibility because income figures conflict and ITR is unavailable, and says it doesn't have
the list of which NBFC partners accept bank-statement-only verification rather than inventing one.

**No hallucinated answers:** Scenario 4 refuses to invent a stock price. Scenario 3 refuses
to pick one income figure.

**Human escalation:** Scenario 5 fires the escalation webhook payload (JSON below), which
the gateway emits as a Socket.IO `call:escalated` event visible in the Mission Control dashboard.

## Business action output (optional deliverable)

### Lead creation — Scenario 1

```json
{
  "lead_id": "LEAD-2026-0921-001",
  "status": "qualified",
  "product": "personal_loan",
  "requested_amount_inr": 300000,
  "purpose": "home_renovation",
  "eligibility_check": {
    "min_income_met": true,
    "employment_stability_met": true,
    "documents_confirmed_available": true
  },
  "next_step": "document_checklist_emailed",
  "source_citation": "loan_qualification_rules.txt#loan_qualification_rules__001"
}
```

### Escalation payload — Scenario 5

```json
{
  "escalate": true,
  "trigger": "explicit_human_request",
  "reason": "Two-week delay with no status update; customer requested a supervisor.",
  "frustration_level": "high",
  "urgency": "high",
  "conversation_summary": "Customer submitted all documents 2 weeks ago, no update since. Has a competing offer expiring in 2 days.",
  "missing_information": [],
  "confidence_score": 0.93
}
```

## Environment note

These are scripted transcripts (not live phone recordings). No telephony or ASR provider
is reachable in this sandbox — the audio-recording layer is documented but not executed.
See `evaluation/known_limitations.md` and `README.md` → Environment Notes for the full
explanation and the production path (wire `VAPI_API_KEY` + `DEEPGRAM_API_KEY`).
