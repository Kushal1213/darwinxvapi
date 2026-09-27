import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getDatabase } from './database.js';

export function createCallHistory() {
  const db = getDatabase();
  const directory = process.env.CALL_HISTORY_DIR || fileURLToPath(new URL('../../../../data/calls/', import.meta.url));
  const migrationKey = `legacy-history:${resolve(directory)}`;
  if (!db.prepare('SELECT 1 FROM metadata WHERE key=?').get(migrationKey)) {
    let files = [];
    try { files = readdirSync(directory).filter((name) => /^[a-f0-9]{64}\.json$/.test(name)); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const file of files) {
        const call = JSON.parse(readFileSync(resolve(directory, file), 'utf8'));
        if (typeof call.call_id !== 'string' || call.status !== 'completed' || !Array.isArray(call.turns)) throw new Error(`Invalid legacy archive: ${file}`);
        call.workspace_id = 'default';
        db.prepare('INSERT OR IGNORE INTO calls VALUES (?, ?, ?, ?, ?)').run(call.call_id, 'default', call.status, call.ended_at, JSON.stringify(call));
      }
      db.prepare('INSERT INTO metadata VALUES (?, ?)').run(migrationKey, 'done');
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  return {
    get(id) {
      const row = db.prepare('SELECT payload FROM calls WHERE id=? AND workspace_id=?').get(id, 'default');
      return row ? JSON.parse(row.payload) : null;
    },
    save(session) {
      db.prepare(`INSERT INTO calls VALUES (?, 'default', ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET status=excluded.status, ended_at=excluded.ended_at, payload=excluded.payload`)
        .run(session.call_id, session.status, session.ended_at || null, JSON.stringify({ ...session, workspace_id: 'default' }));
    },
    active() {
      return db.prepare("SELECT payload FROM calls WHERE workspace_id='default' AND status IN ('created', 'active', 'escalated')")
        .all().map((row) => JSON.parse(row.payload));
    },
    list({ limit = 50, offset = 0 } = {}) {
      const total = db.prepare("SELECT COUNT(*) AS total FROM calls WHERE workspace_id='default' AND status='completed'").get().total;
      const calls = db.prepare("SELECT payload FROM calls WHERE workspace_id='default' AND status='completed' ORDER BY ended_at DESC, id LIMIT ? OFFSET ?")
        .all(limit, offset).map((row) => JSON.parse(row.payload));
      return {
        calls: calls.map(({ turns, ...session }) => ({
          ...session, turn_count: turns.length,
        })),
        total,
      };
    },
  };
}
