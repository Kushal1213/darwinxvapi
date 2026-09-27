import React, { useEffect, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BookOpen,
  Clock,
  Headphones,
  Phone,
  RefreshCw,
} from 'lucide-react';
import { useWorkspaceAuth } from '../components/WorkspaceAuth';
import {
  MARKET_LABELS,
  MetricCard,
  formatDuration,
  useAnalytics,
} from '../components/AnalyticsShared';
import {
  EmptyState,
  LoadingState,
  PageHeading,
  StatusBadge,
  TextAction,
} from '../components/WorkspaceUI';
const services = {
  gateway: 'Workspace gateway',
  rag: 'Knowledge retrieval',
  ingestion: 'Document processing',
  realtime: 'Live insights',
};
const shortcuts = [
  {
    tab: 'agents',
    title: 'Start a conversation',
    text: 'Put your knowledge to work',
    icon: Phone,
  },
  {
    tab: 'knowledge',
    title: 'Manage knowledge',
    text: 'Review, publish, and refine',
    icon: BookOpen,
  },
  {
    tab: 'insights',
    title: 'Follow live activity',
    text: 'Signals that need your attention',
    icon: Activity,
  },
];
function ServiceHealth({ revision }) {
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('timeout'), 10000);
    setHealth(null);
    setError('');
    fetch('/api/health', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            'Service health is unavailable. Refresh to try again.'
          );
        return response.json();
      })
      .then((result) => {
        if (!controller.signal.aborted) setHealth(result);
      })
      .catch((err) => {
        if (controller.signal.reason === 'timeout')
          setError('Service health took too long. Refresh to try again.');
        else if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [revision]);
  return (
    <section className="panel" aria-label="Service health">
      <div className="panel-header">
        <div>
          <h2 className="panel-title">System availability</h2>
          <p className="panel-description">
            The services behind your workspace
          </p>
        </div>
        <Activity size={17} className="text-muted" />
      </div>
      {error ? (
        <p role="alert" className="notice notice-error">
          {error}
        </p>
      ) : !health ? (
        <LoadingState label="Checking services" rows={4} />
      ) : (
        <>
          <dl>
            {Object.entries(services).map(([key, label]) => (
              <div
                key={key}
                className="flex items-center justify-between gap-3 py-4 border-t"
              >
                <dt className="text-xs">{label}</dt>
                <dd>
                  <StatusBadge
                    tone={
                      health.services?.[key]?.status === 'ok'
                        ? 'success'
                        : 'warning'
                    }
                  >
                    {health.services?.[key]?.status === 'ok'
                      ? 'Available'
                      : 'Unavailable'}
                  </StatusBadge>
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-[10px] text-muted leading-5 mt-4">
            Checked {new Date(health.timestamp).toLocaleTimeString()}.
            Availability does not measure answer quality.
          </p>
        </>
      )}
    </section>
  );
}
export default function DashboardPage({ setActiveTab, onReviewCall }) {
  const { workspace } = useWorkspaceAuth();
  const { data, loading, error, refresh } = useAnalytics({ days: 7 });
  const [healthRevision, setHealthRevision] = useState(0);
  return (
    <div className="page">
      <PageHeading
        eyebrow="Your workspace, at a glance"
        title="Workspace overview"
        description={`Welcome to ${workspace.name}. Every conversation adds to the picture.`}
        actions={
          <>
            <button
              className="btn"
              disabled={loading}
              onClick={() => {
                refresh();
                setHealthRevision((value) => value + 1);
              }}
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            <button
              className="btn btn-primary"
              onClick={() => setActiveTab('agents')}
            >
              <Phone size={14} />
              Voice Studio
              <ArrowUpRight size={14} />
            </button>
          </>
        }
      />
      <section aria-label="Conversation overview" aria-busy={loading}>
        <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
          <p className="section-label">
            Activity summary{' '}
            <span className="text-muted font-normal">/ Last 7 days · UTC</span>
          </p>
          {data && (
            <p className="text-[10px] text-muted">
              Updated {new Date(data.generated_at).toLocaleTimeString()}
            </p>
          )}
        </div>
        {loading && (
          <div className="panel">
            <LoadingState label="Loading recorded activity" rows={2} />
          </div>
        )}
        {error && (
          <div role="alert" className="notice notice-error">
            {error}{' '}
            <button className="underline ml-2" onClick={refresh}>
              Retry analytics
            </button>
          </div>
        )}
        {data && (
          <div className="metrics-strip">
            <MetricCard
              label="Conversations"
              value={data.totals.calls.toLocaleString()}
              detail={`${data.totals.completed} completed · ${data.totals.active} open`}
              icon={Phone}
              flat
            />
            <MetricCard
              label="Handoff requests"
              value={data.totals.handoffs.toLocaleString()}
              detail="Requested; transfer not confirmed"
              icon={Headphones}
              flat
            />
            <MetricCard
              label="Avg. session duration"
              value={formatDuration(data.totals.avg_duration_ms)}
              detail={`${data.totals.duration_samples} recorded sessions`}
              icon={Clock}
              flat
            />
            <MetricCard
              label="Replies with citations"
              value={`${data.totals.cited_turns} / ${data.totals.assistant_turns}`}
              detail="Source presence, not answer quality"
              icon={BookOpen}
              flat
            />
          </div>
        )}
      </section>
      <div className="overview-grid">
        <section className="panel" aria-label="Recent conversations">
          <div className="panel-header">
            <div>
              <h2 className="panel-title">Recent conversations</h2>
              <p className="panel-description">
                Your latest activity in the last 7 days
              </p>
            </div>
            <TextAction onClick={() => setActiveTab('history')}>
              View all
            </TextAction>
          </div>
          {loading && <LoadingState label="Loading conversations" />}
          {error && (
            <p className="notice">Recent conversations are unavailable.</p>
          )}
          {data &&
            (data.recent_calls.length ? (
              <ul>
                {data.recent_calls.map((call) => (
                  <li key={call.call_id}>
                    <button
                      className="activity-row"
                      onClick={() => onReviewCall(call.call_id)}
                    >
                      <span className="row-icon">
                        <Phone size={15} />
                      </span>
                      <span className="flex-1 min-w-0">
                        <strong className="text-xs block font-semibold">
                          {MARKET_LABELS[call.market] ||
                            call.market ||
                            'Unknown market'}
                        </strong>
                        <span
                          className="text-[10px] text-muted block truncate mt-1"
                          title={call.call_id}
                        >
                          {call.call_id}
                        </span>
                      </span>
                      <span className="text-right">
                        <StatusBadge
                          tone={
                            call.outcome === 'human_handoff_requested' ||
                            call.status === 'escalated'
                              ? 'warning'
                              : 'neutral'
                          }
                        >
                          {call.outcome === 'human_handoff_requested' ||
                          call.status === 'escalated'
                            ? 'Handoff requested'
                            : call.status === 'completed'
                              ? 'Completed'
                              : 'Open'}
                        </StatusBadge>
                        <time
                          className="text-[10px] text-muted block mt-2"
                          dateTime={call.created_at}
                        >
                          {new Date(call.created_at).toLocaleDateString(
                            undefined,
                            { month: 'short', day: 'numeric' }
                          )}
                        </time>
                      </span>
                      <ArrowUpRight size={14} className="text-muted" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={Phone}
                title="Your next conversation starts here"
                action={
                  <button
                    className="btn"
                    onClick={() => setActiveTab('agents')}
                  >
                    Open Voice Studio
                    <ArrowUpRight size={13} />
                  </button>
                }
              >
                No calls started in the last 7 days. Choose an agent to begin a
                conversation grounded in your knowledge.
              </EmptyState>
            ))}
          <div className="border-t pt-4 mt-3">
            <TextAction onClick={() => setActiveTab('analytics')}>
              Explore conversation analytics
            </TextAction>
          </div>
        </section>
        <ServiceHealth revision={healthRevision} />
      </div>
      <section aria-label="Workspace actions">
        <p className="section-label mb-3">Keep things moving</p>
        <div className="workflow-row">
          {shortcuts.map(({ tab, title, text, icon: Icon }) => (
            <button
              key={tab}
              className="workflow-link"
              onClick={() => setActiveTab(tab)}
            >
              <span className="row-icon">
                <Icon size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block text-xs font-semibold">{title}</strong>
                <span className="block text-[10px] text-muted mt-1">
                  {text}
                </span>
              </span>
              <ArrowUpRight size={14} className="text-muted mr-3" />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
