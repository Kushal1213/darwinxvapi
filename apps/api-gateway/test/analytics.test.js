import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { analyticsCsv, buildAnalytics, getAnalytics } from '../src/services/analytics.js';

const now = new Date('2026-09-26T12:00:00.000Z');
const call = (id, fields = {}) => ({
  call_id: id, market: 'india-loan', status: 'active', created_at: '2026-09-26T10:00:00.000Z',
  turns: [], escalations: [], ...fields,
});

test('UTC cohort uses call start time and excludes the current instant and invalid dates', () => {
  const report = buildAnalytics([
    call('before', { created_at: '2026-09-19T23:59:59.999Z', ended_at: now.toISOString(), status: 'completed' }),
    call('first', { created_at: '2026-09-20T00:00:00.000Z', status: 'created' }),
    call('offset', { created_at: '2026-09-20T05:30:00.000+05:30', status: 'escalated', escalations: [{}, {}] }),
    call('last', { created_at: '2026-09-26T11:59:59.999Z', status: 'completed', outcome: 'human_handoff_requested' }),
    call('at-now', { created_at: now.toISOString() }),
    call('future', { created_at: '2026-09-26T12:00:00.001Z' }),
    call('invalid', { created_at: 'invalid' }),
    call('missing', { created_at: null }),
  ], { now });
  assert.deepEqual(report.window, { from: '2026-09-20T00:00:00.000Z', to: now.toISOString(), timezone: 'UTC' });
  assert.equal(report.daily.length, 7);
  assert.deepEqual(report.daily[0], { date: '2026-09-20', calls: 2, completed: 0, handoffs: 1 });
  assert.deepEqual(report.daily[1], { date: '2026-09-21', calls: 0, completed: 0, handoffs: 0 });
  assert.deepEqual(report.daily.at(-1), { date: '2026-09-26', calls: 1, completed: 1, handoffs: 1 });
  assert.equal(report.totals.calls, 3);
  assert.equal(report.totals.active, 2);
  assert.equal(report.totals.handoffs, 2);
  assert.equal(report.recent_calls[0].call_id, 'last');
  for (const days of [30, 90]) assert.equal(buildAnalytics([], { days, now }).daily.length, days);
});

test('coverage, duration and latency have distinct denominators and nearest-rank percentiles', () => {
  const report = buildAnalytics([
    call('completed', {
      status: 'completed', ended_at: '2026-09-26T10:01:00.000Z',
      turns: [
        { role: 'user', latency_ms: 999999, sources: [{}] },
        { role: 'assistant', sources: [{}], latency_ms: 0 },
        { role: 'assistant', sources: [], latency_ms: 100 },
        { role: 'assistant', sources: [{}], latency_ms: 200 },
        { role: 'assistant', sources: [{}], latency_ms: 400 },
        { role: 'assistant', sources: [], latency_ms: null },
        { role: 'assistant', latency_ms: '25' },
        { role: 'assistant', latency_ms: -5 },
        { role: 'assistant', latency_ms: Infinity },
        { role: 'assistant', latency_ms: NaN },
        null,
      ],
    }),
    call('active', { ended_at: '2026-09-26T10:00:20.000Z' }),
    call('negative-duration', { status: 'completed', ended_at: '2026-09-26T09:59:00.000Z' }),
    call('invalid-end', { status: 'completed', ended_at: 'invalid' }),
    call('future-end', { status: 'completed', ended_at: '2026-09-27T10:00:00.000Z' }),
    call('zero-duration', { status: 'completed', ended_at: '2026-09-26T10:00:00.000Z' }),
  ], { now });
  assert.equal(report.totals.assistant_turns, 9);
  assert.equal(report.totals.cited_turns, 3);
  assert.equal(report.totals.citation_coverage_pct, 33.33);
  assert.equal(report.totals.latency_samples, 4);
  assert.equal(report.totals.avg_latency_ms, 175);
  assert.equal(report.totals.p50_latency_ms, 100);
  assert.equal(report.totals.p95_latency_ms, 400);
  assert.equal(report.totals.duration_samples, 2);
  assert.equal(report.totals.avg_duration_ms, 30000);
  assert.equal(report.recent_calls.length, 5);
});

