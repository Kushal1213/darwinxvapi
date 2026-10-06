// A durable queue for the supported single-gateway, single-ingestion-writer stack.
// Operation IDs also fence delayed publication requests in the ingestion manifest.
import { getDatabase } from './database.js';

export const MAX_ATTEMPTS = 3;
export function enqueueKnowledgeJob(doc, kind, actorId, { notBefore = Date.now() } = {}) {
  const now = Date.now();
  const db = getDatabase();
  const id = db.prepare(`INSERT INTO knowledge_jobs
    (document_id, family_id, kind, actor_id, approval_id, next_attempt_at, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(doc.id, doc.familyId || doc.id, kind, actorId, doc.approvalId || null, notBefore, now, now).lastInsertRowid;
  return Number(id);
}
export function pendingKnowledgeJobs() {
  return getDatabase().prepare("SELECT count(*) AS total FROM knowledge_jobs WHERE state IN ('queued', 'running', 'retry')").get().total;
}
export function familyHasJob(doc) {
  return !!getDatabase().prepare(`SELECT 1 FROM knowledge_jobs WHERE family_id = ?
    AND (state IN ('queued', 'running', 'retry') OR (state = 'failed' AND kind != 'process')) LIMIT 1`).get(doc.familyId || doc.id);
}
export function knowledgeJobs() {
  return getDatabase().prepare(`SELECT * FROM knowledge_jobs WHERE state NOT IN ('succeeded', 'cancelled')
    OR id IN (SELECT id FROM knowledge_jobs WHERE state IN ('succeeded', 'cancelled') ORDER BY id DESC LIMIT 30)
    ORDER BY CASE WHEN state IN ('succeeded', 'cancelled') THEN 1 ELSE 0 END, id DESC`).all();
}
export function transaction(action) {
  const db = getDatabase();
  db.exec('BEGIN IMMEDIATE');
  try { const result = action(db); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
}

export function startJobWorker({ execute, complete, failed, recover, onError = console.error }) {
  const db = getDatabase();
  // Single gateway owns the queue. An interrupted remote operation is replayed with
  // the SAME operation ID; ingestion fences/deduplicates its effects.
  transaction(() => {
    db.prepare("UPDATE knowledge_jobs SET state = 'retry', next_attempt_at = ?, updated_at = ? WHERE state = 'running'").run(Date.now(), Date.now());
    recover();
  });
  let running = false;
  const baseDelay = process.env.NODE_ENV === 'test' ? 40 : 2000;
  async function tick() {
    if (running) return;
    running = true;
    try {
      const job = transaction(() => {
        const row = db.prepare("SELECT * FROM knowledge_jobs WHERE state IN ('queued', 'retry') AND next_attempt_at <= ? ORDER BY id LIMIT 1").get(Date.now());
        if (!row) return null;
        db.prepare("UPDATE knowledge_jobs SET state = 'running', attempts = attempts + 1, updated_at = ? WHERE id = ?").run(Date.now(), row.id);
        return { ...row, state: 'running', attempts: row.attempts + 1 };
      });
      if (!job) return;
      try {
        const result = await execute(job);
        transaction(() => {
          if (db.prepare('SELECT state FROM knowledge_jobs WHERE id = ?').get(job.id)?.state !== 'running') return;
          complete(job, result);
          db.prepare("UPDATE knowledge_jobs SET state = 'succeeded', error = NULL, updated_at = ? WHERE id = ?").run(Date.now(), job.id);
        });
      } catch (error) {
        transaction(() => {
          if (db.prepare('SELECT state FROM knowledge_jobs WHERE id = ?').get(job.id)?.state !== 'running') return;
          const terminal = error.permanent || job.attempts >= MAX_ATTEMPTS;
          const next = Date.now() + baseDelay * 2 ** (job.attempts - 1) + Math.floor(Math.random() * baseDelay);
          db.prepare('UPDATE knowledge_jobs SET state = ?, error = ?, next_attempt_at = ?, updated_at = ? WHERE id = ?')
            .run(terminal ? 'failed' : 'retry', error.message, next, Date.now(), job.id);
          failed(job, error, terminal);
        });
      }
    } catch (error) { onError(error); }
    finally { running = false; }
  }
  const timer = setInterval(() => { void tick(); }, process.env.NODE_ENV === 'test' ? 25 : 500);
  timer.unref();
  void tick();
  return () => clearInterval(timer);
}
