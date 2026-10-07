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
    CREATE TABLE IF NOT EXISTS call_summaries (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspace(id),
      call_id TEXT NOT NULL REFERENCES calls(id),
      version INTEGER NOT NULL,
      state TEXT NOT NULL,
      generator TEXT NOT NULL,
      input_hash TEXT NOT NULL,
      created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL,
      UNIQUE(call_id, version)
    );
    CREATE INDEX IF NOT EXISTS call_summaries_call
      ON call_summaries(call_id, version DESC);
    CREATE UNIQUE INDEX IF NOT EXISTS call_summaries_fallback_input
      ON call_summaries(call_id, input_hash, generator)
      WHERE generator = 'deterministic_fallback.v1';
    CREATE TABLE IF NOT EXISTS call_summary_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      summary_id TEXT NOT NULL REFERENCES call_summaries(id),
      actor_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload TEXT
    );
    CREATE INDEX IF NOT EXISTS call_summary_events_summary
      ON call_summary_events(summary_id, id);
    CREATE TABLE IF NOT EXISTS disclosure_checklists (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspace(id),
      market TEXT NOT NULL,
      channel TEXT NOT NULL,
      workflow TEXT NOT NULL,
      version TEXT NOT NULL,
      status TEXT NOT NULL,
      effective_from TEXT NOT NULL,
      effective_to TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      approved_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      approved_at TEXT,
      payload TEXT NOT NULL,
      UNIQUE(workspace_id, market, channel, workflow, version)
    );
    CREATE INDEX IF NOT EXISTS disclosure_checklists_scope
      ON disclosure_checklists(workspace_id, market, channel, workflow, status, effective_from);
    CREATE TABLE IF NOT EXISTS disclosure_checklist_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checklist_id TEXT NOT NULL REFERENCES disclosure_checklists(id),
      actor_id TEXT NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload TEXT
    );
    CREATE INDEX IF NOT EXISTS disclosure_checklist_events_checklist
      ON disclosure_checklist_events(checklist_id, id);
    CREATE TABLE IF NOT EXISTS disclosure_confirmations (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspace(id),
      checklist_id TEXT NOT NULL REFERENCES disclosure_checklists(id),
      call_id TEXT NOT NULL REFERENCES calls(id),
      item_id TEXT NOT NULL,
      actor_id TEXT NOT NULL REFERENCES users(id),
      decision TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(checklist_id, call_id, item_id)
    );
    CREATE INDEX IF NOT EXISTS disclosure_confirmations_call
      ON disclosure_confirmations(call_id, checklist_id);
    CREATE TABLE IF NOT EXISTS disclosure_confirmation_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      confirmation_id TEXT NOT NULL REFERENCES disclosure_confirmations(id),
      actor_id TEXT NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload TEXT
    );
    CREATE INDEX IF NOT EXISTS disclosure_confirmation_events_confirmation
      ON disclosure_confirmation_events(confirmation_id, id);
    CREATE TABLE IF NOT EXISTS nudges (
      id TEXT PRIMARY KEY, call_id TEXT NOT NULL REFERENCES calls(id),
      status TEXT NOT NULL, expires_at TEXT NOT NULL, payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS nudges_call ON nudges(call_id, expires_at DESC);
    CREATE TABLE IF NOT EXISTS nudge_events (
      id INTEGER PRIMARY KEY, nudge_id TEXT NOT NULL REFERENCES nudges(id),
      actor_id TEXT REFERENCES users(id), action TEXT NOT NULL, created_at TEXT NOT NULL,
      payload TEXT
    );
    CREATE TABLE IF NOT EXISTS handoff_deliveries (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspace(id),
      call_id TEXT NOT NULL REFERENCES calls(id),
      escalation_id TEXT NOT NULL UNIQUE,
      state TEXT NOT NULL,
      destination_type TEXT NOT NULL DEFAULT 'internal_inbox',
      priority TEXT NOT NULL,
      requested_at TEXT NOT NULL,
      delivered_at TEXT,
      acknowledged_at TEXT,
      resolved_at TEXT,
      resolution TEXT,
      updated_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS handoff_deliveries_inbox
      ON handoff_deliveries(workspace_id, state, requested_at DESC);
    CREATE INDEX IF NOT EXISTS handoff_deliveries_call
      ON handoff_deliveries(call_id, requested_at DESC);
    CREATE TABLE IF NOT EXISTS handoff_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      delivery_id TEXT NOT NULL REFERENCES handoff_deliveries(id),
      actor_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload TEXT
    );
    CREATE INDEX IF NOT EXISTS handoff_events_delivery
      ON handoff_events(delivery_id, id);
    CREATE TABLE IF NOT EXISTS knowledge_gaps (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspace(id),
      fingerprint TEXT NOT NULL,
      market TEXT NOT NULL,
      product TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      occurrence_count INTEGER NOT NULL DEFAULT 1,
      question_excerpt TEXT NOT NULL,
      example_call_ids TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      resolution_note TEXT,
      resolution_document_id TEXT REFERENCES knowledge_documents(id),
      updated_by TEXT REFERENCES users(id),
      updated_at TEXT NOT NULL,
      UNIQUE(workspace_id, fingerprint)
    );
    CREATE INDEX IF NOT EXISTS knowledge_gaps_inbox
      ON knowledge_gaps(workspace_id, status, last_seen_at DESC);
    CREATE TABLE IF NOT EXISTS knowledge_gap_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      gap_id TEXT NOT NULL REFERENCES knowledge_gaps(id),
      actor_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload TEXT
    );
    CREATE INDEX IF NOT EXISTS knowledge_gap_events_gap
      ON knowledge_gap_events(gap_id, id);
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
    CREATE TABLE IF NOT EXISTS operational_controls (
      key TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspace(id),
      enabled INTEGER NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      reason TEXT NOT NULL,
      changed_by TEXT REFERENCES users(id),
      changed_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS operational_control_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      control_key TEXT NOT NULL REFERENCES operational_controls(key),
      actor_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS operational_control_events_recent
      ON operational_control_events(id DESC);
    CREATE TABLE IF NOT EXISTS qa_rubrics (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspace(id),
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      status TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      activated_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL,
      activated_at TEXT,
      retired_at TEXT,
      payload TEXT NOT NULL,
      UNIQUE(workspace_id, name, version)
    );
    CREATE INDEX IF NOT EXISTS qa_rubrics_status
      ON qa_rubrics(workspace_id, status, created_at DESC);
    CREATE TABLE IF NOT EXISTS qa_reviews (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspace(id),
      call_id TEXT NOT NULL REFERENCES calls(id),
      rubric_id TEXT NOT NULL REFERENCES qa_rubrics(id),
      reviewer_id TEXT NOT NULL REFERENCES users(id),
      state TEXT NOT NULL,
      score_earned INTEGER,
      score_possible INTEGER,
      assigned_at TEXT NOT NULL,
      completed_at TEXT,
      payload TEXT NOT NULL,
      UNIQUE(call_id, rubric_id, reviewer_id)
    );
    CREATE INDEX IF NOT EXISTS qa_reviews_call
      ON qa_reviews(call_id, assigned_at DESC);
    CREATE INDEX IF NOT EXISTS qa_reviews_report
      ON qa_reviews(workspace_id, state, completed_at DESC);
    CREATE TABLE IF NOT EXISTS qa_findings (
      id TEXT PRIMARY KEY,
      review_id TEXT NOT NULL REFERENCES qa_reviews(id),
      criterion_id TEXT NOT NULL,
      verdict TEXT NOT NULL,
      note TEXT,
      turn_index INTEGER,
      source_index INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(review_id, criterion_id)
    );
    CREATE TABLE IF NOT EXISTS qa_coaching_notes (
      id TEXT PRIMARY KEY,
      review_id TEXT NOT NULL REFERENCES qa_reviews(id),
      actor_id TEXT NOT NULL REFERENCES users(id),
      note TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS qa_coaching_review
      ON qa_coaching_notes(review_id, created_at);
    CREATE TABLE IF NOT EXISTS qa_review_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_id TEXT NOT NULL REFERENCES qa_reviews(id),
      actor_id TEXT NOT NULL REFERENCES users(id),
      action TEXT NOT NULL,
      created_at TEXT NOT NULL,
      payload TEXT
    );
    CREATE INDEX IF NOT EXISTS qa_review_events_review
      ON qa_review_events(review_id, id);
    CREATE TABLE IF NOT EXISTS team_invites (
      id TEXT PRIMARY KEY, email TEXT NOT NULL, role TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id), accepted_at INTEGER, revoked_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS team_events (
      id INTEGER PRIMARY KEY, actor_id TEXT NOT NULL REFERENCES users(id),
      action TEXT NOT NULL, target_id TEXT NOT NULL, created_at INTEGER NOT NULL
    );
  `);
  const nudgeEventColumns = db.prepare('PRAGMA table_info(nudge_events)').all();
  if (!nudgeEventColumns.some((column) => column.name === 'payload')) {
    db.exec('ALTER TABLE nudge_events ADD COLUMN payload TEXT');
  }
  db.exec('PRAGMA user_version = 12');
  database = db;
  return db;
}
