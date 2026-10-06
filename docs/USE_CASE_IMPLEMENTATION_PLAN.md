# Veyra Use Cases and Implementation Plan

Planning revision: 2026-10-06
Status: UC-02 internal inbox and UC-03 gap triage implemented locally; remaining slices require the gates stated below.

## Product Direction

Veyra should first become a dependable human-agent assistance and review system for
one inbound India personal-loan support workflow. It should not make lending decisions,
promise rates or eligibility, execute payments, or contact customers autonomously.

The useful product loop is:

1. A knowledge owner publishes a reviewed, effective revision.
2. An operator receives a grounded suggestion during a conversation.
3. Unsupported or risky requests move to a person through a visible, recoverable handoff.
4. The completed conversation creates evidence for review, knowledge improvement, and pilot measurement.

This positioning matters because real-time knowledge suggestions, summaries, and agent
feedback are established Agent Assist capabilities. Veyra's testable differentiation
should be controlled publication, revision/page traceability, recoverable operations,
deployment boundaries, and a closed improvement loop—not generic RAG alone.

## Prioritized Use-Case Portfolio

| ID | Use case | Primary actor | Current foundation | Priority | Recommendation |
| --- | --- | --- | --- | --- | --- |
| UC-01 | Grounded policy assistance | Operator | Implemented: scoped retrieval, citations, abstention, voice/text sessions | P0 hardening | Pilot after customer corpus and live-provider gates |
| UC-02 | Delivered human handoff | Operator and supervisor | Durable internal delivery, acknowledgement, resolution, and audit events implemented | P0 hardening | Select and validate one external connector before claiming transfer |
| UC-03 | Knowledge-gap inbox | Knowledge owner | Deterministic grouping, counts, states, revision-gated resolution, UI, and audit events implemented | P1 hardening | Add regression-case execution and retention policy |
| UC-04 | Evidence-linked after-call summary | Operator and reviewer | Current summary is only the last four turns | P1 | Build as a draft requiring review |
| UC-05 | QA review and coaching | Supervisor/reviewer | Transcript, citations, nudges, and outcomes exist | P1 | Add manual rubric before AI scoring |
| UC-06 | Customer-owned disclosure checklist | Operator and compliance reviewer | Versioned knowledge and citations exist | P1 guarded | Build only from an approved customer checklist |
| UC-07 | Knowledge change impact review | Knowledge owner | Revision comparison, effective windows, publication jobs, and history exist | P1 | Add usage/impact preview and rollback selection |
| UC-08 | Operations incident and kill switch | Admin/operator | Health views and isolated stacks exist | P0 release control | Build alongside production deployment work |
| UC-09 | Additional language/market rollout | Product owner and native reviewer | Four demo agents exist | P2 | Repeat evaluation independently per market/language |
| UC-10 | Autonomous sales, underwriting, collections, or payments | Customer/end user | Not safely supported | Deferred | Keep explicitly out of scope |

Priorities describe sequencing, not production readiness. UC-01 is the pilot product.
UC-02 proves delivery only to the authenticated internal workspace inbox; it does not
claim a phone transfer or delivery to an external customer system.

## UC-02: Delivered Human Handoff

Local implementation status: complete for `internal_inbox`. The same-transaction
delivery record, idempotency, list/detail/actions API, operator UI, audit events,
restart reconciliation, and lifecycle tests are present. Queue workers, failure/retry,
and callback acknowledgement remain connector work after a destination is selected.

### User outcome

An operator requests assistance, sees who or what queue received the request, and can
distinguish requested, delivered, acknowledged, resolved, and failed states. A failed
external connector never appears as a successful transfer.

```text
handoff requested -> delivery queued -> connector accepted -> recipient acknowledged -> resolved
                           |                    |
                           +-> retry/failed <---+
```

### First implementation slice

- Add an internal supervisor inbox before selecting an external CRM/contact-center
  connector. This exercises ownership, acknowledgement, retry, and audit behavior
  without pretending a vendor integration exists.
