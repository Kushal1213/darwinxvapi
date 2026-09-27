import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { DatabaseSync } from 'node:sqlite';
import { io } from 'socket.io-client';
import test from 'node:test';

test('team invitations, role boundaries, revocation and restart', { timeout: 30000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'veyra-team-'));
  let child, base, ownerCookie;
  async function stop() {
    if (child?.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
  }
  async function start() {
    const probe = createServer().listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    base = 'http://127.0.0.1:' + port;
    child = spawn(process.execPath, ['src/index.js'], {
      cwd: fileURLToPath(new URL('../', import.meta.url)), stdio: 'ignore',
      env: { ...process.env, PORT: String(port), NODE_ENV: 'test', LOG_LEVEL: 'silent',
        VEYRA_DATABASE_PATH: join(directory, 'test.sqlite'), CALL_HISTORY_DIR: directory },
    });
    for (let i = 0; i < 80; i++) {
      try { if ((await fetch(base + '/api/auth/session')).ok) return; } catch {}
      await delay(50);
    }
    throw new Error('Gateway did not start');
  }
  t.after(async () => { await stop(); await rm(directory, { recursive: true, force: true }); });
  async function api(path, body, cookie = ownerCookie, method = body === undefined ? 'GET' : 'POST') {
    const response = await fetch(base + '/api' + path, {
      method, headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', Cookie: cookie || '' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  await start();
  const owner = await api('/auth/setup', { email: 'owner@example.test', password: 'owner-password-2026', workspace: 'Team QA' });
  assert.equal(owner.status, 201);
  ownerCookie = owner.cookie;
  const ownerId = owner.data.user.id;
  let operator;
  await t.test('one-time tokens are hashed, bound to email and cannot be replayed', async () => {
    const invite = await api('/team/invites', { email: 'Agent@example.test', role: 'operator' });
    assert.equal(invite.status, 201);
    assert.equal((await api('/team/invites', { email: 'agent@example.test', role: 'admin' })).status, 409);
    const db = new DatabaseSync(join(directory, 'test.sqlite'));
    const row = db.prepare('SELECT * FROM team_invites WHERE id=?').get(invite.data.id);
    db.close();
    assert.notEqual(row.token_hash, invite.data.token);
    const accepted = await api('/auth/accept-invite', { token: invite.data.token, password: 'operator-password-2026', role: 'admin' }, '');
    assert.equal(accepted.status, 201);
    assert.equal(accepted.data.user.role, 'operator');
    assert.equal(accepted.data.user.email, 'agent@example.test');
    operator = accepted;
    assert.equal((await api('/auth/accept-invite', { token: invite.data.token, password: 'operator-password-2026' }, '')).status, 400);
    assert.equal((await api('/team')).data.users.length, 2);
    assert.equal(JSON.stringify((await api('/team')).data).includes(row.token_hash), false);
  });
  await t.test('operators can run calls but not administer team or knowledge', async () => {
    assert.equal((await api('/team', undefined, operator.cookie)).status, 403);
    assert.equal((await api('/team/users/' + operator.data.user.id, { role: 'admin' }, operator.cookie, 'PATCH')).status, 403);
    assert.equal((await api('/knowledge/documents', undefined, operator.cookie)).status, 200);
    for (const path of ['/knowledge/documents', '/knowledge/documents/fake/retry', '/knowledge/documents/fake/archive']) {
      assert.equal((await api(path, {}, operator.cookie)).status, 403);
    }
    assert.equal((await api('/voice/session', { call_id: 'operator-call' }, operator.cookie)).status, 200);
    assert.equal((await api('/team/users/' + ownerId, { role: 'disabled' }, ownerCookie, 'PATCH')).status, 409);
    assert.equal((await api('/team/users/' + operator.data.user.id, { role: 'invalid' }, ownerCookie, 'PATCH')).status, 400);
  });
  await t.test('disabled users immediately lose HTTP and socket sessions', async () => {
    const socket = io(base, { transports: ['websocket'], extraHeaders: { Cookie: operator.cookie, Origin: 'http://localhost:3000' }, reconnection: false });
    t.after(() => socket.disconnect());
    await once(socket, 'connect');
    const disconnected = once(socket, 'disconnect');
    assert.equal((await api('/team/users/' + operator.data.user.id, { role: 'disabled' }, ownerCookie, 'PATCH')).status, 200);
    await disconnected;
    assert.equal((await api('/knowledge/documents', undefined, operator.cookie)).status, 401);
    assert.equal((await api('/auth/login', { email: 'agent@example.test', password: 'operator-password-2026' }, '')).status, 401);
    await api('/team/users/' + operator.data.user.id, { role: 'operator' }, ownerCookie, 'PATCH');
    assert.equal((await api('/knowledge/documents', undefined, operator.cookie)).status, 401);
  });
  await t.test('revoked and expired invitations fail; persisted invitation survives restart', async () => {
    const revoked = await api('/team/invites', { email: 'revoked@example.test', role: 'operator' });
    await api('/team/invites/' + revoked.data.id + '/revoke', {});
    assert.equal((await api('/auth/accept-invite', { token: revoked.data.token, password: 'password-long-enough' }, '')).status, 400);
    const expired = await api('/team/invites', { email: 'expired@example.test', role: 'operator' });
    const db = new DatabaseSync(join(directory, 'test.sqlite'));
    db.prepare('UPDATE team_invites SET expires_at=0 WHERE id=?').run(expired.data.id);
    db.close();
    assert.equal((await api('/auth/accept-invite', { token: expired.data.token, password: 'password-long-enough' }, '')).status, 400);
    const pending = await api('/team/invites', { email: 'second-admin@example.test', role: 'admin' });
    await stop(); await start();
    const accepted = await api('/auth/accept-invite', { token: pending.data.token, password: 'password-long-enough' }, '');
    assert.equal(accepted.status, 201);
    assert.equal((await api('/team', undefined, accepted.cookie)).status, 200);
    assert.equal((await api('/team/users/' + ownerId, { role: 'operator' }, accepted.cookie, 'PATCH')).status, 200);
    assert.equal((await api('/team', undefined, ownerCookie)).status, 401);
    assert.equal((await api('/team/users/' + accepted.data.user.id, { role: 'operator' }, accepted.cookie, 'PATCH')).status, 409);
  });
});
