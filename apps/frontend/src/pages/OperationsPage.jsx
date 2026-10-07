import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Power, RefreshCw, ShieldCheck } from 'lucide-react';
import { useWorkspaceAuth } from '../components/WorkspaceAuth';
import { EmptyState, LoadingState, PageHeading, StatusBadge } from '../components/WorkspaceUI';

async function request(path, options = {}) {
  const response = await fetch('/api/operations' + path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Operational controls are unavailable.');
  return data;
}

export default function OperationsPage() {
  const { user } = useWorkspaceAuth();
  const [controls, setControls] = useState([]);
  const [events, setEvents] = useState([]);
  const [reasons, setReasons] = useState({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [controlData, eventData] = await Promise.all([
        request('/controls'),
        request('/events?limit=50'),
      ]);
      setControls(controlData.controls || []);
      setEvents(eventData.events || []);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user.role === 'admin') refresh();
  }, [refresh, user.role]);

  async function change(control) {
    const reason = reasons[control.key]?.trim() || '';
    if (reason.length < 8) {
      setError('Provide a reason of at least 8 characters before changing a capability.');
      return;
    }
    const enabled = !control.enabled;
    if (!window.confirm(`${enabled ? 'Restore' : 'Pause'} ${control.label}?\n\n${control.pausedEffect}`)) return;
    setBusyKey(control.key);
    setError('');
    try {
      await request(`/controls/${encodeURIComponent(control.key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, reason }),
      });
      setReasons((current) => ({ ...current, [control.key]: '' }));
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyKey('');
    }
  }

  if (user.role !== 'admin') {
    return (
      <section className="page">
        <PageHeading eyebrow="Release safety" title="Operations" description="Control high-impact product capabilities during incidents and staged releases." />
        <div className="panel"><EmptyState icon={ShieldCheck} title="Administrator access required">Ask a workspace administrator to review or change operational controls.</EmptyState></div>
      </section>
    );
  }

  const available = controls.filter((control) => control.available !== false);
  const paused = available.filter((control) => !control.enabled).length;
  return (
    <section className="page">
      <PageHeading
        eyebrow="Release safety"
        title="Operations"
        description="Pause risky capabilities without disabling authenticated review, call history, human handoff, or knowledge withdrawal. Every change is attributed and reasoned."
        actions={<button className="btn" onClick={refresh} disabled={loading || Boolean(busyKey)}><RefreshCw size={14} />Refresh</button>}
      />
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      <div className={`notice ${paused ? 'notice-warning' : ''}`} role="status">
        <strong>{paused ? `${paused} operational restriction${paused === 1 ? '' : 's'} active` : 'All configured capabilities are available'}</strong>
        <p className="mt-1 text-muted">Controls are enforced by the gateway and durable knowledge worker, not only by this screen.</p>
      </div>
      {loading && controls.length === 0 ? <LoadingState label="Loading operational controls" rows={4} /> : (
        <div className="operations-grid">
          {controls.map((control) => (
            <article className={`operation-card ${!control.enabled && control.available !== false ? 'is-paused' : ''}`} key={control.key}>
              <div className="operation-card-header">
                <div>
                  <h2>{control.label}</h2>
                  <p>{control.description}</p>
                </div>
                <StatusBadge tone={control.available === false ? 'neutral' : control.enabled ? 'success' : 'warning'}>
                  {control.available === false ? 'Not configured' : control.enabled ? 'Available' : 'Paused'}
                </StatusBadge>
              </div>
              <p className="operation-effect"><AlertTriangle size={14} aria-hidden="true" />{control.pausedEffect}</p>
              {control.available === false ? (
                <p className="text-muted text-xs">A connector adapter and delivery contract must be configured before this control can be activated.</p>
              ) : (
                <>
                  <label className="operation-reason">
                    <span>Reason for {control.enabled ? 'pausing' : 'restoring'}</span>
                    <textarea
                      className="field"
                      rows={2}
                      maxLength={1000}
                      value={reasons[control.key] || ''}
                      placeholder="Describe the incident, rollout, or verification result."
                      onChange={(event) => setReasons((current) => ({ ...current, [control.key]: event.target.value }))}
                    />
                  </label>
                  <div className="operation-actions">
                    <button type="button" className={control.enabled ? 'btn btn-danger' : 'btn btn-primary'} disabled={Boolean(busyKey)} onClick={() => change(control)}>
                      <Power size={14} />{busyKey === control.key ? 'Applying…' : control.enabled ? 'Pause capability' : 'Restore capability'}
                    </button>
                    <small>v{control.version} · {control.changed_at ? new Date(control.changed_at).toLocaleString() : 'No changes yet'}</small>
                  </div>
                  {!control.enabled && <p className="operation-current-reason"><strong>Active reason:</strong> {control.reason}</p>}
                </>
              )}
            </article>
          ))}
        </div>
      )}
      <section className="panel">
        <div className="panel-header"><div><h2 className="panel-title">Control audit trail</h2><p className="panel-description">Most recent state changes, newest first.</p></div></div>
        {events.length === 0 ? <EmptyState compact icon={ShieldCheck} title="No control changes yet">The baseline state is recorded on each control. Human changes will appear here.</EmptyState> : (
          <div className="data-table overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead><tr><th className="py-3 pr-4">Capability</th><th className="py-3 pr-4">Change</th><th className="py-3 pr-4">Reason</th><th className="py-3">Actor / time</th></tr></thead>
              <tbody>{events.map((event) => (
                <tr key={event.id}>
                  <td className="py-4 pr-4">{controls.find((item) => item.key === event.control_key)?.label || event.control_key}</td>
                  <td className="py-4 pr-4 capitalize">{event.action}</td>
                  <td className="py-4 pr-4 max-w-md">{event.reason}</td>
                  <td className="py-4 text-muted whitespace-nowrap">{event.actor_email || 'System'}<br />{new Date(event.created_at).toLocaleString()}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
