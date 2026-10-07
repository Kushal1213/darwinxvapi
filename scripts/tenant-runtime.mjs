import {
  closeSync, copyFileSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync,
  readdirSync, realpathSync, renameSync, rmSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { resolve, join, dirname, isAbsolute, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:net';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { parse } from 'dotenv';

export const repository = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const tenantRoot = join(repository, 'data', 'tenants');
const allowedSettings = new Set(['AUTH_SESSION_SECRET', 'VOICE_SERVICE_TOKEN', 'GEMINI_API_KEY',
  'GEMINI_MODEL', 'VAPI_API_KEY', 'VITE_VAPI_PUBLIC_KEY', 'PUBLIC_WEBHOOK_URL']);
const idPattern = /^[a-z][a-z0-9-]{0,39}$/;

function location(id, root) {
  if (!idPattern.test(id) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(id)) throw new Error('Use a lowercase tenant ID starting with a letter (maximum 40 characters).');
  const directory = join(resolve(root), id);
  if (existsSync(directory) && realpathSync(directory) !== directory) throw new Error('Tenant directories cannot be symbolic links.');
  return directory;
}

function requireStopped(directory) {
  if (existsSync(join(directory, 'runtime.lock'))) {
    throw new Error('Tenant has a runtime lock. Stop it and inspect stale locks before operating on storage.');
  }
}

function walkFiles(root, directory = root) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Tenant backups cannot contain symbolic links.');
    if (entry.isDirectory()) files.push(...walkFiles(root, path));
    else if (entry.isFile()) files.push(relative(root, path).split(sep).join('/'));
    else throw new Error('Tenant backups support regular files and directories only.');
  }
  return files.sort();
}

