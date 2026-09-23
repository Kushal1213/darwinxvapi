import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const [serviceDir, serviceUrlEnv, fallbackUrl, appModule = 'main:app'] = process.argv.slice(2);
if (!serviceDir || !serviceUrlEnv || !fallbackUrl) {
  console.error('Usage: node scripts/start-python-service.mjs <service-dir> <url-env> <fallback-url> [app-module]');
  process.exit(1);
}

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readEnvValue(name) {
  try {
    const entry = readFileSync(resolve(rootDir, '.env'), 'utf8')
      .split(/\r?\n/)
      .find((line) => line.trimStart().startsWith(`${name}=`));
    return entry?.slice(entry.indexOf('=') + 1).trim();
  } catch {
    return undefined;
  }
}

const serviceUrl = process.env[serviceUrlEnv] || readEnvValue(serviceUrlEnv) || fallbackUrl;
let port;
try {
  const url = new URL(serviceUrl);
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new Error(`${serviceUrlEnv} must target localhost when starting the local service`);
  }
  port = url.port || (url.protocol === 'https:' ? '443' : '80');
} catch (error) {
  console.error(`Invalid ${serviceUrlEnv} (${serviceUrl}): ${error.message}`);
  process.exit(1);
}

const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const child = spawn(python, ['-m', 'uvicorn', appModule, '--reload', '--port', port], {
  cwd: resolve(rootDir, serviceDir),
  stdio: 'inherit',
});

child.once('error', (error) => {
  console.error(`Could not start ${serviceDir} with ${python}: ${error.message}`);
  process.exit(1);
});
child.once('exit', (code) => process.exit(code ?? 1));
