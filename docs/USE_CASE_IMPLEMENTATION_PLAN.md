# Veyra Use Cases and Implementation Plan

Planning revision: 2026-10-07
Status reconciled with current code: UC-01's local grounding foundation, UC-01A's
private-guidance/playbook/measurement slices, UC-02's internal inbox, UC-03's gap inbox,
UC-04's provider-free summary flow, and UC-06's guarded shadow-mode infrastructure are
implemented and passed the 2026-10-07 local automated/browser verification pass.
UC-05's first manual-review slice and UC-08's first authenticated kill-switch slice are
also locally verified. UC-07 impact execution, UC-08 incident/restore exercises,
external connectors, and evaluated language expansion remain future work.

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
| UC-01A | Live guidance console | Operator | Private search/editable delivery, first live playbook, and guidance measurement locally verified | P0 enhancement | Add customer-owned playbook approval and edit-support warnings |
| UC-02 | Delivered human handoff | Operator and supervisor | Durable internal delivery, acknowledgement, resolution, and audit events implemented | P0 hardening | Select and validate one external connector before claiming transfer |
| UC-03 | Knowledge-gap inbox | Knowledge owner | Deterministic grouping, counts, states, revision-gated resolution, UI, and audit events implemented | P1 hardening | Add regression-case execution and retention policy |
| UC-04 | Evidence-linked after-call summary | Operator and reviewer | Provider-free versioned draft, evidence navigation, revision, and acceptance implemented | P1 hardening | Add provider retry and curated evaluation |
| UC-05 | QA review and coaching | Supervisor/reviewer | Admin-only immutable rubrics, deterministic sampling, evidence-linked manual findings, coaching history, agreement and aggregate export locally verified | P1 | Obtain customer rubric and reviewer evaluation before AI suggestions |
| UC-06 | Customer-owned disclosure checklist | Operator and compliance reviewer | Immutable scoped versions, published-source binding, second-admin approval, live shadow states, and human confirmation implemented | P1 guarded | Obtain customer/legal approval and reviewed false-positive/negative set |
| UC-07 | Knowledge change impact review | Knowledge owner | Revision comparison, effective windows, publication jobs, and history exist | P1 | Add usage/impact preview and rollback selection |
| UC-08 | Operations incident and kill switch | Admin/operator | Audited per-capability controls, global degraded state, health restrictions, and queue pausing locally verified | P0 release control | Exercise outage/restore paths alongside production deployment work |
| UC-09 | Additional language/market rollout | Product owner and native reviewer | Four demo agents exist | P2 | Repeat evaluation independently per market/language |
| UC-10 | Autonomous sales, underwriting, collections, or payments | Customer/end user | Not safely supported | Deferred | Keep explicitly out of scope |

Priorities describe sequencing, not production readiness. UC-01 is the pilot product.
UC-02 proves delivery only to the authenticated internal workspace inbox; it does not
claim a phone transfer or delivery to an external customer system.

## Current Status Snapshot

### Completed local implementation

- Grounded market/product-scoped voice and text assistance with citations and abstention.
- Private Ask Veyra, editable explicit delivery, durable nudges, the first deterministic
  India-loan playbook, and guidance-interaction measurement.
- Durable internal handoff delivery/acknowledgement/resolution and grouped knowledge-gap
  triage linked to published revisions.
- Deterministic evidence-linked after-call drafts with immutable operator revisions,
  proposed follow-ups, and acceptance history.
- Disclosure-checklist authoring, different-admin approval, effective windows,
  published-revision binding, conservative live shadow states, human confirmation, and
  retirement. No customer checklist is bundled.
- Per-capability operational controls with admin-only mutation, bounded reasons, audit
  history, global restriction display, health reporting, and retry-preserving knowledge
  queue pauses. Outbound delivery remains visibly unconfigured.
- Admin-only manual QA with immutable rubric snapshots, deterministic call sampling,
  transcript/citation-linked findings, weighted human scoring, immutable completion,
  coaching history, reviewer agreement, and content-free aggregate export.

The guidance-measurement, summary, disclosure, operational-control, and QA bullets are
included in the 2026-10-07 provider-free automated and isolated-browser pass.

### Next implementation and validation work

1. Exercise UC-08 outage, queue, restore, and decommission paths against deployment-like failures.
2. Validate UC-05 with a customer-owned rubric and multiple reviewers; decide reviewer-role
   separation before any automated score suggestion.
3. Add customer-owned playbook configuration and evidence warnings for edited guidance.
4. Build UC-07 change-impact preview plus automatic gap/regression-case execution.
5. Select one external handoff/CRM destination, then evaluate each additional language
   and market independently.