test('empty cohorts preserve unknown metrics, and market filtering applies to every output', () => {
  const empty = buildAnalytics([], { now });
  assert.equal(empty.totals.calls, 0);
  for (const key of ['citation_coverage_pct', 'avg_duration_ms', 'avg_latency_ms', 'p50_latency_ms', 'p95_latency_ms']) {
    assert.equal(empty.totals[key], null);
  }
  assert.deepEqual(empty.markets, []);
  assert.deepEqual(empty.recent_calls, []);
  const filtered = buildAnalytics([
    call('loan'), call('insurance', { market: 'india-insurance', turns: [{ role: 'assistant', sources: [] }] }),
    call('unknown', { market: undefined }),
  ], { market: 'india-insurance', now });
  assert.equal(filtered.totals.calls, 1);
  assert.equal(filtered.totals.citation_coverage_pct, 0);
  assert.deepEqual(filtered.markets, [{ market: 'india-insurance', calls: 1, completed: 0, handoffs: 0 }]);
  assert.deepEqual(filtered.recent_calls.map((entry) => entry.call_id), ['insurance']);
  assert.equal(filtered.daily.at(-1).calls, 1);
  assert.equal(analyticsCsv(filtered).split('\r\n')[0], 'date,calls,completed,handoffs');
  assert.equal(analyticsCsv(filtered).includes('insurance'), false);
});

test('stored workspace and status override conflicting payload claims without disclosing transcript', () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec('CREATE TABLE calls (id TEXT, workspace_id TEXT, status TEXT, ended_at TEXT, payload TEXT)');
    const insert = db.prepare('INSERT INTO calls VALUES (?, ?, ?, ?, ?)');
    insert.run('own', 'one', 'completed', '2026-09-26T10:00:10.000Z', JSON.stringify(call('payload-id', {
      workspace_id: 'two', status: 'active', state: { customer_name: 'PRIVATE CUSTOMER' },
      turns: [{ role: 'assistant', content: 'PRIVATE TRANSCRIPT', sources: [{ excerpt: 'PRIVATE SOURCE' }] }],
    })));
    insert.run('other', 'two', 'active', null, JSON.stringify(call('other', { workspace_id: 'one' })));
    const report = getAnalytics({ db, workspaceId: 'one', now });
    assert.equal(report.totals.calls, 1);
    assert.equal(report.totals.completed, 1);
    assert.equal(report.totals.avg_duration_ms, 10000);
    assert.equal(report.recent_calls[0].call_id, 'own');
    assert.equal(JSON.stringify(report).includes('PRIVATE'), false);
    assert.equal(JSON.stringify(report).includes('workspace_id'), false);
    assert.equal(getAnalytics({ db, workspaceId: 'missing', now }).totals.calls, 0);
  } finally { db.close(); }
});

