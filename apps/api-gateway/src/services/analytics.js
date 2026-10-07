import { getDatabase } from './database.js';

export const ANALYTICS_MARKETS = ['india-loan', 'india-insurance', 'ph-bancassurance', 'id-finance'];
const DAY_MS = 24 * 60 * 60 * 1000;
const liveStatuses = new Set(['created', 'active', 'escalated']);
const timestamp = (value) => typeof value === 'string' ? Date.parse(value) : NaN;
const round = (value) => Math.round(value * 100) / 100;
const average = (values) => values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
const percentile = (sorted, fraction) => sorted.length ? sorted[Math.ceil(sorted.length * fraction) - 1] : null;

/** Aggregate a cohort of calls started within UTC calendar days, ending now. */
export function buildAnalytics(sessions, { days = 7, market = 'all', now = new Date() } = {}) {
  const end = new Date(now).getTime();
  const today = new Date(end);
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - (days - 1) * DAY_MS;
  const daily = Array.from({ length: days }, (_, index) => ({
    date: new Date(start + index * DAY_MS).toISOString().slice(0, 10), calls: 0, completed: 0, handoffs: 0,
  }));
  const dayBuckets = new Map(daily.map((entry) => [entry.date, entry]));
  const marketBuckets = new Map();
  const totals = {
    calls: 0, completed: 0, active: 0, handoffs: 0, assistant_turns: 0, cited_turns: 0,
    citation_coverage_pct: null, avg_duration_ms: null, duration_samples: 0,
    avg_latency_ms: null, p50_latency_ms: null, p95_latency_ms: null, latency_samples: 0,
  };
  const durations = [];
  const latencies = [];
  const recent = [];

  for (const session of sessions) {
    const created = timestamp(session.created_at);
    if (!Number.isFinite(created) || created < start || created >= end) continue;
    if (market !== 'all' && session.market !== market) continue;
    const callMarket = typeof session.market === 'string' && session.market ? session.market : 'unknown';
    const completed = session.status === 'completed';
    const handoff = (Array.isArray(session.escalations) && session.escalations.some((item) => !item.resolved_at))
      || session.outcome === 'human_handoff_requested';
    const turns = Array.isArray(session.turns) ? session.turns : [];
    const day = dayBuckets.get(new Date(created).toISOString().slice(0, 10));
    if (!marketBuckets.has(callMarket)) marketBuckets.set(callMarket, { market: callMarket, calls: 0, completed: 0, handoffs: 0 });
    const region = marketBuckets.get(callMarket);
    for (const bucket of [totals, day, region]) {
      bucket.calls += 1;
      if (completed) bucket.completed += 1;
      if (handoff) bucket.handoffs += 1;
    }
    if (liveStatuses.has(session.status)) totals.active += 1;
    const ended = timestamp(session.ended_at);
    if (completed && Number.isFinite(ended) && ended >= created && ended <= end) durations.push(ended - created);

    for (const turn of turns) {
      if (turn?.role !== 'assistant') continue;
      totals.assistant_turns += 1;
      if (Array.isArray(turn.sources) && turn.sources.length > 0) totals.cited_turns += 1;
      if (typeof turn.latency_ms === 'number' && Number.isFinite(turn.latency_ms) && turn.latency_ms >= 0) {
        latencies.push(turn.latency_ms);
      }
    }
    recent.push({
      call_id: session.call_id, market: callMarket, status: session.status,
      created_at: session.created_at, ended_at: session.ended_at || null,
      outcome: session.outcome || null, turn_count: turns.length,
    });
  }

  latencies.sort((left, right) => left - right);
  Object.assign(totals, {
    citation_coverage_pct: totals.assistant_turns ? round(totals.cited_turns / totals.assistant_turns * 100) : null,
    avg_duration_ms: average(durations), duration_samples: durations.length,
    avg_latency_ms: average(latencies), p50_latency_ms: percentile(latencies, 0.5),
    p95_latency_ms: percentile(latencies, 0.95), latency_samples: latencies.length,
  });
  return {
    generated_at: new Date(end).toISOString(), filters: { days, market },
    window: { from: new Date(start).toISOString(), to: new Date(end).toISOString(), timezone: 'UTC' },
    totals, daily,
    markets: [...marketBuckets.values()].sort((left, right) => right.calls - left.calls || left.market.localeCompare(right.market)),
    recent_calls: recent.sort((left, right) => timestamp(right.created_at) - timestamp(left.created_at)
      || String(left.call_id).localeCompare(String(right.call_id))).slice(0, 5),
  };
}

