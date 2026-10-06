import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';

import { EmptyState, LoadingState, StatusBadge } from './WorkspaceUI';

const tone = { open: 'warning', reopened: 'error', triaged: 'accent', planned: 'accent', resolved: 'success' };
const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

async function request(path = '', options) {
  const response = await fetch(`/api/knowledge/gaps${path}`, {
    headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Knowledge gaps are unavailable.');
  return data;
}

export default function KnowledgeGapsPanel({ canManage, documents }) {
  const [scope, setScope] = useState('active');
  const [gaps, setGaps] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [note, setNote] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function refresh() {
    try {
      const data = await request(`?status=${scope}`);
      setGaps(data.gaps || []);
      setSelectedId((current) => data.gaps?.some((gap) => gap.id === current)
        ? current : data.gaps?.[0]?.id || null);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    setLoading(true);
    refresh();
  }, [scope]);

  const selected = gaps.find((gap) => gap.id === selectedId) || gaps[0];
  const published = documents.filter((doc) => doc.status === 'indexed');
  async function update(status) {
    setBusy(true);
    setError('');
    try {
      await request(`/${selected.id}/actions`, {
        method: 'POST',
        body: JSON.stringify({ status, note, document_id: status === 'resolved' ? documentId : undefined }),
      });
      setNote('');
      setDocumentId('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel space-y-4" aria-label="Knowledge gap inbox">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">Knowledge gaps</h2>
          <p className="panel-description">Repeated unsupported questions, grouped by market and product.</p>
        </div>
        <div className="flex gap-2">
          <button className={`btn ${scope === 'active' ? 'btn-primary' : ''}`} onClick={() => setScope('active')}>Active</button>
          <button className={`btn ${scope === 'all' ? 'btn-primary' : ''}`} onClick={() => setScope('all')}>All</button>
          <button className="icon-button" aria-label="Refresh knowledge gaps" onClick={refresh}><RefreshCw size={15} /></button>
        </div>
      </div>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {loading ? <LoadingState label="Loading knowledge gaps" /> : !gaps.length ? (
        <EmptyState compact icon={CheckCircle2} title="No matching knowledge gaps">
          Retrieval abstentions will appear here; greetings and human requests are excluded.
        </EmptyState>
      ) : (
        <div className="grid lg:grid-cols-[minmax(0,1fr)_minmax(280px,.8fr)] gap-5">
          <div className="table-scroll">
            <table className="data-table">
              <thead><tr><th>Question</th><th>Scope</th><th>Seen</th><th>Status</th></tr></thead>
              <tbody>{gaps.map((gap) => (
                <tr key={gap.id} className={selected?.id === gap.id ? 'bg-[var(--surface-soft)]' : ''}>
                  <td><button className="text-left" onClick={() => { setSelectedId(gap.id); setNote(''); setDocumentId(''); }}><strong>{gap.question_excerpt}</strong><span className="block text-xs text-muted mt-1">Last seen {date.format(new Date(gap.last_seen_at))}</span></button></td>
                  <td>{gap.market} · {gap.product}</td>
                  <td>{gap.occurrence_count}</td>
                  <td><StatusBadge tone={tone[gap.status] || 'neutral'}>{gap.status.replaceAll('_', ' ')}</StatusBadge></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          <div className="signal-tile space-y-4">
            <div className="flex justify-between gap-3">
              <div><p className="eyebrow">Triage</p><h3 className="font-semibold mt-1">{selected.question_excerpt}</h3></div>
              <AlertCircle size={18} className="text-[var(--warning)] shrink-0" />
            </div>
            <p className="text-sm text-muted">Reason: {selected.reason.replaceAll('_', ' ')} · Example calls: {selected.example_call_ids.join(', ')}</p>
            {selected.resolution_note && <p className="notice notice-success">{selected.resolution_note}</p>}
            {canManage && !['resolved', 'out_of_scope'].includes(selected.status) && <>
              <label className="text-sm space-y-2 block"><span>Decision note</span><textarea rows={3} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Required when closing a gap." /></label>
              <label className="text-sm space-y-2 block"><span>Published revision for verified resolution</span><select className="field" value={documentId} onChange={(event) => setDocumentId(event.target.value)}><option value="">Choose a published revision</option>{published.map((doc) => <option key={doc.id} value={doc.id}>{doc.title} · revision {doc.revision}</option>)}</select></label>
              <div className="flex flex-wrap gap-2">
                <button className="btn" disabled={busy} onClick={() => update('triaged')}>Mark triaged</button>
                <button className="btn" disabled={busy} onClick={() => update('planned')}>Plan content</button>
                <button className="btn" disabled={busy || !note.trim()} onClick={() => update('out_of_scope')}>Out of scope</button>
                <button className="btn btn-primary" disabled={busy || !note.trim() || !documentId} onClick={() => update('resolved')}>Resolve with revision</button>
              </div>
            </>}
          </div>
        </div>
      )}
    </section>
  );
}
