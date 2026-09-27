import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Cpu,
  Database,
  Globe,
  Radio,
  RefreshCw,
  Server,
} from 'lucide-react';
import {
  PageHeading,
  StatusBadge,
  LoadingState,
} from '../components/WorkspaceUI';
const stages = [
  {
    id: 'conversation',
    title: 'Conversation',
    label: '01',
    icon: Radio,
    description: 'Voice or text enters through the browser.',
    detail:
      'The browser manages microphone access, speech recognition, spoken responses, and text input. Voice support depends on the browser and configured providers.',
    items: [
      'Microphone and text input',
      'Live transcript',
      'Playback controls',
    ],
  },
  {
    id: 'orchestration',
    title: 'Orchestration',
    label: '02',
    icon: Server,
    description: 'One gateway coordinates the session.',
    detail:
      'The gateway authenticates workspace access, maintains the call lifecycle, routes requests, and streams conversation events to the interface.',
    items: [
      'Authenticated session',
      'Persisted call history',
      'Live event delivery',
    ],
  },
  {
    id: 'knowledge',
    title: 'Knowledge',
    label: '03',
    icon: Database,
    description: 'Relevant knowledge supports the response.',
    detail:
      'Retrieval selects eligible sources by market and product. Managed documents follow revision, review, publication, and withdrawal workflows. Returned citations identify the source used.',
    items: [
      'Market and product scope',
      'Reviewed document revisions',
      'Source citations',
    ],
  },
  {
    id: 'response',
    title: 'Response & insights',
    label: '04',
    icon: Cpu,
    description: 'Answers and signals return to the workspace.',
    detail:
      'The configured generation service prepares a response. Conversation signals feed operator nudges; the application records conversation evidence for later review.',
    items: ['Grounded response', 'Operator nudges', 'Conversation review'],
  },
];
const serviceNames = {
  gateway: 'API gateway',
  rag: 'Knowledge retrieval',
  ingestion: 'Document processing',
  realtime: 'Live insights',
};
export default function ArchitecturePage() {
  const [selected, setSelected] = useState('conversation');
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), 10000);
    setHealth(null);
    setError('');
    fetch('/api/health', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Service health is unavailable.');
        return response.json();
      })
      .then((data) => {
        if (!controller.signal.aborted) setHealth(data);
      })
      .catch((err) => {
        if (controller.signal.reason === 'timeout')
          setError('The health check timed out. Refresh to try again.');
        else if (!controller.signal.aborted) setError(err.message);
      })
      .finally(() => clearTimeout(timer));
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [revision]);
  const stage = stages.find((item) => item.id === selected);
  return (
    <div className="page">
      <PageHeading
        eyebrow="Behind the conversation"
        title="Architecture"
        description="How voice, knowledge, and live assistance connect across the workspace."
        actions={
          <button
            className="btn"
            onClick={() => setRevision((value) => value + 1)}
          >
            <RefreshCw size={14} />
            Refresh status
          </button>
        }
      />
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">From question to understanding</h2>
            <p className="panel-description">
              Select a stage to explore its role. This is a system map, not a
              live execution trace.
            </p>
          </div>
          <Globe size={18} className="text-muted" />
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-3">
          {stages.map(({ id, title, label, icon: Icon, description }) => (
            <button
              key={id}
              aria-pressed={selected === id}
              onClick={() => setSelected(id)}
              className={`text-left p-5 rounded-lg border ${selected === id ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'hover:bg-[var(--surface-soft)]'}`}
            >
              <div className="flex justify-between items-center mb-7">
                <Icon size={21} strokeWidth={1.5} className="text-accent" />
                <span className="font-mono text-[10px] text-muted">
                  {label}
                </span>
              </div>
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="text-[11px] text-muted leading-6 mt-2">
                {description}
              </p>
              <ArrowRight size={15} className="text-accent mt-4" />
            </button>
          ))}
        </div>
        <div
          className="border-t mt-6 pt-6 grid md:grid-cols-[1.5fr_1fr] gap-8"
          role="region"
          aria-label={stage.title}
        >
          <div>
            <h3 className="text-sm font-semibold">{stage.title}</h3>
            <p className="text-xs text-muted leading-7 mt-2 max-w-2xl">
              {stage.detail}
            </p>
          </div>
          <ul className="space-y-3">
            {stage.items.map((item) => (
              <li key={item} className="text-xs flex items-center gap-3">
                <span className="status-dot text-accent" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="panel">
        <div className="panel-header">
          <div>
            <h2 className="panel-title">Service availability</h2>
            <p className="panel-description">
              Reported by the workspace gateway
            </p>
          </div>
          {health && (
            <StatusBadge
              tone={health.status === 'healthy' ? 'success' : 'warning'}
            >
              {health.status === 'healthy'
                ? 'All available'
                : 'Needs attention'}
            </StatusBadge>
          )}
        </div>
        {error ? (
          <p role="alert" className="notice notice-error">
            {error}
          </p>
        ) : !health ? (
          <LoadingState label="Checking services" />
        ) : (
          <>
            <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {Object.entries(serviceNames).map(([key, label]) => (
                <div key={key} className="signal-tile">
                  <p className="text-xs font-semibold mb-4">{label}</p>
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
                </div>
              ))}
            </div>
            <p className="text-[10px] text-muted mt-5">
              Checked {new Date(health.timestamp).toLocaleString()}.
              Availability does not establish response accuracy or end-to-end
              voice performance.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
