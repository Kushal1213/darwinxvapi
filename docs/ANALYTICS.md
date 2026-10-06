# Recorded conversation analytics

Dashboard and Analytics read persisted call snapshots from the authenticated
user's workspace. No accuracy, PII protection, ROI, or provider benchmark is
inferred from these records.

## API

`GET /api/analytics?days=7&market=all` requires a signed-in admin or operator.
Allowed `days` values are `7`, `30`, and `90`; the default is `7`. The market is
`all` (default), `india-loan`, `india-insurance`, `ph-bancassurance`, or `id-finance`.
Unsupported, repeated, or malformed parameters return 400. Workspace selection
comes from the authenticated account, never a request parameter. Responses are
marked `Cache-Control: no-store`.

Add `format=csv` to download daily aggregate rows with columns
`date,calls,completed,handoffs`, followed by a separate two-column guidance summary
when guidance data is present. CSV does not contain transcripts, names, private
questions, suggested wording, or call IDs. Explicit `format=json` returns the normal
JSON response.

The response contains `generated_at`, `filters`, `window`, `totals`, `daily`,
`markets`, `guidance`, and at most five `recent_calls`. Recent calls expose only IDs, market,
status, start/end timestamps, outcome, and turn count; they exclude transcript,
source excerpts, state, and handoff reasons.

## Measurement definitions

- The cohort contains calls **started** from UTC midnight `days - 1` days ago
  (inclusive) through `generated_at` (exclusive). Today is a partial UTC day.
  Invalid/missing start timestamps and calls outside this interval are excluded.
  A call started before the interval is excluded even when it ended inside it.
- All statuses contribute to total calls. Active counts `created`, `active`, and
  `escalated`; completed counts only `completed`. Completion is not a success or
  resolution judgment. These are current snapshot states, not historical state
  changes at each point in the chart.
- Handoffs count calls with at least one escalation or the outcome
  `human_handoff_requested`, once per call. They are assistance requests, not
  confirmed transfers. Daily completion and handoff counts are attributed to the
  call's start date.
- Duration is `ended_at - created_at` for completed calls with valid timestamps,
  a nonnegative duration, and no end timestamp in the future. It measures session
  elapsed time, which may include inactivity; it is not audio talk time.
- Reply latency uses finite, nonnegative numeric `latency_ms` values from
  assistant turns. Current voice routes record gateway processing through the
  retrieval reply, excluding speech recognition and synthesized audio playback.
  Missing latency, including direct handoff acknowledgements, is excluded.
- p50 and p95 use the nearest-rank rule: sort samples ascending, then select
  rank `ceil(percentile * sample_count)`, counting ranks from one. Averages and
  percentages are rounded to two decimals. Sample counts accompany duration
  and latency to make sparse measurements visible.
- Citation coverage is assistant turns with a nonempty `sources` array divided
  by **all assistant turns**, including handoff acknowledgements. It measures
  citation presence, not source correctness, grounding accuracy, or answer
  quality. Customer turns are excluded from this denominator.
- Missing measurements are `null`, never an invented zero; counts are zero.
  Daily buckets include every UTC date in the selected interval, even with no
  calls. Market buckets include observed markets only; missing legacy markets
  appear as `unknown` under the all-markets filter.

### Guidance effectiveness

The guidance cohort contains `knowledge_tip` records created inside the selected UTC
window and market. It is independent of the call-start cohort, so a tip is attributed
to when the guidance was generated. The response reports:

- generated, displayed, active, applied, edited, dismissed, and expired counts;
- apply, edit, dismissal, display, citation-presence, and feedback-response rates with
  explicit denominators;
- customer-turn versus private-operator-search origin counts;
- average recorded retrieval-to-suggestion latency and sample count;
- average time from suggestion creation to apply/dismiss and sample count;
- reason-coded dismissals, feedback volume, and useful percentage among ratings; and
- distinct calls with guidance and how many later recorded a handoff outcome.

Only grounded guidance requires a dismissal reason: `not_relevant`,
`incorrect_or_unsupported`, `too_verbose`, `already_answered`, `prefer_human`, or
`other`. Legacy dismissals remain visible as `unclassified`. Safety-alert dismissal
stays one click so reason capture does not delay urgent handling.

These measures describe operator interaction, not correctness, customer satisfaction,
compliance, causal impact, or ROI. “Useful” is an operator rating with its own response
denominator. Citation coverage measures source presence only.

## Boundaries and verification

The endpoint aggregates locally persisted snapshots at request time. It does not
call model providers or require voice services to be running. Existing legacy
JSON archives become available after the voice API's one-time SQLite import.
The implementation reads workspace snapshots and is intended for the current
local dedicated-stack volume; larger deployments need indexed event aggregates.
It does not measure failures, ASR/TTS latency, retrieval correctness, or provider
cost because those are not reliably recorded in the current call contract. Guidance
aggregation is computed from persisted records at request time and will require indexed
event aggregates at larger production volumes.

Run `node --test test/analytics.test.js` from `apps/api-gateway` for UTC boundary,
denominator, percentile, missing-measurement, workspace isolation, authentication,
filter, CSV, and restart-persistence verification with synthetic records.

## UI verification (2026-09-26)

The frontend production build and all 26 gateway tests passed. Browser checks
used a separate temporary workspace with four synthetic calls, confirming
7/30-day and market filters, empty results, a downloaded CSV's actual contents,
error/retry recovery without stale figures, dashboard-to-call-review navigation,
review URL reload and browser Back, and a 390px light-mode layout without
horizontal page overflow. No JavaScript page errors were observed. Provider
voice quality was outside this change. Vite still reports sourcemap reporting
warnings in `main.jsx` and a large bundle warning.