- Create `handoff_deliveries` with `id`, `workspace_id`, `call_id`, `escalation_id`,
  `destination_type`, `destination_id`, `state`, `idempotency_key`, `attempts`,
  `next_attempt_at`, `provider_reference`, `requested_by`, `created_at`, `delivered_at`,
  `acknowledged_at`, `resolved_at`, and a bounded operator-safe error.
- Keep immutable `handoff_events` for state changes and actor attribution.
- Use a dedicated delivery worker/adapter boundary. Do not reuse knowledge job kinds;
  handoffs have different urgency, retention, destination, and retry semantics.
- Queue delivery in the same SQLite transaction that records the escalation. A repeated
  request for the same active escalation returns the original delivery.
- Add `GET /api/handoffs`, `GET /api/handoffs/:id`,
  `POST /api/handoffs/:id/acknowledge`, `POST /api/handoffs/:id/resolve`, and an
  admin retry endpoint. Connector callbacks require a scoped secret and idempotent
  provider event ID.
- Add a Handoff Inbox to Live Insights with age, priority, destination, delivery state,
  last customer message, redacted context, and links to the live or archived call.
- Emit Socket.IO state updates only after the database transaction commits.

### Acceptance

- Restart between queueing and delivery resumes the same idempotency key.
- Duplicate requests and callbacks do not create duplicate inbox items.
- A connector timeout remains `retry` or `failed`, never `delivered`.
- Operators cannot acknowledge another workspace's delivery; provider tokens cannot
  read transcripts or use browser/admin APIs.
- Ending a call does not erase an unresolved handoff. Retrying cannot reopen a completed
  call or change its transcript.
- Metrics distinguish requested, delivered, acknowledged, resolved, failed, and age;
  no state is labelled a successful transfer without acknowledgement evidence.

### Estimated effort

Seven to eleven engineering days for the internal inbox, durable worker, APIs, UI,
auditing, restart/failure tests, and documentation. An external connector is estimated
only after the pilot destination and its authentication/callback contract are selected.

## UC-03: Knowledge-Gap Inbox

Local implementation status: first operational slice complete. Supported abstention
reasons group by normalized workspace/market/product/question fingerprint; excerpts
redact email addresses and long digit sequences; example call IDs are capped; closed
gaps reopen on recurrence. Admin triage and revision-gated resolution are audited.
Automatic regression execution and approved retention/deletion remain follow-up gates.

### User outcome

Knowledge owners can see repeated unsupported questions, decide whether the question is
in scope, publish a new revision when appropriate, and verify the gap against the same
reviewed evaluation case before closing it.

### Implementation

- Record a gap only for explicit retrieval outcomes such as `no_eligible_candidates`,
  `insufficient_support`, conflicting eligible evidence, or provider failure. Greetings,
  explicit human requests, and malformed inputs are not knowledge gaps.
- Store a normalized fingerprint, workspace, market, product, reason, occurrence count,
  first/last seen timestamps, example call IDs, status, assignee, and resolution revision.
  Raw transcript storage is opt-in; default to the minimum question excerpt needed for
  triage and apply the approved retention policy.
- Add statuses `open`, `triaged`, `out_of_scope`, `planned`, `resolved`, and `reopened`.
- Add `/api/knowledge/gaps` list/detail/update routes and a Knowledge Hub inbox with
  frequency, recency, market/product, reason, and linked evidence.
- Resolving with a document revision creates a regression case. Reopen automatically if
  the same fingerprint still abstains after that revision becomes active.

### Acceptance and measurement

- Duplicate questions group deterministically inside one workspace and product scope.
- Wrong-market questions never become requests to publish cross-market content.
- Closing a gap requires an out-of-scope reason or an active revision plus a passing test.
- Report new gaps, repeated gaps, median triage age, and verified resolution rate—not
  the misleading goal of driving abstentions to zero.

Estimated effort: five to eight engineering days after UC-02 establishes a reusable
event/audit pattern.

## UC-04: Evidence-Linked After-Call Summary

### User outcome

An operator receives a draft summary containing customer intent, facts stated by the
customer, assistance provided, unresolved issues, handoff state, and next action. Policy
claims retain the document revision, chunk, and PDF page that supported them.

### Implementation

