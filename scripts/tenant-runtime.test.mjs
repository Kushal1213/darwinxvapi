import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:net';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { io } from 'socket.io-client';
import { execFileSync } from 'node:child_process';
import {
  assertPortsAvailable, backupTenant, decommissionTenant, launchTenant, provisionTenant,
  repository, restoreTenant, tenantConfiguration, verifyTenantBackup,
} from './tenant-runtime.mjs';

test('tenant configuration fails closed and never inherits shared application settings', async t => {
  const root = mkdtempSync(join(tmpdir(), 'veyra-tenant-config-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  assert.throws(() => provisionTenant('../escape', 4100, root));
  assert.throws(() => provisionTenant('con', 4100, root));
  assert.throws(() => provisionTenant('alpha', 65534, root));
  provisionTenant('alpha', 4100, root);
  assert.throws(() => provisionTenant('alpha', 4200, root));
  const config = tenantConfiguration('alpha', root, {
    PATH: process.env.PATH, GEMINI_API_KEY: 'shared-key', VOICE_SERVICE_TOKEN: 'shared-token',
    VEYRA_DATABASE_PATH: 'shared.sqlite', RAG_SERVICE_URL: 'http://shared', VITE_VAPI_PUBLIC_KEY: 'shared-public',
  });
  assert.equal(config.env.GEMINI_API_KEY, '');
  assert.equal(config.env.VITE_VAPI_PUBLIC_KEY, '');
  assert.notEqual(config.env.VOICE_SERVICE_TOKEN, 'shared-token');
  assert.equal(config.env.VEYRA_DATABASE_PATH, join(root, 'alpha', 'veyra.sqlite'));
  const envFile = join(root, 'alpha', '.env');
  writeFileSync(envFile, readFileSync(envFile, 'utf8') + '\nFAISS_INDEX_PATH=shared-index');
  assert.throws(() => tenantConfiguration('alpha', root), /Unsupported tenant setting/);
  const listener = createServer().listen(0, '127.0.0.1');
  await once(listener, 'listening');
  try { await assert.rejects(assertPortsAvailable([listener.address().port]), /already in use/); }
  finally { await new Promise(resolve => listener.close(resolve)); }
});

test('tenant backup, integrity verification, restore, and confirmed decommission are recoverable', t => {
  const root = mkdtempSync(join(tmpdir(), 'veyra-tenant-recovery-'));
  const backups = mkdtempSync(join(tmpdir(), 'veyra-tenant-backups-'));
  t.after(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(backups, { recursive: true, force: true });
  });
  const original = provisionTenant('alpha', 4100, root);
  mkdirSync(join(original, 'knowledge'), { recursive: true });
  writeFileSync(join(original, 'veyra.sqlite'), 'database snapshot');
  writeFileSync(join(original, 'knowledge', 'current.json'), '{"generation":"one"}');
  assert.throws(() => backupTenant('alpha', join(original, 'nested-backup'), root), /outside the tenant/);
  writeFileSync(join(original, 'runtime.lock'), '123');
  assert.throws(() => backupTenant('alpha', join(backups, 'running'), root), /runtime lock/);
  rmSync(join(original, 'runtime.lock'));

  const firstBackup = backupTenant('alpha', join(backups, 'first'), root);
  const manifest = verifyTenantBackup(firstBackup);
  assert.equal(manifest.tenant_id, 'alpha');
  assert.ok(manifest.files.some(file => file.path === 'veyra.sqlite'));
  assert.throws(() => backupTenant('alpha', firstBackup, root), /already exists/);
  writeFileSync(join(firstBackup, 'veyra.sqlite'), 'tampered');
  assert.throws(() => verifyTenantBackup(firstBackup), /integrity check failed/);

  const safeBackup = backupTenant('alpha', join(backups, 'safe'), root);
  assert.throws(() => decommissionTenant('alpha', join(backups, 'wrong-confirmation'), 'beta', root), /exactly match/);
  const recoveryBackup = decommissionTenant('alpha', join(backups, 'decommission'), 'alpha', root);
  assert.equal(existsSync(original), false);
  assert.equal(verifyTenantBackup(recoveryBackup).tenant_id, 'alpha');
  assert.throws(() => restoreTenant(safeBackup, 'beta', root), /different tenant/);
  const restored = restoreTenant(recoveryBackup, 'alpha', root);
  assert.equal(readFileSync(join(restored, 'veyra.sqlite'), 'utf8'), 'database snapshot');
  assert.throws(() => restoreTenant(recoveryBackup, 'alpha', root), /already exists/);
  assert.equal(tenantConfiguration('alpha', root).id, 'alpha');
});

test('two complete tenant stacks isolate sessions, calls, realtime, knowledge and files', { timeout: 120000 }, async t => {
  const root = mkdtempSync(join(tmpdir(), 'veyra-tenants-'));
  const runtimes = [], sockets = [];
  t.after(async () => {
    for (const socket of sockets) socket.disconnect();
    for (const runtime of runtimes) await runtime.stop();
    rmSync(root, { recursive: true, force: true });
  });
  async function freeBase() {
    for (let i = 0; i < 20; i++) {
      const port = 20000 + Math.floor(Math.random() * 30000);
      try { await assertPortsAvailable(Array.from({ length: 5 }, (_, n) => port + n)); return port; } catch {}
    }
    throw new Error('No free tenant ports found');
  }
  const configs = [];
  for (const id of ['alpha', 'beta']) {
    provisionTenant(id, await freeBase(), root);
    const config = tenantConfiguration(id, root);
    configs.push(config);
    runtimes.push(await launchTenant(config, { stdio: 'ignore' }));
  }
  const [a, b] = configs;
  async function api(config, path, body, cookie = '', origin = config.env.FRONTEND_URL) {
    const response = await fetch(config.env.VITE_API_GATEWAY_URL + '/api' + path, {
      headers: { 'Content-Type': 'application/json', Origin: origin, Cookie: cookie },
      ...(body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }),
    });
    return { status: response.status, data: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
  }
  const accounts = [];
  for (const config of configs) {
    const setup = await api(config, '/auth/setup', { email: 'owner@example.test', password: 'tenant-test-password-2026', workspace: config.id });
    assert.equal(setup.status, 201);
    assert.ok(setup.cookie.startsWith('veyra.' + config.id + '.sid='));
    accounts.push(setup.cookie);
    const health = await (await fetch(config.env.RAG_SERVICE_URL + '/health')).json();
    assert.equal(health.indexed_chunks, 0, 'A new tenant must not inherit the reference corpus');
  }
  const [cookieA, cookieB] = accounts;
  assert.equal((await api(b, '/voice/live', undefined, cookieA)).status, 401);
  assert.equal((await api(b, '/voice/live', undefined, cookieA.replace('veyra.alpha.sid=', 'veyra.beta.sid='))).status, 401);
  assert.equal((await api(a, '/voice/session', { call_id: 'blocked' }, cookieA, b.env.FRONTEND_URL)).status, 403);
  const eventsA = [], eventsB = [];
  for (const [index, config] of configs.entries()) {
    const socket = io(config.env.VITE_API_GATEWAY_URL, {
      transports: ['websocket'], reconnection: false, extraHeaders: { Cookie: accounts[index], Origin: config.env.FRONTEND_URL },
    });
    sockets.push(socket);
    socket.on('call:escalated', event => (index === 0 ? eventsA : eventsB).push(event));
    await once(socket, 'connect');
  }
  for (const [index, config] of configs.entries()) {
    assert.equal((await api(config, '/voice/session', { call_id: 'same-call' }, accounts[index])).status, 200);
  }
  await api(a, '/voice/query', { call_id: 'same-call', query: 'I want to talk to a human' }, cookieA);
  await delay(150);
  assert.equal(eventsA.length, 1);
  assert.equal(eventsB.length, 0);
  assert.equal((await api(b, '/voice/session/same-call', undefined, cookieB)).data.turns.length, 0);
  await api(a, '/voice/session', { call_id: 'alpha-only' }, cookieA);
  assert.equal((await api(b, '/voice/session/alpha-only', undefined, cookieB)).status, 404);
  const form = new FormData();
  form.append('file', new Blob(['Alpha confidential policy']), 'alpha.txt');
  for (const [key, value] of Object.entries({ title: 'Alpha policy', market: 'india', category: 'policy' })) form.append(key, value);
  const upload = await fetch(a.env.VITE_API_GATEWAY_URL + '/api/knowledge/documents', {
    method: 'POST', headers: { Cookie: cookieA, Origin: a.env.FRONTEND_URL }, body: form,
  });
  assert.equal(upload.status, 202);
  const doc = (await upload.json()).document;
  assert.equal((await api(b, '/knowledge/documents/' + doc.id, undefined, cookieB)).status, 404);
  assert.equal((await api(b, '/knowledge/documents', undefined, cookieB)).data.documents.length, 0);
  for (const [index, config] of configs.entries()) {
    execFileSync(process.env.PYTHON || 'python', ['-c', [
      'import sys',
      'sys.path.insert(0, sys.argv[1])',
      'from managed_knowledge import replace_document',
      'replace_document(sys.argv[2], 3072, "same-document", [{"document_id": "same-document", "chunk_id": "same-chunk", "source": sys.argv[3], "market": "india", "content": sys.argv[3] + " private knowledge"}], [[1.0] + [0.0] * 3071])',
    ].join('\n'), join(repository, 'services'), config.env.FAISS_INDEX_PATH, index === 0 ? 'zircon' : 'beryl']);
  }
  const grounded = await api(a, '/rag/retrieve', { query: 'zircon' }, cookieA);
  assert.equal(grounded.status, 200);
  assert.equal(grounded.data.sources[0].source, 'zircon');
  assert.equal((await api(b, '/rag/retrieve', { query: 'zircon' }, cookieB)).data.sources.length, 0);
  assert.equal((await api(b, '/rag/retrieve', { query: 'beryl' }, cookieB)).data.sources[0].source, 'beryl');
  // Provider callback credentials are installation-specific too.
  const crossProvider = await fetch(b.env.VITE_API_GATEWAY_URL + '/api/transcript/chunk', {
    method: 'POST', headers: { Authorization: 'Bearer ' + a.env.VOICE_SERVICE_TOKEN, 'Content-Type': 'application/json' }, body: '{}',
  });
  assert.equal(crossProvider.status, 403);
  for (const config of configs) {
    const frontend = config.env.FRONTEND_URL.replace('localhost', '127.0.0.1');
    for (const file of [join(config.directory, '.env'), join(config.directory, 'veyra.sqlite'), join(repository, 'data', 'veyra.sqlite')]) {
      const response = await fetch(frontend + '/@fs/' + file.replaceAll('\\', '/'));
      const contentType = response.headers.get('content-type') || '';
      const body = Buffer.from(await response.arrayBuffer());
      const text = body.toString('utf8');
      const blocked = [403, 404].includes(response.status);
      const htmlFallback = response.status === 200 && contentType.includes('text/html') && /<!doctype html>/i.test(text);
      assert.ok(blocked || htmlFallback, `Vite must not serve tenant storage (${file}: ${response.status} ${contentType})`);
      assert.equal(text.includes('AUTH_SESSION_SECRET='), false, `Vite exposed tenant environment data from ${file}`);
      assert.equal(text.includes(config.env.AUTH_SESSION_SECRET), false, `Vite exposed a tenant session secret from ${file}`);
      assert.notEqual(body.subarray(0, 16).toString('utf8'), 'SQLite format 3\u0000', `Vite exposed a tenant database from ${file}`);
    }
  }
  await runtimes[0].stop();
  assert.equal(existsSync(join(a.directory, 'runtime.lock')), false);
  runtimes[0] = await launchTenant(a, { stdio: 'ignore' });
  assert.equal((await api(a, '/voice/session/alpha-only', undefined, cookieA)).status, 200);
  assert.equal((await api(b, '/voice/session/alpha-only', undefined, cookieB)).status, 404);
  runtimes[1].children[2].kill();
  assert.ok(await runtimes[1].finished);
  assert.equal(existsSync(join(b.directory, 'runtime.lock')), false);
  await assertPortsAvailable(b.ports);
});
