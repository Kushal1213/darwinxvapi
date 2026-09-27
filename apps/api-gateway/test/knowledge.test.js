import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';

test('knowledge upload, failure, retry, archive, access and persistence', { timeout: 30000 }, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'veyra-knowledge-'));
  let fail = true;
  let puts = 0;
  let publishes = 0;
  let hold = false;
  let release;
  let holdPublish = false;
  let releasePublish;
  const publicationOperations = [];
  const mock = createServer(async (req, res) => {
    for await (const _chunk of req) { /* Consume multipart body. */ }
    if (hold && req.method === 'PUT') await new Promise(resolve => { release = resolve; });
    res.setHeader('Content-Type', 'application/json');
    if (fail) { res.writeHead(503); res.end('{}'); return; }
    if (req.method === 'PUT') puts += 1;
    if (req.method === 'POST' && req.url.includes('/publish')) {
      publishes += 1;
      publicationOperations.push(new URL(req.url, 'http://test').searchParams.get('operation_id'));
      if (holdPublish) await new Promise(resolve => { releasePublish = resolve; });
    }
    res.end(JSON.stringify({ chunks_added: 1, pii_detected: false, generation: 'test', chunks: [{ chunk_id: 'test', content: 'Policy' }] }));
  });
  mock.listen(0, '127.0.0.1');
  await once(mock, 'listening');
  let child, base, cookie = '';
  async function start() {
    const probe = createServer().listen(0, '127.0.0.1');
    await once(probe, 'listening');
    const port = probe.address().port;
    await new Promise(resolve => probe.close(resolve));
    base = 'http://127.0.0.1:' + port + '/api';
    child = spawn(process.execPath, ['src/index.js'], {
      cwd: fileURLToPath(new URL('../', import.meta.url)),
      env: { ...process.env, PORT: String(port), NODE_ENV: 'test', LOG_LEVEL: 'silent',
        VEYRA_DATABASE_PATH: join(directory, 'test.sqlite'), CALL_HISTORY_DIR: directory,
        INGESTION_SERVICE_URL: 'http://127.0.0.1:' + mock.address().port }, stdio: 'ignore',
    });
    for (let i = 0; i < 80; i++) {
      try { if ((await fetch(base + '/knowledge/documents')).status === 401) return; } catch {}
      await delay(50);
    }
    throw new Error('Gateway startup failed');
  }
  async function stop() {
    if (child?.exitCode === null) { const exited = once(child, 'exit'); child.kill(); await exited; }
  }
  t.after(async () => {
    release?.();
    releasePublish?.();
    await stop(); mock.closeAllConnections(); await new Promise(resolve => mock.close(resolve));
    await rm(directory, { recursive: true, force: true });
  });
  await start();
  const setup = await fetch(base + '/auth/setup', { method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ email: 'owner@example.test', password: 'test-password-knowledge', workspace: 'Test' }) });
  assert.equal(setup.status, 201);
  cookie = setup.headers.get('set-cookie').split(';')[0];
  const request = (path, options = {}) => fetch(base + '/knowledge/documents' + path, {
    ...options, headers: { Cookie: cookie, Origin: 'http://localhost:3000', ...options.headers },
  });
  const jobRequest = (path = '', options = {}) => fetch(base + '/knowledge/jobs' + path, {
    ...options, headers: { Cookie: cookie, Origin: 'http://localhost:3000', ...options.headers },
  });
  async function failedJob(target, kind) {
    for (let i = 0; i < 120; i++) {
      const jobs = (await (await jobRequest()).json()).jobs;
      const job = jobs.find(job => job.document_id === target && job.kind === kind && job.state === 'failed');
      if (job) return job;
      await delay(25);
    }
    throw new Error('Job did not reach terminal failure');
  }
  function form(filename = 'policy.txt') {
    const data = new FormData();
    data.append('file', new Blob(['Policy text']), filename);
    data.append('title', 'Policy'); data.append('market', 'india'); data.append('category', 'policy');
    data.append('product', 'loan');
    return data;
  }
  assert.equal((await request('', { method: 'POST', body: form('bad.exe') })).status, 400);
  assert.equal((await request('', { method: 'POST', body: form(), headers: { Origin: 'https://evil.test' } })).status, 403);
  const upload = await request('', { method: 'POST', body: form() });
  assert.equal(upload.status, 202);
  let id = (await upload.json()).document.id;
  const firstId = id;
  async function until(status, target = id) {
    for (let i = 0; i < 80; i++) {
      const docs = (await (await request('')).json()).documents;
      const doc = docs.find(value => value.id === target);
      if (doc.status === status) return doc;
      await delay(25);
    }
    throw new Error('Document did not become ' + status);
  }
  assert.match((await until('failed')).error, /unavailable/);
  fail = false;
  hold = true;
  assert.equal((await request('/' + id + '/retry', { method: 'POST' })).status, 202);
  await until('processing');
  assert.equal((await request('/' + id + '/retry', { method: 'POST' })).status, 409);
  assert.equal((await request('/' + id + '/archive', { method: 'POST' })).status, 409);
  for (let i = 0; !release && i < 40; i++) await delay(25);
  assert.ok(release);
  hold = false;
  release();
  assert.equal((await until('ready')).chunks, 1);
  assert.equal((await (await request('/' + id)).json()).chunks.length, 1);
  assert.equal((await request('/' + id + '/approve', { method: 'POST' })).status, 409);
  assert.equal(publishes, 0);
  async function member(email, role) {
    const invite = await fetch(base + '/team/invites', { method: 'POST', headers: { Cookie: cookie, Origin: 'http://localhost:3000', 'Content-Type': 'application/json' }, body: JSON.stringify({ email, role }) });
    assert.equal(invite.status, 201);
    const accepted = await fetch(base + '/auth/accept-invite', { method: 'POST', headers: { Origin: 'http://localhost:3000', 'Content-Type': 'application/json' }, body: JSON.stringify({ token: (await invite.json()).token, password: 'test-password-reviewer' }) });
    assert.equal(accepted.status, 201);
    return accepted.headers.get('set-cookie').split(';')[0];
  }
  const reviewerCookie = await member('reviewer@example.test', 'admin');
  const operatorCookie = await member('operator@example.test', 'operator');
  assert.equal((await request('/' + id, { headers: { Cookie: operatorCookie } })).status, 403);
  const approve = target => request('/' + target + '/approve', { method: 'POST', headers: { Cookie: reviewerCookie } });
  const approvedResponse = await approve(id);
  assert.equal(approvedResponse.status, 202, await approvedResponse.text());
  await until('indexed');
  assert.equal((await (await request('/' + id)).json()).document.reviewStatus, 'approved');
  assert.equal(publishes, 1);
  assert.equal((await request('/' + id + '/retry', { method: 'POST' })).status, 409);
  fail = true;
  assert.equal((await request('/' + id + '/archive', { method: 'POST' })).status, 202);
  const withdrawal = await failedJob(id, 'withdraw');
  assert.equal(withdrawal.attempts, 3);
  await until('withdrawing');
  fail = false;
  assert.equal((await jobRequest('/' + withdrawal.id + '/retry', { method: 'POST' })).status, 202);
  await until('archived');
  assert.equal((await (await request('/' + id)).json()).document.reviewStatus, 'approved');
  await stop(); await start();
  await until('archived');
  const restore = await request('/' + id + '/retry', { method: 'POST' });
  assert.equal(restore.status, 202);
  const restored = (await restore.json()).document;
  assert.equal(restored.revision, 2);
  assert.equal(restored.product, 'loan');
  assert.equal(restored.familyId, firstId);
  assert.notEqual(restored.id, firstId);
  id = restored.id;
  await until('ready');
  assert.equal(publishes, 1);
  assert.equal(puts, 2);
  await stop();
  const db = new DatabaseSync(join(directory, 'test.sqlite'));
  const interrupted = JSON.parse(db.prepare('SELECT payload FROM knowledge_documents WHERE id = ?').get(id).payload);
  interrupted.status = 'processing';
  db.prepare('UPDATE knowledge_documents SET payload = ? WHERE id = ?').run(JSON.stringify(interrupted), id);
  db.prepare("UPDATE knowledge_jobs SET state = 'running' WHERE document_id = ? AND kind = 'process'").run(id);
  db.close();
  await start();
  await until('ready');
  assert.equal((await approve(id)).status, 202);
  await until('indexed');
  const publishedId = id;
  const revisionForm = form();
  revisionForm.set('file', new Blob(['Personal loan minimum age is 25 years.']), 'policy.txt');
  const replacement = await request('/' + id + '/revisions', { method: 'POST', body: revisionForm });
  assert.equal(replacement.status, 202);
  const revision = (await replacement.json()).document;
  id = revision.id;
  await until('ready');
  assert.equal(revision.revision, 3);
  assert.equal(revision.previousRevisionId, publishedId);
  assert.match(revision.contentHash, /^[a-f0-9]{64}$/);
  assert.equal((await until('indexed', publishedId)).activeRevision, 2);
  assert.equal((await request('/' + publishedId + '/revisions', { method: 'POST', body: form() })).status, 409);
  assert.equal((await request('/' + id + '/revisions', { method: 'POST', body: form() })).status, 409);
  assert.equal((await request('/' + id + '/approve', { method: 'POST' })).status, 409);
  assert.equal((await request('/' + id + '/reject', { method: 'POST', headers: { Cookie: operatorCookie } })).status, 403);
  const rejectOptions = reason => ({ method: 'POST', headers: { Cookie: reviewerCookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
  assert.equal((await request('/' + id + '/reject', rejectOptions(' '))).status, 400);
  const rejected = await request('/' + id + '/reject', rejectOptions('Please verify the minimum age with the policy owner.'));
  assert.equal(rejected.status, 200);
  assert.equal((await rejected.json()).document.reviewStatus, 'rejected');
  assert.equal((await approve(id)).status, 409);
  await until('indexed', publishedId);
  const corrected = await request('/' + id + '/revisions', { method: 'POST', body: revisionForm });
  assert.equal(corrected.status, 202);
  id = (await corrected.json()).document.id;
  await until('ready');
  fail = true;
  assert.equal((await approve(id)).status, 202);
  const publication = await failedJob(id, 'publish');
  assert.equal(publication.attempts, 3);
  assert.equal((await jobRequest('/' + publication.id + '/cancel', { method: 'POST' })).status, 409);
  assert.equal((await jobRequest('', { headers: { Cookie: operatorCookie } })).status, 403);
  assert.equal((await jobRequest('/' + publication.id + '/retry', { method: 'POST', headers: { Cookie: operatorCookie } })).status, 403);
  await until('indexed', publishedId);
  fail = false;
  holdPublish = true;
  assert.equal((await jobRequest('/' + publication.id + '/retry', { method: 'POST' })).status, 202);
  for (let i = 0; !releasePublish && i < 80; i++) await delay(25);
  assert.ok(releasePublish, 'Publication reached ingestion before the gateway crash');
  await stop();
  holdPublish = false;
  releasePublish();
  await start();
  await until('indexed');
  assert.deepEqual(publicationOperations.slice(-2), [String(publication.id), String(publication.id)], 'Crash replays the same operation identity');
  assert.equal((await approve(id)).status, 409);
  await until('superseded', publishedId);
  assert.equal((await request('/' + publishedId, { headers: { Cookie: operatorCookie } })).status, 403);
  assert.equal((await request('/' + id, { headers: { Cookie: operatorCookie } })).status, 200);
  assert.equal((await request('/' + publishedId + '/retry', { method: 'POST' })).status, 409);
  const revisions = (await (await request('/' + firstId + '/revisions')).json()).revisions;
  assert.deepEqual(revisions.map(doc => doc.revision), [4, 3, 2, 1]);
  assert.equal(revisions[1].reviewStatus, 'rejected');
  assert.equal(revisions[1].contentHash, revision.contentHash);
  await stop(); await start();
  await until('indexed');
  const audit = new DatabaseSync(join(directory, 'test.sqlite'));
  assert.equal(audit.prepare("SELECT count(*) AS total FROM team_events WHERE action = 'knowledge.rejected'").get().total, 1);
  assert.equal(audit.prepare("SELECT count(*) AS total FROM team_events WHERE action = 'knowledge.revision_created'").get().total, 4);
  audit.close();

  // Withdrawal cancels publication intent even when its remote response arrives late.
  const lastRevision = await request('/' + id + '/revisions', { method: 'POST', body: form() });
  id = (await lastRevision.json()).document.id;
  await until('ready');
  holdPublish = true; releasePublish = null;
  const pendingPublication = await approve(id);
  assert.equal(pendingPublication.status, 202);
  const pendingJobId = (await pendingPublication.json()).jobId;
  for (let i = 0; !releasePublish && i < 80; i++) await delay(25);
  assert.ok(releasePublish);
  assert.equal((await request('/' + id + '/archive', { method: 'POST' })).status, 202);
  await until('withdrawing');
  holdPublish = false; releasePublish();
  await until('archived');
  assert.equal((await (await jobRequest()).json()).jobs.find(job => job.id === pendingJobId).state, 'cancelled');
  assert.equal((await jobRequest('/' + pendingJobId + '/retry', { method: 'POST' })).status, 409);

  // Cancelling queued work survives restart and never invokes ingestion.
  hold = true; release = null;
  const blocking = await request('', { method: 'POST', body: form() });
  const blockingId = (await blocking.json()).document.id;
  await until('processing', blockingId);
  const queued = await request('', { method: 'POST', body: form() });
  const queuedId = (await queued.json()).document.id;
  const queuedJob = (await (await jobRequest()).json()).jobs.find(job => job.document_id === queuedId);
  assert.equal((await jobRequest('/' + queuedJob.id + '/cancel', { method: 'POST' })).status, 200);
  assert.match((await until('failed', queuedId)).error, /cancelled/);
  for (let i = 0; !release && i < 80; i++) await delay(25);
  assert.ok(release);
  hold = false; release?.();
  await until('ready', blockingId);
  await stop(); await start();
  assert.equal((await (await jobRequest()).json()).jobs.find(job => job.id === queuedJob.id).state, 'cancelled');
});
