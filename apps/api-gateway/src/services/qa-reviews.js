import { createHash, randomUUID } from 'node:crypto';

import { z } from 'zod';

import { getDatabase } from './database.js';

const criterionSchema = z.object({
  label: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1_000).default(''),
  weight: z.number().int().min(1).max(10),
}).strict();
const rubricSchema = z.object({
  name: z.string().trim().min(1).max(180),
  version: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,49}$/),
  description: z.string().trim().min(1).max(2_000),
  criteria: z.array(criterionSchema).min(1).max(30),
}).strict();
const findingSchema = z.object({
  criterion_id: z.string().uuid(),
  verdict: z.enum(['pass', 'fail', 'not_applicable']),
  note: z.string().trim().max(2_000).default(''),
  turn_index: z.number().int().nonnegative().nullable().optional(),
  source_index: z.number().int().nonnegative().nullable().optional(),
}).strict();
const findingsSchema = z.object({ findings: z.array(findingSchema).max(30) }).strict();
const coachingSchema = z.object({ note: z.string().trim().min(1).max(2_000) }).strict();

const parse = (row) => row ? JSON.parse(row.payload) : null;
const now = () => new Date().toISOString();
const badRequest = (message) => Object.assign(new Error(message), { status: 400 });

function getCall(db, callId) {
  const call = parse(db.prepare("SELECT payload FROM calls WHERE id=? AND workspace_id='default'").get(callId));
  if (!call) throw Object.assign(new Error('Call not found'), { status: 404 });
  if (call.status !== 'completed') throw Object.assign(new Error('Only completed calls can be reviewed'), { status: 409 });
  return call;
}

function getRubric(db, id) {
  return parse(db.prepare("SELECT payload FROM qa_rubrics WHERE id=? AND workspace_id='default'").get(id));
}

function reviewEvent(db, reviewId, actorId, action, payload = null) {
  db.prepare(`INSERT INTO qa_review_events
    (review_id, actor_id, action, created_at, payload) VALUES (?, ?, ?, ?, ?)`)
    .run(reviewId, actorId, action, now(), payload ? JSON.stringify(payload) : null);
}

function rubricWithUsage(db, rubric) {
  const usage = db.prepare(`SELECT COUNT(*) AS review_count,
    SUM(CASE WHEN state='completed' THEN 1 ELSE 0 END) AS completed_review_count
    FROM qa_reviews WHERE rubric_id=?`).get(rubric.id);
  return {
    ...rubric,
    review_count: usage.review_count,
    completed_review_count: Number(usage.completed_review_count || 0),
  };
}

function hydrateReview(db, row) {
  if (!row) return null;
  const review = parse(row);
  const findings = db.prepare('SELECT * FROM qa_findings WHERE review_id=? ORDER BY created_at, criterion_id')
    .all(review.id).map((finding) => ({
      id: finding.id,
      criterion_id: finding.criterion_id,
      verdict: finding.verdict,
      note: finding.note || '',
      turn_index: finding.turn_index,
      source_index: finding.source_index,
      updated_at: finding.updated_at,
    }));
  const coaching = db.prepare(`SELECT notes.id, notes.note, notes.created_at, users.email AS actor_email
    FROM qa_coaching_notes notes JOIN users ON users.id=notes.actor_id
    WHERE notes.review_id=? ORDER BY notes.created_at`).all(review.id);
  const reviewer = db.prepare('SELECT email FROM users WHERE id=?').get(review.reviewer_id);
  return { ...review, findings, coaching, reviewer_email: reviewer?.email || 'Unknown reviewer' };
}

function rawReview(db, id) {
  const row = db.prepare("SELECT payload FROM qa_reviews WHERE id=? AND workspace_id='default'").get(id);
  if (!row) throw Object.assign(new Error('QA review not found'), { status: 404 });
  return parse(row);
}

function requireOwner(review, actorId) {
  if (review.reviewer_id !== actorId) {
    throw Object.assign(new Error('Only the assigned reviewer can change this review'), { status: 403 });
  }
}

