import assert from 'node:assert/strict';
import test from 'node:test';
import { getDatabase } from '../src/services/database.js';
import { createNudgeStore } from '../src/services/nudges.js';

process.env.VEYRA_DATABASE_PATH = ':memory:';
const db = getDatabase();
db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)').run('operator', 'operator@example.test', 'unused', 'default', 'admin');
let time = Date.parse('2026-09-26T00:00:00Z');
const store = createNudgeStore(db, () => time);
const payload = { type: 'buying_signal', text: 'Offer the next step.', priority: 'LOW', confidence: 0.8 };
function call(id) { db.prepare('INSERT INTO calls VALUES (?, ?, ?, ?, ?)').run(id, 'default', 'active', null, '{}'); }

test('nudge actions persist attribution and duplicate delivery does not reopen a resolved alert', () => {
  call('actions');
  const { nudge } = store.create('actions', payload);
  assert.equal(nudge.status, 'created');
  assert.equal(store.act(nudge.id, 'displayed', 'operator').status, 'displayed');
  assert.equal(store.act(nudge.id, 'acknowledged', 'operator').acted_by, 'operator');
  assert.equal(store.act(nudge.id, 'acknowledged', 'operator').status, 'acknowledged');
  assert.throws(() => store.act(nudge.id, 'dismissed', 'operator'), { status: 409 });
  assert.equal(store.act(nudge.id, 'useful', 'operator').feedback, 'useful');
  const duplicate = store.create('actions', payload);
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.nudge.id, nudge.id);
  assert.equal(duplicate.nudge.status, 'acknowledged');
  assert.deepEqual(store.events(nudge.id).map((event) => event.action), ['created', 'displayed', 'acknowledged', 'useful']);
  const freshStore = createNudgeStore(db, () => time);
  assert.equal(freshStore.list('actions')[0].feedback_by, 'operator');
});

test('expiry and call completion remove actionable state while retaining feedback history', () => {
  call('expiry');
  const { nudge } = store.create('expiry', { ...payload, expires_after_seconds: 1 });
  time += 1001;
  assert.equal(store.list('expiry')[0].status, 'expired');
  assert.throws(() => store.act(nudge.id, 'acknowledged', 'operator'), { status: 409 });
  assert.equal(store.act(nudge.id, 'too_late', 'operator').feedback, 'too_late');
  call('end');
  store.create('end', payload);
  db.prepare("UPDATE calls SET status='completed' WHERE id='end'").run();
  assert.equal(store.list('end')[0].status, 'expired');
  assert.throws(() => store.create('end', payload), { status: 409 });
});

test('active nudge cap prioritizes urgent signals', () => {
  call('capacity');
  for (let i = 0; i < 3; i++) store.create('capacity', { ...payload, text: `Urgent ${i}`, priority: 'HIGH' });
  assert.throws(() => store.create('capacity', payload), { status: 409 });
  store.create('capacity', { ...payload, text: 'Urgent replacement', priority: 'HIGH' });
  const records = store.list('capacity');
  assert.equal(records.filter((nudge) => nudge.status === 'created').length, 3);
  assert.equal(records.filter((nudge) => nudge.status === 'expired').length, 1);
});

test('malformed inputs and unknown IDs cannot create or mutate records', () => {
  assert.throws(() => store.create('missing', payload), { status: 404 });
  assert.throws(() => store.create('actions', { ...payload, confidence: 3 }), { status: 400 });
  assert.throws(() => store.act('missing', 'acknowledged', 'operator'), { status: 404 });
  assert.throws(() => store.act('missing', 'arbitrary', 'operator'), { status: 400 });
});

test('grounded knowledge tips apply once and retain their evidence', () => {
  call('guided');
  const { nudge } = store.create('guided', {
    type: 'knowledge_tip',
    text: 'A grounded loan reply is ready.',
    priority: 'MEDIUM',
    confidence: null,
    suggested_response: 'The approved income requirement is in the loan policy.',
    context_query: 'What income is required?',
    sources: [{ source: 'loan-policy', chunk_id: 'income-1', page: 7 }],
  });
  let persisted = 0;
  const first = store.apply(nudge.id, 'operator', () => { persisted += 1; });
  assert.equal(first.applied, true);
  assert.equal(first.nudge.status, 'applied');
  assert.equal(first.nudge.sources[0].page, 7);
  const replay = store.apply(nudge.id, 'operator', () => { persisted += 1; });
  assert.equal(replay.applied, false);
  assert.equal(persisted, 1);
  assert.deepEqual(store.events(nudge.id).map((event) => event.action), ['created', 'applied']);
  const ordinary = store.create('guided', payload).nudge;
  assert.throws(() => store.apply(ordinary.id, 'operator', () => {}), { status: 409 });
});

test('new guidance replaces stale guidance without consuming safety-alert capacity', () => {
  call('guidance-capacity');
  for (let i = 0; i < 3; i++) {
    store.create('guidance-capacity', { ...payload, text: `Safety ${i}`, priority: 'HIGH' });
  }
  const tip = (text) => ({
    type: 'knowledge_tip', text, priority: 'MEDIUM', confidence: null,
    suggested_response: text, sources: [],
  });
  store.create('guidance-capacity', tip('First grounded reply'));
  store.create('guidance-capacity', tip('Current grounded reply'));
  const records = store.list('guidance-capacity');
  assert.equal(records.filter((nudge) => nudge.type !== 'knowledge_tip' && nudge.status === 'created').length, 3);
  assert.equal(records.filter((nudge) => nudge.type === 'knowledge_tip' && nudge.status === 'created').length, 1);
  assert.equal(records.find((nudge) => nudge.type === 'knowledge_tip' && nudge.status === 'created').text, 'Current grounded reply');
});
