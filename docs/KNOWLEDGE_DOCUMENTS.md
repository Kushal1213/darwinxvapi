# Knowledge Documents

## Scope

Knowledge Hub manages uploads in a dedicated workspace stack. Admins upload and
review revisions; operators can inspect published revisions and search them. It no
longer substitutes sample documents, fabricated retrieval results, or PII-masking
claims. Existing legacy reference files remain searchable but are not managed
uploads and cannot be archived through this UI.

## Workflow

- Upload a PDF, UTF-8 TXT, or Markdown file (maximum 5 MB and 500 extracted chunks).
- The gateway retains the original bytes and metadata in SQLite, returning HTTP 202.
- Processing follows uploaded -> processing -> ready or failed. Ready revisions await
  a different administrator's approval before publication. Rejection requires a reason.
- New revision uploads preserve the published version while the replacement is processed
  and reviewed. The UI groups revisions into one document with an explicit live-version badge.
- Review shows retained chunks, prior-revision comparison, revision history, rejection
  reasons, content hash, and upload/approval attribution. Unpublished and historical
  chunk previews require administrator access.
- Approval saves a publication job and returns HTTP 202. Its worker atomically replaces that document family's chunks in the active snapshot.
  The prior published revision becomes superseded; its content and approval remain retained.
- Retry of the latest failed revision uses the same ID and original file. Restoring
  the latest archived revision creates a new ID and review request, with the restorer
  as author. It cannot reuse the old approval.
- Archive withdraws only the selected revision. Archiving a rejected replacement
  does not withdraw the older live revision; use history to select the live revision.
- Archive is not permanent deletion. It retains original bytes, processed evidence,
  review reasons, and attribution.
- Interrupted jobs resume automatically on gateway startup using their original operation
  IDs. Knowledge jobs shows progress, retries, failures, and admin retry/cancel actions.

Endpoints under authenticated /api/knowledge/documents:

| Method | Suffix | Result |
| --- | --- | --- |
| GET | / | All revision metadata, status, errors, latest flag, and active revision ID/number |
| POST | / | Multipart file, title, market, category, product; returns 202 |
| GET | /:id | Metadata and retained chunks; only published content is operator-readable |
| GET | /:id/revisions | Revision history for the document family, newest first |
| POST | /:id/revisions | Replacement multipart upload based on the latest resolved revision; returns 202 |
| POST | /:id/approve | Save independent approval and queue publication; returns 202 with jobId |
| POST | /:id/reject | Different administrator rejects with JSON `{ "reason": "..." }` |
| POST | /:id/retry | Retry latest failed revision or restore latest archived revision as a new revision; returns 202 |
| POST | /:id/archive | Queue withdrawal; returns 202 with jobId; archived only after index acknowledgement |

The existing authenticated origin checks protect mutations. The gateway permits
one running knowledge job and up to 100 pending jobs for new uploads/retries. Publication
and withdrawal are allowed to drain existing documents even when the upload queue is full. Original files are not returned by the
list API. Markets are india, philippines, and indonesia.

## Revision Identity and Compatibility

Each revision has an immutable UUID (`id`), root `familyId`, monotonically increasing
`revision`, `previousRevisionId`, SHA-256 of the original bytes (`contentHash`), and
author. Content, title, market, product, and category changes require a new revision. Pending
review must be resolved before creating another revision. State transitions update
the same revision's lifecycle metadata; they do not edit its content.

Existing gateway records without revision fields are interpreted as standalone v1
documents. Their original approval state is preserved, never upgraded. Old records
may lack a content hash or retained historical chunks until a new revision is made.
The legacy reference corpus is unchanged and has no newly assigned approval.

New UI uploads require a product selection. The API still accepts older clients without
product metadata, but unclassified chunks are excluded from product-specific queries.
Only an explicit `general` classification means shared across products. To classify old
knowledge, create and independently approve a new revision; do not edit its index metadata.
Knowledge Hub supports a product filter for retrieval testing; both gateway retrieval
aliases forward it. Agent market aliases imply their product scope and conflicting
explicit product choices are rejected.

Managed citations include `document_id` (the revision UUID), `family_id`, `revision`,
`content_hash`, and revision-scoped `chunk_id`. These fields pass through to persisted
call turns; Call History displays the revision number. Existing call citations remain
unchanged. Creation, rejection, publication, and withdrawal emit actor-attributed
workspace events; rejection reasons also remain in the revision record.

## Index Publication