- Introduce a versioned `call_summaries` record instead of overwriting the call payload.
  Store schema/prompt/model versions, generation state, sections, evidence references,
  author/editor, timestamps, and provider usage when available.
- Generate asynchronously after call completion. Provider failure leaves the call review
  usable and exposes retry; it never blocks call archival.
- Require each summary fact to reference transcript turn IDs or knowledge citation IDs.
  Unsupported generated sentences are removed or marked for reviewer attention.
- Let an operator accept or edit a draft. Preserve the generated version and append an
  audit event; do not silently train on edits or send them to a provider.
- Add deterministic fallback sections from persisted call state when no provider is
  configured. Label fallback and model-generated summaries distinctly.

### Acceptance and measurement

- Late callbacks cannot mutate an already accepted summary.
- Provider retries use an idempotency key and one stored input snapshot.
- Review UI can navigate from each factual summary item to the supporting turn/citation.
- Evaluate accuracy, completeness, and instruction adherence on a curated set; also
  report acceptance rate, edit distance, missing-section rate, latency, and cost.

Estimated effort: five to eight engineering days plus approved provider evaluation.

## UC-05: QA Review and Coaching

### User outcome

A reviewer samples completed calls, applies a versioned rubric, records evidence-linked
findings, and returns coaching to the operator without treating model scores as facts.

### Implementation

- Start with manual `qa_reviews`, `qa_rubrics`, `qa_findings`, and review assignment.
  Suggested dimensions: correct source use, unsupported-claim avoidance, required
  escalation, clarity, process adherence, and nudge usefulness.
- Add a least-privilege reviewer role only when the customer confirms the separation of
  duties. Until then, restrict pilot review to admins and document that limitation.
- Support deterministic sampling by date, market, outcome, handoff, and missing citation.
- Add AI suggestions only after manual reviewer agreement is measured. Suggestions must
  cite exact transcript turns and remain editable/rejectable.
- Export aggregates without transcript content by default.

Acceptance: rubric versions are immutable after use; every failed item has evidence and
a reviewer; changing a model cannot rewrite historical reviews; reviewer disagreement
and sample size remain visible. Estimated effort: eight to twelve engineering days.

## UC-06: Customer-Owned Disclosure Checklist

### User outcome

During an in-scope loan-information conversation, the operator sees which customer-owned
disclosure topics have evidence in the transcript and which still require attention.
This is a workflow aid, not a legal-compliance determination.

### Implementation guardrails

- The customer compliance owner supplies and approves a versioned checklist for the
  selected workflow, market, channel, and effective period. Do not encode a generic
  “RBI compliant” checklist or infer applicability from this repository.
- Checklist items reference approved knowledge revisions and define `required`,
  `not_applicable`, and human-confirmation conditions.
- Detection may suggest `observed`, `missing`, or `uncertain`; only a human may confirm
  completion. Each observation links to a transcript turn and, where applicable, a
  knowledge citation.
- Keep lending decisions, eligibility determinations, customer consent, and document
  delivery outside the language model. Integrations must verify those actions in their
  authoritative systems.

Acceptance: expired checklist versions cannot apply to new calls; a missing provider or
low evidence produces `uncertain`, not pass; every result shows checklist version and
evidence; legal/customer owners sign off before pilot use. Estimated effort: eight to
twelve engineering days after checklist approval, excluding legal and policy work.

## UC-07 and UC-08: Governance and Operational Controls

### Knowledge change impact review

- Before publication, show affected market/product, scheduled activation, current live
  revision, changed pages/chunks, and recent calls that cited the prior revision.
- Add explicit rollback-to-revision as a new independently approved publication intent;
  never reactivate an expired or withdrawn revision silently.
- Create regression cases from prior citations and open knowledge gaps, then run them
  before approval. Block publication only on customer-approved critical cases.
- Add retained-generation quotas and cleanup after backup/reference checks.

### Incident and kill switch

- Add per-capability controls for new voice sessions, provider generation, ingestion,
  publication, proactive nudges, and outbound connector delivery. Preserve authenticated
  read/review access when safe.
- Persist who changed each control, why, and when. Require a bounded reason and display
  the active restriction prominently.
