import { mkdirSync, readFileSync, writeFileSync, existsSync, realpathSync, openSync, closeSync, unlinkSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
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