function digest(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function copyTree(source, destination) {
  mkdirSync(destination, { recursive: true, mode: 0o700 });
  for (const name of walkFiles(source)) {
    const target = join(destination, ...name.split('/'));
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    copyFileSync(join(source, ...name.split('/')), target);
  }
}

export function verifyTenantBackup(snapshotDirectory) {
  const snapshot = resolve(snapshotDirectory);
  if (!existsSync(snapshot) || !lstatSync(snapshot).isDirectory()) throw new Error('Backup directory does not exist.');
  const manifestPath = join(snapshot, 'backup-manifest.json');
  if (!existsSync(manifestPath)) throw new Error('Backup manifest is missing.');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  if (manifest.version !== 1 || !idPattern.test(manifest.tenant_id) || !Array.isArray(manifest.files)) {
    throw new Error('Backup manifest is invalid.');
  }
  const actual = walkFiles(snapshot).filter(name => name !== 'backup-manifest.json');
  const expected = manifest.files.map(file => file.path).sort();
  if (new Set(expected).size !== expected.length || JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error('Backup file inventory does not match its manifest.');
  }
  for (const file of manifest.files) {
    if (!/^[a-f0-9]{64}$/.test(file.sha256) || !Number.isSafeInteger(file.bytes) || file.bytes < 0
      || file.path.startsWith('/') || file.path.includes('..') || file.path.includes('\\')) {
      throw new Error('Backup manifest contains an invalid file record.');
    }
    const path = join(snapshot, ...file.path.split('/'));
    if (lstatSync(path).size !== file.bytes || digest(path) !== file.sha256) {
      throw new Error('Backup integrity check failed for ' + file.path + '.');
    }
  }
  if (!expected.includes('tenant.json') || !expected.includes('.env')) throw new Error('Backup is missing required tenant configuration.');
  return manifest;
}

export function backupTenant(id, snapshotDirectory, root = tenantRoot) {
  const source = location(id, root);
  if (!existsSync(source)) throw new Error('Tenant does not exist.');
  requireStopped(source);
  const snapshot = resolve(snapshotDirectory);
  const fromSource = relative(source, snapshot);
  if (!fromSource || (!fromSource.startsWith('..' + sep) && fromSource !== '..' && !isAbsolute(fromSource))) {
    throw new Error('Backup destination must be outside the tenant directory.');
  }
  if (existsSync(snapshot)) throw new Error('Backup destination already exists; no files were changed.');
  copyTree(source, snapshot);
  const files = walkFiles(snapshot).map(path => {
    const file = join(snapshot, ...path.split('/'));
    return { path, bytes: lstatSync(file).size, sha256: digest(file) };
  });
  const manifest = { version: 1, tenant_id: id, created_at: new Date().toISOString(), files };
  writeFileSync(join(snapshot, 'backup-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  verifyTenantBackup(snapshot);
  return snapshot;
}

export function restoreTenant(snapshotDirectory, id, root = tenantRoot) {
  const manifest = verifyTenantBackup(snapshotDirectory);
  if (manifest.tenant_id !== id) throw new Error('Backup belongs to a different tenant ID.');
  const target = location(id, root);
  if (existsSync(target)) throw new Error('Tenant already exists; restore did not overwrite it.');
  mkdirSync(resolve(root), { recursive: true });
  const temporary = join(resolve(root), `.restore-${id}-${randomBytes(6).toString('hex')}`);
  try {
    mkdirSync(temporary, { mode: 0o700 });
    for (const file of manifest.files) {
      const destination = join(temporary, ...file.path.split('/'));
      mkdirSync(dirname(destination), { recursive: true, mode: 0o700 });
      copyFileSync(join(resolve(snapshotDirectory), ...file.path.split('/')), destination);
    }
    renameSync(temporary, target);
  } catch (error) {
    if (existsSync(temporary)) rmSync(temporary, { recursive: true, force: true });
    throw error;
  }
  tenantConfiguration(id, root, {});
  return target;
}

export function decommissionTenant(id, snapshotDirectory, confirmation, root = tenantRoot) {
  if (confirmation !== id) throw new Error('Decommission confirmation must exactly match the tenant ID.');
  const source = location(id, root);
  const snapshot = backupTenant(id, snapshotDirectory, root);
  verifyTenantBackup(snapshot);
  const tombstone = join(resolve(root), `.decommission-${id}-${randomBytes(6).toString('hex')}`);
  renameSync(source, tombstone);
  rmSync(tombstone, { recursive: true, force: true });
  return snapshot;
}
export function provisionTenant(id, basePort, root = tenantRoot) {
  const directory = location(id, root);
  if (!Number.isInteger(basePort) || basePort < 1024 || basePort > 65531) throw new Error('Base port must be between 1024 and 65531.');
  if (existsSync(directory)) throw new Error('Tenant already exists; existing data was not changed.');
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'tenant.json'), JSON.stringify({ version: 1, id, basePort }, null, 2), { flag: 'wx' });
  writeFileSync(join(directory, '.env'), [
    '# Private tenant credentials. Never commit this file.',
    'AUTH_SESSION_SECRET=' + randomBytes(32).toString('hex'),
    'VOICE_SERVICE_TOKEN=' + randomBytes(32).toString('hex'),
    'GEMINI_API_KEY=', 'GEMINI_MODEL=', 'VAPI_API_KEY=', 'VITE_VAPI_PUBLIC_KEY=', 'PUBLIC_WEBHOOK_URL=', '',
  ].join('\n'), { flag: 'wx', mode: 0o600 });
  return directory;
}
export function tenantConfiguration(id, root = tenantRoot, inherited = process.env) {
  const directory = location(id, root);
  const profile = JSON.parse(readFileSync(join(directory, 'tenant.json'), 'utf8'));
  if (profile.version !== 1 || profile.id !== id || !Number.isInteger(profile.basePort) || profile.basePort < 1024 || profile.basePort > 65531) throw new Error('Invalid tenant profile.');
  const settings = parse(readFileSync(join(directory, '.env')));
  for (const key of Object.keys(settings)) if (!allowedSettings.has(key)) throw new Error('Unsupported tenant setting: ' + key);
  if (settings.AUTH_SESSION_SECRET?.length < 32 || !settings.AUTH_SESSION_SECRET || settings.VOICE_SERVICE_TOKEN?.length < 32 || !settings.VOICE_SERVICE_TOKEN) throw new Error('Tenant credentials are missing or too short.');
  const env = {};
  // Keep OS/runtime essentials, never inherit application credentials or service URLs.
  for (const [key, value] of Object.entries(inherited)) {
    if (/^(path|systemroot|windir|comspec|pathext|temp|tmp|tmpdir|home|userprofile|appdata|localappdata|virtual_env|lang|lc_all)$/i.test(key)) env[key] = value;
  }
  Object.assign(env, settings);
  if (!env.GEMINI_MODEL) env.GEMINI_MODEL = 'models/gemini-flash-latest';
  const ports = Array.from({ length: 5 }, (_, index) => profile.basePort + index);
  Object.assign(env, {
    NODE_ENV: 'development', VEYRA_TENANT_ID: id, VEYRA_ENV_FILE: join(directory, '.env'),
    VEYRA_DATABASE_PATH: join(directory, 'veyra.sqlite'), CALL_HISTORY_DIR: join(directory, 'legacy-calls'),
    FAISS_INDEX_PATH: join(directory, 'knowledge'), KNOWLEDGE_RAW_PATH: join(directory, 'raw'),
    PORT: String(ports[1]), FRONTEND_URL: 'http://localhost:' + ports[0],
    VITE_API_GATEWAY_URL: 'http://127.0.0.1:' + ports[1],
    RAG_SERVICE_URL: 'http://127.0.0.1:' + ports[2],
    INGESTION_SERVICE_URL: 'http://127.0.0.1:' + ports[3],
    INSIGHTS_SERVICE_URL: 'http://127.0.0.1:' + ports[4],
    REALTIME_AI_URL: 'http://127.0.0.1:' + ports[4],
  });
  return { directory, ports, env, id };
}
export async function assertPortsAvailable(ports) {
  const servers = [];
  try {
    for (const port of ports) {
      const server = createServer();
      await new Promise((resolve, reject) => {
        server.once('error', () => reject(new Error('Port ' + port + ' is already in use; no tenant services were started.')));
        server.listen({ port, host: '127.0.0.1', exclusive: true }, resolve);
      });
      servers.push(server);
    }
  } finally { await Promise.all(servers.map(server => new Promise(resolve => server.close(resolve)))); }
}
export async function launchTenant(config, { python = process.env.PYTHON || 'python', stdio = 'inherit', signal } = {}) {
  await assertPortsAvailable(config.ports);
  const lock = join(config.directory, 'runtime.lock');
  if (existsSync(lock)) {
    const pid = Number(readFileSync(lock, 'utf8'));
    if (!Number.isSafeInteger(pid) || pid <= 0) throw new Error('Invalid runtime lock; inspect it before starting.');
    try { process.kill(pid, 0); throw new Error('Tenant is already running.'); }
    catch (error) { if (error.code !== 'ESRCH') throw error; }
    unlinkSync(lock);
  }
  const fd = openSync(lock, 'wx');
  writeFileSync(fd, String(process.pid)); closeSync(fd);
  const { env, ports } = config;
  const commands = [
    [process.execPath, ['src/index.js'], join(repository, 'apps/api-gateway')],
    [process.execPath, [join(repository, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(ports[0]), '--strictPort'], join(repository, 'apps/frontend')],
    ...[['rag-service', 'main:app', ports[2]], ['ingestion-service', 'main:app', ports[3]], ['realtime-insights', 'api:app', ports[4]]]
      .map(([service, app, port]) => [python, ['-m', 'uvicorn', app, '--host', '127.0.0.1', '--port', String(port)], join(repository, 'services', service)]),
  ];
  let stopped = false, failure, stopping;
  let finish;
  const finished = new Promise(resolve => { finish = resolve; });
  const children = [];
  function stop() {
    if (stopping) return stopping;
    stopped = true;
    stopping = (async () => {
      await Promise.all(children.map(child => new Promise(resolve => {
        if (child.exitCode !== null || child.signalCode !== null || !child.pid) return resolve();
        child.once('exit', resolve); child.kill();
      })));
      if (existsSync(lock)) unlinkSync(lock);
      finish(failure);
    })();
    return stopping;
  }
  for (const [command, args, cwd] of commands) {
    const child = spawn(command, args, { cwd, env, stdio, windowsHide: true });
    children.push(child);
    child.on('error', error => { failure = error; void stop(); });
    child.on('exit', code => { if (!stopped) { failure = new Error('A tenant service exited (' + code + ').'); void stop(); } });
  }
  signal?.addEventListener('abort', () => { void stop(); }, { once: true });
  if (signal?.aborted) { await stop(); throw new Error('Tenant stopped.'); }
  try {
    const pending = new Set([env.FRONTEND_URL, env.VITE_API_GATEWAY_URL + '/api/auth/session',
      env.RAG_SERVICE_URL + '/health', env.INGESTION_SERVICE_URL + '/health', env.INSIGHTS_SERVICE_URL + '/health']);
    const deadline = Date.now() + 45000;
    while (pending.size && Date.now() < deadline) {
      if (failure || stopped) throw failure || new Error('Tenant stopped.');
      for (const url of pending) {
        try { if ((await fetch(url.replace('localhost', '127.0.0.1'), { signal: AbortSignal.timeout(1000) })).ok) pending.delete(url); } catch {}
      }
      if (pending.size) await delay(200);
    }
    if (pending.size) throw new Error('Tenant did not become healthy within 45 seconds.');
    if (failure || stopped) throw failure || new Error('Tenant stopped.');
    return { stop, children, finished };
  } catch (error) { await stop(); throw error; }
}