- Add provider health, queue age, retry exhaustion, storage capacity, and stale-snapshot
  indicators. Raw prompt/transcript content is excluded from telemetry by default.
- Test provider outage, corrupt snapshot, full disk, callback replay, secret rotation,
  restore, and tenant decommission procedures.

## Delivery Sequence

| Phase | Deliverable | Exit evidence |
| --- | --- | --- |
| 0 | Pilot decisions and data boundaries | Named workflow, handoff recipient, permitted data, retention, corpus owner, provider budget |
| 1 | Internal Handoff Inbox | Durable requested-to-acknowledged flow; restart, duplicate, timeout, and authorization tests |
| 2 | One selected external handoff adapter | Synthetic delivery and callback acknowledgement; operator-visible failures; runbook |
| 3 | Knowledge-Gap Inbox | Scoped grouping, assignment, resolution-to-revision, regression case creation |
| 4 | Evidence-linked summary | Versioned draft, provider/fallback behavior, human edit audit, curated evaluation |
| 5 | Manual QA review | Versioned rubric, sampling, evidence-linked findings, aggregate export |
| 6 | Disclosure checklist shadow mode | Customer-approved checklist, human confirmation, reviewed false-positive/negative set |
| 7 | Controlled human-agent pilot | Security/restore/provider gates, training, monitoring, budget, incident owner, stop conditions |

Phases can overlap in engineering, but their exit evidence cannot be skipped. Do not add
the effort estimates together as a delivery promise; re-estimate after Phase 0 decisions.

## Repository Implementation Map

The first three slices fit the existing repository without replacing its service stack:

| Concern | Proposed location | Responsibility |
| --- | --- | --- |
| Durable schema | `apps/api-gateway/src/services/database.js` plus an explicit migration helper | Add delivery/event/gap/summary tables and indexes without rewriting existing payloads |
| Handoff domain | `apps/api-gateway/src/services/handoff-deliveries.js` | State machine, idempotency, retry policy, audit events, connector-neutral contract |
| Handoff API | `apps/api-gateway/src/routes/handoffs.js` | Authenticated inbox/detail/actions and scoped connector callbacks |
| Delivery process | `apps/api-gateway/src/handoff-worker.js` initially, promoted to a separately supervised process before external pilot | Claim due work, call one adapter, persist acknowledgement/failure, resume safely |
| Connector adapter | `apps/api-gateway/src/integrations/handoffs/` | Internal inbox first; one customer-selected provider behind the same interface |
| Gap capture | `apps/api-gateway/src/services/knowledge-gaps.js` | Classify eligible abstentions, fingerprint/minimize text, group occurrences, reopen resolved gaps |
| Gap API | `apps/api-gateway/src/routes/knowledge-gaps.js` | List, triage, assign, resolve, and link revisions/evaluation cases |
| Summary jobs | `apps/api-gateway/src/services/call-summaries.js` | Snapshot completed calls, generate/fallback, validate evidence links, retain versions |
| UI | `HandoffInboxPage.jsx`, additions to `KnowledgeHubPage.jsx` and `CallHistoryPage.jsx` | Delivery operations, gap triage, summary review without inventing successful states |
| Contracts | `docs/HANDOFF_DELIVERY.md`, `docs/KNOWLEDGE_GAPS.md`, `docs/CALL_SUMMARIES.md` | State transitions, permissions, retention, failure and recovery behavior |
| Verification | Gateway integration tests plus connector contract fixtures and frontend build | Restart, duplicate, timeout, cross-workspace, late-callback, redaction, and accessibility cases |

Before adding a second asynchronous domain, extract common queue primitives only where
the state and retry semantics are genuinely shared. Do not turn the knowledge-job table
into a generic payload queue or place customer-specific connector logic in voice routes.

## Cross-Cutting Engineering Work

### Data and events

- Add append-only domain events for escalation, delivery, summary, gap, QA, checklist,
  and kill-switch transitions. Use workspace identity from the authenticated session,
  never from client input.
- Give every asynchronous operation an idempotency key, bounded retries, timestamps,
  and an operator-visible terminal state.
