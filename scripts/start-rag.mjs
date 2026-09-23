import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function readEnvValue(name) {
  try {
    const line = readFileSync(resolve(rootDir, '.env'), 'utf8')
      .split(/\r?\n/)
      .find((entry) => entry.startsWith(`${name}=`));
    return line?.slice(name.length + 1).trim();
  } catch {
    return undefined;
  }
}

const ragUrl = process.env.RAG_SERVICE_URL || readEnvValue('RAG_SERVICE_URL') || 'http://localhost:8001';
let ragPort;

try {
  const url = new URL(ragUrl);
  if (!['localhost', '127.0.0.1', '::1'].includes(url.hostname)) {
    throw new Error('RAG_SERVICE_URL must be a local URL when starting the local RAG service.');
  }
  ragPort = url.port || (url.protocol === 'https:' ? '443' : '80');
} catch (error) {
  console.error(`Invalid RAG_SERVICE_URL (${ragUrl}): ${error.message}`);
  process.exit(1);
}

const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const child = spawn(python, ['-m', 'uvicorn', 'main:app', '--reload', '--port', ragPort], {
  cwd: resolve(rootDir, 'services/rag-service'),
  stdio: 'inherit',
});

child.once('error', (error) => {
  console.error(`Could not start the RAG service with ${python}: ${error.message}`);
  process.exit(1);
});

child.once('exit', (code) => process.exit(code ?? 1));

