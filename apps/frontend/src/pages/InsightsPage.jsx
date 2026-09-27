import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, MessageSquare, Radio, RefreshCw } from 'lucide-react';
import { io } from 'socket.io-client';
import NudgeFeed from '../components/NudgeFeed';
import {
  EmptyState,
  LoadingState,
  PageHeading,
  StatusBadge,
} from '../components/WorkspaceUI';

export default function InsightsPage() {
  const [selectedStream, setSelectedStream] = useState(null);
  const [liveCalls, setLiveCalls] = useState({});
  const [connection, setConnection] = useState('connecting');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState(null);
  const requestRef = useRef(0);
  const refreshLiveCalls = useCallback(async () => {
    const request = ++requestRef.current;
    try {
      const response = await fetch('/api/voice/live', {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok)
        throw new Error('Live calls are unavailable. Refresh to try again.');
      const data = await response.json();
      if (request !== requestRef.current) return;
      const calls = Array.isArray(data.calls) ? data.calls : [];
      const callsById = Object.fromEntries(
        calls.map((call) => [call.id, call])
      );
      setLiveCalls(callsById);
      setSelectedStream((selected) =>
        selected && callsById[selected] ? selected : calls[0]?.id || null
      );
      setError('');
      setUpdated(new Date());
    } catch (err) {
      if (request === requestRef.current)
        setError(
          err.name === 'TimeoutError'
            ? 'Live calls took too long to load. Refresh to try again.'
            : err.message === 'Failed to fetch'
              ? 'Live calls could not be loaded. Check your connection and refresh.'
              : err.message
        );
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    refreshLiveCalls();
    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });
    socket.on('connect', () => {
      setConnection('connected');
      refreshLiveCalls();
    });
    socket.on('disconnect', () => setConnection('disconnected'));
    socket.on('connect_error', () => setConnection('disconnected'));
    socket.on('insights:call:update', ({ call }) => {
      if (!call?.id) return;
      setLiveCalls((previous) => ({ ...previous, [call.id]: call }));
      setSelectedStream((selected) => selected || call.id);
      setUpdated(new Date());
    });
    socket.on('insights:call:ended', ({ call_id: id }) => {
      setLiveCalls((previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      });
      setSelectedStream((selected) => (selected === id ? null : selected));
      setUpdated(new Date());
    });
    return () => {
      requestRef.current += 1;
      socket.disconnect();
    };
  }, [refreshLiveCalls]);
  const streams = Object.values(liveCalls).sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
  const call = streams.find((item) => item.id === selectedStream) || streams[0];
  const frustration =
    typeof call?.frustration === 'number'
      ? Math.max(0, Math.min(1, call.frustration))
      : null;
  return (
    <div className="page">
      <PageHeading
        eyebrow="Listen. Understand. Act."
        title="Live Insights"
        description="Follow active conversations and focus on the signals that need attention."
        actions={
          <>
            <StatusBadge
              tone={connection === 'connected' ? 'success' : 'warning'}
            >
              {connection === 'connected'
                ? 'Connected'
                : connection === 'connecting'
                  ? 'Connecting'
                  : 'Reconnecting'}
            </StatusBadge>
            <button
              className="btn"
              disabled={loading}
              onClick={refreshLiveCalls}
            >
              <RefreshCw size={14} />
              Refresh
            </button>
          </>
        }
      />
      {error && (
        <p role="alert" className="notice notice-error">
          {error} {updated && 'The last available snapshot is shown below.'}
        </p>
      )}
      {connection === 'disconnected' && (
        <p role="status" className="notice notice-warning">
          Live updates are paused while the connection recovers. The displayed
          snapshot may be out of date.
        </p>
      )}
      <div className="flex flex-wrap gap-4 justify-between text-[11px] text-muted">
        <span className="flex items-center gap-2">
          <Radio size={14} />
          <strong className="text-[var(--ink)]">{streams.length}</strong> active
          conversations
        </span>
        {updated && <span>Last update {updated.toLocaleTimeString()}</span>}
      </div>
      <div className="insights-layout">
        <section
          className="panel !p-0 overflow-hidden"
          aria-label="Active call streams"
        >
          <div className="p-5 border-b">
            <h2 className="panel-title">Call streams</h2>
            <p className="panel-description">Select a conversation to follow</p>
          </div>
          {loading ? (
            <div className="px-5">
              <LoadingState label="Loading live calls" />
            </div>
          ) : !streams.length ? (
            <EmptyState
              compact
              icon={Radio}
              title={error ? 'Streams unavailable' : 'No active conversations'}
            >
              {error
                ? 'Refresh to try loading the call queue again.'
                : 'Start a conversation in Voice Studio. It will appear here automatically.'}
            </EmptyState>
          ) : (
            streams.map((stream) => (
              <button
                key={stream.id}
                className={`stream-button ${call?.id === stream.id ? 'selected' : ''}`}
                aria-pressed={call?.id === stream.id}
                onClick={() => setSelectedStream(stream.id)}
              >
                <span className="flex justify-between items-center gap-2">
                  <strong className="text-xs">
                    {stream.customer || 'Customer'}
                  </strong>
                  {stream.complianceRisk && (
                    <AlertTriangle
                      size={14}
                      className="text-[var(--warning)]"
                    />
                  )}
                </span>
                <span className="block text-[10px] text-muted mt-2">
                  {stream.market} · {stream.agent}
                </span>
                <span className="block text-xs mt-3">
                  {stream.intent || 'Awaiting intent'}
                </span>
                <span className="block text-[10px] text-muted mt-3">
                  {stream.sentiment || 'Sentiment unavailable'}
                </span>
              </button>
            ))
          )}
        </section>
        <div className="space-y-5">
          {!call ? (
            <section className="panel">
              <EmptyState
                icon={MessageSquare}
                title="A clearer picture, as it happens"
              >
                Select an active conversation to read the latest exchange,
                inspect signals, and review recommended actions.
              </EmptyState>
            </section>
          ) : (
            <>
              <section className="panel" aria-label="Selected conversation">
                <div className="panel-header">
                  <div>
                    <h2 className="panel-title">
                      {call.customer || 'Customer conversation'}
                    </h2>
                    <p className="panel-description">
                      {call.market} · {call.agent}
                    </p>
                  </div>
                  <StatusBadge
                    tone={connection === 'connected' ? 'success' : 'warning'}
                  >
                    {connection === 'connected' ? 'Live' : 'Last snapshot'}
                  </StatusBadge>
                </div>
                <div className="space-y-5">
                  <div>
                    <p className="eyebrow !mb-2">Customer</p>
                    <p className="message-content">
                      {call.query || 'Waiting for the customer transcript…'}
                    </p>
                  </div>
                  <div>
                    <p className="eyebrow !mb-2">Agent response</p>
                    <p className="message-content">
                      {call.answer || 'Waiting for the agent response…'}
                    </p>
                  </div>
                </div>
                {call.complianceRisk && (
                  <div className="notice notice-warning mt-5">
                    <p className="font-semibold flex items-center gap-2">
                      <AlertTriangle size={15} />
                      Review this conversation
                    </p>
                    <p className="mt-2">
                      {call.complianceRule || 'A risk signal was detected.'}{' '}
                      Review the transcript and operator nudges before acting.
                    </p>
                  </div>
                )}
              </section>
              <div className="detail-pair">
                <div className="signal-tile">
                  <p className="text-[10px] text-muted">Frustration signal</p>
                  <p className="text-xl font-semibold tabular-nums mt-2">
                    {frustration == null
                      ? 'Not measured'
                      : `${Math.round(frustration * 100)}%`}
                  </p>
                  <p className="text-[10px] text-muted mt-2">
                    Automated indicator; verify against the conversation.
                  </p>
                </div>
                <div className="signal-tile">
                  <p className="text-[10px] text-muted">Buying intent</p>
                  <p className="text-base font-semibold mt-2">
                    {call.buyingSignal == null
                      ? 'Not available'
                      : call.buyingSignal
                        ? 'Signal detected'
                        : 'No signal detected'}
                  </p>
                  <p className="text-[10px] text-muted mt-2">
                    Recorded signal, not a confirmed customer decision.
                  </p>
                </div>
              </div>
            </>
          )}
          <section className="panel">
            <NudgeFeed callId={call?.id || null} />
          </section>
        </div>
      </div>
    </div>
  );
}
