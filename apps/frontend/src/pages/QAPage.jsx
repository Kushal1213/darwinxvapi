import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  Download,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useWorkspaceAuth } from '../components/WorkspaceAuth';
import { MARKET_LABELS } from '../components/AnalyticsShared';
import { EmptyState, LoadingState, PageHeading, StatusBadge } from '../components/WorkspaceUI';

const newCriterion = () => ({ clientId: crypto.randomUUID(), label: '', description: '', weight: 1 });

async function request(path, options = {}) {
  const response = await fetch('/api/qa' + path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'QA workspace request failed.');
  return data;
}

function CriterionEditor({ criteria, onChange }) {
  return (
    <div className="space-y-3">
      {criteria.map((criterion, index) => (
        <div className="qa-criterion-editor" key={criterion.clientId}>
          <label>
            <span>Criterion {index + 1}</span>
            <input className="field" maxLength={180} required value={criterion.label} onChange={(event) => onChange(criteria.map((item) => item.clientId === criterion.clientId ? { ...item, label: event.target.value } : item))} />
          </label>
          <label>
            <span>Reviewer guidance</span>
            <input className="field" maxLength={1000} value={criterion.description} onChange={(event) => onChange(criteria.map((item) => item.clientId === criterion.clientId ? { ...item, description: event.target.value } : item))} />
          </label>
          <label>
            <span>Weight</span>
            <input className="field" type="number" min={1} max={10} required value={criterion.weight} onChange={(event) => onChange(criteria.map((item) => item.clientId === criterion.clientId ? { ...item, weight: Number(event.target.value) } : item))} />
          </label>
          <button type="button" className="icon-button" aria-label={`Remove criterion ${index + 1}`} disabled={criteria.length === 1} onClick={() => onChange(criteria.filter((item) => item.clientId !== criterion.clientId))}>
            <Trash2 size={15} />
          </button>
        </div>
      ))}
      <button type="button" className="btn" disabled={criteria.length >= 30} onClick={() => onChange([...criteria, newCriterion()])}>
        <Plus size={14} /> Add criterion
      </button>
    </div>
  );
}

