import { randomUUID } from 'node:crypto';

import { z } from 'zod';

import { getDatabase } from './database.js';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
});
const sourceSchema = z.object({
  document_id: z.string().trim().min(1).max(200),
  revision: z.number().int().positive(),
}).strict();
const itemSchema = z.object({
  id: z.string().trim().regex(/^[a-z][a-z0-9_-]{1,63}$/),
  label: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1_000).default(''),
  applicability: z.enum(['required', 'conditional']),
  condition_note: z.string().trim().max(1_000).default(''),
  roles: z.array(z.enum(['user', 'assistant'])).min(1).max(2),
  phrases: z.array(z.string().trim().min(2).max(120)).min(1).max(30),
  require_sources: z.boolean().default(true),
  source_refs: z.array(sourceSchema).min(1).max(10),
  human_confirmation_required: z.literal(true).default(true),
}).strict();
const createSchema = z.object({
  title: z.string().trim().min(1).max(180),
  version: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$/),
  market: z.enum(['india-loan', 'india-insurance', 'ph-bancassurance', 'id-finance']),
  channel: z.enum(['voice', 'text']),
  workflow: z.string().trim().regex(/^[a-z][a-z0-9_-]{1,79}$/),
  effective_from: dateOnly,
  effective_to: dateOnly.nullable().optional(),
  owner_note: z.string().trim().min(1).max(2_000),
  items: z.array(itemSchema).min(1).max(30),
}).strict().superRefine((value, context) => {
  if (value.effective_to && value.effective_to < value.effective_from) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['effective_to'], message: 'End date must be on or after start date' });
  }
  if (new Set(value.items.map((item) => item.id)).size !== value.items.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['items'], message: 'Checklist item IDs must be unique' });
  }
  for (const [index, item] of value.items.entries()) {
    if (item.applicability === 'conditional' && !item.condition_note) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['items', index, 'condition_note'], message: 'Conditional items require a condition note' });
    }
  }
});
const confirmationSchema = z.object({
  decision: z.enum(['observed', 'missing', 'uncertain', 'not_applicable']),
  note: z.string().trim().max(1_000).default(''),
}).strict().superRefine((value, context) => {
  if (['missing', 'not_applicable'].includes(value.decision) && !value.note) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['note'], message: 'A note is required for this decision' });
  }
});

const utcToday = (value = new Date()) => value.toISOString().slice(0, 10);

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function parseRow(row) {
  return row ? JSON.parse(row.payload) : null;
}

function windowState(checklist, today = utcToday()) {
  if (checklist.status === 'retired') return 'retired';
  if (checklist.status === 'draft') return 'draft';
  if (checklist.effective_from > today) return 'scheduled';
  if (checklist.effective_to && checklist.effective_to < today) return 'expired';
  return 'active';
}

function event(db, checklistId, actorId, action, payload = null) {
  db.prepare(`INSERT INTO disclosure_checklist_events
    (checklist_id, actor_id, action, created_at, payload) VALUES (?, ?, ?, ?, ?)`)
    .run(checklistId, actorId, action, new Date().toISOString(), payload ? JSON.stringify(payload) : null);
}

function publishedDocument(db, reference) {
  const row = db.prepare("SELECT payload FROM knowledge_documents WHERE id=? AND workspace_id='default'")
    .get(reference.document_id);
  const document = parseRow(row);
  if (!document || document.revision !== reference.revision
    || !((document.status === 'indexed' && document.publicationStatus === 'published')
      || (document.status === 'indexed' && !document.publicationStatus))) return null;
  return document;
}

function overlaps(leftStart, leftEnd, rightStart, rightEnd) {
  return leftStart <= (rightEnd || '9999-12-31') && rightStart <= (leftEnd || '9999-12-31');
}