test('analytics API authenticates, validates, isolates, exports and persists across gateway restart', { timeout: 30000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'veyra-analytics-'));
  const databasePath = join(directory, 'test.sqlite');
  let child;
  let base;
  let db;
  async function stop() {
    if (child?.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
  }
  async function start() {
    const probe = createServer().listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    base = `http://127.0.0.1:${port}/api`;
    child = spawn(process.execPath, ['src/index.js'], {
      cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: 'ignore',
      env: { ...process.env, PORT: String(port), NODE_ENV: 'test', LOG_LEVEL: 'silent',
        VEYRA_DATABASE_PATH: databasePath, CALL_HISTORY_DIR: directory },
    });
    for (let attempt = 0; attempt < 80; attempt += 1) {
      if (child.exitCode !== null) throw new Error(`Gateway exited: ${child.exitCode}`);
      try { if ((await fetch(`${base}/auth/session`)).ok) return; } catch {}
      await delay(50);
    }
    throw new Error('Gateway did not start');
  }
  t.after(async () => { db?.close(); await stop(); await rm(directory, { recursive: true, force: true }); });
  const request = (path, cookie = '', body) => fetch(base + path, {
    headers: { Cookie: cookie, Origin: 'http://localhost:3000', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
  });
  await start();
  assert.equal((await request('/analytics')).status, 401);
  assert.equal((await request('/analytics?format=csv')).status, 401);
  const password = 'analytics-password-2026';
  const setup = await request('/auth/setup', '', { email: 'owner@example.test', password, workspace: 'Analytics test' });
  assert.equal(setup.status, 201);
  const cookie = setup.headers.get('set-cookie').split(';')[0];
  const owner = await setup.json();
  const emptyResponse = await request('/analytics', cookie);
  assert.equal(emptyResponse.status, 200);
  assert.equal(emptyResponse.headers.get('cache-control'), 'no-store');
  assert.equal((await emptyResponse.json()).totals.calls, 0);
  for (const query of ['days=0', 'days=8', 'days=7.0', 'days=7&days=30', 'days[x]=7', 'market=india', 'market=all&market=india-loan', 'format=html', 'workspace_id=other']) {
    assert.equal((await request('/analytics?' + query, cookie)).status, 400, query);
  }
  db = new DatabaseSync(databasePath);
  db.prepare('INSERT INTO workspace VALUES (?, ?)').run('other', 'Other workspace');
  const passwordHash = db.prepare('SELECT password_hash FROM users WHERE id=?').get(owner.user.id).password_hash;
  db.prepare('INSERT INTO users VALUES (?, ?, ?, ?, ?)').run('other-operator', 'other@example.test', passwordHash, 'other', 'operator');
  const started = new Date(Date.now() - 60000).toISOString();
  const ended = new Date(Date.now() - 30000).toISOString();
  const insert = db.prepare('INSERT INTO calls VALUES (?, ?, ?, ?, ?)');
  insert.run('own-record', 'default', 'completed', ended, JSON.stringify(call('own-record', {
    created_at: started, ended_at: ended, status: 'completed', outcome: 'human_handoff_requested',
    turns: [{ role: 'assistant', content: 'CONFIDENTIAL CONTENT', sources: [{ excerpt: 'SOURCE CONTENT' }], latency_ms: 250 }],
  })));
  insert.run('other-record', 'other', 'active', null, JSON.stringify(call('other-record', { created_at: started })));
  for (const days of [7, 30, 90]) {
    const response = await request(`/analytics?days=${days}`, cookie);
    assert.equal(response.status, 200);
    const report = await response.json();
    assert.equal(report.daily.length, days);
    assert.equal(report.totals.calls, 1);
    assert.equal(report.totals.handoffs, 1);
    assert.equal(report.totals.avg_latency_ms, 250);
    assert.deepEqual(report.recent_calls.map((entry) => entry.call_id), ['own-record']);
    assert.equal(JSON.stringify(report).includes('CONTENT'), false);
  }
  assert.equal((await (await request('/analytics?market=india-insurance', cookie)).json()).totals.calls, 0);
  const csv = await request('/analytics?format=csv', cookie);
  assert.match(csv.headers.get('content-type'), /^text\/csv/);
  assert.match(csv.headers.get('content-disposition'), /^attachment; filename="veyra-analytics-/);
  const csvBody = await csv.text();
  assert.equal(csvBody.split('\r\n').length, 9);
  assert.equal(csvBody.includes('own-record'), false);
  assert.equal(csvBody.includes('CONTENT'), false);
  const login = await request('/auth/login', '', { email: 'other@example.test', password });
  assert.equal(login.status, 200);
  const otherCookie = login.headers.get('set-cookie').split(';')[0];
  const otherReport = await (await request('/analytics', otherCookie)).json();
  assert.deepEqual(otherReport.recent_calls.map((entry) => entry.call_id), ['other-record']);
  db.prepare("UPDATE users SET role='disabled' WHERE id='other-operator'").run();
  assert.equal((await request('/analytics', otherCookie)).status, 401);
  await stop();
  await start();
  assert.equal((await (await request('/analytics', cookie)).json()).totals.calls, 1);
});
