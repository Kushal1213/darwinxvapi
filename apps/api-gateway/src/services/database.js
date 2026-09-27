import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

let database;
export function getDatabase() {
  if (database) return database;
  const path = process.env.VEYRA_DATABASE_PATH || fileURLToPath(new URL('../../../../data/veyra.sqlite', import.meta.url));
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS workspace (id TEXT PRIMARY KEY, name TEXT NOT NULL);
    INSERT OR IGNORE INTO workspace VALUES ('default', 'Veyra Workspace');
    CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      workspace_id TEXT NOT NULL REFERENCES workspace(id), role TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (id TEXT PRIMARY KEY, expires_at INTEGER NOT NULL, payload TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS auth_sessions_expiry ON auth_sessions(expires_at);
    CREATE TABLE IF NOT EXISTS calls (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspace(id),
      status TEXT NOT NULL, ended_at TEXT, payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS calls_history ON calls(workspace_id, status, ended_at DESC);
    CREATE TABLE IF NOT EXISTS nudges (
      id TEXT PRIMARY KEY, call_id TEXT NOT NULL REFERENCES calls(id),
      status TEXT NOT NULL, expires_at TEXT NOT NULL, payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS nudges_call ON nudges(call_id, expires_at DESC);
    CREATE TABLE IF NOT EXISTS nudge_events (
      id INTEGER PRIMARY KEY, nudge_id TEXT NOT NULL REFERENCES nudges(id),
      actor_id TEXT REFERENCES users(id), action TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS knowledge_documents (
      id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspace(id),
      filename TEXT NOT NULL, content BLOB NOT NULL, payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS knowledge_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      document_id TEXT NOT NULL REFERENCES knowledge_documents(id),
      family_id TEXT NOT NULL, kind TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0,
      actor_id TEXT NOT NULL REFERENCES users(id), approval_id TEXT,
      next_attempt_at INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS knowledge_jobs_due ON knowledge_jobs(state, next_attempt_at);
    CREATE INDEX IF NOT EXISTS knowledge_jobs_family ON knowledge_jobs(family_id, state);
    CREATE TABLE IF NOT EXISTS team_invites (
      id TEXT PRIMARY KEY, email TEXT NOT NULL, role TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id), accepted_at INTEGER, revoked_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS team_events (
      id INTEGER PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id),
      action TEXT NOT NULL, target_id TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    PRAGMA user_version = 5;
  `);
  database = db;
  return db;
}
