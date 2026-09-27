import React, { useCallback, useEffect, useState } from 'react';

export const MARKET_LABELS = {
  'india-loan': 'Aria · India Loans',
  'india-insurance': 'Priya · India Insurance',
  'ph-bancassurance': 'Maria · Philippines',
  'id-finance': 'Dewi · Indonesia',
};
export const panelClass = 'panel';
export const buttonClass = 'btn';
export function formatDuration(ms) {
  if (ms == null || !Number.isFinite(ms)) return '—';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}
export const formatLatency = (ms) =>
  ms == null || !Number.isFinite(ms)
    ? '—'
    : `${Math.round(ms).toLocaleString()} ms`;
export const formatPercent = (value) =>
  value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)}%`;

// Cancel obsolete requests so a slower response cannot replace a newer filter.
export function useAnalytics({ days = 7, market = 'all' } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 15000);
    setLoading(true);
    setError('');
    setData(null);
    async function read() {
      try {
        const response = await fetch(
          `/api/analytics?${new URLSearchParams({ days: String(days), market })}`,
          { signal: controller.signal }
        );
        if (!response.ok)
          throw new Error(
            response.status === 401
              ? 'Please sign in again to view analytics.'
              : 'Analytics is unavailable. Please try again.'
          );
        const result = await response.json();
        if (!controller.signal.aborted) setData(result);
      } catch (err) {
        if (timedOut)
          setError('Analytics took too long to respond. Please try again.');
        else if (!controller.signal.aborted) setError(err.message);
      } finally {
        clearTimeout(timeout);
        if (!controller.signal.aborted || timedOut) setLoading(false);
      }
    }
    read();
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [days, market, revision]);
  return { data, loading, error, refresh };
}

export function MetricCard({ label, value, detail, icon: Icon, flat = false }) {
  return (
    <article className={flat ? 'metric' : 'panel metric'}>
      <div className="metric-label">
        <h2>{label}</h2>
        {Icon && <Icon size={15} aria-hidden="true" />}
      </div>
      <p className="metric-value">{value}</p>
      {detail && <p className="metric-detail">{detail}</p>}
    </article>
  );
}