/** Aggregate grounded guidance usage without treating operator interaction as correctness. */
export function buildGuidanceAnalytics(records, { days = 7, market = 'all', now = new Date() } = {}) {
  const end = new Date(now).getTime();
  const today = new Date(end);
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - (days - 1) * DAY_MS;
  const summary = {
    suggestions: 0,
    displayed: 0,
    applied: 0,
    edited: 0,
    dismissed: 0,
    expired: 0,
    active: 0,
    cited_suggestions: 0,
    feedback_count: 0,
    useful_count: 0,
    calls_with_guidance: 0,
    calls_with_handoff: 0,
    display_rate_pct: null,
    apply_rate_pct: null,
    edit_rate_pct: null,
    dismissal_rate_pct: null,
    citation_coverage_pct: null,
    feedback_response_pct: null,
    useful_feedback_pct: null,
    avg_generation_latency_ms: null,
    generation_latency_samples: 0,
    avg_decision_ms: null,
    decision_samples: 0,
    origins: { customer_turn: 0, operator_query: 0 },
    dismiss_reasons: [],
  };
  const latencies = [];
  const decisionTimes = [];
  const calls = new Map();
  const reasons = new Map();

  for (const record of records) {
    const nudge = record.nudge;
    const session = record.session;
    if (nudge?.type !== 'knowledge_tip') continue;
    const created = timestamp(nudge.created_at);
    if (!Number.isFinite(created) || created < start || created >= end) continue;
    if (market !== 'all' && session.market !== market) continue;
    summary.suggestions += 1;
    if (nudge.displayed_at) summary.displayed += 1;
    if (nudge.status === 'applied') summary.applied += 1;
    if (nudge.was_edited) summary.edited += 1;
    if (nudge.status === 'dismissed') summary.dismissed += 1;
    if (nudge.status === 'expired') summary.expired += 1;
    if (['created', 'displayed'].includes(nudge.status) && timestamp(nudge.expires_at) > end) summary.active += 1;
    if (Array.isArray(nudge.sources) && nudge.sources.length > 0) summary.cited_suggestions += 1;
    if (nudge.feedback) summary.feedback_count += 1;
    if (nudge.feedback === 'useful') summary.useful_count += 1;
    const origin = nudge.origin === 'operator_query' ? 'operator_query' : 'customer_turn';
    summary.origins[origin] += 1;
    if (typeof nudge.latency_ms === 'number' && Number.isFinite(nudge.latency_ms) && nudge.latency_ms > 0) {
      latencies.push(nudge.latency_ms);
    }
    const decisionAt = timestamp(nudge.applied_at || nudge.dismissed_at || (
      ['applied', 'dismissed'].includes(nudge.status) ? nudge.acted_at : null
    ));
    if (Number.isFinite(decisionAt) && decisionAt >= created) decisionTimes.push(decisionAt - created);
    if (nudge.status === 'dismissed') {
      const reason = nudge.dismiss_reason || 'unclassified';
      reasons.set(reason, (reasons.get(reason) || 0) + 1);
    }
    calls.set(session.call_id, session);
  }

  const callValues = [...calls.values()];
  summary.calls_with_guidance = callValues.length;
  summary.calls_with_handoff = callValues.filter((session) =>
    session.outcome === 'human_handoff_requested' || session.escalations?.some((item) => !item.resolved_at)
  ).length;
  Object.assign(summary, {
    display_rate_pct: summary.suggestions ? round(summary.displayed / summary.suggestions * 100) : null,
    apply_rate_pct: summary.suggestions ? round(summary.applied / summary.suggestions * 100) : null,
    edit_rate_pct: summary.applied ? round(summary.edited / summary.applied * 100) : null,
    dismissal_rate_pct: summary.suggestions ? round(summary.dismissed / summary.suggestions * 100) : null,
    citation_coverage_pct: summary.suggestions ? round(summary.cited_suggestions / summary.suggestions * 100) : null,
    feedback_response_pct: summary.suggestions ? round(summary.feedback_count / summary.suggestions * 100) : null,
    useful_feedback_pct: summary.feedback_count ? round(summary.useful_count / summary.feedback_count * 100) : null,
    avg_generation_latency_ms: average(latencies),
    generation_latency_samples: latencies.length,
    avg_decision_ms: average(decisionTimes),
    decision_samples: decisionTimes.length,
    dismiss_reasons: [...reasons.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason)),
  });
  return summary;
}

export function getAnalytics({ workspaceId, days = 7, market = 'all', now = new Date(), db = getDatabase() }) {
  // The database workspace column is authoritative, never a caller-supplied payload field.
  const sessions = db.prepare('SELECT id, status, ended_at, payload FROM calls WHERE workspace_id = ?')
    .all(workspaceId).map((row) => ({ ...JSON.parse(row.payload), call_id: row.id, status: row.status, ended_at: row.ended_at }));
  const report = buildAnalytics(sessions, { days, market, now });
  const hasNudges = db.prepare(
    "SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'nudges'",
  ).get();
  const guidanceRecords = hasNudges ? db.prepare(`
      SELECT n.payload AS nudge_payload, c.id AS call_id, c.status AS call_status,
        c.ended_at AS call_ended_at, c.payload AS call_payload
      FROM nudges n
      JOIN calls c ON c.id = n.call_id
      WHERE c.workspace_id = ?
    `).all(workspaceId).map((row) => ({
      nudge: JSON.parse(row.nudge_payload),
      session: {
        ...JSON.parse(row.call_payload),
        call_id: row.call_id,
        status: row.call_status,
        ended_at: row.call_ended_at,
      },
    })) : [];
  report.guidance = buildGuidanceAnalytics(guidanceRecords, { days, market, now });
  return report;
}

export function analyticsCsv(report) {
  const rows = ['date,calls,completed,handoffs', ...report.daily.map((day) =>
    `${day.date},${day.calls},${day.completed},${day.handoffs}`)];
  if (report.guidance) {
    rows.push(
      '',
      'guidance_metric,value',
      `suggestions,${report.guidance.suggestions}`,
      `displayed,${report.guidance.displayed}`,
      `applied,${report.guidance.applied}`,
      `edited,${report.guidance.edited}`,
      `dismissed,${report.guidance.dismissed}`,
      `expired,${report.guidance.expired}`,
      `feedback_count,${report.guidance.feedback_count}`,
      `useful_count,${report.guidance.useful_count}`,
      `generation_latency_samples,${report.guidance.generation_latency_samples}`,
      `decision_samples,${report.guidance.decision_samples}`,
    );
  }
  return rows.join('\r\n') + '\r\n';
}
