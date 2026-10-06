# Release Status

Reviewed: 2026-10-06

This repository is locally release-complete for its documented single-workspace,
dedicated-stack scope. It is not certified for a customer production launch merely
because local tests pass.

## Verified Local Capabilities

- Authenticated admin/operator workspace, durable sessions, invitations, and access revocation.
- Voice/text call lifecycle, restart recovery, transcript/citation review, and recorded analytics.
- Market/product-scoped RAG with explicit abstention and revision/PDF-page citations.
- Reviewed knowledge revisions, effective dates, scheduled publication, retryable jobs, and withdrawal fencing.
- Durable internal handoff inbox with atomic creation, idempotency, acknowledgement, resolution, and audit events.
- Knowledge-gap grouping and triage with privacy-minimized excerpts, recurrence counts, reopen behavior, and published-revision validation.
- Operator-guided grounded replies that pause, preview, apply, render, and speak with citation and actor attribution.
- Private operator knowledge search plus editable/copyable grounded replies that preserve generated and delivered wording without adding artificial customer turns.
- Maintained Google Gen AI SDK adapter and provider-free contract/grounding tests.
- Zero advisories in the npm production dependency graph on the review date.

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
  evidence-linked structured summaries, QA rubrics, and operational kill switches remain roadmap items.
- Edited guidance is attributed and preserved but does not yet receive sentence-level
  evidence validation; the operator remains responsible for confirming edits.
- Development-only audit advisories remain in the Vite 5 and Tailwind 3 toolchain;
  development servers must stay private until tested major migrations are completed.

Verification commands and exact outcomes should be recorded in the release commit or
handoff message. Provider-free tests do not establish live-provider quality.
