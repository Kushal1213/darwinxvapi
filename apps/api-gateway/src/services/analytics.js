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
    const handoff = (Array.isArray(session.escalations) && session.escalations.length > 0)
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

export function getAnalytics({ workspaceId, days = 7, market = 'all', now = new Date(), db = getDatabase() }) {
  // The database workspace column is authoritative, never a caller-supplied payload field.
  const sessions = db.prepare('SELECT id, status, ended_at, payload FROM calls WHERE workspace_id = ?')
    .all(workspaceId).map((row) => ({ ...JSON.parse(row.payload), call_id: row.id, status: row.status, ended_at: row.ended_at }));
  return buildAnalytics(sessions, { days, market, now });
}

export function analyticsCsv(report) {
  return ['date,calls,completed,handoffs', ...report.daily.map((day) =>
    `${day.date},${day.calls},${day.completed},${day.handoffs}`)].join('\r\n') + '\r\n';
}
