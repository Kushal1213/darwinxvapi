# Live Playbooks

Veyra's first live playbook is a deterministic operator aid for the `india-loan`
market. It organizes observed conversation evidence and recommends a next question
or private knowledge search. It does not make a lending decision, establish legal
compliance, or execute an external action.

## Current Definition

| Field | Value |
| --- | --- |
| ID | `india-loan-information` |
| Version | `2026-10-06.1` |
| Intended intent | `loan_inquiry` |
| Status | Demo workflow guide; not customer-approved policy |

The versioned steps cover understanding the question, requested amount, income or
employment context, approved requirements, documents, pricing or repayment terms,
and the next step or human assistance.

## Evidence and Progress

Progress is derived on each request from the server-owned call session. Discovery
steps may use detected session fields or customer turns. Knowledge-delivery steps
require an assistant turn with citations as well as matching language. Uncited
assistant wording cannot complete those steps. A live handoff pauses recommended
automated guidance.

Evidence contains a bounded transcript excerpt, role, turn index, and source count.
The playbook does not create a second mutable progress record: persisted transcript
and call state are the recovery source after a gateway restart.

The endpoint is:

```text
GET /api/voice/session/:callId/playbook
```

It requires an authenticated workspace session and an active call. Unsupported
markets return `playbook: null` with an explicit reason. Completed or unknown calls
return `404`.

## Operator UI

Voice Studio displays the version, observed progress, evidence links, open steps,
and one recommended next action. Discovery actions can be copied as suggested
customer questions. Knowledge actions can populate **Ask Veyra privately**, but the
operator must review and submit the private query and must separately approve any
resulting reply.

## Limits and Next Work

- The current definition is code-versioned and not editable in the workspace.
- Only the India loan demo market has a definition.
- Pattern matches mean “observed”, not completed, correct, or compliant.
- No manual confirmation, skip reason, assignment, analytics, or customer approval
  state exists yet.
- A later customer-owned configuration flow must preserve immutable versions,
  effective periods, approval attribution, and historical call interpretation.

Automated tests cover stable versions, deterministic progress, cited-evidence
requirements, handoff pause state, unsupported markets, authenticated delivery, and
restart recovery. Frontend production build verifies the UI bundle; interactive
browser evaluation remains a follow-up gate.
