# Operator Nudges

Mission Control now uses persisted nudge records instead of a browser-only alert
array. Call Review shows the same records for the selected completed call.

## Lifecycle

`created -> displayed -> acknowledged | dismissed | expired`

Acknowledgement and dismissal can also occur directly from `created`. The frontend
marks a record displayed when its row mounts; this is a rendering signal, not a
claim that an operator read it. Resolved records cannot return to an active state.
Repeated identical actions are idempotent.

Feedback is independent of lifecycle status. Operators may record or revise
`useful`, `not_useful`, `wrong_signal`, or `too_late`, including after expiry or call
completion. The record holds the latest assessment; event history retains every
change with the authenticated user ID and timestamp. This is one workspace-wide
assessment per nudge, not separate votes for each user.

## Queue Rules

- The gateway assigns a UUID and records call ID, signal type, text, priority,
  confidence, timestamps, optional detection latency, state, and feedback.
- Default lifetime is 45 seconds. Callback payloads may set 1-300 seconds.
- Identical text and signal type for the same call are suppressed for 15 seconds,
  including if the previous alert was already dismissed or acknowledged.
- At most three nudges are active for one call. An incoming alert replaces the
  oldest alert of the lowest priority, unless every active alert has higher
  priority. Lower-priority overflow returns 409 from the callback API; the voice
  integration skips it and continues processing the batch.
- Ending a call expires outstanding alerts. Expiry is materialized on the next
  nudge read/write, not by a background worker. The frontend refreshes every five
  seconds and on connection, nudge updates, and call-end events.
- The existing Python detector retains its confidence and cooldown rules. The
  gateway validates confidence ranges but does not calibrate scores or infer
  signal accuracy from feedback.

## API

| Endpoint | Behavior |
|---|---|
| `GET /api/nudges?call_id=<id>` | Latest 100 nudges for a call; omit call ID for workspace-wide recent records |
| `POST /api/nudges/:id/actions` | Body `{ "action": "acknowledged" }`, or another lifecycle/feedback action |
| `GET /api/nudges/:id/events` | Ordered lifecycle and feedback history with actor and timestamp |

All three require the workspace's cookie session. Mutations also require an
allowed Origin. The provider callback token cannot read or modify operator
feedback through these endpoints.

The gateway's voice-insights integration persists generated nudges before emitting
the canonical `nudge` event. The existing `/api/transcript/signal` callback follows
the same storage path and requires a known, non-completed call. Its nudge payload
must include `type` (or `signal_type`), `text`, `priority`, and `confidence`.
Authenticated `nudge:dismiss` socket requests also save the action and emit
`nudge:updated`. The HTTP action endpoint emits that same update event.

SQLite schema version 2 adds `nudges` and `nudge_events`, retaining existing calls
and authentication data. Nudge history remains after a call ends.

## Verification and Remaining Work

Gateway tests cover lifecycle transitions, conflicting/repeated actions, malformed
input, expiry, priority limits, callback ingestion, voice-generated nudges,
attributed socket dismissal, restart persistence, and API authentication.
Browser checks cover acknowledgement, usefulness feedback, refresh recovery,
and desktop/mobile rendering using an isolated workspace.

The view is limited to the latest 100 records; exports and older-history pagination
are future work. Feedback analytics, configurable rules, retention/deletion, and
separate reviewer roles also remain pending. Existing single-workspace boundaries
and dependency audit findings still apply.
