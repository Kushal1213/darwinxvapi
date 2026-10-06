import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy, Play, RotateCcw, Sparkles, X, RefreshCw } from 'lucide-react';
import { io } from 'socket.io-client';
import { EmptyState, LoadingState } from './WorkspaceUI';

const isActive = (nudge) =>
  ['created', 'displayed'].includes(nudge.status) &&
  Date.parse(nudge.expires_at) > Date.now();
const GUIDANCE_DISMISS_OPTIONS = [
  ['not_relevant', 'Not relevant'],
  ['incorrect_or_unsupported', 'Incorrect or unsupported'],
  ['too_verbose', 'Too verbose'],
  ['already_answered', 'Already answered'],
  ['prefer_human', 'Prefer human assistance'],
  ['other', 'Other'],
];
const guidanceDismissLabel = (value) =>
  GUIDANCE_DISMISS_OPTIONS.find(([code]) => code === value)?.[1] || value;

export default function NudgeFeed({ callId = null, review = false, onApply = null, applyLabel = 'Use this reply', title = 'Operator nudges' }) {
  const [nudges, setNudges] = useState([]);
  const [view, setView] = useState(review ? 'all' : 'active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState({});
  const [revision, setRevision] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    let live = true;
    let sequence = 0;
    let controller;
    generation.current += 1;
    setNudges([]);
    setError('');
    setActionError('');
    setLoading(true);
    async function refresh() {
      const request = ++sequence;
      controller?.abort();
      controller = new AbortController();
      try {
        const response = await fetch(
          `/api/nudges${callId ? `?call_id=${encodeURIComponent(callId)}` : ''}`,
          { signal: controller.signal }
        );
        if (!response.ok)
          throw new Error('Nudges are unavailable. Please retry.');
        const data = await response.json();
        if (live && request === sequence) {
          setNudges(data.nudges);
          setError('');
        }
      } catch (err) {
        if (live && err.name !== 'AbortError') setError(err.message);
      } finally {
        if (live && request === sequence) setLoading(false);
      }
    }
    refresh();
    const timer = setInterval(refresh, 5000);
    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });
    socket.on('connect', refresh);
    socket.on('nudge', refresh);
    socket.on('nudge:updated', refresh);
    socket.on('insights:call:ended', refresh);
    return () => {
      live = false;
      generation.current += 1;
      controller?.abort();
      clearInterval(timer);
      socket.disconnect();
    };
  }, [callId, revision]);

  async function act(id, action, reason) {
    const current = generation.current;
    setBusy((previous) => ({ ...previous, [id]: true }));
    try {
      const response = await fetch(
        `/api/nudges/${encodeURIComponent(id)}/actions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
        }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || 'Could not save your response');
      if (current === generation.current) {
        setNudges((previous) =>
          previous.map((nudge) => (nudge.id === id ? data.nudge : nudge))
        );
        setActionError('');
      }
    } catch (err) {
      if (current === generation.current) setActionError(err.message);
    } finally {
      setBusy((previous) => ({ ...previous, [id]: false }));
    }
  }

  async function applyNudge(nudge, responseText) {
    if (!onApply) return;
    const current = generation.current;
    setBusy((previous) => ({ ...previous, [nudge.id]: true }));
    try {
      await onApply(nudge, responseText);
      if (current === generation.current) {
        setActionError('');
        setRevision((value) => value + 1);
      }
    } catch (err) {
      if (current === generation.current) setActionError(err.message);
    } finally {
      setBusy((previous) => ({ ...previous, [nudge.id]: false }));
    }
  }

  // Mark a nudge displayed only when its row is actually mounted in the feed.
  const visible = nudges.filter((nudge) => view === 'all' || isActive(nudge));
  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="panel-title">{title}</h2>
        <div className="flex items-center gap-3">
          <div role="group" aria-label="Nudge view" className="flex gap-1">
            {[
              ['active', 'Active'],
              ['all', 'Recent'],
            ].map(([value, label]) => (
              <button
                key={value}
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={`px-3 py-2 text-sm border-b-2 ${view === value ? 'border-[var(--accent)] text-accent' : 'border-transparent'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            aria-label="Refresh nudges"
            title="Refresh nudges"
            className="btn"
            onClick={() => setRevision((value) => value + 1)}
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </div>
      {loading && <LoadingState label="Loading nudges" rows={2} />}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {actionError && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {actionError}
        </p>
      )}
      {!loading && !error && visible.length === 0 && (
        <EmptyState
          compact
          icon={Check}
          title={
            view === 'active'
              ? 'Nothing needs your attention'
              : 'No nudges recorded'
          }
        >
          {view === 'active'
            ? 'Relevant recommendations will appear here as conversations develop.'
            : 'Recorded nudges and your responses will appear here.'}
        </EmptyState>
      )}
      <div className="space-y-3">
        {visible.map((nudge) => (
          <NudgeRow
            key={nudge.id}
            nudge={nudge}
            busy={busy[nudge.id]}
            onAction={act}
            onApply={onApply ? applyNudge : null}
            applyLabel={applyLabel}
            showCall={!callId}
          />
        ))}
      </div>
    </section>
  );
}

function NudgeRow({ nudge, busy, onAction, onApply, applyLabel, showCall }) {
  const displayed = useRef(false);
  const [draft, setDraft] = useState(nudge.applied_response || nudge.suggested_response || '');
  const [copyStatus, setCopyStatus] = useState('');
  const [dismissReason, setDismissReason] = useState('');
  useEffect(() => {
    if (nudge.status === 'created' && isActive(nudge) && !displayed.current) {
      displayed.current = true;
      onAction(nudge.id, 'displayed');
    }
  }, [nudge.id, nudge.status, onAction]);
  useEffect(() => {
    setDraft(nudge.applied_response || nudge.suggested_response || '');
    setCopyStatus('');
    setDismissReason('');
  }, [nudge.id, nudge.applied_response, nudge.suggested_response]);
  const active = isActive(nudge);
  const edited = Boolean(nudge.suggested_response) && draft.trim() !== nudge.suggested_response.trim();
  const status =
    ['created', 'displayed'].includes(nudge.status) && !active
      ? 'expired'
      : nudge.status;
  const border =
    nudge.priority === 'HIGH'
      ? 'border-red-500'
      : nudge.priority === 'MEDIUM'
        ? 'border-amber-500'
        : 'border-emerald-500';
  return (
    <article className={`border-l-2 ${border} pl-4 py-3 space-y-3 min-w-0`}>
      <div className="flex flex-wrap justify-between gap-2 text-xs text-muted">
        <span>
          {nudge.type.replaceAll('_', ' ')} / {nudge.priority} / {status}
        </span>
        <time>{new Date(nudge.created_at).toLocaleTimeString()}</time>
      </div>
      {showCall && (
        <p className="text-xs break-all text-muted">Call {nudge.call_id}</p>
      )}
      <p className="text-sm break-words">{nudge.text}</p>
      {nudge.dismiss_reason ? (
        <p className="text-xs text-muted">Dismissed because: {guidanceDismissLabel(nudge.dismiss_reason)}</p>
      ) : null}
      {nudge.type === 'knowledge_tip' && nudge.suggested_response && (
        <div className="signal-tile space-y-2">
          <p className="text-xs font-semibold flex items-center gap-2">
            <Sparkles size={14} className="text-accent" />
            {nudge.origin === 'operator_query' ? 'Private Ask Veyra result' : 'Suggested reply'}
          </p>
          {nudge.context_query && nudge.origin === 'operator_query' && (
            <p className="text-xs text-muted">Private question: {nudge.context_query}</p>
          )}
          {active && onApply ? (
            <label className="block text-xs text-muted">
              Review or edit before delivery
              <textarea
                value={draft}
                maxLength={8000}
                rows={5}
                disabled={busy}
                onChange={(event) => setDraft(event.target.value)}
                className="field mt-2 min-h-28 resize-y text-sm leading-6"
              />
              <span className="mt-1 flex justify-between gap-3 text-[10px]">
                <span>{edited ? 'Edited wording will be preserved with the original.' : 'Generated wording is unchanged.'}</span>
                <span>{draft.length}/8000</span>
              </span>
            </label>
          ) : (
            <p className="text-sm whitespace-pre-wrap break-words">
              {nudge.applied_response || nudge.suggested_response}
            </p>
          )}
          {!active && nudge.was_edited && (
            <details className="text-xs text-muted">
              <summary>View original generated reply</summary>
              <p className="mt-2 whitespace-pre-wrap">{nudge.suggested_response}</p>
            </details>
          )}
          {nudge.sources?.length > 0 && (
            <p className="text-[10px] text-muted">
              Grounded in {nudge.sources.map((source) => source.title || source.source || 'knowledge').join(', ')}
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-end gap-3">
        {active && (
          <>
            {nudge.type === 'knowledge_tip' && onApply ? (
              <>
                <button
                  disabled={busy || !draft.trim()}
                  onClick={() => onApply(nudge, draft.trim())}
                  className="btn btn-primary"
                >
                  <Play size={15} /> {applyLabel}
                </button>
                <button
                  disabled={busy || !draft.trim()}
                  onClick={async () => {
                    try {
                      if (!navigator.clipboard?.writeText) throw new Error('Clipboard access is unavailable');
                      await navigator.clipboard.writeText(draft.trim());
                      setCopyStatus('Copied');
                    } catch (_) {
                      setCopyStatus('Copy unavailable');
                    }
                  }}
                  className="btn"
                >
                  <Copy size={15} /> Copy
                </button>
                {edited && (
                  <button
                    disabled={busy}
                    onClick={() => setDraft(nudge.suggested_response)}
                    className="btn"
                  >
                    <RotateCcw size={15} /> Reset
                  </button>
                )}
                {copyStatus && <span role="status" className="text-xs text-muted">{copyStatus}</span>}
              </>
            ) : nudge.type !== 'knowledge_tip' ? (
              <button
                disabled={busy}
                aria-label="Acknowledge nudge"
                title="Acknowledge nudge"
                onClick={() => onAction(nudge.id, 'acknowledged')}
                className="p-2 border rounded-md border-[var(--accent)] text-accent disabled:opacity-40"
              >
                <Check size={18} />
              </button>
            ) : null}
            {nudge.type === 'knowledge_tip' ? (
              <div className="basis-full flex flex-wrap items-end gap-2">
                <label className="min-w-52 flex-1 text-xs text-muted">
                  Reason to dismiss this reply
                  <select
                    value={dismissReason}
                    disabled={busy}
                    onChange={(event) => setDismissReason(event.target.value)}
                    className="field mt-2"
                  >
                    <option value="">Select a reason</option>
                    {GUIDANCE_DISMISS_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <button
                  disabled={busy || !dismissReason}
                  onClick={() => onAction(nudge.id, 'dismissed', dismissReason)}
                  className="btn"
                >
                  <X size={15} /> Dismiss reply
                </button>
              </div>
            ) : (
              <button
                disabled={busy}
                aria-label="Dismiss nudge"
                title="Dismiss nudge"
                onClick={() => onAction(nudge.id, 'dismissed')}
                className="btn"
              >
                <X size={18} />
              </button>
            )}
          </>
        )}
        <label className="text-xs text-muted">
          Feedback
          <select
            aria-label="Nudge feedback"
            disabled={busy}
            value={nudge.feedback || ''}
            onChange={(event) => onAction(nudge.id, event.target.value)}
            className="field mt-2"
          >
            <option value="" disabled>
              Not rated
            </option>
            <option value="useful">Useful</option>
            <option value="not_useful">Not useful</option>
            <option value="wrong_signal">Wrong signal</option>
            <option value="too_late">Too late</option>
          </select>
        </label>
      </div>
    </article>
  );
}