export default function QAPage({ onReviewCall }) {
  const { user } = useWorkspaceAuth();
  const [rubrics, setRubrics] = useState([]);
  const [sample, setSample] = useState({ calls: [], total_eligible: 0 });
  const [report, setReport] = useState(null);
  const [filters, setFilters] = useState({ days: '30', market: 'all', outcome: 'all', handoff: 'all', missing_citation: 'all', review_state: 'all' });
  const [criteria, setCriteria] = useState(() => [newCriterion()]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async (signal) => {
    setLoading(true);
    try {
      const query = new URLSearchParams({ ...filters, limit: '25' });
      const reportQuery = new URLSearchParams({ days: filters.days, market: filters.market });
      const [rubricData, sampleData, reportData] = await Promise.all([
        request('/rubrics', { signal }),
        request(`/sample?${query}`, { signal }),
        request(`/report?${reportQuery}`, { signal }),
      ]);
      setRubrics(rubricData.rubrics || []);
      setSample(sampleData);
      setReport(reportData);
      setError('');
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (user.role !== 'admin') return undefined;
    const controller = new AbortController();
    refresh(controller.signal);
    return () => controller.abort();
  }, [refresh, user.role]);

  async function mutate(key, path, options = {}) {
    setBusy(key);
    setError('');
    try {
      const result = await request(path, options);
      await refresh();
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy('');
    }
  }

  if (user.role !== 'admin') {
    return (
      <section className="page">
        <PageHeading eyebrow="Human review" title="QA & Coaching" description="Apply evidence-linked manual reviews before considering automated scoring." />
        <div className="panel"><EmptyState icon={ClipboardCheck} title="Administrator access required">Pilot QA review remains admin-only until a customer approves a dedicated reviewer role.</EmptyState></div>
      </section>
    );
  }

  return (
    <section className="page">
      <PageHeading
        eyebrow="Human review"
        title="QA & Coaching"
        description="Sample completed calls deterministically, score an immutable rubric, and retain evidence-linked findings and coaching history. No AI score is generated."
        actions={<button type="button" className="btn" disabled={loading || Boolean(busy)} onClick={() => refresh()}><RefreshCw size={14} />Refresh</button>}
      />
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {report && (
        <dl className="metrics-strip stats-three">
          <div className="metric"><dt className="metric-label">Completed reviews</dt><dd className="metric-value">{report.sample_size}</dd><p className="metric-note">{report.reviewed_calls} calls · {report.reviewer_count} reviewers</p></div>
          <div className="metric"><dt className="metric-label">Weighted score</dt><dd className="metric-value">{report.score_rate == null ? '—' : `${Math.round(report.score_rate * 100)}%`}</dd><p className="metric-note">{report.score_possible ? `${report.score_earned} of ${report.score_possible} points` : 'No completed score denominator'}</p></div>
          <div className="metric"><dt className="metric-label">Reviewer agreement</dt><dd className="metric-value">{report.agreement_rate == null ? '—' : `${Math.round(report.agreement_rate * 100)}%`}</dd><p className="metric-note">{report.reviewer_pairs} comparable reviewer pairs</p></div>
        </dl>
      )}

      <section className="panel">
        <div className="panel-header">
          <div><h2 className="panel-title">Deterministic review sample</h2><p className="panel-description">The same filter set produces the same privacy-minimized ordering.</p></div>
          <a className="btn" href={`/api/qa/report?${new URLSearchParams({ days: filters.days, market: filters.market, format: 'csv' })}`} download><Download size={14} />Export aggregate CSV</a>
        </div>
        <form className="qa-filter-grid" onSubmit={(event) => { event.preventDefault(); refresh(); }}>
          <label><span>Window</span><select className="field" value={filters.days} onChange={(event) => setFilters((current) => ({ ...current, days: event.target.value }))}><option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option></select></label>
          <label><span>Market</span><select className="field" value={filters.market} onChange={(event) => setFilters((current) => ({ ...current, market: event.target.value }))}><option value="all">All markets</option>{Object.entries(MARKET_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label><span>Outcome</span><select className="field" value={filters.outcome} onChange={(event) => setFilters((current) => ({ ...current, outcome: event.target.value }))}><option value="all">All outcomes</option><option value="completed">Completed</option><option value="human_handoff_requested">Handoff requested</option></select></label>
          <label><span>Handoff</span><select className="field" value={filters.handoff} onChange={(event) => setFilters((current) => ({ ...current, handoff: event.target.value }))}><option value="all">Either</option><option value="yes">Yes</option><option value="no">No</option></select></label>
          <label><span>Missing citation</span><select className="field" value={filters.missing_citation} onChange={(event) => setFilters((current) => ({ ...current, missing_citation: event.target.value }))}><option value="all">Either</option><option value="yes">Yes</option><option value="no">No</option></select></label>
          <label><span>Review state</span><select className="field" value={filters.review_state} onChange={(event) => setFilters((current) => ({ ...current, review_state: event.target.value }))}><option value="all">Any</option><option value="unreviewed">Unreviewed</option><option value="completed">Completed</option></select></label>
          <button className="btn btn-primary" disabled={loading}>Apply filters</button>
        </form>
        {loading && sample.calls.length === 0 ? <LoadingState label="Loading QA sample" rows={4} /> : sample.calls.length === 0 ? (
          <EmptyState compact icon={ClipboardCheck} title="No eligible calls">Complete calls or broaden the current sample filters.</EmptyState>
        ) : (
          <div className="data-table overflow-x-auto mt-5">
            <table><caption className="sr-only">Deterministic QA sample</caption><thead><tr><th>Call</th><th>Market</th><th>Signals</th><th>Reviews</th><th className="relative"><span className="sr-only">Action</span></th></tr></thead>
              <tbody>{sample.calls.map((call) => (
                <tr key={call.call_id}>
                  <td><button type="button" className="text-action text-left break-all" onClick={() => onReviewCall(call.call_id)}>{call.call_id}</button><p className="text-[10px] text-muted mt-1">{new Date(call.ended_at).toLocaleString()}</p></td>
                  <td>{MARKET_LABELS[call.market] || call.market}</td>
                  <td><div className="flex flex-wrap gap-2">{call.handoff && <StatusBadge tone="warning">Handoff</StatusBadge>}{call.missing_citation && <StatusBadge tone="error">Missing citation</StatusBadge>}{!call.handoff && !call.missing_citation && <StatusBadge>Routine</StatusBadge>}</div></td>
                  <td>{call.completed_review_count} completed</td>
                  <td><button type="button" className="btn" disabled={Boolean(busy) || !rubrics.some((rubric) => rubric.status === 'active')} onClick={async () => { const result = await mutate(`review-${call.call_id}`, '/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ call_id: call.call_id }) }); if (result) onReviewCall(call.call_id); }}>{busy === `review-${call.call_id}` ? 'Opening…' : 'Review call'}</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <p className="text-[10px] text-muted mt-4">Showing {sample.calls.length} of {sample.total_eligible} eligible calls. Transcript content is excluded from this sample and aggregate export.</p>
      </section>

      <div className="grid xl:grid-cols-[minmax(320px,0.9fr)_minmax(0,1.4fr)] gap-5 items-start">
        <form className="form-panel space-y-5" onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          const values = Object.fromEntries(new FormData(form));
          const result = await mutate('create-rubric', '/rubrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: values.name, version: values.version, description: values.description, criteria: criteria.map(({ label, description, weight }) => ({ label, description, weight })) }) });
          if (result) { form.reset(); setCriteria([newCriterion()]); }
        }}>
          <div><h2 className="panel-title">Create immutable rubric version</h2><p className="panel-description">A version cannot be edited. Create and activate a new version when expectations change.</p></div>
          <label><span>Name</span><input className="field" name="name" required maxLength={180} placeholder="Inbound loan support QA" /></label>
          <label><span>Version</span><input className="field" name="version" required maxLength={50} pattern="[A-Za-z0-9][A-Za-z0-9._-]*" placeholder="2026.1" /></label>
          <label><span>Purpose and scope</span><textarea className="field" name="description" required maxLength={2000} rows={3} /></label>
          <CriterionEditor criteria={criteria} onChange={setCriteria} />
          <button className="btn btn-primary" disabled={Boolean(busy)}><Plus size={14} />Create draft version</button>
        </form>

        <section className="panel">
          <div className="panel-header"><div><h2 className="panel-title">Rubric versions</h2><p className="panel-description">Activating a draft retires the currently active version. Historical review snapshots remain unchanged.</p></div></div>
          {rubrics.length === 0 ? <EmptyState compact icon={ClipboardCheck} title="No rubric versions">Create a manual rubric to begin QA review.</EmptyState> : (
            <div className="space-y-4">{rubrics.map((rubric) => (
              <article className="qa-rubric-card" key={rubric.id}>
                <div className="flex justify-between items-start gap-3"><div><h3>{rubric.name} <span className="text-muted">v{rubric.version}</span></h3><p>{rubric.description}</p></div><StatusBadge tone={rubric.status === 'active' ? 'success' : rubric.status === 'draft' ? 'accent' : 'neutral'}>{rubric.status}</StatusBadge></div>
                <p className="text-[10px] text-muted">{rubric.criteria.length} criteria · {rubric.completed_review_count} completed reviews</p>
                <div className="flex flex-wrap gap-2">
                  {rubric.status === 'draft' && <button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={() => window.confirm(`Activate ${rubric.name} ${rubric.version}? The current active version will be retired.`) && mutate(`activate-${rubric.id}`, `/rubrics/${rubric.id}/activate`, { method: 'POST' })}><CheckCircle2 size={14} />Activate</button>}
                  {rubric.status === 'active' && <button type="button" className="btn btn-danger" disabled={Boolean(busy)} onClick={() => { const reason = window.prompt('Why is this rubric being retired?'); if (reason) mutate(`retire-${rubric.id}`, `/rubrics/${rubric.id}/retire`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) }); }}>Retire</button>}
                </div>
              </article>
            ))}</div>
          )}
        </section>
      </div>
    </section>
  );
}
