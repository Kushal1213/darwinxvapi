# Manual QA Reviews and Coaching

Status: first provider-free implementation slice; automated and isolated-browser
verification passed on 2026-10-07.

## Scope

The QA workspace lets administrators create an immutable rubric version, activate one
version, deterministically sample completed calls, self-assign a review, link findings to
transcript turns or citations, complete a weighted manual score, and append attributed
coaching notes. It does not generate AI scores or deliver coaching to an external system.

Pilot review is admin-only until a customer approves a separate reviewer role and its
least-privilege permissions. Rubric content is customer-owned; the repository does not
bundle a generic regulatory or quality rubric.

## Data and lifecycle

- A rubric version is immutable at creation. Activating a draft retires the prior active
  version but never changes historical review snapshots.
- Starting a review snapshots the active rubric and assigns the review to the signed-in
  administrator. An unfinished review is resumed before a newer one is created.
- Draft findings may be saved repeatedly. Every failed criterion requires a reviewer note
  and a valid transcript turn; a citation can be selected when the turn contains one.
- Completion requires a verdict for every criterion and at least one applicable criterion.
  The score and findings are immutable after completion.
- Coaching notes are append-only, attributed, and timestamped. They are internal records,
  not proof that coaching was delivered or acknowledged.

## Sampling and reporting

Sampling supports 7/30/90-day windows plus market, outcome, handoff, missing-citation,
and review-state filters. Candidate ordering is a deterministic hash of the filter set
and call ID. Sample rows exclude transcript content.

Aggregate JSON/CSV reports expose sample size, reviewed-call count, reviewer count,
weighted score denominator, reviewer-pair agreement, rubric versions, and failed-criterion
counts. Transcript text, customer facts, and coaching-note content are excluded.

## Remaining gates

- Obtain and approve a customer rubric for the selected workflow.
- Have multiple reviewers score a controlled set and evaluate agreement and disagreements.
- Decide reviewer role separation, assignment queues, access boundaries, and coaching
  acknowledgement with the customer.
- Consider evidence-linked AI suggestions only after manual agreement is understood;
  suggestions must remain editable and rejectable and must never rewrite completed reviews.
