# Release Status

Reviewed: 2026-10-07

The current provider-free automated and isolated-browser pass establishes a locally
verified baseline for the documented single-workspace, dedicated-stack scope through
guidance measurement, evidence-linked summaries, disclosure shadow mode, operational
release controls, and manual QA/coaching. This local evidence does not constitute live-
provider quality, customer policy approval, deployment readiness, or production
certification.

## Verified Local Capabilities

- Authenticated admin/operator workspace, durable sessions, invitations, and access revocation.
- Voice/text call lifecycle, restart recovery, transcript/citation review, and recorded analytics.
- Market/product-scoped RAG with explicit abstention and revision/PDF-page citations.
- Reviewed knowledge revisions, effective dates, scheduled publication, retryable jobs, and withdrawal fencing.
- Durable internal handoff inbox with atomic creation, idempotency, acknowledgement, resolution, and audit events.
- Knowledge-gap grouping and triage with privacy-minimized excerpts, recurrence counts, reopen behavior, and published-revision validation.
- Operator-guided grounded replies that pause, preview, apply, render, and speak with citation and actor attribution.
- Private operator knowledge search plus editable/copyable grounded replies that preserve generated and delivered wording without adding artificial customer turns.
- Versioned India-loan live playbook with deterministic transcript evidence, cited knowledge-step requirements, restart recovery, and human-controlled recommended actions.
- Maintained Google Gen AI SDK adapter and provider-free contract/grounding tests.
- Vite 8/Tailwind 4 development toolchain and production dependencies with zero npm audit
  advisories on the review date.
- Integrity-manifested tenant backup, verification, restore, and confirmed decommission CLI.

## Capabilities Included in the Current Verification Pass

The 2026-10-07 pass includes the following newer roadmap slices:

- Guidance-interaction analytics for display, application, edits, reason-coded dismissal,
  citation presence, operator feedback, latency samples, origin, and handoff context.
- Provider-free evidence-linked after-call drafts with immutable revisions, structured
  proposed follow-ups, transcript/citation navigation, and latest-version acceptance.
- Customer-authored disclosure-checklist infrastructure with immutable scoped versions,
  published-revision binding, different-admin approval, effective periods, conservative
  shadow suggestions, evidence navigation, retirement, and append-only human decisions.
- Authenticated operational controls for new sessions, customer-answer generation,
  private guidance, guided delivery, proactive nudges, knowledge ingestion, and knowledge
  publication. Changes require bounded reasons, are attributed in an audit trail, appear
  in a global degraded-state banner and health response, and pause queued knowledge work
  without exhausting retries. Outbound delivery is explicitly shown as not configured.
- Admin-only manual QA with immutable rubric versions, deterministic privacy-minimized
  sampling, self-assigned reviews, transcript/citation-linked findings, immutable
  completion, append-only coaching history, reviewer agreement, and content-free
  aggregate CSV reporting. No AI score or customer rubric is bundled.

No checklist is bundled or represented as regulatory approval. No proposed follow-up is
represented as an executed CRM/customer action. See [call summaries](CALL_SUMMARIES.md)
and [disclosure checklist shadow mode](DISCLOSURE_CHECKLISTS.md).

## Remaining Repository Work

1. Exercise the documented operational controls and recovery runbook in the selected
   production environment, including provider-account disable actions owned by the customer.
2. Obtain a customer-owned QA rubric, evaluate reviewer agreement, and decide whether a
   dedicated reviewer role is required before considering AI suggestions.
3. Add customer-owned playbook configuration/approval and sentence-level evidence warnings
   for edited guidance.
4. Add knowledge-change impact/regression execution, then one customer-selected external
   handoff/CRM integration and independently evaluated language expansion.

## External Launch Prerequisites

These cannot be completed truthfully from repository code alone:

- A named customer workflow, approved corpus, data-retention policy, and legal/security review.
- Authorized Gemini/Vapi/Deepgram account, region, quota, terms, budget, and live smoke tests.
- A customer-selected external handoff destination and its authentication, delivery callback, retry, and incident runbook.
- Private deployment/network boundary, encrypted backups, restore drill, secrets management, monitoring, and on-call ownership.
- Native-speaker and policy-owner evaluation for every enabled market/language.
- Customer-reviewed grounding and adversarial corpus meeting the release thresholds in the product plan.

## Known Engineering Boundaries

- One gateway process owns each SQLite database and knowledge queue.
- The internal handoff inbox is not a telephony transfer or an external connector.
- OCR, automated retention/deletion, distributed workers, MFA/SSO, password recovery,
  a dedicated reviewer role, QA assignment queues, and knowledge-impact execution remain roadmap items.
- Manual QA is implemented for administrators only and has not received a customer rubric
  or real multi-reviewer agreement evaluation.
- Operational controls and backup/restore/decommission logic passed local automated checks;
  production provider, encrypted-backup, full-disk, and infrastructure drills remain external.
- Structured summaries currently use a deterministic fallback. Provider-backed generation,
  retry UI, usage accounting, and curated summary-quality evaluation remain future work.
- Disclosure shadow mode still requires a customer policy owner, legal/security review,
  a dedicated compliance-owner role decision, and reviewed false-positive/negative cases.
- Edited guidance is attributed and preserved but does not yet receive sentence-level
  evidence validation; the operator remains responsible for confirming edits.
- Development servers remain local tools and must not be exposed as production ingress.

## Verification Record — 2026-10-07

- `npm run test --workspace apps/api-gateway`: **45 passed, 0 failed**.
- `python -m unittest discover -s services -p 'test_*.py'`: **19 passed, 0 failed**.
- `npm run test:tenants`: **3 passed, 0 failed**.
- `npm run test:provider-inventory`: **1 passed, 0 failed**.
- `python services/grounding_eval.py --output evaluation/grounding_report.json`:
  **7 fixture cases passed, 0 failed**.
- `npm run build --workspace apps/frontend`: Vite 8/Tailwind 4 production build passed
  with **2,489 modules transformed**.
- `npm audit`: **0 vulnerabilities across production and development dependencies**.
- Isolated browser verification created a temporary workspace, paused and restored new
  sessions, observed the global degraded-state banner and attributed audit trail, created
  and activated a QA rubric, completed and archived a text call, completed an evidence-
  linked review, appended coaching, and verified Operations, QA, and Call Review at a
  390 px viewport without page-level horizontal overflow.

The verification used synthetic accounts, fixture knowledge, and provider-free paths.
It does not establish live-provider quality or customer production readiness.