- Record schema, rule, prompt, model, knowledge revision, and evaluation versions needed
  to reproduce an outcome.
- Define retention/deletion behavior separately for transcripts, summaries, questions,
  citations, provider payloads, audit events, exports, and backups.

### Security

- Treat transcript text, uploaded documents, connector payloads, and model output as
  untrusted data. Validate tool/connector arguments and enforce permissions outside the
  model.
- Keep Python services and worker endpoints private. Browser cookies do not authenticate
  direct service ports.
- Use destination-scoped connector credentials, callback replay protection, secret
  rotation, and redacted errors. Never store provider secrets in domain payloads.

### Evaluation

- Maintain separate fixture, synthetic replay, shadow-mode, and live-provider reports.
- Expand the grounding corpus with conflicting sources, adversarial documents, page
  citations, effective-window transitions, ambiguous product questions, and outages.
- Freeze a held-out customer-reviewed set before tuning. Report denominators and reviewer
  disagreement; never infer production accuracy from fixture tests.
- Evaluate each new language and market independently with native reviewers.

### Observability

- Correlate call, turn, retrieval, citation, nudge, handoff, connector, job, and summary
  IDs. Capture state, duration, error class, versions, and token/usage counts without raw
  content by default.
- Track p50/p95 delivery and acknowledgement latency, summary time, gap age, queue age,
  provider errors, retries, and sample counts.

## Decisions Required

| Decision | Recommended default | Owner |
| --- | --- | --- |
| Pilot workflow | India inbound personal-loan policy support, human-agent assist | Product owner + design partner |
| First handoff destination | Internal supervisor inbox, then one selected connector | Customer operations + platform lead |
| Recipient acknowledgement | Explicit human action or authoritative provider callback | Customer operations |
| Gap data retained | Normalized fingerprint and minimal excerpt; no full transcript duplication | Privacy/security owner |
| Summary use | Draft for internal review only; no automatic customer/CRM send | Operations + compliance |
| Reviewer access | Admin-only initially; add reviewer role after duty mapping | Security + operations |
| Disclosure checklist | Customer-authored, versioned, human-confirmed | Customer compliance owner |
| Production deployment | Dedicated customer stack with private Python services | Platform + customer security |
| Live provider budget | Small synthetic-data smoke-test budget before pilot | Product + platform |
| Retention and deletion | No default promise; decide per data class and backup | Privacy/security owner |

If these decisions are not available, implementation may continue with synthetic
fixtures and the internal inbox, but customer data and external delivery stay disabled.

## Research Basis and Limits

- Google documents real-time knowledge/response suggestions and conversation profiles
  as standard Agent Assist capabilities, supporting the decision not to position generic
  suggestions as Veyra's differentiator:
  [Agent Assist basics](https://docs.cloud.google.com/gemini-enterprise-cx/agent-assist/basics) and
  [Generative knowledge assist](https://docs.cloud.google.com/gemini-enterprise-cx/agent-assist/generative-knowledge-assist).
- Google's guidance recommends representative golden examples and exposes explicit
  answer feedback; these are useful product patterns, not Veyra production benchmarks:
  [knowledge-assist best practices](https://docs.cloud.google.com/gemini-enterprise-cx/agent-assist/pgka-bp) and
  [answer feedback](https://docs.cloud.google.com/gemini-enterprise-cx/agent-assist/feedback).
- NIST frames generative-AI risk management across the lifecycle; Veyra should retain
  versioned evidence and release gates rather than treating a passing demo as assurance:
  [NIST AI 600-1](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence).
- OWASP identifies retrieved documents and conversation history as untrusted prompt-
  injection channels and recommends permission enforcement outside the model:
  [Prompt Injection Prevention](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html).
- RBI materials emphasize customer-facing key facts and grievance mechanisms in digital
  lending. Applicability and exact checklist content require customer-specific legal and
  compliance review; this plan does not interpret regulation:
  [RBI Annual Report 2024-25](https://www.rbi.org.in/scripts/AnnualReportPublications.aspx?Id=1436).

No customer interviews, live contact-center integration, legal opinion, live-provider
benchmark, or production security assessment was performed for this planning revision.
