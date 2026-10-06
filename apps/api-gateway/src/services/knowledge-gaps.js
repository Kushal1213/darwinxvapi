import { createHash, randomUUID } from 'node:crypto';

import { getDatabase } from './database.js';

const workspaceId = 'default';
const ACTIVE_STATES = ['open', 'reopened', 'triaged', 'planned'];
const STATUSES = new Set([...ACTIVE_STATES, 'out_of_scope', 'resolved']);
const GAP_REASONS = new Set([
  'no_eligible_candidates',
  'insufficient_support',
  'knowledge_empty',
  'conflicting_evidence',
]);

function normalizeQuestion(question) {
  return String(question).normalize('NFKC').toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
}

function safeExcerpt(question) {
  return String(question).replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, '[email]')
    .replace(/(?:\+?\d[\d .()-]{4,}\d)/g, '[number]').slice(0, 500);
}

function eventsFor(gapId) {
  return getDatabase().prepare(`SELECT id, actor_id, action, created_at, payload
    FROM knowledge_gap_events WHERE gap_id=? ORDER BY id`).all(gapId).map((event) => ({
    ...event,
    payload: event.payload ? JSON.parse(event.payload) : null,
  }));
}

function gapFromRow(row, includeEvents = false) {
  if (!row) return null;
  const gap = {
    ...row,
    example_call_ids: JSON.parse(row.example_call_ids),
  };
  if (includeEvents) gap.events = eventsFor(row.id);
  return gap;
}

function addEvent(db, gapId, actorId, action, now, payload = null) {
  db.prepare(`INSERT INTO knowledge_gap_events
    (gap_id, actor_id, action, created_at, payload) VALUES (?, ?, ?, ?, ?)`)
    .run(gapId, actorId || null, action, now, payload ? JSON.stringify(payload) : null);
}

export function recordKnowledgeGap({ callId, market, product, reason, question }) {
  if (!GAP_REASONS.has(reason)) return null;
  const normalized = normalizeQuestion(question);
  if (!normalized) return null;
  const fingerprint = createHash('sha256')
    .update([workspaceId, market, product, normalized].join('\n')).digest('hex');
  const db = getDatabase();
  const current = db.prepare('SELECT * FROM knowledge_gaps WHERE workspace_id=? AND fingerprint=?')
    .get(workspaceId, fingerprint);
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    if (!current) {
      const id = randomUUID();
      db.prepare(`INSERT INTO knowledge_gaps
        (id, workspace_id, fingerprint, market, product, reason, status,
         occurrence_count, question_excerpt, example_call_ids, first_seen_at,
         last_seen_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'open', 1, ?, ?, ?, ?, ?)`)
        .run(id, workspaceId, fingerprint, market, product, reason,
          safeExcerpt(question), JSON.stringify([callId]), now, now, now);
      addEvent(db, id, null, 'created', now, { call_id: callId, reason });
    } else {
      const callIds = JSON.parse(current.example_call_ids);
      if (!callIds.includes(callId)) callIds.push(callId);
      const nextStatus = ['resolved', 'out_of_scope'].includes(current.status) ? 'reopened' : current.status;
      db.prepare(`UPDATE knowledge_gaps SET reason=?, status=?, occurrence_count=occurrence_count+1,
        example_call_ids=?, last_seen_at=?, updated_at=?,
        resolution_note=CASE WHEN ?='reopened' THEN NULL ELSE resolution_note END,
        resolution_document_id=CASE WHEN ?='reopened' THEN NULL ELSE resolution_document_id END,
        updated_by=CASE WHEN ?='reopened' THEN NULL ELSE updated_by END WHERE id=?`)
        .run(reason, nextStatus, JSON.stringify(callIds.slice(-10)), now, now,
          nextStatus, nextStatus, nextStatus, current.id);
      addEvent(db, current.id, null, nextStatus === 'reopened' ? 'reopened' : 'occurred', now,
        { call_id: callId, reason });
    }
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return getKnowledgeGap(current?.id || db.prepare('SELECT id FROM knowledge_gaps WHERE workspace_id=? AND fingerprint=?').get(workspaceId, fingerprint).id);
}

export function listKnowledgeGaps({ status = 'active', limit = 50, offset = 0 } = {}) {
  const db = getDatabase();
  let where = 'workspace_id=?';
  const parameters = [workspaceId];
  if (status === 'active') {
    where += ` AND status IN ('open', 'reopened', 'triaged', 'planned')`;
  } else if (status !== 'all') {
    where += ' AND status=?';
    parameters.push(status);
  }
  const total = db.prepare(`SELECT COUNT(*) AS total FROM knowledge_gaps WHERE ${where}`).get(...parameters).total;
  const rows = db.prepare(`SELECT * FROM knowledge_gaps WHERE ${where}
    ORDER BY occurrence_count DESC, last_seen_at DESC LIMIT ? OFFSET ?`)
    .all(...parameters, limit, offset);
  return { gaps: rows.map((row) => gapFromRow(row)), total };
}

export function getKnowledgeGap(id) {
  return gapFromRow(getDatabase().prepare('SELECT * FROM knowledge_gaps WHERE id=? AND workspace_id=?').get(id, workspaceId), true);
}

export function updateKnowledgeGap(id, { status, note, documentId }, actorId) {
  if (!STATUSES.has(status)) throw Object.assign(new Error('Invalid knowledge-gap status'), { status: 400 });
  if ((status === 'out_of_scope' || status === 'resolved') && !note) {
    throw Object.assign(new Error('A resolution note is required to close a gap'), { status: 400 });
  }
  const db = getDatabase();
  const current = db.prepare('SELECT * FROM knowledge_gaps WHERE id=? AND workspace_id=?').get(id, workspaceId);
  if (!current) return null;
  if (status === 'resolved') {
    if (!documentId) throw Object.assign(new Error('An active published document is required to resolve a gap'), { status: 400 });
    const document = db.prepare('SELECT payload FROM knowledge_documents WHERE id=? AND workspace_id=?').get(documentId, workspaceId);
    let published = false;
    try { published = JSON.parse(document?.payload || '{}').status === 'indexed'; } catch { /* Invalid documents are not eligible. */ }
    if (!published) throw Object.assign(new Error('Resolution document must be an active published revision'), { status: 409 });
  }
  if (current.status === status && current.resolution_note === (note || null)
    && current.resolution_document_id === (documentId || null)) return getKnowledgeGap(id);
  const now = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`UPDATE knowledge_gaps SET status=?, resolution_note=?, resolution_document_id=?,
      updated_by=?, updated_at=? WHERE id=?`)
      .run(status, note || null, documentId || null, actorId, now, id);
    addEvent(db, id, actorId, `status.${status}`, now, { note: note || null, document_id: documentId || null });
    db.exec('COMMIT');
  } catch (error) { db.exec('ROLLBACK'); throw error; }
  return getKnowledgeGap(id);
}

export { STATUSES as knowledgeGapStatuses };
