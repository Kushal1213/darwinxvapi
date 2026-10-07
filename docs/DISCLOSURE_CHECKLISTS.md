# Disclosure Checklist Shadow Mode

Veyra can display a customer-authored disclosure checklist beside a live call. The
feature is intentionally a shadow-mode workflow aid: detector output is a suggestion,
not a legal conclusion, compliance score, proof of delivery, or customer consent.

No checklist is bundled or inferred from generic regulation. When no approved version
matches the call's market and channel, Voice Studio says so explicitly and performs no
checklist evaluation.

## Governance lifecycle

1. An administrator creates an immutable draft for one market, channel, workflow,
   version, and effective period.
2. Every topic includes literal evidence phrases, applicability, permitted transcript
   speaker, a human-confirmation requirement, and at least one exact published knowledge
   document revision.
3. A different administrator approves the draft. Approval rechecks every referenced
   document and rejects expired versions or effective periods that overlap an existing
   approved checklist for the same scope.
4. Approved versions become active only inside their UTC effective period. Expired
   versions cannot apply to a new call.
5. An administrator may retire an approved version with a required note. Retirement
   and approval are append-only audit events; the checklist payload is not edited.

The current workspace roles do not provide a separate customer compliance-owner role.
Two-administrator approval is therefore a technical governance boundary, not proof of
customer legal sign-off. Customer authorization remains a pilot prerequisite.

## Shadow evaluation

The evaluator uses literal configured phrases rather than an LLM or hidden legal rules.
For an item requiring sources, an agent turn is suggested as `observed` only when it
contains a configured phrase and cites the exact configured document ID and revision.
A phrase without that source is `uncertain`. A required topic becomes `missing` after
an assistant turn when no configured signal exists; conditional applicability remains
`uncertain` until reviewed.

These states mean:

| State | Meaning |
|---|---|
| `observed` | The configured transcript and source rule matched |
| `missing` | No configured signal has been observed yet; this is not a violation finding |
| `uncertain` | Evidence or applicability is insufficient for the configured rule |
| `not_applicable` | A human reviewer marked the item outside this call's scope |

The live UI shows whether a state is suggested or human-confirmed. Operators can save
`observed`, `missing`, `uncertain`, or `not_applicable`; missing and not-applicable
decisions require a note. Updating a decision preserves an append-only event containing
the previous and new state. Detector evidence is never rewritten by confirmation.

## Evidence and data model

`disclosure_checklists` stores immutable definitions and approval/effective metadata.
`disclosure_checklist_events` records creation, approval, and retirement.
`disclosure_confirmations` stores the latest human decision per call/item, while
`disclosure_confirmation_events` preserves every decision transition and actor.

Observed evidence identifies the transcript turn and its stored citations. Voice Studio
can focus the exact turn and expand the cited source. Checklist definitions store source
IDs and revisions, not document content.

## API

| Endpoint | Behavior |
|---|---|
| `GET /api/disclosure-checklists` | Approved versions for operators; drafts and retired history for admins |
| `POST /api/disclosure-checklists` | Admin-only immutable draft creation |
| `POST /api/disclosure-checklists/:id/approve` | Different-admin approval after source and date checks |
| `POST /api/disclosure-checklists/:id/retire` | Admin-only retirement with a note |
| `GET /api/voice/session/:id/disclosure-checklist` | Evaluate the version effective when the call began |
| `POST /api/voice/session/:id/disclosure-checklist/items/:itemId/confirm` | Save an attributed human decision for a live call |

## Deliberate limits

- Detection is literal and conservative; it does not establish semantic equivalence,
  whether a customer heard or understood wording, or whether another system delivered
  a required document.
- No eligibility, lending, consent, or document-delivery decision is made.
- The first slice does not provide checklist import, draft editing, diffing, reviewer
  disagreement analytics, or a customer compliance-owner role.
- Provider-free lifecycle coverage passed on 2026-10-07 for published-revision
  governance, different-admin approval, overlapping-window rejection, role-filtered
  listing, shadow evaluation, required decision notes, and append-only confirmation
  history. Browser verification covered the live checklist surface and empty state;
  customer/legal approval plus reviewed false-positive and false-negative fixtures
  remain required before pilot use.
