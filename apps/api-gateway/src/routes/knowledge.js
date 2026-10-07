import { Router } from 'express';
import multer from 'multer';
import { createHash, randomUUID } from 'node:crypto';
import { basename, extname } from 'node:path';
import { z } from 'zod';
import { getDatabase } from '../services/database.js';
import { enqueueKnowledgeJob, familyHasJob, knowledgeJobs, pendingKnowledgeJobs, startJobWorker, transaction } from '../services/knowledge-jobs.js';
import { assertOperationalControl } from '../services/operational-controls.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 6 } });
const dateOnly = z.preprocess(value => value === '' ? undefined : value,
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
    const parsed = new Date(value + 'T00:00:00.000Z');
    return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
  }).optional());
const metadata = z.object({
  title: z.string().trim().min(1).max(180),
  market: z.enum(['india', 'philippines', 'indonesia']),
  category: z.string().trim().min(1).max(80),
  product: z.string().trim().min(1).max(100).optional(),
  effectiveFrom: dateOnly,
  effectiveTo: dateOnly,
}).refine(value => !value.effectiveFrom || !value.effectiveTo || value.effectiveFrom <= value.effectiveTo,
  { message: 'Effective end date must be on or after the start date.', path: ['effectiveTo'] });
const database = getDatabase;
const utcToday = (now = new Date()) => now.toISOString().slice(0, 10);
export function effectiveWindowStatus(doc, today = utcToday()) {
  if (doc.effectiveTo && doc.effectiveTo < today) return 'expired';
  if (doc.effectiveFrom && doc.effectiveFrom > today) return 'scheduled';
  return doc.effectiveFrom || doc.effectiveTo ? 'active' : 'undated';
}
function save(doc, db = getDatabase()) {
  doc.updatedAt = new Date().toISOString();
  const { effectiveStatus: _derived, ...stored } = doc;
  db.prepare('UPDATE knowledge_documents SET payload = ? WHERE id = ?').run(JSON.stringify(stored), doc.id);
}
function get(id) {
  const row = database().prepare("SELECT * FROM knowledge_documents WHERE id = ? AND workspace_id = 'default'").get(id);
  return row && { ...row, document: versioned(JSON.parse(row.payload)) };
}
function versioned(doc) {
  return { ...doc, familyId: doc.familyId || doc.id, revision: doc.revision || 1,
    effectiveStatus: effectiveWindowStatus(doc) };
}
function documents() {
  return database().prepare("SELECT payload FROM knowledge_documents WHERE workspace_id = 'default' ORDER BY rowid DESC").all().map(row => versioned(JSON.parse(row.payload)));
}
function history(doc) {
  return documents().filter(item => item.familyId === doc.familyId).sort((a, b) => b.revision - a.revision);
}
const familyBusy = familyHasJob;
function event(actor, action, id) {
  database().prepare('INSERT INTO team_events (actor_id, action, target_id, created_at) VALUES (?, ?, ?, ?)').run(actor, action, id, Date.now());
}
function createRevision(req, file, values, parent = null) {
  const id = randomUUID();
  const doc = { id, ...values, familyId: parent?.familyId || id, revision: (parent?.revision || 0) + 1,
    previousRevisionId: parent?.id || null, contentHash: createHash('sha256').update(file.buffer).digest('hex'),
    filename: file.originalname, bytes: file.buffer.length, status: 'uploaded',
    reviewStatus: 'pending', publicationStatus: 'unpublished', createdById: req.session.userId,
    chunks: 0, piiDetected: null, error: null, createdAt: new Date().toISOString() };
  const db = database();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare("INSERT INTO knowledge_documents VALUES (?, 'default', ?, ?, ?)").run(id, doc.filename, file.buffer, JSON.stringify(doc));
    event(req.session.userId, 'knowledge.revision_created', id);
    enqueueKnowledgeJob(doc, 'process', req.session.userId);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return doc;
}
async function ingestion(path, options = {}) {
  try {
    const response = await fetch((process.env.INGESTION_SERVICE_URL || 'http://localhost:8002') + path,
      { ...options, signal: AbortSignal.timeout(120000) });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const message = typeof body.detail === 'string' && response.status < 500 ? body.detail : 'Ingestion service unavailable. Retry when the service is ready.';
      const error = new Error(message);
      error.permanent = response.status >= 400 && response.status < 500 && ![408, 429].includes(response.status);
      throw error;
    }
    return await response.json();
  } catch (error) {
    if (error.name === 'TimeoutError' || error instanceof TypeError) throw new Error('Ingestion service did not respond. Retry to reconcile the index.');
    throw error;
  }
}
export function startKnowledgeWorker(onError) {
  return startJobWorker({ onError,
    recover() {
      // Adopt uploads left by the pre-queue implementation without inventing approvals.
      for (const doc of documents()) {
        if (['uploaded', 'processing'].includes(doc.status) && !database().prepare('SELECT 1 FROM knowledge_jobs WHERE document_id = ?').get(doc.id)) {
          if (database().prepare('SELECT 1 FROM users WHERE id = ?').get(doc.createdById || '')) enqueueKnowledgeJob(doc, 'process', doc.createdById);
          else save({ ...doc, status: 'failed', error: 'This legacy upload has no recorded author. Create a new revision to process it.' });
        }
      }
    },
    async execute(job) {
      const row = get(job.document_id);
      const doc = row.document;
      if (job.kind === 'publish') {
        assertOperationalControl('knowledge_publication', { queued: true });
        if (doc.reviewStatus !== 'approved' || doc.approvalId !== job.approval_id || doc.publicationStatus !== 'publishing' || history(doc)[0].id !== doc.id) {
          throw Object.assign(new Error('Publication approval is no longer valid.'), { permanent: true });
        }
        if (effectiveWindowStatus(doc) === 'expired') return { expired: true };
        return ingestion('/documents/' + doc.id + '/publish?operation_id=' + job.id, { method: 'POST' });
      }
      if (job.kind === 'withdraw') return ingestion('/documents/' + doc.id + '?operation_id=' + job.id + '&family_id=' + doc.familyId, { method: 'DELETE' });
      assertOperationalControl('knowledge_ingestion', { queued: true });
      if (!['uploaded', 'processing', 'failed'].includes(doc.status) || history(doc)[0].id !== doc.id) throw Object.assign(new Error('Processing revision is no longer current.'), { permanent: true });
      save({ ...doc, status: 'processing', error: null });
      const form = new FormData();
      form.append('file', new Blob([row.content]), row.filename);
      for (const key of ['title', 'market', 'category']) form.append(key, doc[key]);
      if (doc.product) form.append('product', doc.product);
      if (doc.effectiveFrom) form.append('effective_from', doc.effectiveFrom);
      if (doc.effectiveTo) form.append('effective_to', doc.effectiveTo);
      form.append('family_id', doc.familyId);
      form.append('revision', String(doc.revision));
      form.append('content_hash', doc.contentHash || createHash('sha256').update(row.content).digest('hex'));
      return ingestion('/documents/' + doc.id, { method: 'PUT', body: form });
    },
    complete(job, result) {
      const doc = get(job.document_id).document;
      if (job.kind === 'process') save({ ...doc, status: 'ready', reviewStatus: 'pending', publicationStatus: 'unpublished', chunks: result.chunks_added, piiDetected: result.pii_detected, error: null });
      if (job.kind === 'publish') {
        if (result.expired) {
          save({ ...doc, status: 'expired', publicationStatus: 'expired', error: null });
          event(job.actor_id, 'knowledge.expired', doc.id);
          return;
        }
        for (const previous of history(doc)) {
          if (previous.id !== doc.id && previous.status === 'indexed') save({ ...previous, status: 'superseded', publicationStatus: 'superseded', supersededById: doc.id });
        }
        save({ ...doc, status: 'indexed', publicationStatus: 'published', generation: result.generation, error: null });
        event(job.actor_id, 'knowledge.published', doc.id);
      }
      if (job.kind === 'withdraw') {
        save({ ...doc, status: 'archived', publicationStatus: 'withdrawn', generation: result.generation, error: null });
        event(job.actor_id, 'knowledge.withdrawn', doc.id);
      }
    },
    failed(job, error, terminal) {
      const doc = get(job.document_id).document;
      save({ ...doc, ...(job.kind === 'process' && terminal ? { status: 'failed' } : {}), error: error.message });
    },
  });
}
router.get('/documents', (_req, res) => {
  const all = documents();
  res.json({ documents: all.map(doc => {
    const family = all.filter(item => item.familyId === doc.familyId);
    const active = family.find(item => effectiveWindowStatus(item) !== 'expired' &&
      (item.publicationStatus === 'published' || (!item.publicationStatus && item.status === 'indexed')));
    return { ...doc, isLatest: !family.some(item => item.revision > doc.revision), activeRevisionId: active?.id || null, activeRevision: active?.revision || null };
  }) });
});
const receiveUpload = (req, res, next) => {
  upload.single('file')(req, res, error => {
    if (error) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Maximum file size is 5 MB' : 'Invalid upload' });
    next();
  });
};
function uploadRevision(req, res) {
  assertOperationalControl('knowledge_ingestion');
  if (pendingKnowledgeJobs() >= 100) return res.status(429).json({ error: 'The knowledge queue is full. Try again after pending jobs finish.' });
  const parsed = metadata.safeParse(req.body);
  if (!parsed.success || !req.file?.size) return res.status(400).json({ error: parsed.error?.issues?.[0]?.message || 'Choose a file and provide a title, market, and category.' });
  const filename = basename(req.file.originalname.replaceAll('\\', '/'));
  if (!['.pdf', '.txt', '.md'].includes(extname(filename).toLowerCase())) return res.status(400).json({ error: 'Use PDF, TXT, or Markdown files.' });
  const parent = req.params.id ? get(req.params.id)?.document : null;
  if (req.params.id && !parent) return res.status(404).json({ error: 'Document not found' });
  if (parent && (familyBusy(parent) || history(parent)[0].id !== parent.id || ['uploaded', 'processing', 'publishing', 'withdrawing'].includes(parent.status) || (parent.status === 'ready' && parent.reviewStatus === 'pending'))) {
    return res.status(409).json({ error: 'Resolve the latest revision before uploading another revision.' });
  }
  const doc = createRevision(req, { ...req.file, originalname: filename }, parsed.data, parent);
  res.status(202).json({ document: doc });
}
router.post('/documents', receiveUpload, uploadRevision);
router.post('/documents/:id/revisions', receiveUpload, uploadRevision);
router.get('/documents/:id/revisions', (req, res) => {
  const doc = get(req.params.id)?.document;
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  res.json({ revisions: history(doc) });
});
router.get('/documents/:id', async (req, res) => {
  const row = get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Document not found' });
  const reviewer = database().prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId);
  if (row.document.status !== 'indexed' && reviewer?.role !== 'admin') return res.status(403).json({ error: 'Administrator access required to review unpublished knowledge.' });
  try {
    const result = ['ready', 'indexed', 'superseded', 'archived', 'publishing', 'withdrawing'].includes(row.document.status) ? await ingestion('/documents/' + row.id + '/chunks') : { chunks: [] };
    res.json({ document: row.document, chunks: result.chunks });
  } catch (error) { res.status(503).json({ error: error.message }); }
});
router.post('/documents/:id/approve', async (req, res) => {
  const row = get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Document not found' });
  const doc = row.document;
  assertOperationalControl('knowledge_publication');
  if (doc.createdById === req.session.userId) return res.status(409).json({ error: 'A different administrator must approve this document.' });
  if (doc.status !== 'ready' || doc.reviewStatus !== 'pending' || doc.publicationStatus !== 'unpublished') {
    return res.status(409).json({ error: 'Only a ready, unpublished document awaiting review can be approved.' });
  }
  if (familyBusy(doc) || history(doc)[0].id !== doc.id) return res.status(409).json({ error: 'Only the latest revision can be approved, and no other revision may be changing.' });
  if (effectiveWindowStatus(doc) === 'expired') return res.status(409).json({ error: 'This revision expired before approval. Upload a new revision with a current effective window.' });
  const approved = { ...doc, status: 'publishing', reviewStatus: 'approved', publicationStatus: 'publishing', approvalId: randomUUID(),
    approvedById: req.session.userId, approvedAt: new Date().toISOString(), error: null };
  const jobId = transaction(() => {
    save(approved);
    event(req.session.userId, 'knowledge.approved', row.id);
    const notBefore = approved.effectiveFrom ? Date.parse(approved.effectiveFrom + 'T00:00:00.000Z') : Date.now();
    return enqueueKnowledgeJob(approved, 'publish', req.session.userId, { notBefore: Math.max(Date.now(), notBefore) });
  });
  res.status(202).json({ document: approved, jobId });
});
router.post('/documents/:id/reject', (req, res) => {
  const doc = get(req.params.id)?.document;
  if (!doc) return res.status(404).json({ error: 'Document not found' });
  const reason = z.string().trim().min(1).max(2000).safeParse(req.body?.reason);
  if (!reason.success) return res.status(400).json({ error: 'Provide a rejection reason (up to 2000 characters).' });
  if (doc.createdById === req.session.userId) return res.status(409).json({ error: 'A different administrator must review this revision.' });
  if (familyBusy(doc) || doc.status !== 'ready' || doc.reviewStatus !== 'pending' || history(doc)[0].id !== doc.id) return res.status(409).json({ error: 'Only the latest revision awaiting review can be rejected.' });
  const rejected = { ...doc, reviewStatus: 'rejected', rejectedById: req.session.userId, rejectedAt: new Date().toISOString(), rejectionReason: reason.data };
  const db = database();
  db.exec('BEGIN IMMEDIATE');
  try {
    save(rejected, db);
    event(req.session.userId, 'knowledge.rejected', doc.id);
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  res.json({ document: rejected });
});
router.post('/documents/:id/retry', (req, res) => {
  assertOperationalControl('knowledge_ingestion');
  const row = get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Document not found' });
  if (familyBusy(row.document) || history(row.document)[0].id !== row.id || !['failed', 'archived'].includes(row.document.status)) return res.status(409).json({ error: 'Only the latest failed or archived revision can be retried.' });
  if (pendingKnowledgeJobs() >= 100) return res.status(429).json({ error: 'The knowledge queue is full.' });
  if (row.document.status === 'archived') {
    const doc = createRevision(req, { originalname: row.filename, buffer: row.content },
      { title: row.document.title, market: row.document.market, category: row.document.category, product: row.document.product,
        effectiveFrom: row.document.effectiveFrom, effectiveTo: row.document.effectiveTo }, row.document);
    return res.status(202).json({ document: doc });
  }
  transaction(() => {
    // A failed process can be explicitly retried with its durable operation identity.
    const job = database().prepare("SELECT * FROM knowledge_jobs WHERE document_id = ? AND kind = 'process' ORDER BY id DESC LIMIT 1").get(row.id);
    if (job) database().prepare("UPDATE knowledge_jobs SET state = 'queued', attempts = 0, error = NULL, next_attempt_at = ?, updated_at = ? WHERE id = ?").run(Date.now(), Date.now(), job.id);
    else enqueueKnowledgeJob(row.document, 'process', req.session.userId);
    save({ ...row.document, status: 'uploaded', error: null });
    event(req.session.userId, 'knowledge.retry_requested', row.id);
  });
  res.status(202).json({ document: get(row.id).document });
});
router.post('/documents/:id/archive', async (req, res) => {
  const row = get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Document not found' });
  const jobs = database().prepare("SELECT * FROM knowledge_jobs WHERE family_id = ? AND state IN ('queued', 'running', 'retry', 'failed')").all(row.document.familyId);
  if (jobs.some(job => (job.document_id !== row.id && (job.state !== 'failed' || job.kind !== 'process')) || (job.kind === 'process' && job.state !== 'failed'))) return res.status(409).json({ error: 'A revision is being processed.' });
  if (['archived', 'superseded'].includes(row.document.status)) return res.status(409).json({ error: 'This revision is already inactive.' });
  if (row.document.status === 'withdrawing') return res.status(409).json({ error: 'Withdrawal is already queued. Retry its failed job if needed.' });
  const doc = { ...row.document, status: 'withdrawing', publicationStatus: 'withdrawing', withdrawnById: req.session.userId, withdrawnAt: new Date().toISOString(), error: null };
  const jobId = transaction(() => {
    database().prepare("UPDATE knowledge_jobs SET state = 'cancelled', updated_at = ? WHERE document_id = ? AND state IN ('queued', 'running', 'retry', 'failed')").run(Date.now(), row.id);
    save(doc);
    event(req.session.userId, 'knowledge.withdrawal_requested', row.id);
    return enqueueKnowledgeJob(doc, 'withdraw', req.session.userId);
  });
  res.status(202).json({ document: doc, jobId });
});

router.get('/jobs', (req, res) => {
  if (database().prepare('SELECT role FROM users WHERE id = ?').get(req.session.userId)?.role !== 'admin') return res.status(403).json({ error: 'Administrator access required.' });
  res.json({ jobs: knowledgeJobs() });
});
router.post('/jobs/:id/retry', (req, res) => {
  const job = database().prepare('SELECT * FROM knowledge_jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.state !== 'failed') return res.status(409).json({ error: 'Only failed jobs can be retried.' });
  if (pendingKnowledgeJobs() >= 100) return res.status(429).json({ error: 'The knowledge queue is full.' });
  const doc = get(job.document_id).document;
  if (job.kind === 'publish') assertOperationalControl('knowledge_publication');
  if (job.kind === 'process') assertOperationalControl('knowledge_ingestion');
  if (job.kind === 'publish' && effectiveWindowStatus(doc) === 'expired') {
    transaction(() => {
      database().prepare("UPDATE knowledge_jobs SET state = 'cancelled', error = NULL, updated_at = ? WHERE id = ?").run(Date.now(), job.id);
      save({ ...doc, status: 'expired', publicationStatus: 'expired', error: null });
      event(req.session.userId, 'knowledge.expired', doc.id);
    });
    return res.json({ jobId: job.id, expired: true });
  }
  if ((job.kind === 'process' && (doc.status !== 'failed' || history(doc)[0].id !== doc.id)) ||
      (job.kind === 'publish' && (doc.publicationStatus !== 'publishing' || doc.approvalId !== job.approval_id)) ||
      (job.kind === 'withdraw' && doc.publicationStatus !== 'withdrawing')) return res.status(409).json({ error: 'This job is no longer current.' });
  transaction(() => {
    database().prepare("UPDATE knowledge_jobs SET state = 'queued', attempts = 0, error = NULL, next_attempt_at = ?, updated_at = ? WHERE id = ?").run(Date.now(), Date.now(), job.id);
    save({ ...doc, error: null, ...(job.kind === 'process' ? { status: 'uploaded' } : {}) });
    event(req.session.userId, 'knowledge.job_retry_requested', doc.id);
  });
  res.status(202).json({ jobId: job.id });
});
router.post('/jobs/:id/cancel', (req, res) => {
  const job = database().prepare('SELECT * FROM knowledge_jobs WHERE id = ?').get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.kind !== 'process' || !['queued', 'retry', 'failed'].includes(job.state)) return res.status(409).json({ error: 'Only processing jobs that are not running can be cancelled. Withdraw a revision to stop publication.' });
  transaction(() => {
    database().prepare("UPDATE knowledge_jobs SET state = 'cancelled', updated_at = ? WHERE id = ?").run(Date.now(), job.id);
    const doc = get(job.document_id).document;
    if (['uploaded', 'processing', 'failed'].includes(doc.status)) save({ ...doc, status: 'failed', error: 'Processing cancelled. Retry when ready.' });
    event(req.session.userId, 'knowledge.job_cancelled', job.document_id);
  });
  res.json({ jobId: job.id });
});
export default router;
