# Veyra Product Work Plan

Research revision: 2026-09-26
Implementation status reviewed: 2026-10-06
Status: active product plan; use as guidance and validate priorities against product evidence.

Detailed workflow portfolio and proposed implementation slices:
[Use Cases and Implementation Plan](USE_CASE_IMPLEMENTATION_PLAN.md).

## Purpose and Decision Summary

Veyra is a product, not an assessment. The original assessment/PRD documents are background references, not delivery requirements or instructions. This revision replaces the previous duplicated workstreams and outdated backlog with a baseline, research findings, ordered work packages, and release gates.

Recommended sequence: correct grounding and product claims -> approval-controlled knowledge -> recoverable publication -> production security and observable workflows -> controlled pilot.

Important changes from the previous plan:

- Completed call persistence, nudges, knowledge lifecycle, team access, and dedicated-stack provisioning are no longer listed as new work.
- Grounding-quality evaluation, unsupported accuracy/PII claims, and knowledge approval remain P0 blockers. Cross-market fallback has a hard-filter implementation and still needs corpus evaluation.
- SDK maintenance and real-provider evaluation move ahead of pilot commitments.
- Dedicated tenant stacks remain the near-term architecture. Shared-process multi-tenancy is deferred, not marked complete.
- Human-agent assistance for one workflow is the proposed first pilot. This is a recommendation, not a confirmed customer requirement.
- No application code, dependencies, credentials, deployments, or customer data are changed as part of this planning update.

## Current Baseline

| Area | Implemented locally | Remaining gap |
| --- | --- | --- |
| Calls | Shared lifecycle, persistence, review, citations, and durable internal handoff delivery/acknowledgement/resolution | External connector delivery and live voice reliability |
| Workspace | SQLite users/sessions, admin/operator permissions, invitations, disabling | Recovery, MFA/SSO, permission review, customer deployment |
| Nudges | Persistence, expiry, duplicate suppression, feedback, audit events | Measured usefulness, signal-quality evaluation, production delivery behavior |
| Knowledge | Immutable revisions, effective windows, approval/publication jobs, revision/page citations, and grouped knowledge-gap triage | Separate worker supervision, automatic gap regression, retention, and explicit legacy corpus review |
| Tenant boundary | Independent local stacks and storage; cross-stack tests | Private production networks, container/VM boundaries, per-tenant operations |
| Retrieval | FAISS plus lexical fallback; market/product hard filters; attributed evidence extraction and explicit abstention | Customer-reviewed isolation/support corpus and calibrated thresholds |
| Analytics | Persisted workspace metrics, distinct sample counts, unavailable states, filters, and CSV export | No validated pilot ROI or live-provider performance baseline |
| Providers | Maintained `google-genai` SDK adapter, pinned dependencies, and provider-free contract tests | Account/region availability, limits, terms, and authorized live smoke tests |
| Verification | 31 gateway + 19 Python + 2 tenant tests, seven-case grounding gate, provider inventory test, and frontend production build passed on 2026-10-06 | Live-provider quality and customer-reviewed corpus remain unproven |

Evidence inspected for this revision:

- [RAG service](../services/rag-service/main.py): market/product filters are now hard eligibility checks; answer synthesis and corpus quality still need reviewed evaluation.
- [Knowledge routes](../apps/api-gateway/src/routes/knowledge.js): processing, review, and publication are separate; durable jobs recover uploads, publication, and withdrawal, including future-effective scheduling.
- [Analytics](../apps/frontend/src/pages/AnalyticsPage.jsx): fixed accuracy, PII, latency, language, and volume values.
- [Gemini provider](../services/gemini_provider.py): maintained SDK adapter preserves the existing embedding model/dimension; heuristic PII detection remains separate and is not a compliance control.
- [Knowledge contract](KNOWLEDGE_DOCUMENTS.md), [team contract](TEAM_ACCESS.md), and [tenant contract](TENANT_STACKS.md): operational limits.
- Shared-process tenant isolation remains absent; dedicated stacks are the supported local boundary.

## Research Findings

These are primary-source findings reviewed on 2026-09-26. The Veyra decisions below are engineering/product recommendations, not claims that the sources prescribe this exact architecture.

