import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Clock3, Inbox, RefreshCw, ShieldAlert } from 'lucide-react';
import { io } from 'socket.io-client';

import { EmptyState, LoadingState, PageHeading, StatusBadge } from '../components/WorkspaceUI';

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const stateTone = { delivered: 'warning', acknowledged: 'accent', resolved: 'success' };

async function handoffRequest(path = '', options) {
  const response = await fetch(`/api/handoffs${path}`, {
    signal: AbortSignal.timeout(10000),
    headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
    ...options,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'The handoff inbox is unavailable.');
  return data;
}

export default function HandoffInboxPage({ onReviewCall }) {
  const [filter, setFilter] = useState('open');
  const [handoffs, setHandoffs] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [resolution, setResolution] = useState('');

  const refresh = useCallback(async () => {
    try {
      const data = await handoffRequest(`?state=${filter}`);
      setHandoffs(data.handoffs || []);
      setSelectedId((current) => data.handoffs?.some((item) => item.id === current)
        ? current : data.handoffs?.[0]?.id || null);
      setError('');
    } catch (err) {
      setError(err.name === 'TimeoutError' ? 'The handoff inbox took too long to load.' : err.message);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    setLoading(true);
    refresh();
    const socket = io({ path: '/socket.io', transports: ['websocket', 'polling'] });
    socket.on('handoff:updated', refresh);
    return () => socket.disconnect();
  }, [refresh]);

  const selected = handoffs.find((item) => item.id === selectedId) || handoffs[0];
  const act = async (action) => {
    setBusy(true);
    setError('');
    try {
      await handoffRequest(`/${selected.id}/${action}`, {
        method: 'POST',
        body: JSON.stringify(action === 'resolve' ? { resolution } : {}),
      });
      setResolution('');
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeading
        eyebrow="Human assistance"
        title="Handoff Inbox"
        description="A durable queue for customer requests that need a person. Delivery here means the workspace inbox accepted the request; it does not mean a phone transfer occurred."
        actions={
          <button className="btn" disabled={loading} onClick={refresh}>
            <RefreshCw size={14} /> Refresh
          </button>
        }
      />
      {error && <p role="alert" className="notice notice-error">{error}</p>}
      <div className="flex flex-wrap gap-2" aria-label="Handoff filters">
        {['open', 'delivered', 'acknowledged', 'resolved', 'all'].map((value) => (
          <button
            key={value}
            className={`btn ${filter === value ? 'btn-primary' : ''}`}
            aria-pressed={filter === value}
            onClick={() => setFilter(value)}
          >
            {value === 'open' ? 'Open' : value[0].toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>
      {loading ? (
        <LoadingState label="Loading handoffs" rows={4} />
      ) : !handoffs.length ? (
        <section className="panel">
          <EmptyState icon={Inbox} title={filter === 'open' ? 'No open handoffs' : 'No matching handoffs'}>
            New human-assistance requests will be delivered here with their context and priority.
          </EmptyState>
        </section>
      ) : (
        <div className="insights-layout">
          <section className="panel !p-0 overflow-hidden" aria-label="Handoff queue">
            <div className="p-5 border-b">
              <h2 className="panel-title">Queue</h2>
              <p className="panel-description">{handoffs.length} shown</p>
            </div>
            {handoffs.map((handoff) => (
              <button
                key={handoff.id}
                className={`stream-button ${selected?.id === handoff.id ? 'selected' : ''}`}
                aria-pressed={selected?.id === handoff.id}
                onClick={() => { setSelectedId(handoff.id); setResolution(''); }}
              >
                <span className="flex justify-between items-center gap-2">
                  <strong className="text-xs">{handoff.escalation.customer_intent || 'Customer assistance'}</strong>
                  {handoff.priority === 'HIGH' && <ShieldAlert size={14} className="text-[var(--negative)]" />}
                </span>
                <span className="block text-xs mt-2 line-clamp-2">{handoff.escalation.reason}</span>
                <span className="block text-[10px] text-muted mt-3">{dateTime.format(new Date(handoff.requested_at))}</span>
              </button>
            ))}
          </section>
          <section className="panel" aria-label="Selected handoff">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Call {selected.call_id}</p>
                <h2 className="panel-title">{selected.escalation.reason}</h2>
              </div>
              <StatusBadge tone={stateTone[selected.state] || 'neutral'}>{selected.state}</StatusBadge>
            </div>
            <div className="detail-pair">
              <div className="signal-tile">
                <p className="text-[10px] text-muted">Priority</p>
                <p className="font-semibold mt-2">{selected.priority}</p>
              </div>
              <div className="signal-tile">
                <p className="text-[10px] text-muted">Destination</p>
                <p className="font-semibold mt-2">Internal workspace inbox</p>
              </div>
            </div>
            <div className="space-y-5 mt-5">
              <div>
                <p className="eyebrow !mb-2">Last customer message</p>
                <p className="message-content">{selected.escalation.last_customer_message || 'No customer message recorded.'}</p>
              </div>
              <div>
                <p className="eyebrow !mb-2">Conversation context</p>
                <p className="message-content whitespace-pre-wrap">{selected.escalation.conversation_summary || 'No summary recorded.'}</p>
              </div>
              {selected.escalation.missing_information?.length > 0 && (
                <p className="notice notice-warning">Missing details: {selected.escalation.missing_information.join(', ')}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-5">
              <button className="btn" onClick={() => onReviewCall(selected.call_id)}>Review call</button>
              {selected.state === 'delivered' && (
                <button className="btn btn-primary" disabled={busy} onClick={() => act('acknowledge')}>
                  <Clock3 size={14} /> Acknowledge
                </button>
              )}
            </div>
            {selected.state !== 'resolved' ? (
              <div className="mt-6 border-t pt-5">
                <label className="field-label" htmlFor="handoff-resolution">Resolution note</label>
                <textarea
                  id="handoff-resolution"
                  rows={3}
                  maxLength={1000}
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value)}
                  placeholder="Record what was done and the next action."
                />
                <button className="btn mt-3" disabled={busy || !resolution.trim()} onClick={() => act('resolve')}>
                  <CheckCircle2 size={14} /> Resolve handoff
                </button>
              </div>
            ) : (
              <div className="notice notice-success mt-5">
                <strong>Resolved</strong>
                <p className="mt-1">{selected.resolution}</p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