Both Python services resolve relative FAISS_INDEX_PATH values from the repository
root. Set the same path for both. The ingestion gateway URL is INGESTION_SERVICE_URL
(default http://localhost:8002).

The legacy index.faiss and metadata.json pair is preserved. New documents use
managed/<generation>.faiss and managed/<generation>.json with an atomically replaced
managed/current.json pointer. Readers use immutable snapshots. Each retrieval
checks the pointer and combines legacy and managed chunks when it changes.
Invalid new snapshots fail closed with HTTP 503, not stale archived content.
Requests already in progress may finish against the snapshot they captured.

The private `managed/revisions/<id>.json` evidence files preserve processed content
after replacement or withdrawal. Staged vectors remain available after publication
so a lost response can be retried without another embedding call; archiving discards
those staged vectors. Neither retained evidence nor staged chunks are loaded by RAG.

Only one ingestion process/writer and one gateway process are supported. Managed
publication has an in-process lock, not a distributed lock. Do not run multiple
ingestion workers against one directory. Keep Python services private; gateway
authentication does not make their direct ports public-safe.

## Durable Jobs and Recovery

SQLite stores upload intent alongside the revision, approval intent alongside its
immutable approval ID, and withdrawal intent alongside its requested state. The job
worker runs inside the single gateway process and starts automatically. It serializes
work, uses a 120-second remote timeout, and retries transient errors up to three attempts
with exponential backoff and jitter (starting at two seconds). Invalid input fails
without repeated provider requests. Explicit admin retry resets the attempt budget.

Admin-only routes under `/api/knowledge/jobs`:

| Method | Suffix | Result |
| --- | --- | --- |
| GET | / | All unresolved jobs and the 30 most recent completed/cancelled jobs |
| POST | /:id/retry | Requeue a current failed job with its existing operation ID |
| POST | /:id/cancel | Cancel a processing job that is queued, waiting to retry, or failed |

To stop publication, withdraw the revision. This cancels its publication intent and
queues a newer withdrawal operation. Running processing cannot be cancelled. Withdrawal
is asynchronous: knowledge can remain searchable until the withdrawal job succeeds.
The UI shows `publishing` and `withdrawing` until the index acknowledgement is recorded.

Operation sequence numbers are persisted per document family in the same atomic manifest
swap as the new snapshot. Replaying the same operation has no duplicate index effect;
an older request cannot override a newer publication/withdrawal. Gateway completion and
audit updates share a SQLite transaction. A crash between index publication and database
completion replays the same operation on startup. Completed staged embeddings are reused,
including recovery of missing evidence files, rather than calling the provider again.

Unresolved publication/withdrawal jobs block conflicting family changes. Retry, cancellation,
approval, and withdrawal requests are attributed in workspace events. Legacy interrupted
uploads with a known author are adopted into the queue; uploads without an author fail
with an explanation instead of preventing gateway startup.

## Limits Before Production

- The worker shares the gateway process; separate supervision, distributed leases,
  multiple workers, and automatic repair of deleted/corrupt snapshots are not implemented.
  Restore the database and index together; operation IDs must not move backwards.
- The embedding provider is required for indexing. Tests use fake vectors, not
  paid provider calls. Provider limits and real-model retrieval quality need pilot tests.
- PII detection is a heuristic signal, not masking, redaction, or a compliance guarantee.
- Scanned PDFs need OCR, which is not implemented. Text extraction does not preserve
  page citations in the managed chunker.
- Original uploads and old generations remain on disk. Retention, secure deletion,
  encryption, malware scanning, snapshot garbage collection, and backup policy remain open.
- Snapshot publication is atomic visibility, not a cross-system SQLite/FAISS transaction.
- Automatic effective dates, rollback selection, retained-generation quotas, and snapshot
  cleanup are not implemented. A terminal failed job requires an administrator's retry
  after resolving its cause. Restart recovery assumes exactly one gateway owns the queue.
- Dedicated stacks provide the supported tenant boundary; shared-process tenancy is
  not supported. Legacy sources need an explicit review and migration.
- Retrieval treats market and product family as hard filters. UI agent IDs such
  as `india-loan` and `india-insurance` are mapped to canonical RAG scopes, and
  unknown markets are rejected instead of silently falling back.
- Existing answer synthesis still needs grounding-quality evaluation before
  customer deployment.

## Verification

Run from repository root:

```powershell
npm run test --workspace apps/api-gateway
python -m unittest discover -s services -p test_managed_knowledge.py
npm run build --workspace apps/frontend
node apps/api-gateway/test/browser-server.mjs --knowledge
```

The browser fixture uses temporary SQLite and index directories, ports 3010/3014
and 8011/8012, and deterministic fake embeddings. Create a test owner there, upload
test/fixtures/knowledge-policy.txt from the gateway directory, then invite a second
administrator to review it. Upload a replacement, compare revisions, reject with a
reason, resubmit, and approve. Confirm the prior version remains live until approval
and retrieval then cites the replacement. It does not configure the real workspace owner.

Verified locally: 29 gateway tests, 12 Python tests, frontend build, and a browser
workflow covering upload, rejection, resubmission, publication, revision history,
and retrieval citations on desktop/mobile. Embeddings were deterministic fixtures.
Short substantive terms such as age and fee now participate in whole-word matching.
Regression coverage includes longer age questions, wrong-product and unclassified
exclusion in vector/lexical paths, and an explicit empty-knowledge abstention.
Broader answer-quality evaluation remains separate from revision correctness.