## UC-01A: Live Guidance Console

### User outcome

During a live call, an operator can privately search approved knowledge, inspect
the evidence, edit the proposed wording, and explicitly speak or add the reply.
The private question never becomes a customer turn. Veyra retains the generated
wording, delivered wording, evidence, operator, and timestamps for review.

### First implementation slice

- Add an authenticated call-scoped private guidance endpoint using the call's
  fixed market, product, and language scope.
- Do not feed private questions to the customer transcript, conversation-state
  extractor, live signal detector, or knowledge-gap counts.
- Reuse the one-active-knowledge-tip slot so a new private result replaces an
  unselected stale result without evicting compliance or escalation alerts.
- Add an editable response composer with copy and explicit voice/text delivery.
- Keep the original suggestion immutable and record delivered wording, edit flag,
  source evidence, and authenticated operator attribution.
- Preserve apply idempotency and prevent automated guidance during an active
  human handoff, after expiry, or after call completion.

### Follow-up slices

Delivered locally: guidance effectiveness measurement, provider-free evidence-linked
summaries, and customer-owned disclosure-checklist infrastructure in shadow mode.

Still planned:

1. Customer-owned playbook configuration, approval, and effective versions.
2. Sentence-level evidence warnings for operator edits.
3. Manual QA/coaching with immutable rubrics and reviewer evidence.
4. Supervisor whisper, then one selected CRM and external handoff integration.

Acceptance: private questions never appear in the archived transcript; an edited
reply is delivered exactly once; replay cannot replace delivered wording; every
delivery retains original text and citations; unsupported private searches abstain;
permissions, restart, handoff, expiry, and interruption races are covered.

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

Implementation status: the provider-free slice is implemented. Completed calls now
receive versioned deterministic drafts, evidence links, structured proposed follow-ups,
operator revision/acceptance, and preserved audit history. Provider-backed asynchronous
generation, retry UI, evaluation, and workflow execution remain open. Automated and
isolated-browser verification passed on 2026-10-07.

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

Current implementation details and boundaries are recorded in
[CALL_SUMMARIES.md](CALL_SUMMARIES.md).

### Acceptance and measurement

- Late callbacks cannot mutate an already accepted summary.
- Provider retries use an idempotency key and one stored input snapshot.
- Review UI can navigate from each factual summary item to the supporting turn/citation.
- Evaluate accuracy, completeness, and instruction adherence on a curated set; also
  report acceptance rate, edit distance, missing-section rate, latency, and cost.

Estimated effort: five to eight engineering days plus approved provider evaluation.

## UC-05: QA Review and Coaching

Implementation status: the first provider-free manual slice is implemented. Administrators
can create immutable rubric versions, activate one version at a time, draw deterministic
privacy-minimized samples, self-assign a completed call, save evidence-linked findings,
complete an immutable weighted review, append attributed coaching notes, compare reviewer
agreement, and export aggregates without transcript content. No AI score is produced.
Customer rubric approval, a dedicated reviewer role/assignment queue, and real reviewer
evaluation remain open. See [QA reviews](QA_REVIEWS.md).

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

Implementation status: the guarded infrastructure and UI are implemented without a
bundled checklist. Administrators can create immutable scoped versions tied to published
knowledge, a different administrator must approve them, effective periods cannot overlap,
and Voice Studio shows conservative suggested states plus append-only human decisions.
Customer/legal approval, a dedicated compliance-owner role, and reviewed evaluation
remain open. See
[DISCLOSURE_CHECKLISTS.md](DISCLOSURE_CHECKLISTS.md).

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

Local implementation status: the authenticated control plane and enforcement slice is
implemented. It covers new sessions, customer-answer generation, private guidance,
guided delivery, proactive nudges, ingestion, and publication. Knowledge jobs paused by
a control stay retryable without consuming their attempt budget; withdrawal and
authenticated review remain available. The external-delivery control is intentionally
non-operational until a connector exists. Repository restore/decommission tooling now has
automated recovery coverage; production fault, encrypted-backup, and provider-account drills
remain external deployment work. Local regression/browser verification passed
on 2026-10-07.

## Delivery Sequence

