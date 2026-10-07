import { getDatabase } from './database.js';

export const OPERATIONAL_CONTROL_DEFINITIONS = [
  {
    key: 'new_sessions',
    label: 'New voice sessions',
    description: 'Starting new browser or provider-owned call sessions.',
    pausedEffect: 'New sessions are rejected; active calls and call review stay available.',
  },
  {
    key: 'customer_answer_generation',
    label: 'Customer answer generation',
    description: 'Grounded RAG answers delivered directly to the customer.',
    pausedEffect: 'Greetings and human handoff still work; knowledge answers use a safe pause response.',
  },
  {
    key: 'private_guidance',
    label: 'Private operator guidance',
    description: 'Private knowledge searches that create operator-only suggestions.',
    pausedEffect: 'Operators can review calls and existing tips but cannot request new private guidance.',
  },
  {
    key: 'guided_delivery',
    label: 'Guided answer delivery',
    description: 'Applying a reviewed tip as the next assistant turn.',
    pausedEffect: 'Tips remain visible and dismissible but cannot be delivered to the customer.',
  },
  {
    key: 'proactive_nudges',
    label: 'Proactive live nudges',
    description: 'Signal-driven tips generated from live transcript activity.',
    pausedEffect: 'Signal analysis may continue, but no new proactive tip is created or shown.',
  },
  {
    key: 'knowledge_ingestion',
    label: 'Knowledge ingestion',
    description: 'Uploading, revising, and processing source documents.',
    pausedEffect: 'New processing is rejected and queued work waits without exhausting retries.',
  },
  {
    key: 'knowledge_publication',
    label: 'Knowledge publication',
    description: 'Approving and publishing a reviewed knowledge revision.',
    pausedEffect: 'New approvals are rejected and queued publications wait without losing approval.',
  },
  {
    key: 'outbound_delivery',
    label: 'Outbound connector delivery',
    description: 'Delivery to external CRM, ticketing, or messaging connectors.',
    pausedEffect: 'No external delivery is attempted.',
    available: false,
  },
];

const availableDefinitions = OPERATIONAL_CONTROL_DEFINITIONS.filter((item) => item.available !== false);
let seeded = false;

function seed(db = getDatabase()) {
  if (seeded) return;
  const insert = db.prepare(`INSERT OR IGNORE INTO operational_controls
    (key, workspace_id, enabled, version, reason, changed_by, changed_at)
    VALUES (?, 'default', 1, 1, 'Enabled by the release baseline.', NULL, ?)`);
  const now = new Date().toISOString();
  for (const definition of availableDefinitions) insert.run(definition.key, now);
  seeded = true;
}

function rowFor(key, db = getDatabase()) {
  seed(db);
  return db.prepare("SELECT * FROM operational_controls WHERE key = ? AND workspace_id = 'default'").get(key);
}

function present(definition, row) {
  if (definition.available === false) {
    return { ...definition, enabled: false, version: 0, reason: 'No outbound connector is configured.', changed_by: null, changed_at: null };
  }
  return {
    ...definition,
    enabled: Boolean(row.enabled),
    version: row.version,
    reason: row.reason,
    changed_by: row.changed_by,
    changed_at: row.changed_at,
  };
}

export function listOperationalControls() {
  const db = getDatabase();
  seed(db);
  const rows = new Map(db.prepare("SELECT * FROM operational_controls WHERE workspace_id = 'default'").all().map((row) => [row.key, row]));
  return OPERATIONAL_CONTROL_DEFINITIONS.map((definition) => present(definition, rows.get(definition.key)));
}

export function getOperationalControl(key) {
  const definition = OPERATIONAL_CONTROL_DEFINITIONS.find((item) => item.key === key);
  if (!definition) throw Object.assign(new Error('Unknown operational control.'), { status: 404 });
  return present(definition, definition.available === false ? null : rowFor(key));
}

export function isOperationalControlEnabled(key) {
  return getOperationalControl(key).enabled;
}

export function assertOperationalControl(key, { queued = false } = {}) {
  const control = getOperationalControl(key);
  if (control.enabled) return control;
  const error = Object.assign(new Error(`${control.label} is paused: ${control.reason}`), {
    status: 503,
    code: 'CAPABILITY_PAUSED',
    control,
  });
  if (queued) error.paused = true;
  throw error;
}

export function updateOperationalControl(key, enabled, reason, actorId) {
  const definition = OPERATIONAL_CONTROL_DEFINITIONS.find((item) => item.key === key);
  if (!definition) throw Object.assign(new Error('Unknown operational control.'), { status: 404 });
  if (definition.available === false) throw Object.assign(new Error('This capability is not configured.'), { status: 409 });
  const db = getDatabase();
  seed(db);
  db.exec('BEGIN IMMEDIATE');
  try {
    const previous = rowFor(key, db);
    if (Boolean(previous.enabled) === enabled) {
      throw Object.assign(new Error(`${definition.label} is already ${enabled ? 'enabled' : 'paused'}.`), { status: 409 });
    }
    const changedAt = new Date().toISOString();
    db.prepare(`UPDATE operational_controls
      SET enabled = ?, version = version + 1, reason = ?, changed_by = ?, changed_at = ?
      WHERE key = ? AND workspace_id = 'default'`).run(enabled ? 1 : 0, reason, actorId, changedAt, key);
    const current = rowFor(key, db);
    db.prepare(`INSERT INTO operational_control_events
      (control_key, actor_id, action, created_at, payload) VALUES (?, ?, ?, ?, ?)`)
      .run(key, actorId, enabled ? 'enabled' : 'paused', changedAt, JSON.stringify({
        previous_enabled: Boolean(previous.enabled),
        enabled,
        reason,
        version: current.version,
      }));
    db.exec('COMMIT');
    return present(definition, current);
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function listOperationalControlEvents(limit = 50) {
  seed();
  return getDatabase().prepare(`SELECT events.id, events.control_key, events.action, events.created_at,
    events.payload, users.email AS actor_email
    FROM operational_control_events events
    LEFT JOIN users ON users.id = events.actor_id
    ORDER BY events.id DESC LIMIT ?`).all(limit).map((row) => ({
      id: row.id,
      control_key: row.control_key,
      action: row.action,
      created_at: row.created_at,
      actor_email: row.actor_email,
      ...JSON.parse(row.payload),
    }));
}
