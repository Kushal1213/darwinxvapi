import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createCallHistory } from '../src/services/call-history.js';
import { getDatabase } from '../src/services/database.js';

test('legacy archives migrate once without changing original files', () => {
  const directory = mkdtempSync(join(tmpdir(), 'veyra-migration-'));
  process.env.VEYRA_DATABASE_PATH = join(directory, 'calls.sqlite');
  process.env.CALL_HISTORY_DIR = directory;
  const call = { call_id: 'legacy', status: 'completed', ended_at: new Date().toISOString(), turns: [] };
  const file = join(directory, `${createHash('sha256').update(call.call_id).digest('hex')}.json`);
  const original = JSON.stringify(call);
  writeFileSync(file, original);
  try {
    const history = createCallHistory();
    assert.equal(history.list().total, 1);
    assert.equal(history.get('legacy').workspace_id, 'default');
    history.save({ ...history.get('legacy'), summary: 'Preserve database updates' });
    const reopened = createCallHistory();
    assert.equal(reopened.list().total, 1);
    assert.equal(reopened.get('legacy').summary, 'Preserve database updates');
    assert.equal(readFileSync(file, 'utf8'), original);
    history.save({ call_id: 'active', status: 'active', turns: [] });
    assert.equal(history.active().length, 1);
    assert.equal(history.list().total, 1);
  } finally {
    getDatabase().close();
    rmSync(directory, { recursive: true, force: true });
  }
});