function reviewAgreement(reviews) {
  const completed = reviews.filter((review) => review.state === 'completed');
  let pairs = 0;
  let comparisons = 0;
  let matches = 0;
  for (let left = 0; left < completed.length; left += 1) {
    for (let right = left + 1; right < completed.length; right += 1) {
      if (completed[left].call_id !== completed[right].call_id
        || completed[left].rubric_id !== completed[right].rubric_id) continue;
      pairs += 1;
      const rightFindings = new Map(completed[right].findings.map((item) => [item.criterion_id, item.verdict]));
      for (const item of completed[left].findings) {
        if (!rightFindings.has(item.criterion_id)) continue;
        comparisons += 1;
        if (rightFindings.get(item.criterion_id) === item.verdict) matches += 1;
      }
    }
  }
  return {
    reviewer_pairs: pairs,
    criterion_comparisons: comparisons,
    matching_verdicts: matches,
    agreement_rate: comparisons ? matches / comparisons : null,
  };
}

function hasMissingCitation(call) {
  return (call.turns || []).some((turn) => turn.role === 'assistant'
    && ['grounded', 'guided'].includes(turn.response_kind)
    && !(turn.sources || []).length);
}

function stableSampleKey(callId, filters) {
  return createHash('sha256').update(`default:${callId}:${JSON.stringify(filters)}`).digest('hex');
}