| Finding | Implication for Veyra |
| --- | --- |
| Google recommends google-genai; google-generativeai is a legacy library that is not actively maintained. [SDK documentation](https://ai.google.dev/gemini-api/docs/libraries) | Plan a tested SDK migration and account-specific model smoke tests before pilot commitments. |
| Model lifecycle schedules are published separately from SDK maintenance. [Model deprecations](https://ai.google.dev/gemini-api/docs/deprecations) | Inventory deployed model IDs and aliases; do not combine SDK migration with an untested embedding-model swap. |
| OWASP documents indirect prompt injection through retrieved content and layered defenses. [Prevention guidance](https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html) | Treat uploaded documents as untrusted data; approval is not an injection-proofing mechanism. Test malicious documents and restrict actions independently. |
| The transactional outbox pattern addresses database/event dual writes and requires duplicate-handling discipline. [AWS guidance](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html) | Record durable publication intent with metadata changes; make workers idempotent. This does not make SQLite and FAISS one atomic transaction. |
| NIST's GenAI profile is a voluntary resource for trustworthy AI design and evaluation. [NIST AI 600-1](https://www.nist.gov/publications/artificial-intelligence-risk-management-framework-generative-artificial-intelligence) | Maintain a risk register and release evidence, not just a feature checklist. Do not claim certification or regulatory compliance. |
| OpenTelemetry warns that model inputs/outputs are sensitive and recommends not capturing their content by default. [GenAI conventions](https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-spans.md) | Trace IDs, durations, versions, and outcomes first; raw transcript/prompt capture requires separate policy and access controls. Pin the convention version used. |
| Google's Agent Assist already offers suggestions based on uploaded business data. [Product documentation](https://docs.cloud.google.com/gemini-enterprise-cx/agent-assist) | Generic RAG and live suggestions are not sufficient differentiation. Validate Veyra's approval governance, traceability, deployment options, and workflow fit with buyers. |
| MeitY publishes the DPDP Rules 2025 and a separate enforcement timeline. [Official publication index](https://www.meity.gov.in/documents/act-and-policies/digital-personal-data-protection-rules-2025-gDOxUjMtQWa) | Before an India pilot, obtain an applicability/timeline review for the actual customer, data flows, and sector. Do not infer that every provision is already effective or that this product is compliant. |

Research limits: no customer interviews, procurement validation, pricing comparison, legal opinion, live provider benchmark, or fresh vulnerability audit was performed. Provider documentation can change; recheck it when implementation starts.

## Product Scope to Validate

Proposed pilot: human-agent assistance for inbound personal-loan policy/support questions at one India BFSI organization, using customer-approved knowledge. The human remains responsible for communicating the answer and making decisions.

Exclude autonomous lending decisions, binding eligibility/price promises, collections, outbound campaigns, and payments from the first pilot. Preserve voice experiments as a sandbox until provider and operational gates pass. Philippines/Indonesia remain demonstration coverage until native-speaker and customer-policy review.

Positioning hypothesis: Veyra helps a small operations team control which knowledge is usable, trace an answer to the approved revision, and review whether assistance helped. This hypothesis needs buyer validation; it is not an established competitive advantage.

Discovery work, before committing to a pilot date:

1. Product owner conducts five interviews spanning an operations buyer, agents, knowledge owners, and a security/compliance stakeholder.
2. Choose one workflow and one design partner with an available knowledge owner and approver.
3. Collect permissioned or synthetic representative questions and transcripts; document the data-use boundary.
4. Observe the current workflow and baseline handling/review effort. Do not promise ROI from vendor marketing benchmarks.
5. Produce a one-page pilot charter: users, languages, volumes, integration needs, success measures, exclusions, data handling, and stop conditions.

No customer name, team size, cloud provider, retention duration, or commercial price is assumed.

## Ordered Work Packages

The work-package text below preserves the original planning intent. The current-baseline
table and implementation-progress sections are authoritative for completed local work.
Owner labels are responsibilities to assign, not existing staffing commitments. Effort
is a rough engineering planning range for a familiar codebase; external review/procurement
time is excluded.

| ID | Priority | Work package | Dependency | Accountable role | Rough effort |
| --- | --- | --- | --- | --- | --- |
| P0-A | P0 | Grounding, market eligibility, truthful metrics, baseline evaluation | None | AI/backend lead + product owner | 4-7 engineering days |
| P0-B | P0 | Provider/SDK and dependency compatibility review | None; can overlap P0-A | Platform lead | 2-4 days to inventory/spike; remediation estimated after triage |
| P0-C | P0 | Knowledge revisions, review, and publication controls | P0-A eligibility contract | Backend lead + knowledge owner | 6-10 engineering days |
| P0-D | P0 | Durable jobs, reconciliation, recovery tests | P0-C revision/publication schema | Platform/backend lead | 5-8 engineering days |
| P0-E | P0 | Customer deployment, privacy, security and operational readiness | Design can overlap; live-data release needs A-D | Platform lead + customer security owner | 5-10 engineering days plus external review |
| P1-A | P1 | Real operational analytics and pilot evaluation | P0-A events; P0-C/D versions and jobs | Product/data lead | 4-7 engineering days |
| P1-B | P1 | Controlled pilot and one provider integration | P0-A through E and P1-A gates | Product owner + customer operations | Timeboxed pilot agreed after discovery |

Do not interpret these ranges as a dated delivery promise or add them blindly across parallel tracks. Re-estimate after discovery and the SDK/dependency spike. P0-C may be built using fixtures before P0-B completes, but no live-provider readiness claim follows from that.

### P0-A: Grounded Answers and Honest Product Signals

Planned work:

- Remove fixed financial facts from the answer path. Every substantive policy fact must be supported by an eligible source or the system must abstain/escalate.
- Make market and product eligibility hard filters for both vector and lexical retrieval. Unknown market/product is an explicit error or clarification, never a silent default.
- Return fewer than top_k results when only those results are eligible; do not fill with other-market knowledge.
- Define retrieval mode, document revision, chunk identity, publication generation, and abstention reason in the result contract. Retrieval mode and abstention reason are now exposed; richer revision metadata remains pending.
- Do not label cosine similarity, lexical overlap, or an uncalibrated heuristic as answer confidence.
- Remove or explicitly label static Analytics/Dashboard metrics as demo data; never present static accuracy or PII protection as measured.
- Build the evaluation manifest before tuning: question, permitted market/product, expected source revision, expected action, risk category, and reviewer. A fixture manifest and runner now exist; customer-reviewed corpus expansion remains pending.
- Add unsupported, conflicting, expired, wrong-market, adversarial-document, and provider-outage cases.

Acceptance:

- Zero wrong-market or unpublished-source responses in the release isolation corpus.
- Every factual policy answer in the critical-case suite has reviewer-verified supporting evidence.
- Unsupported questions abstain with a reason; explicit human requests retain the existing deterministic handoff behavior.
- Metric cards read recorded events or clearly identify demo/unavailable data.
- A reproducible report separates vector/lexical mode and fixture/live-provider runs.

### P0-B: Provider and Dependency Compatibility

Planned work:

- Inventory SDK versions, model IDs, account/region availability, input limits, timeouts, and provider data-handling terms without exposing secrets. A local no-secrets provider inventory command now covers SDK/model references and dependency pins; account availability, limits, terms, and live smoke tests remain pending.
- Migrate legacy Google Python integration to the maintained SDK behind focused contract tests. Implemented locally with `google-genai==2.28.0`; authorized live-account validation remains pending.
- Keep the existing embedding model/dimension unless an evaluated migration is justified. Same dimension alone does not make vectors from different models comparable.
- If changing embeddings: record model/dimension/chunker identity, rebuild a separate index generation, evaluate, and retain a rollback path.
- Run fresh Node and Python dependency audits, classify runtime exposure, and prioritize exploitable high-severity issues before external access.
- Test cancellation, rate limits, missing/invalid credentials, structured errors, and explicit degraded-mode reporting.
- Use a small approved paid-provider budget and synthetic data for live smoke tests; do not invoke providers during planning.

Acceptance: reproducible dependency lockfiles, supported SDK/model inventory, reviewed audit disposition, and passing live smoke tests in the intended account. Historical advisories and 27 fixture-focused tests are not current production assurance.

### P0-C: Approval-Controlled Knowledge

Keep processing, review, and publication as separate state dimensions:

| Dimension | Proposed states |
| --- | --- |
| Processing | uploaded, extracting, embedding, ready, failed |
| Review | draft, pending_review, approved, rejected |
| Publication | unpublished, publishing, published, withdrawn, expired |

Planned design:

- Create immutable document revisions with original-content hash, title, source, market/product, effective_from/effective_to, author, reviewer, review reason, timestamps, extraction/chunker/embedding versions, and chunk references.
- Build staged chunks outside the active retrieval snapshot. Being embedded or approved must not implicitly mean published.
- Review the exact revision and metadata; edits create a new revision and invalidate its approval.
- Use existing admin access initially, with a different admin as approver for live-data publication. Single-admin demo exceptions, if needed, must be explicit, audited, and disabled for customer deployments.
- Restrict review preview to authorized reviewers; it must not leak draft material into customer queries.
- Publication eligibility requires approved revision, correct tenant/market/product, valid effective dates, and no withdrawal.
- Record approval and publication intent durably. P0-D completes automatic execution/reconciliation before the live-pilot gate.
- Fence stale publish jobs with revision/approval identity so a delayed retry cannot republish a withdrawn revision.
- Preserve the prior approved active revision while a replacement is reviewed; withdrawal removes eligibility for new queries immediately.
- Cite the immutable revision used by each response; record how in-flight requests behave when approval is withdrawn.
- Require an explicit migration review for legacy searchable files. Never silently mark the legacy corpus approved. A synthetic demo corpus must remain clearly separate from customer publication.

Acceptance scenarios: rejected drafts never retrieve; editing approved content cannot bypass re-review; expired and withdrawn material is excluded; duplicate approvals do not duplicate publication; rollback points only to an eligible approved revision; all decisions have actor, reason, and revision attribution.

### P0-D: Durable Jobs and Publication Recovery

Recommended first design: a durable per-tenant SQL jobs/outbox table and a separate supervised worker, preserving one writer per FAISS directory. Evaluate an external broker only if workload evidence justifies it; no Celery/Temporal/cloud queue selection is committed.

- Write job intent with document metadata in one database transaction.
- Give jobs revision-scoped idempotency keys, attempt counts, bounded exponential backoff with jitter, leases/heartbeats, cancellation, and terminal failure states.
- Persist progress without calling the embedding provider again after a verified completed step unnecessarily.
- Reconcile the authoritative desired publication state against the active manifest after crashes.
- Handle failure before and after manifest replacement, duplicate delivery, lease expiry, interrupted uploads, disk errors, and stale approval.
- Expose pending/failed jobs and controlled retry/cancel to admins; no manual database edits should be required.
- Add tenant quotas for upload size/count, pending jobs, concurrency, and retained generations.
- Define cleanup only after a generation is no longer referenced by active readers, retained evidence, or backup policy.

Acceptance: automated fault-injection tests show recoverable outcomes at each transition, no duplicate chunks, no withdrawn-source resurrection, and useful operator-visible error states. Do not promise exactly-once execution or cross-store atomicity.

### P0-E: Security and Customer Deployment

- Keep the dedicated-stack architecture for the first pilot; provision separate containers/VMs, private service networking, scoped credentials, HTTPS ingress, and storage permissions.
- Do not expose Vite or unauthenticated Python services. Confirm denial tests from an external network, not just loopback.
- Harden auth recovery, secret rotation, callback authentication, administrator actions, and backup/restore.
- Inventory uploads, raw transcripts, audio, vectors, logs, exports, snapshots, and backups as separate data classes.
- Agree retention, deletion/legal-hold rules, recording notices/consent handling where applicable, subprocessors, and provider account terms with the customer.
- Redact sensitive content in operational logs; heuristic detection is not redaction and is not a compliance guarantee.
- Add document-upload abuse controls, malicious-content tests, and resource limits. Approval must not grant retrieved content instruction authority.
- Create incident, rollback, provider-outage, restore, and tenant-decommission runbooks with named owners.
- Obtain a customer-specific legal/security review, including applicable DPDP timing and sector obligations for an India pilot. This plan does not determine legal applicability.

Acceptance: security owner signs off the threat model and residual risks; restore is demonstrated; forbidden network paths fail; access and publication audit records are reviewable; there is a tested kill switch.

### P1-A: Measurement and Pilot Evidence

- Trace the gateway -> retrieval -> provider/insights -> response path using correlated IDs and version metadata, without content capture by default.
- Record user-visible latency boundaries separately: end-of-speech to first audio, retrieval duration, final transcript to nudge display, and end-of-call to summary.
- Report p50/p95, errors, timeouts, queue age, throughput, and sample count; never compare mocked latency with live voice latency.
- Join nudges, feedback, handoffs, approved revision usage, and review outcomes into an exportable pilot report.
- Measure task resolution and operator acceptance alongside speed. A lower escalation rate is not automatically better.
- Attribute provider usage/cost by tenant, call, and job using actual usage/invoices; no speculative per-call price claim.

### P1-B: Controlled Pilot

Progress through synthetic replay -> authorized shadow mode -> human-agent assist. Autonomous customer voice is a separate later release decision.

Use one customer, one workflow, agreed language coverage, a small named operator group, and a frozen evaluation corpus. Compare with the customer's measured baseline and review failures weekly. Stop or roll back on cross-tenant exposure, unapproved-source use, fabricated material policy facts, or unresolved severe access-control failures.

Do not promise production handoff simply because a handoff record exists. Verify the receiving system, delivery acknowledgement, retry ownership, and the operator's actual experience.

## Release Gates and Proposed Targets

Targets below are initial product proposals, not achieved benchmarks or industry requirements. Confirm them with the design partner before using them contractually.

| Gate | Required evidence |
| --- | --- |
| G0: Scope agreed | Pilot charter, accountable knowledge owner/approver, permitted data, use-case exclusions, baseline collection plan |
| G1: Safe internal demo | P0-A critical tests pass; demo metrics identified; draft/published distinction demonstrated with synthetic data |
| G2: Recoverable knowledge operations | P0-C/D failure matrix passes; immutable evidence, rejection/withdrawal, restart recovery, and rollback demonstrated |
| G3: Live-data readiness | P0-B/E signed off; account-specific provider tests, approved corpus, privacy/security decisions, private deployment and restore evidence |
| G4: Controlled pilot | P1-A report works; operator training, escalation recipient, incident owner, budget and stop conditions agreed |
| G5: Expand | Customer-reviewed outcomes support continued use; no unresolved critical regressions; next workflow/market independently validated |

Evaluation starting point:

- Curate at least 150 reviewed cases across answerable, unsupported, conflicting/expired, wrong-market/product, and adversarial inputs, plus dedicated access-control tests.
- Keep a held-out set separate from prompt/ranking tuning and rerun it for model, chunker, policy, or publication changes.
- Proposed gate: at least 95% fully supported answers among answerable held-out cases and at least 95% correct abstention/escalation on unsupported cases.
- Any cross-tenant disclosure, unpublished-source use, or critical fabricated financial fact in the release suite blocks release regardless of aggregate score.
- Publish denominators and reviewer disagreement; zero failures in a finite test suite is not proof of zero production risk.
- Proposed latency budgets for initial measurement: p95 text/retrieval response <= 2 seconds and p95 nudge display <= 3 seconds after final transcript. Baseline live providers before accepting these budgets; no voice latency promise yet.
- Report nudge usefulness with response rate and sample count. Set a commercial target only after baseline operator feedback exists.

## Decisions Required Before Implementation Resumes

| Decision | Recommendation for now | Who confirms | Required before |
| --- | --- | --- | --- |
| First workflow and mode | India inbound loan-policy support, human-agent assist | Product owner + design partner | G0 |
| Knowledge reviewer | Different admin from author; customer owns policy correctness | Product + customer knowledge owner | P0-C contract |
| Deployment | Dedicated stack per customer, private production services | Platform + customer security | G3 |
| Providers and model versions | Retain provider boundaries; validate supported IDs, cost and terms | AI/platform lead | P0-B completion |
| Worker infrastructure | Per-tenant durable SQL jobs first; no broker commitment yet | Backend/platform lead | P0-D design |
| Retention and sensitive data | No default customer promise; approve data-class policy | Customer privacy/security owner | G3 |
| Pilot thresholds and budget | Use proposed targets only after baseline review | Product + customer operations | G4 |

If these inputs are unavailable, continue synthetic evaluation and design only; do not widen customer access.

## Deferred Work

- Shared-process multi-tenancy, row-level isolation, tenant switching, and self-service provisioning.
- Additional reviewer/manager role taxonomy unless the initial approval flow demonstrably needs it.
- Broad CRM/contact-center integrations before selecting the pilot system.
- Autonomous outbound voice, collections, payments, and lending decisions.
- Philippines/Indonesia production rollout before native-speaker and market-specific review.
- New embedding/vector-store infrastructure, multimodal/OCR support, and model swaps without measured need.
- Billing, marketplace integrations, advanced QA scoring, and broad commercial launch materials before pilot evidence.

## Plan Maintenance

On each future milestone, update status, evidence, unresolved risks, and the next gate rather than appending another unprioritized feature list. Track tests run, fixture versus provider coverage, corpus/model versions, and migration/rollback requirements.

The 2026-09-26 planning revision changed only this work-plan document. Existing implementation history below is retained as historical context, not a fresh certification of correctness or readiness.

## Implementation Progress - 2026-09-26

First implementation milestone: shared call lifecycle and completed-call review.

- Added created, active, escalated, and completed session states.
- Added local completed-call persistence and paginated history API.
- Added Call History and transcript/citation/handoff review to the product UI.
- Added End Session for text conversations and surfaced archive failures for retry.
- Human requests now bypass retrieval; unsupported retrieval records a handoff.
- Added tests for duplicate sessions, handoff context, late responses, and restart persistence.
- Verified the full local stack starts and the browser conversation-to-review flow.

Implementation contract and limitations: [Call Sessions and Review](CALL_SESSION_CONTRACT.md).

Second implementation milestone: durable sessions and workspace-owner access.

- SQLite stores active/completed calls, workspace identity, the owner account, and sign-in sessions.
- Existing JSON history imports once; original archives are preserved.
- Active calls and sign-in sessions survive gateway restart.
- First-run setup, sign-in, sign-out, API authentication, and socket authentication are implemented.
- Origin checks, sign-in throttling, and logout socket disconnection are covered by tests.
- Browser verification uses an isolated database; the local owner account is left for the user to create.

Access contract and current limits: [Workspace Access](WORKSPACE_ACCESS.md).

Third implementation milestone: persistent operator nudges and feedback.

- Live nudges now have server-generated IDs and survive refreshes and gateway restarts.
- Operators can acknowledge, dismiss, and rate nudges in Mission Control and Call Review.
- A three-active-nudge limit, priority replacement, duplicate suppression, and expiry keep the queue bounded.
- SQLite records lifecycle events and operator attribution; authenticated APIs expose the history.
- Gateway tests cover generation, actions, restart recovery, expiry, and socket dismissal.

Lifecycle rules and limits: [Operator Nudges](NUDGE_WORKFLOW.md).

Fourth implementation milestone: managed knowledge-document lifecycle.

- Knowledge Hub now lists persisted uploads instead of sample documents.
- PDF, UTF-8 TXT, and Markdown uploads have processing, indexed, failed, and archived states.
- Original files survive restart; failed/interrupted jobs can be retried.
- Chunk inspection, archive/restore, and retrieval tests use live authenticated APIs.
- Immutable FAISS snapshots make publication atomic; retries replace a document's chunks.
- Retrieval reloads changed snapshots and excludes archived managed documents.
- Isolated tests cover ingestion failures, index publication, retrieval refresh, and UI upload-to-citation flow.

Lifecycle contract and current limits: [Knowledge Documents](KNOWLEDGE_DOCUMENTS.md).

Fifth implementation milestone: team accounts and role enforcement.

- Admins can issue/revoke 48-hour, single-use invitations and manage account access.
- Invited members set their own passwords; only hashed invitation tokens are stored.
- Operators retain call, nudge, review, and knowledge-reading workflows.
- Knowledge mutations and team APIs require admin access on the server.
- Role changes revoke sessions and sockets; the last admin cannot be disabled or demoted.
- SQLite records attributed team-access events. Automated and browser tests use isolated workspaces.

Access contract and current limits: [Team Access](TEAM_ACCESS.md).

Sixth implementation milestone: dedicated tenant-stack provisioning.

- A tenant launcher provisions independent databases, indexes, services, credentials, and cookies.
- Root workspace data and provider settings are not inherited by new tenants.
- Two-stack integration tests cover call/document ID collisions, retrieval, socket events, and session boundaries.
- Startup checks ports and health; service failures stop sibling processes.
- Development-server file rules deny database, credential, and knowledge storage access.

The supported boundary is one dedicated stack per tenant, not shared-process
multi-tenancy. Production ingress, container isolation, and a tenant control plane
remain open. See [Dedicated Tenant Stacks](TENANT_STACKS.md).

Seventh implementation milestone: staged knowledge review and publication.

- Knowledge Hub uploads are embedded into a private staged area and remain absent from retrieval until approval.
- Reviewers can inspect staged chunks; the uploader cannot approve their own document.
- A different administrator explicitly approves publication, with reviewer identity and timestamp recorded in workspace events.
- Archive removes published chunks and discards staged content; restoring an archived document returns it to review before it can be published again.
- Gateway and ingestion tests cover staged invisibility, approval, publication, archive, and recovery behavior.

Historical limits at the seventh milestone: staged records were not yet immutable revision history. The revision milestone below closes that gap. Effective dates and product metadata are not captured; publication and gateway status are not coordinated by a durable outbox. Existing legacy corpus content has not been reviewed or migrated into approval states.

### Knowledge revision milestone

- Replacement files create immutable revision IDs, content hashes, and family history; the live version remains available during processing and review.
- Reviewers compare content, reject with an attributed reason, and approve a replacement without editing historical evidence.
- Publication replaces the family's active chunks in one snapshot; unrelated documents are preserved. Historical previews remain administrator-only.
- Restoring an archived document creates a fresh revision and requires a new independent approval.
- Retrieval and completed-call citations retain revision identity. Existing records are treated as standalone v1 without manufacturing approval.
- Verification: 28 gateway tests, 9 Python tests, frontend build, and isolated desktop/mobile browser checks with synthetic embeddings. Failure injection covers snapshot-write failure and idempotent publication retry.

Remaining at this milestone: rollback selection, legacy corpus review, and durable recovery. Later follow-ups implement product metadata, effective windows, and the first durable recovery path. Live-provider quality remains unverified.

### Working-flow and recovery milestone — 2026-09-27

- SQLite records processing/publication/withdrawal jobs in the same transactions as their intended document state. The single gateway worker resumes interrupted work on startup, retries transient failures, and exposes admin retry/cancel actions.
- Atomic index manifests retain family operation sequences. Replays are idempotent and older publication requests cannot resurrect withdrawn content; completed embeddings and evidence are reused on recovery.
- Approval and withdrawal APIs now return 202 with a job ID. UI states remain pending until acknowledgement, and selected review details refresh after jobs finish.
- Product classification is captured in uploaded revisions and passed through both retrieval aliases. Unclassified sources no longer act as a wildcard in product-specific agents; explicit shared scope remains available.
- Query validation reports input errors instead of outages. Whole-word age/fee matching fixes supported short-term questions, and empty knowledge returns an explicit abstention.
- Verification includes gateway restart during remote publication, retry exhaustion/manual retry, late completion after withdrawal, cancellation persistence, manifest-write failure, and wrong-product exclusion in both retrieval modes. Browser checks cover upload/approval, product filtering, a grounded text conversation, and persisted revision citations.

Still open for P0-D: a separately supervised worker, distributed leases/heartbeats if process concurrency is introduced, retained-storage quotas/cleanup, and backup/restore reconciliation. The current worker requires one gateway and one ingestion writer per dedicated stack. Live-provider reliability, corpus review, and deployment gates remain open.

### Effective-window milestone — 2026-10-06

- Knowledge revisions accept optional inclusive UTC `effectiveFrom` and `effectiveTo` dates, validate real calendar dates and ordering, and retain them as immutable chunk and citation metadata.
- Approval of a future revision schedules its durable publication job for the start of the effective date while preserving the current live revision. Already-expired revisions cannot be approved.
- Both vector and lexical retrieval fail closed for future, expired, or malformed effective metadata. Undated legacy content remains eligible under the existing compatibility contract.
- Knowledge Hub exposes effective windows and scheduled/expired states. Fixture tests cover validation, scheduled publication, boundary inclusivity, citation propagation, and exclusion outside the window.

Still open: time-of-day and locale-specific activation, automatic rollback or successor selection, and an independently supervised scheduler. Published chunks may remain in immutable snapshots after expiry, but retrieval eligibility no longer permits them to support new answers.

### PDF page-citation milestone — 2026-10-06

- Managed PDF extraction now creates page-bounded chunks with stable one-based physical page numbers; blank pages remain absent without shifting later citations.
- Page metadata survives staging, immutable publication snapshots, RAG support selection, gateway call persistence, and restart recovery.
- Knowledge review, Voice Studio, and Call History display the supporting PDF page beside the exact excerpt and revision identity.
- An end-to-end fixture publishes a PDF, retrieves a fact unique to page 3, and verifies the returned page and excerpt. Previously indexed PDFs remain immutable and require a new revision to gain page metadata.

Still open: OCR for scanned PDFs, printed-label mapping when it differs from the physical PDF page, and bounding-box or highlight coordinates.

## Definition of Product Progress

Veyra progresses when a specific user can complete a useful workflow with approved, traceable knowledge; failures are recoverable; operators can act on the output; and customer-reviewed evidence supports the product's claims. More features or more test counts alone do not establish pilot readiness.
