import { spawn } from 'node:child_process';

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const useShell = process.platform === 'win32';
const services = [
  ['gateway', ['run', 'dev:gateway']],
  ['rag', ['run', 'dev:rag']],
  ['ingestion', ['run', 'dev:ingestion']],
  ['realtime-insights', ['run', 'dev:realtime']],
  ['frontend', ['run', 'dev:frontend']],
];

const children = services.map(([name, args]) => {
  const child = spawn(npm, args, { stdio: 'inherit', shell: useShell });
  child.once('error', (error) => console.error(`[${name}] failed to start: ${error.message}`));
  child.once('exit', (code) => {
    if (code && code !== 0) console.error(`[${name}] exited with code ${code}`);
  });
  return child;
});

function stopChildren() {
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
}

process.once('SIGINT', () => { stopChildren(); process.exit(0); });
process.once('SIGTERM', () => { stopChildren(); process.exit(0); });