function evidenceForTurn(session, turnIndex) {
  const turn = session.turns[turnIndex];
  return {
    kind: 'transcript_turn',
    turn_index: turnIndex,
    role: turn.role,
    excerpt: String(turn.content || '').replace(/\s+/g, ' ').trim().slice(0, 220),
    citations: (turn.sources || []).map((source, sourceIndex) => ({
      source_index: sourceIndex,
      document_id: source.document_id || null,
      revision: source.revision || null,
      page: source.page || null,
      chunk_id: source.chunk_id || null,
      title: source.title || source.source || 'Knowledge source',
    })),
  };
}

function matchingSource(turn, item) {
  return (turn.sources || []).some((source) => item.source_refs.some((reference) =>
    source.document_id === reference.document_id
    && Number(source.revision) === reference.revision));
}

function suggestedResult(session, item) {
  const phrases = item.phrases.map((phrase) => phrase.toLocaleLowerCase());
  let weakMatch = null;
  for (let index = session.turns.length - 1; index >= 0; index -= 1) {
    const turn = session.turns[index];
    if (!item.roles.includes(turn.role)) continue;
    const text = String(turn.content || '').toLocaleLowerCase();
    if (!phrases.some((phrase) => text.includes(phrase))) continue;
    const evidence = evidenceForTurn(session, index);
    if (!item.require_sources || matchingSource(turn, item)) {
      return { suggested_state: 'observed', evidence, reason: 'Configured phrase and evidence rules matched.' };
    }
    weakMatch ||= evidence;
  }
  if (weakMatch) {
    return { suggested_state: 'uncertain', evidence: weakMatch, reason: 'Topic wording was detected without the configured published source revision.' };
  }
  if (item.applicability === 'conditional') {
    return { suggested_state: 'uncertain', evidence: null, reason: 'Applicability requires human review.' };
  }
  const hasAssistantTurn = session.turns.some((turn) => turn.role === 'assistant');
  return hasAssistantTurn
    ? { suggested_state: 'missing', evidence: null, reason: 'No configured evidence signal has been observed yet.' }
    : { suggested_state: 'uncertain', evidence: null, reason: 'The conversation has not progressed far enough to assess this item.' };
}

function getChecklist(db, id) {
  return parseRow(db.prepare("SELECT payload FROM disclosure_checklists WHERE id=? AND workspace_id='default'").get(id));
}

function resolveSources(db, checklist) {
  const documents = new Map();
  for (const item of checklist.items) {
    for (const reference of item.source_refs) {
      const document = parseRow(db.prepare("SELECT payload FROM knowledge_documents WHERE id=? AND workspace_id='default'")
        .get(reference.document_id));
      documents.set(`${reference.document_id}:${reference.revision}`, {
        ...reference,
        title: document?.title || document?.filename || 'Published knowledge revision',
      });
    }
  }
  return checklist.items.map((item) => ({
    ...item,
    source_refs: item.source_refs.map((reference) => documents.get(`${reference.document_id}:${reference.revision}`)),
  }));
}