export function createQaReviewStore() {
  const db = getDatabase();
  return {
    listRubrics() {
      return db.prepare("SELECT payload FROM qa_rubrics WHERE workspace_id='default' ORDER BY created_at DESC")
        .all().map(parse).map((rubric) => rubricWithUsage(db, rubric));
    },

    createRubric(actorId, input) {
      const parsed = rubricSchema.safeParse(input);
      if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message || 'Rubric is invalid');
      const createdAt = now();
      const rubric = {
        id: randomUUID(),
        workspace_id: 'default',
        ...parsed.data,
        criteria: parsed.data.criteria.map((criterion) => ({ ...criterion, id: randomUUID() })),
        status: 'draft',
        schema_version: 'qa-rubric.v1',
        created_by: actorId,
        created_at: createdAt,
        activated_by: null,
        activated_at: null,
        retired_at: null,
      };
      try {
        db.prepare(`INSERT INTO qa_rubrics
          (id, workspace_id, name, version, status, created_by, created_at, payload)
          VALUES (?, 'default', ?, ?, 'draft', ?, ?, ?)`)
          .run(rubric.id, rubric.name, rubric.version, actorId, createdAt, JSON.stringify(rubric));
      } catch (error) {
        if (error.code === 'ERR_SQLITE_CONSTRAINT_UNIQUE' || error.message?.includes('UNIQUE constraint failed')) {
          throw Object.assign(new Error('That rubric version already exists'), { status: 409 });
        }
        throw error;
      }
      return rubricWithUsage(db, rubric);
    },

    activateRubric(id, actorId) {
      const rubric = getRubric(db, id);
      if (!rubric) throw Object.assign(new Error('Rubric not found'), { status: 404 });
      if (rubric.status !== 'draft') throw Object.assign(new Error('Only a draft rubric can be activated'), { status: 409 });
      const activatedAt = now();
      db.exec('BEGIN IMMEDIATE');
      try {
        const activeRows = db.prepare("SELECT payload FROM qa_rubrics WHERE workspace_id='default' AND status='active'").all();
        for (const row of activeRows) {
          const active = parse(row);
          const retired = { ...active, status: 'retired', retired_at: activatedAt, retirement_reason: `Superseded by ${rubric.name} ${rubric.version}` };
          db.prepare("UPDATE qa_rubrics SET status='retired', retired_at=?, payload=? WHERE id=?")
            .run(activatedAt, JSON.stringify(retired), active.id);
        }
        const active = { ...rubric, status: 'active', activated_by: actorId, activated_at: activatedAt };
        db.prepare("UPDATE qa_rubrics SET status='active', activated_by=?, activated_at=?, payload=? WHERE id=?")
          .run(actorId, activatedAt, JSON.stringify(active), id);
        db.exec('COMMIT');
        return rubricWithUsage(db, active);
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },

    retireRubric(id, actorId, reason) {
      const rubric = getRubric(db, id);
      if (!rubric) throw Object.assign(new Error('Rubric not found'), { status: 404 });
      if (rubric.status !== 'active') throw Object.assign(new Error('Only the active rubric can be retired'), { status: 409 });
      const parsedReason = z.string().trim().min(8).max(1_000).safeParse(reason);
      if (!parsedReason.success) throw badRequest('Provide a retirement reason between 8 and 1000 characters');
      const retired = { ...rubric, status: 'retired', retired_at: now(), retired_by: actorId, retirement_reason: parsedReason.data };
      db.prepare("UPDATE qa_rubrics SET status='retired', retired_at=?, payload=? WHERE id=?")
        .run(retired.retired_at, JSON.stringify(retired), id);
      return rubricWithUsage(db, retired);
    },

    sample(input = {}) {
      const filters = {
        days: input.days || 30,
        market: input.market || 'all',
        outcome: input.outcome || 'all',
        handoff: input.handoff || 'all',
        missing_citation: input.missing_citation || 'all',
        review_state: input.review_state || 'all',
        limit: input.limit || 25,
      };
      const cutoff = new Date(Date.now() - filters.days * 86_400_000).toISOString();
      const reviewCounts = new Map(db.prepare(`SELECT call_id, COUNT(*) AS total,
        SUM(CASE WHEN state='completed' THEN 1 ELSE 0 END) AS completed
        FROM qa_reviews GROUP BY call_id`).all().map((row) => [row.call_id, row]));
      const candidates = db.prepare(`SELECT payload FROM calls
        WHERE workspace_id='default' AND status='completed' AND ended_at>=?`).all(cutoff)
        .map(parse)
        .map((call) => {
          const counts = reviewCounts.get(call.call_id) || { total: 0, completed: 0 };
          const handoff = call.outcome === 'human_handoff_requested' || (call.escalations || []).some((item) => !item.resolved_at);
          return {
            call_id: call.call_id,
            market: call.market,
            ended_at: call.ended_at,
            outcome: call.outcome || 'completed',
            turn_count: call.turns?.length || 0,
            handoff,
            missing_citation: hasMissingCitation(call),
            review_count: counts.total,
            completed_review_count: Number(counts.completed || 0),
          };
        })
        .filter((call) => filters.market === 'all' || call.market === filters.market)
        .filter((call) => filters.outcome === 'all' || call.outcome === filters.outcome)
        .filter((call) => filters.handoff === 'all' || call.handoff === (filters.handoff === 'yes'))
        .filter((call) => filters.missing_citation === 'all' || call.missing_citation === (filters.missing_citation === 'yes'))
        .filter((call) => filters.review_state === 'all'
          || (filters.review_state === 'unreviewed' ? call.review_count === 0 : call.completed_review_count > 0));
      candidates.sort((left, right) => stableSampleKey(left.call_id, filters).localeCompare(stableSampleKey(right.call_id, filters)));
      return { filters, total_eligible: candidates.length, calls: candidates.slice(0, filters.limit) };
    },

    startReview(callId, actorId, rubricId = null) {
      getCall(db, callId);
      const unfinished = db.prepare(`SELECT payload FROM qa_reviews
        WHERE call_id=? AND reviewer_id=? AND state='draft' ORDER BY assigned_at DESC LIMIT 1`)
        .get(callId, actorId);
      if (unfinished) return hydrateReview(db, unfinished);
      const rubric = rubricId
        ? getRubric(db, rubricId)
        : parse(db.prepare("SELECT payload FROM qa_rubrics WHERE workspace_id='default' AND status='active' ORDER BY activated_at DESC LIMIT 1").get());
      if (!rubric) throw Object.assign(new Error('Activate a QA rubric before starting review'), { status: 409 });
      if (rubric.status !== 'active') throw Object.assign(new Error('New reviews require the active rubric'), { status: 409 });
      const existing = db.prepare('SELECT payload FROM qa_reviews WHERE call_id=? AND rubric_id=? AND reviewer_id=?')
        .get(callId, rubric.id, actorId);
      if (existing) return hydrateReview(db, existing);
      const assignedAt = now();
      const review = {
        id: randomUUID(),
        workspace_id: 'default',
        call_id: callId,
        rubric_id: rubric.id,
        reviewer_id: actorId,
        state: 'draft',
        rubric: {
          id: rubric.id,
          name: rubric.name,
          version: rubric.version,
          description: rubric.description,
          schema_version: rubric.schema_version,
          criteria: rubric.criteria,
        },
        score_earned: null,
        score_possible: null,
        assigned_at: assignedAt,
        completed_at: null,
        updated_at: assignedAt,
      };
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(`INSERT INTO qa_reviews
          (id, workspace_id, call_id, rubric_id, reviewer_id, state, assigned_at, payload)
          VALUES (?, 'default', ?, ?, ?, 'draft', ?, ?)`)
          .run(review.id, callId, rubric.id, actorId, assignedAt, JSON.stringify(review));
        reviewEvent(db, review.id, actorId, 'assigned');
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return hydrateReview(db, { payload: JSON.stringify(review) });
    },

    saveFindings(id, actorId, input) {
      const parsed = findingsSchema.safeParse(input);
      if (!parsed.success) throw badRequest(parsed.error.issues[0]?.message || 'Findings are invalid');
      const review = rawReview(db, id);
      requireOwner(review, actorId);
      if (review.state !== 'draft') throw Object.assign(new Error('Completed reviews are immutable'), { status: 409 });
      const call = getCall(db, review.call_id);
      const criteria = new Set(review.rubric.criteria.map((criterion) => criterion.id));
      const seen = new Set();
      for (const finding of parsed.data.findings) {
        if (!criteria.has(finding.criterion_id) || seen.has(finding.criterion_id)) throw badRequest('Each finding must target one rubric criterion');
        seen.add(finding.criterion_id);
        if (finding.verdict === 'fail' && (finding.turn_index == null || !finding.note)) {
          throw badRequest('Failed criteria require a note and transcript evidence');
        }
        if (finding.verdict === 'not_applicable' && !finding.note) throw badRequest('Not-applicable criteria require a note');
        if (finding.turn_index != null && !call.turns?.[finding.turn_index]) throw badRequest('Transcript evidence does not exist');
        if (finding.source_index != null && !call.turns?.[finding.turn_index]?.sources?.[finding.source_index]) throw badRequest('Citation evidence does not exist');
      }
      const updatedAt = now();
      db.exec('BEGIN IMMEDIATE');
      try {
        const submittedCriteria = new Set(parsed.data.findings.map((finding) => finding.criterion_id));
        for (const existing of db.prepare('SELECT criterion_id FROM qa_findings WHERE review_id=?').all(id)) {
          if (!submittedCriteria.has(existing.criterion_id)) {
            db.prepare('DELETE FROM qa_findings WHERE review_id=? AND criterion_id=?')
              .run(id, existing.criterion_id);
          }
        }
        for (const finding of parsed.data.findings) {
          const existing = db.prepare('SELECT id, created_at FROM qa_findings WHERE review_id=? AND criterion_id=?')
            .get(id, finding.criterion_id);
          db.prepare(`INSERT INTO qa_findings
            (id, review_id, criterion_id, verdict, note, turn_index, source_index, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(review_id, criterion_id) DO UPDATE SET verdict=excluded.verdict,
              note=excluded.note, turn_index=excluded.turn_index, source_index=excluded.source_index,
              updated_at=excluded.updated_at`)
            .run(existing?.id || randomUUID(), id, finding.criterion_id, finding.verdict,
              finding.note || null, finding.turn_index ?? null, finding.source_index ?? null,
              existing?.created_at || updatedAt, updatedAt);
        }
        const updated = { ...review, updated_at: updatedAt };
        db.prepare('UPDATE qa_reviews SET payload=? WHERE id=?').run(JSON.stringify(updated), id);
        reviewEvent(db, id, actorId, 'findings_saved', { finding_count: parsed.data.findings.length });
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return hydrateReview(db, db.prepare('SELECT payload FROM qa_reviews WHERE id=?').get(id));
    },

    completeReview(id, actorId) {
      const review = rawReview(db, id);
      requireOwner(review, actorId);
      if (review.state === 'completed') return hydrateReview(db, db.prepare('SELECT payload FROM qa_reviews WHERE id=?').get(id));
      const findings = db.prepare('SELECT * FROM qa_findings WHERE review_id=?').all(id);
      const byCriterion = new Map(findings.map((finding) => [finding.criterion_id, finding]));
      if (review.rubric.criteria.some((criterion) => !byCriterion.has(criterion.id))) {
        throw Object.assign(new Error('Score every rubric criterion before completing the review'), { status: 409 });
      }
      let earned = 0;
      let possible = 0;
      for (const criterion of review.rubric.criteria) {
        const finding = byCriterion.get(criterion.id);
        if (finding.verdict === 'not_applicable') continue;
        possible += criterion.weight;
        if (finding.verdict === 'pass') earned += criterion.weight;
      }
      if (!possible) throw Object.assign(new Error('At least one criterion must be applicable'), { status: 409 });
      const completedAt = now();
      const completed = { ...review, state: 'completed', score_earned: earned, score_possible: possible, completed_at: completedAt, updated_at: completedAt };
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare(`UPDATE qa_reviews SET state='completed', score_earned=?, score_possible=?, completed_at=?, payload=? WHERE id=?`)
          .run(earned, possible, completedAt, JSON.stringify(completed), id);
        reviewEvent(db, id, actorId, 'completed', { score_earned: earned, score_possible: possible });
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return hydrateReview(db, { payload: JSON.stringify(completed) });
    },

    addCoaching(id, actorId, input) {
      const parsed = coachingSchema.safeParse(input);
      if (!parsed.success) throw badRequest('Coaching note is required and must be at most 2000 characters');
      const review = rawReview(db, id);
      if (review.state !== 'completed') throw Object.assign(new Error('Complete the review before adding coaching'), { status: 409 });
      const createdAt = now();
      const note = { id: randomUUID(), note: parsed.data.note, created_at: createdAt };
      db.exec('BEGIN IMMEDIATE');
      try {
        db.prepare('INSERT INTO qa_coaching_notes (id, review_id, actor_id, note, created_at) VALUES (?, ?, ?, ?, ?)')
          .run(note.id, id, actorId, note.note, createdAt);
        reviewEvent(db, id, actorId, 'coaching_added', { note_id: note.id });
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      return hydrateReview(db, db.prepare('SELECT payload FROM qa_reviews WHERE id=?').get(id));
    },

    callBundle(callId, actorId) {
      getCall(db, callId);
      const activeRubric = parse(db.prepare("SELECT payload FROM qa_rubrics WHERE workspace_id='default' AND status='active' ORDER BY activated_at DESC LIMIT 1").get());
      const reviews = db.prepare("SELECT payload FROM qa_reviews WHERE call_id=? AND workspace_id='default' ORDER BY assigned_at DESC")
        .all(callId).map((row) => hydrateReview(db, row));
      return {
        active_rubric: activeRubric ? rubricWithUsage(db, activeRubric) : null,
        reviews,
        my_review: reviews.find((review) => review.reviewer_id === actorId && review.rubric_id === activeRubric?.id)
          || reviews.find((review) => review.reviewer_id === actorId && review.state === 'draft')
          || null,
        agreement: reviewAgreement(reviews),
      };
    },

    report({ days = 30, market = 'all' } = {}) {
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
      const rows = db.prepare(`SELECT reviews.payload, calls.payload AS call_payload
        FROM qa_reviews reviews JOIN calls ON calls.id=reviews.call_id
        WHERE reviews.workspace_id='default' AND reviews.state='completed' AND reviews.completed_at>=?`)
        .all(cutoff);
      const reviews = rows.map((row) => ({ review: hydrateReview(db, { payload: row.payload }), call: JSON.parse(row.call_payload) }))
        .filter(({ call }) => market === 'all' || call.market === market);
      let earned = 0;
      let possible = 0;
      const reviewers = new Set();
      const calls = new Set();
      const rubricVersions = new Set();
      const failures = new Map();
      for (const { review } of reviews) {
        earned += review.score_earned;
        possible += review.score_possible;
        reviewers.add(review.reviewer_id);
        calls.add(review.call_id);
        rubricVersions.add(`${review.rubric.name} ${review.rubric.version}`);
        const criteria = new Map(review.rubric.criteria.map((criterion) => [criterion.id, criterion.label]));
        for (const finding of review.findings) {
          if (finding.verdict !== 'fail') continue;
          const label = criteria.get(finding.criterion_id) || 'Unknown criterion';
          failures.set(label, (failures.get(label) || 0) + 1);
        }
      }
      const agreement = reviewAgreement(reviews.map(({ review }) => review));
      return {
        generated_at: now(),
        filters: { days, market },
        sample_size: reviews.length,
        reviewed_calls: calls.size,
        reviewer_count: reviewers.size,
        rubric_versions: [...rubricVersions],
        score_earned: earned,
        score_possible: possible,
        score_rate: possible ? earned / possible : null,
        ...agreement,
        failed_criteria: [...failures.entries()].map(([label, count]) => ({ label, count }))
          .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label)),
      };
    },
  };
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function qaReportCsv(report) {
  const rows = [
    ['record_type', 'metric', 'value'],
    ['summary', 'generated_at', report.generated_at],
    ['summary', 'days', report.filters.days],
    ['summary', 'market', report.filters.market],
    ['summary', 'completed_reviews', report.sample_size],
    ['summary', 'reviewed_calls', report.reviewed_calls],
    ['summary', 'reviewers', report.reviewer_count],
    ['summary', 'score_rate', report.score_rate == null ? '' : report.score_rate],
    ['summary', 'reviewer_pairs', report.reviewer_pairs],
    ['summary', 'agreement_rate', report.agreement_rate == null ? '' : report.agreement_rate],
    ...report.failed_criteria.map((item) => ['failed_criterion', item.label, item.count]),
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\n') + '\n';
}
