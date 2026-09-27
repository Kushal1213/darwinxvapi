# Call Sessions and Review

Implemented milestone: core conversation lifecycle and completed-call review.
The initial verification workflow uses India personal-loan support; the existing
market agents remain available.

## Identity and Lifecycle

`call_id` identifies the same conversation across Voice Studio, RAG's `session_id`,
transcript events, Mission Control, handoff requests, and Call History.

Voice sessions store the selected UI agent market (`india-loan`,
`india-insurance`, `ph-bancassurance`, or `id-finance`). Before retrieval, the
gateway converts that value into a canonical RAG scope: country market plus
product family. Unsupported market IDs return 400 instead of silently falling
back to an India loan agent.

| State | Meaning | Next states |
|---|---|---|
| `created` | Session allocated; no transcript yet | `active`, `escalated`, `completed` |
| `active` | Customer conversation in progress | `escalated`, `completed` |
| `escalated` | Human assistance requested | `completed` |
| `completed` | Call ended and archived | Terminal |

Retrieval failures return 503/504 and leave the call open for retry. A separate
terminal `failed` state remains future work. Persisted active calls are restored
on the first authenticated voice API request after a gateway restart. In-flight
retrieval requests are not replayed; the caller can submit a new turn.
The end endpoint retains its legacy `status: ended` acknowledgement; the archived
session itself uses `completed`.

Creating an existing live ID returns the existing session without erasing turns.
Reusing a completed ID returns 409. Concurrent queries for one call return 409.
Ending a call is idempotent; late retrieval results and transcript webhooks cannot
reopen or change an archived call.

## API

These endpoints require the workspace owner's authenticated cookie session.
Browser mutations must carry an allowed Origin. See [workspace access](WORKSPACE_ACCESS.md).

| Endpoint | Result |
|---|---|
| `POST /api/voice/session` | Create a session; optional `call_id`, supported UI `market`, `language` |
| `POST /api/voice/query` | Record a customer turn and return an answer and sources |
| `GET /api/voice/live` | Current created, active, and escalated calls |
| `POST /api/voice/escalate` | Request a handoff for an existing live call |
| `POST /api/voice/session/:id/end` | Archive the call, then remove it from live monitoring |
| `GET /api/voice/history?limit=20&offset=0` | Newest completed calls first; `calls` and `total` |
| `GET /api/voice/session/:id` | Full live or archived session, including transcript and citations |

History accepts an integer limit from 1 to 100 and a nonnegative integer offset.
List entries omit `turns` and include `turn_count`. Detail entries contain:

- `call_id`, `market`, `language`, `created_at`, `last_activity`, `status`.
- `turns`: role, content, timestamp (`ts`), and optional sources and latency.
- `state`: captured intent and qualification fields, current stage and signals.
- `escalations`: handoff ID, reason, intent, last customer message, recent
  conversation summary, missing details, sources, priority, and timestamp.
- For archived calls: `ended_at`, `summary`, and `outcome` (`completed` or
  `human_handoff_requested`). Summary currently contains the last four turns.

## Handoff Behavior

Explicit human requests and complaints trigger handoff before calling retrieval.
An empty source result also records a handoff. Repeated requests return the
existing handoff, preserving the original context. Subsequent queries acknowledge
the recorded request rather than continuing automated product answers.

Handoff records are requests for operator follow-up, not confirmed phone transfers.
Automatic triggers currently use English keywords; market-specific intent handling,
negative-intent handling, repeated-frustration policies and calibrated confidence
thresholds are still pending. `state.confidence` is null because retrieval similarity
scores are not calibrated probabilities.

Retrieval uses hard eligibility filters. RAG returns only chunks in the requested
canonical market and matching requested product family when product metadata is
present. It may return fewer than the requested `top_k` chunks, including zero.
The RAG response reports `retrieval_mode` and `abstention_reason`; the gateway
escalates abstentions instead of treating retrieved but unsupported chunks as an
answer.

## Storage Boundary

Active and completed call snapshots use SQLite at `data/veyra.sqlite`, overridden
by `VEYRA_DATABASE_PATH`. Each live-state update is saved, and completed calls are
saved before being removed from live monitoring. History uses indexed, paginated
SQL queries. Calls carry `workspace_id: default` for the installation's workspace.

Legacy JSON archives are imported transactionally once from `data/calls/` or
`CALL_HISTORY_DIR`. Originals remain untouched and duplicate IDs do not replace
database records. Invalid legacy records fail migration rather than silently
dropping history. Restart after correcting an invalid archive to retry.

This is a single-gateway, single-workspace database. Active state is also cached
in memory; multiple gateway writers are unsupported. Browser microphone sessions
are not automatically reconnected after a restart. Tenant isolation, team roles,
retention/deletion, and provider-call reconciliation remain future work.

## Verification

Run `npm run test --workspace apps/api-gateway` for lifecycle integration tests
against a temporary gateway and deterministic retrieval stub. Run
`npm run build --workspace apps/frontend` to check the UI build.

Manual flow: open Voice Agents, select Text Mode, ask a supported loan question,
request a human, choose End Session, open Call History, and select the call to
review its transcript, source excerpts, and handoff reason.