export function createDisclosureChecklistStore() {
  const db = getDatabase();
  return {
    list({ includeDrafts = false } = {}) {
      const rows = db.prepare(`SELECT payload FROM disclosure_checklists WHERE workspace_id='default'
        ${includeDrafts ? '' : "AND status='approved'"} ORDER BY created_at DESC`).all();
      return rows.map(parseRow).map((checklist) => ({ ...checklist, effective_status: windowState(checklist) }));
    },

    create(actorId, input) {
      const parsed = createSchema.safeParse(input);
      if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message || 'Checklist is invalid');
      const now = new Date().toISOString();
      const checklist = {
        id: randomUUID(),
        workspace_id: 'default',
        ...parsed.data,
        effective_to: parsed.data.effective_to || null,
        status: 'draft',
        schema_version: 'disclosure-checklist.v1',
        created_by: actorId,
        approved_by: null,
        created_at: now,
        approved_at: null,
      };
      for (const item of checklist.items) {
        item.phrases = [...new Set(item.phrases.map((phrase) => phrase.toLocaleLowerCase()))];
        item.roles = [...new Set(item.roles)];
      }
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(`INSERT INTO disclosure_checklists
          (id, workspace_id, market, channel, workflow, version, status, effective_from, effective_to,
           created_by, approved_by, created_at, approved_at, payload)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?)`)
          .run(checklist.id, checklist.workspace_id, checklist.market, checklist.channel,
            checklist.workflow, checklist.version, checklist.status, checklist.effective_from,
            checklist.effective_to, checklist.created_by, checklist.created_at, JSON.stringify(checklist));
        event(db, checklist.id, actorId, 'created');
        db.exec('COMMIT');
        return checklist;
      } catch (error) {
        db.exec('ROLLBACK');
        if (error.code === 'ERR_SQLITE_CONSTRAINT_UNIQUE' || error.message?.includes('UNIQUE constraint failed')) {
          throw Object.assign(new Error('That checklist version already exists for this scope'), { status: 409 });
        }
        throw error;
      }
    },

    approve(id, actorId) {
      const checklist = getChecklist(db, id);
      if (!checklist) throw Object.assign(new Error('Checklist not found'), { status: 404 });
      if (checklist.status !== 'draft') throw Object.assign(new Error('Only draft checklists can be approved'), { status: 409 });
      if (checklist.created_by === actorId) {
        throw Object.assign(new Error('A different administrator must approve this checklist'), { status: 409 });
      }
      if (checklist.effective_to && checklist.effective_to < utcToday()) {
        throw Object.assign(new Error('An expired checklist cannot be approved'), { status: 409 });
      }
      for (const item of checklist.items) {
        for (const reference of item.source_refs) {
          const document = publishedDocument(db, reference);
          const missesEffectiveWindow = document && (
            (document.effectiveFrom && document.effectiveFrom > checklist.effective_from)
            || (document.effectiveTo && (!checklist.effective_to || document.effectiveTo < checklist.effective_to))
          );
          if (!document) {
            throw Object.assign(new Error(`Item “${item.label}” must reference an existing published knowledge revision`), { status: 409 });
          }
          if (missesEffectiveWindow) {
            throw Object.assign(new Error(`The published revision for “${item.label}” must cover the checklist's full effective period`), { status: 409 });
          }
        }
      }
      const existing = db.prepare(`SELECT payload FROM disclosure_checklists
        WHERE workspace_id='default' AND market=? AND channel=? AND workflow=? AND status='approved'`)
        .all(checklist.market, checklist.channel, checklist.workflow).map(parseRow)
        .find((candidate) => overlaps(checklist.effective_from, checklist.effective_to,
          candidate.effective_from, candidate.effective_to));
      if (existing) {
        throw Object.assign(new Error(`Effective dates overlap approved version ${existing.version}`), { status: 409 });
      }
      const now = new Date().toISOString();
      const approved = { ...checklist, status: 'approved', approved_by: actorId, approved_at: now };
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('UPDATE disclosure_checklists SET status=?, approved_by=?, approved_at=?, payload=? WHERE id=?')
          .run(approved.status, actorId, now, JSON.stringify(approved), approved.id);
        event(db, approved.id, actorId, 'approved');
        db.exec('COMMIT');
        return { ...approved, effective_status: windowState(approved) };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },

    retire(id, actorId, note) {
      const checklist = getChecklist(db, id);
      if (!checklist) throw Object.assign(new Error('Checklist not found'), { status: 404 });
      if (checklist.status !== 'approved') throw Object.assign(new Error('Only approved checklists can be retired'), { status: 409 });
      const parsedNote = z.string().trim().min(1).max(1_000).safeParse(note);
      if (!parsedNote.success) throw badRequest('A retirement note is required');
      const retired = { ...checklist, status: 'retired', retired_at: new Date().toISOString(), retired_by: actorId, retirement_note: parsedNote.data };
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('UPDATE disclosure_checklists SET status=?, payload=? WHERE id=?')
          .run(retired.status, JSON.stringify(retired), retired.id);
        event(db, retired.id, actorId, 'retired', { note: parsedNote.data });
        db.exec('COMMIT');
        return { ...retired, effective_status: 'retired' };
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },

    evaluate(session) {
      const callDate = utcToday(new Date(session.created_at || Date.now()));
      const channel = session.channel || 'text';
      const checklist = db.prepare(`SELECT payload FROM disclosure_checklists
        WHERE workspace_id='default' AND market=? AND channel=? AND status='approved'
          AND effective_from<=? AND (effective_to IS NULL OR effective_to>=?)
        ORDER BY effective_from DESC, approved_at DESC LIMIT 1`)
        .get(session.market, channel, callDate, callDate);
      if (!checklist) return null;
      const definition = parseRow(checklist);
      const confirmations = new Map(db.prepare(`SELECT * FROM disclosure_confirmations
        WHERE call_id=? AND checklist_id=?`).all(session.call_id, definition.id)
        .map((row) => [row.item_id, row]));
      const items = resolveSources(db, definition).map((item) => {
        const suggestion = suggestedResult(session, item);
        const confirmation = confirmations.get(item.id) || null;
        return {
          ...item,
          ...suggestion,
          state: confirmation?.decision || suggestion.suggested_state,
          confirmed: Boolean(confirmation),
          confirmation: confirmation ? {
            decision: confirmation.decision,
            note: confirmation.note,
            actor_id: confirmation.actor_id,
            updated_at: confirmation.updated_at,
          } : null,
        };
      });
      const counts = { observed: 0, missing: 0, uncertain: 0, not_applicable: 0 };
      for (const item of items) counts[item.state] += 1;
      return {
        id: definition.id,
        title: definition.title,
        version: definition.version,
        market: definition.market,
        channel: definition.channel,
        workflow: definition.workflow,
        effective_from: definition.effective_from,
        effective_to: definition.effective_to,
        owner_note: definition.owner_note,
        schema_version: definition.schema_version,
        mode: 'shadow',
        disclaimer: 'Workflow aid only. Suggested states are not a legal or compliance determination; human confirmation is required.',
        counts,
        items,
      };
    },

    confirm(session, itemId, actorId, input) {
      const checklist = this.evaluate(session);
      if (!checklist) throw Object.assign(new Error('No approved checklist applies to this call'), { status: 409 });
      if (!checklist.items.some((item) => item.id === itemId)) {
        throw Object.assign(new Error('Checklist item not found'), { status: 404 });
      }
      const parsed = confirmationSchema.safeParse(input);
      if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message || 'Confirmation is invalid');
      const previous = db.prepare('SELECT * FROM disclosure_confirmations WHERE checklist_id=? AND call_id=? AND item_id=?')
        .get(checklist.id, session.call_id, itemId);
      const id = previous?.id || randomUUID();
      const now = new Date().toISOString();
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(`INSERT INTO disclosure_confirmations
          (id, workspace_id, checklist_id, call_id, item_id, actor_id, decision, note, created_at, updated_at)
          VALUES (?, 'default', ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(checklist_id, call_id, item_id) DO UPDATE SET
            actor_id=excluded.actor_id, decision=excluded.decision, note=excluded.note, updated_at=excluded.updated_at`)
          .run(id, checklist.id, session.call_id, itemId, actorId, parsed.data.decision,
            parsed.data.note || null, previous?.created_at || now, now);
        db.prepare(`INSERT INTO disclosure_confirmation_events
          (confirmation_id, actor_id, action, created_at, payload) VALUES (?, ?, ?, ?, ?)`)
          .run(id, actorId, previous ? 'updated' : 'created', now, JSON.stringify({
            previous_decision: previous?.decision || null,
            decision: parsed.data.decision,
            note: parsed.data.note || null,
          }));
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return this.evaluate(session);
    },
  };
}
