import { randomUUID } from 'node:crypto';

import { getDatabase } from './database.js';

const workspaceId = 'default';
const OPEN_STATES = ['delivered', 'acknowledged'];

function deliveryFromRow(row, includeEvents = false) {
  if (!row) return null;
  const escalation = JSON.parse(row.payload);
  const delivery = {
    id: row.id,
    workspace_id: row.workspace_id,
    call_id: row.call_id,
    escalation_id: row.escalation_id,
    state: row.state,
    destination_type: row.destination_type,
    priority: row.priority,
    requested_at: row.requested_at,
    delivered_at: row.delivered_at,
    acknowledged_at: row.acknowledged_at,
    resolved_at: row.resolved_at,
    resolution: row.resolution,
    updated_at: row.updated_at,
    escalation,
  };
  if (includeEvents) delivery.events = getEvents(row.id);
  return delivery;
}

function getEvents(deliveryId) {
  return getDatabase().prepare(`SELECT id, actor_id, action, created_at, payload
    FROM handoff_events WHERE delivery_id=? ORDER BY id`).all(deliveryId).map((event) => ({
    ...event,
    payload: event.payload ? JSON.parse(event.payload) : null,
  }));
}

function insertEvent(db, deliveryId, actorId, action, createdAt, payload = null) {
  db.prepare(`INSERT INTO handoff_events
    (delivery_id, actor_id, action, created_at, payload) VALUES (?, ?, ?, ?, ?)`)
    .run(deliveryId, actorId || null, action, createdAt, payload ? JSON.stringify(payload) : null);
}

/**
 * Persist the call snapshot and its internal-inbox delivery in one transaction.
 * escalation_id is the idempotency key, so retries cannot create duplicate work.
 */
export function persistHandoffEscalation(session, escalation, actorId = null) {
  const db = getDatabase();
  const existing = db.prepare('SELECT id FROM handoff_deliveries WHERE escalation_id=?').get(escalation.escalation_id);
  if (existing) {
    escalation.delivery_id = existing.id;
    db.prepare(`INSERT INTO calls VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status=excluded.status, ended_at=excluded.ended_at, payload=excluded.payload`)
      .run(session.call_id, workspaceId, session.status, session.ended_at || null,
        JSON.stringify({ ...session, workspace_id: workspaceId }));
    return getHandoff(existing.id);
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  escalation.delivery_id = id;
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare(`INSERT INTO calls VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET status=excluded.status, ended_at=excluded.ended_at, payload=excluded.payload`)
      .run(session.call_id, workspaceId, session.status, session.ended_at || null,
        JSON.stringify({ ...session, workspace_id: workspaceId }));
    db.prepare(`INSERT INTO handoff_deliveries
      (id, workspace_id, call_id, escalation_id, state, destination_type, priority,
       requested_at, delivered_at, updated_at, payload)
      VALUES (?, ?, ?, ?, 'delivered', 'internal_inbox', ?, ?, ?, ?, ?)`)
      .run(id, workspaceId, session.call_id, escalation.escalation_id,
        escalation.priority || 'NORMAL', escalation.timestamp || now, now, now, JSON.stringify(escalation));
    insertEvent(db, id, actorId, 'requested', escalation.timestamp || now, {
      reason: escalation.reason,
      priority: escalation.priority || 'NORMAL',
    });
    insertEvent(db, id, null, 'delivered', now, { destination_type: 'internal_inbox' });
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return getHandoff(id);
}

export function reconcileHandoffDeliveries() {
  const db = getDatabase();
  const calls = db.prepare('SELECT payload FROM calls WHERE workspace_id=?').all(workspaceId);
  for (const row of calls) {
    const session = JSON.parse(row.payload);
    for (const escalation of session.escalations || []) {
      if (escalation.trigger !== 'human_request') continue;
      persistHandoffEscalation(session, escalation);
    }
  }
}

export function listHandoffs({ state = 'open', limit = 50, offset = 0 } = {}) {
  const db = getDatabase();
  let where = 'workspace_id=?';
  const parameters = [workspaceId];
  if (state === 'open') {
    where += ` AND state IN ('delivered', 'acknowledged')`;
  } else if (state !== 'all') {
    where += ' AND state=?';
    parameters.push(state);
  }
  const total = db.prepare(`SELECT COUNT(*) AS total FROM handoff_deliveries WHERE ${where}`).get(...parameters).total;
  const rows = db.prepare(`SELECT * FROM handoff_deliveries WHERE ${where}
    ORDER BY CASE priority WHEN 'HIGH' THEN 0 ELSE 1 END, requested_at ASC, id
    LIMIT ? OFFSET ?`).all(...parameters, limit, offset);
  return { handoffs: rows.map((row) => deliveryFromRow(row)), total };
}

export function getHandoff(id) {
  const row = getDatabase().prepare('SELECT * FROM handoff_deliveries WHERE id=? AND workspace_id=?')
    .get(id, workspaceId);
  return deliveryFromRow(row, true);
}

export function transitionHandoff(id, action, actorId, resolution) {
  const db = getDatabase();
  const current = db.prepare('SELECT * FROM handoff_deliveries WHERE id=? AND workspace_id=?').get(id, workspaceId);
  if (!current) return null;

  const now = new Date().toISOString();
  if (action === 'acknowledge') {
    if (current.state === 'acknowledged') return getHandoff(id);
    if (current.state !== 'delivered') throw Object.assign(new Error('Only delivered handoffs can be acknowledged'), { status: 409 });
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`UPDATE handoff_deliveries SET state='acknowledged', acknowledged_at=?, updated_at=? WHERE id=?`).run(now, now, id);
      insertEvent(db, id, actorId, 'acknowledged', now);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  } else if (action === 'resolve') {
    if (current.state === 'resolved') return getHandoff(id);
    if (!OPEN_STATES.includes(current.state)) throw Object.assign(new Error('Only open handoffs can be resolved'), { status: 409 });
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare(`UPDATE handoff_deliveries SET state='resolved', resolved_at=?, resolution=?, updated_at=? WHERE id=?`)
        .run(now, resolution, now, id);
      insertEvent(db, id, actorId, 'resolved', now, { resolution });
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  } else {
    throw Object.assign(new Error('Unsupported handoff action'), { status: 400 });
  }
  return getHandoff(id);
}
