import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getDatabase } from './database.js';

const inputSchema = z.object({
  type: z.enum(['missed_cross_sell', 'compliance_gap', 'rising_frustration', 'payment_difficulty', 'buying_signal', 'human_escalation']),
  text: z.string().trim().min(1).max(2000),
  priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
  confidence: z.number().min(0).max(1),
  latency_ms: z.number().min(0).optional().default(0),
  expires_after_seconds: z.number().min(1).max(300).optional().default(45),
});
export const nudgeActionSchema = z.object({
  action: z.enum(['displayed', 'acknowledged', 'dismissed', 'useful', 'not_useful', 'wrong_signal', 'too_late']),
}).strict();
const active = (nudge) => ['created', 'displayed'].includes(nudge.status);
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };

export function createNudgeStore(db = getDatabase(), now = () => Date.now()) {
  const stamp = () => new Date(now()).toISOString();
  const read = (id) => {
    const row = db.prepare('SELECT payload FROM nudges WHERE id=?').get(id);
    return row ? JSON.parse(row.payload) : null;
  };
  function save(nudge, action, actor = null) {
    db.prepare('INSERT INTO nudges VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET status=excluded.status, payload=excluded.payload')
      .run(nudge.id, nudge.call_id, nudge.status, nudge.expires_at, JSON.stringify(nudge));
    db.prepare('INSERT INTO nudge_events(nudge_id, actor_id, action, created_at) VALUES (?, ?, ?, ?)')
      .run(nudge.id, actor, action, stamp());
  }
  function transaction(work) {
    db.exec('BEGIN IMMEDIATE');
    try { const result = work(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function expire() {
    const rows = db.prepare("SELECT payload FROM nudges WHERE status IN ('created', 'displayed') AND (expires_at<=? OR call_id IN (SELECT id FROM calls WHERE status='completed'))").all(stamp());
    if (!rows.length) return;
    transaction(() => rows.forEach((row) => {
      const nudge = JSON.parse(row.payload);
      save({ ...nudge, status: 'expired', updated_at: stamp() }, 'expired');
    }));
  }
  return {
    create(callId, input) {
      const parsed = inputSchema.safeParse(input);
      if (!parsed.success) fail(400, 'Invalid nudge payload');
      const call = db.prepare('SELECT status FROM calls WHERE id=?').get(callId);
      if (!call) fail(404, 'Call not found');
      if (call.status === 'completed') fail(409, 'Call has ended');
      expire();
      const recent = db.prepare("SELECT payload FROM nudges WHERE call_id=? ORDER BY json_extract(payload, '$.created_at') DESC LIMIT 50").all(callId).map((row) => JSON.parse(row.payload));
      const duplicate = recent.find((n) => n.type === parsed.data.type && n.text === parsed.data.text && now() - Date.parse(n.created_at) < 15000);
      if (duplicate) return { nudge: duplicate, created: false };
      const nudge = { ...parsed.data, id: randomUUID(), call_id: callId, status: 'created', feedback: null,
        created_at: stamp(), updated_at: stamp(), ts: stamp(), expires_at: new Date(now() + parsed.data.expires_after_seconds * 1000).toISOString() };
      transaction(() => {
        const pending = db.prepare("SELECT payload FROM nudges WHERE call_id=? AND status IN ('created', 'displayed')").all(callId).map((row) => JSON.parse(row.payload));
        if (pending.length >= 3) {
          const weight = { LOW: 0, MEDIUM: 1, HIGH: 2 };
          const victim = pending.sort((a, b) => weight[a.priority] - weight[b.priority] || a.created_at.localeCompare(b.created_at))[0];
          if (weight[victim.priority] > weight[nudge.priority]) fail(409, 'Higher-priority nudges are already active');
          save({ ...victim, status: 'expired', updated_at: stamp() }, 'replaced');
        }
        save(nudge, 'created');
      });
      return { nudge, created: true };
    },
    list(callId, limit = 100) {
      expire();
      return (callId
        ? db.prepare("SELECT payload FROM nudges WHERE call_id=? ORDER BY json_extract(payload, '$.created_at') DESC, id LIMIT ?").all(callId, limit)
        : db.prepare("SELECT payload FROM nudges ORDER BY json_extract(payload, '$.created_at') DESC, id LIMIT ?").all(limit))
        .map((row) => JSON.parse(row.payload));
    },
    act(id, action, actor) {
      if (!nudgeActionSchema.safeParse({ action }).success) fail(400, 'Invalid nudge action');
      expire();
      const nudge = read(id);
      if (!nudge) fail(404, 'Nudge not found');
      const isFeedback = ['useful', 'not_useful', 'wrong_signal', 'too_late'].includes(action);
      if (isFeedback ? nudge.feedback === action : nudge.status === action) return nudge;
      if (!isFeedback && !active(nudge)) fail(409, 'This nudge is already resolved or expired');
      const updated = { ...nudge, updated_at: stamp(), ...(isFeedback
        ? { feedback: action, feedback_by: actor, feedback_at: stamp() }
        : { status: action, acted_by: actor, acted_at: stamp() }) };
      transaction(() => save(updated, action, actor));
      return updated;
    },
    events(id) {
      expire();
      if (!read(id)) fail(404, 'Nudge not found');
      return db.prepare('SELECT actor_id, action, created_at FROM nudge_events WHERE nudge_id=? ORDER BY id').all(id);
    },
  };
}

let store;
export const getNudgeStore = () => (store ||= createNudgeStore());