| Phase | Deliverable | Current state | Remaining exit evidence |
| --- | --- | --- | --- |
| 0 | Pilot decisions and data boundaries | External decision | Named workflow, permitted data, retention, corpus owner, provider budget |
| 1 | Internal Handoff Inbox | Implemented and previously verified locally | Customer-selected external destination is separate work |
| 2 | Knowledge-Gap Inbox | Operational local slice implemented and previously verified | Automatic regression execution and retention policy |
| 3 | Evidence-linked summary | Provider-free versioned flow locally verified | Provider retry/usage path and curated accuracy evaluation |
| 4 | Disclosure checklist shadow mode | Guarded infrastructure/UI locally verified | Customer approval and reviewed false-positive/negative set |
| 5 | Manual QA review | First admin-only provider-free slice locally verified | Customer rubric, reviewer agreement evaluation, role/assignment decision |
| 6 | Operational release controls | First control-plane/enforcement slice locally verified | Fault injection, incident/restore exercises, provider-account disable controls |
| 7 | One selected external handoff adapter | Not implemented; destination unknown | Synthetic delivery/callback tests, visible failures, and runbook |
| 8 | Controlled human-agent pilot | Not started | Security/provider gates, training, monitoring, budget, incident owner, stop conditions |

Phases can overlap in engineering, but their exit evidence cannot be skipped. Do not add
the effort estimates together as a delivery promise; re-estimate after Phase 0 decisions.

## Repository Implementation Map

Current implementation ownership and the remaining planned boundaries are:

| Concern | Location | Current responsibility/status |
| --- | --- | --- |
| Durable schema | `apps/api-gateway/src/services/database.js` | Delivery, gap, summary, checklist, QA review/coaching, operational-control, and event tables exist; explicit migration tooling remains future hardening |
| Handoff domain | `apps/api-gateway/src/services/handoff-deliveries.js` | Implemented internal-inbox persistence, escalation idempotency, reconciliation, manual transitions, and audit events; external retry/delivery states are absent |
| Handoff API | `apps/api-gateway/src/routes/handoffs.js` | Implemented authenticated inbox/detail, acknowledge, and resolve actions; no provider callback endpoint exists |
| Delivery process | Planned `apps/api-gateway/src/handoff-worker.js` or a separately supervised service | Not present; required only after an external destination is selected |
| Connector adapter | Planned `apps/api-gateway/src/integrations/handoffs/` | Not present; internal inbox is the only delivery destination |
| Gap capture | `apps/api-gateway/src/services/knowledge-gaps.js` | Classify eligible abstentions, fingerprint/minimize text, group occurrences, reopen resolved gaps |
| Gap API | `apps/api-gateway/src/routes/knowledge-gaps.js` | List/detail and audited status/resolution updates with published-revision validation implemented; assignment and regression-case execution remain future work |
| Summary flow | `apps/api-gateway/src/services/call-summaries.js` | Deterministic snapshot hash, fallback generation, evidence links, immutable revisions, and acceptance implemented; provider jobs remain future work |
| Checklist flow | `apps/api-gateway/src/services/disclosure-checklists.js` | Scoped immutable versions, source/date approval gates, shadow evaluation, confirmations, and audit events implemented |
| Operational controls | `apps/api-gateway/src/services/operational-controls.js`, `routes/operations.js`, voice/knowledge enforcement points | Audited controls and queue-safe pauses implemented; incident exercises and provider-account actions remain open |
| QA review | `apps/api-gateway/src/services/qa-reviews.js`, `routes/qa.js` | Immutable rubric/review records, deterministic sampling, evidence checks, coaching, agreement, and aggregate export implemented; customer evaluation remains open |
| UI | `HandoffInboxPage.jsx`, `CallHistoryPage.jsx`, `KnowledgeHubPage.jsx`, `VoiceStudioPage.jsx`, `OperationsPage.jsx`, `QAPage.jsx` and their components | Delivery, gap triage, summary/QA review, checklist governance, live shadow review, and operational restriction surfaces are present |
| Contracts | `docs/CALL_SUMMARIES.md`, `docs/DISCLOSURE_CHECKLISTS.md`, `docs/QA_REVIEWS.md`, and domain documentation | Current behavior, limits, and non-claims documented; external connector contracts remain undecided |
| Verification | Gateway/Python/tenant tests, frontend build, dependency audit, and browser flows | 2026-10-07 provider-free pass covers measurement, summary, checklist, controls, QA, tenant recovery, and the zero-advisory toolchain; live-provider and customer evidence remain open |

Before adding a second asynchronous domain, extract common queue primitives only where
the state and retry semantics are genuinely shared. Do not turn the knowledge-job table
into a generic payload queue or place customer-specific connector logic in voice routes.

## Cross-Cutting Engineering Work

### Data and events

- Append-only events exist for escalation/delivery, gaps, summaries, checklist lifecycle,
  checklist confirmations, QA/coaching, and operational-control changes. Continue to
  derive workspace identity from the authenticated session, never client input.
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
