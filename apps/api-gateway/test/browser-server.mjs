import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Isolated browser verification: never create a test owner in the user's workspace.
const root = fileURLToPath(new URL('../../../', import.meta.url));
const directory = mkdtempSync(join(tmpdir(), 'veyra-browser-'));
const env = { ...process.env, NODE_ENV: 'development', PORT: '3014',
  FRONTEND_URL: 'http://localhost:3010', VITE_API_GATEWAY_URL: 'http://localhost:3014',
  VEYRA_DATABASE_PATH: join(directory, 'test.sqlite'), CALL_HISTORY_DIR: join(directory, 'legacy') };
const knowledge = process.argv.includes('--knowledge');
if (knowledge) Object.assign(env, {
  FAISS_INDEX_PATH: join(directory, 'index'), GEMINI_API_KEY: '',
  INGESTION_SERVICE_URL: 'http://127.0.0.1:8012', RAG_SERVICE_URL: 'http://127.0.0.1:8011',
});
const children = [
  spawn(process.execPath, ['src/index.js'], { cwd: join(root, 'apps/api-gateway'), env, stdio: 'inherit' }),
  spawn(process.execPath, ['../../node_modules/vite/bin/vite.js', '--port', '3010', '--strictPort'], { cwd: join(root, 'apps/frontend'), env, stdio: 'inherit' }),
];
if (knowledge) {
  for (const [service, port] of [['ingestion-service', '8012'], ['rag-service', '8011']]) {
    children.push(spawn('python', ['services/knowledge_browser_fixture.py', service, port], { cwd: root, env, stdio: 'inherit' }));
  }
}
function stop() { for (const child of children) child.kill(); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) {
  child.on('error', (error) => { console.error(error.message); stop(); });
  child.on('exit', (code) => { if (code) { process.exitCode = code; stop(); } });
}
console.log(`Isolated workspace: ${directory}`);
