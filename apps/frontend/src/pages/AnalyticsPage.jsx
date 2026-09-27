import React, { useEffect, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Activity,
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock,
  Download,
  FileCheck2,
  Globe,
  PhoneCall,
  RefreshCw,
  Users,
} from 'lucide-react';
import {
  useAnalytics,
  MetricCard,
  formatDuration,
  formatLatency,
  formatPercent,
  MARKET_LABELS,
  panelClass,
  buttonClass,
} from '../components/AnalyticsShared';

import { LoadingState, PageHeading } from '../components/WorkspaceUI';
const number = new Intl.NumberFormat();
const selectClass = 'field';
const shortDate = (value) =>
  new Date(`${value.slice(0, 10)}T00:00:00Z`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

function VolumeTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-lg dark:border-white/10 dark:bg-slate-900 dark:text-slate-200">
      <p className="mb-2 font-semibold">{shortDate(label)} · UTC</p>
      <p>{number.format(row.calls)} calls started</p>
      <p>{number.format(row.completed)} completed</p>
      <p>{number.format(row.handoffs)} with handoff requests</p>
    </div>
  );
}

function EmptyPanel({ children }) {
  return (
    <p className="flex min-h-48 items-center justify-center px-4 text-center text-sm text-muted">
      {children}
    </p>
  );
}

function DailyTable({ daily }) {
  return (
    <details className="mt-4 text-xs">
      <summary className="w-fit cursor-pointer rounded text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-blue-400">
        View daily data table
      </summary>
      <div className="mt-3 max-h-64 overflow-auto rounded-lg border border-slate-200 dark:border-white/10">
        <table className="w-full text-left">
          <caption className="sr-only">
            Daily recorded call volume in UTC
          </caption>
          <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900">
            <tr>
              {['Date (UTC)', 'Calls', 'Completed', 'Handoffs'].map((label) => (
                <th key={label} scope="col" className="p-3 font-medium">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {daily.map((row) => (
              <tr
                key={row.date}
                className="border-t border-slate-200 dark:border-white/5"
              >
                <th scope="row" className="whitespace-nowrap p-3 font-normal">
                  {row.date}
                </th>
                <td className="p-3">{row.calls}</td>
                <td className="p-3">{row.completed}</td>
                <td className="p-3">{row.handoffs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const [market, setMarket] = useState('all');
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState('');
  const [exportMessage, setExportMessage] = useState('');
  const exportController = useRef(null);
  const { data, loading, error, refresh } = useAnalytics({ days, market });
  // Do not label a previous response with a newly selected filter while it loads.
  const currentData =
    data && Number(data.filters.days) === days && data.filters.market === market
      ? data
      : null;
  const totals = currentData?.totals;

  useEffect(() => {
    setExportError('');
    setExportMessage('');
    setExporting(false);
    return () => {
      exportController.current?.abort();
      exportController.current = null;
    };
  }, [days, market]);

  async function exportCsv() {
    exportController.current?.abort();
    const controller = new AbortController();
    exportController.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 30000);
    setExporting(true);
    setExportError('');
    setExportMessage('');
    try {
      const query = new URLSearchParams({
        days: String(days),
        market,
        format: 'csv',
      });
      const response = await fetch(`/api/analytics?${query}`, {
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(
          `Export failed (${response.status}). Please try again.`
        );
      if (!response.headers.get('content-type')?.includes('text/csv'))
        throw new Error(
          'The server did not return a CSV report. Please try again.'
        );
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `veyra-analytics-${market}-${days}days-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
      setExportMessage('CSV download started.');
    } catch (err) {
      if (!controller.signal.aborted)
        setExportError(
          err.message || 'Unable to export analytics. Please try again.'
        );
      else if (exportController.current === controller)
        setExportError('The export timed out. Please try again.');
    } finally {
      window.clearTimeout(timeout);
      if (exportController.current === controller) {
        exportController.current = null;
        setExporting(false);
      }
    }
  }

  return (
    <div className="page">
      <PageHeading
        eyebrow="The bigger picture"
        title="Operational Analytics"
        description="Understand recorded activity, response timing, and the sources behind your answers."
        actions={
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting || loading || !currentData}
            className="btn"
          >
            <Download size={14} />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        }
      />

      <section
        aria-label="Analytics filters"
        className={`${panelClass} flex flex-wrap items-end gap-4 p-4 sm:p-5`}
      >
        <div className="min-w-40 flex-1 sm:max-w-48">
          <label
            htmlFor="analytics-days"
            className="mb-2 block text-xs font-semibold text-muted"
          >
            Date range
          </label>
          <select
            id="analytics-days"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
            className={selectClass}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>
        <div className="min-w-52 flex-1 sm:max-w-80">
          <label
            htmlFor="analytics-market"
            className="mb-2 block text-xs font-semibold text-muted"
          >
            Agent / market
          </label>
          <select
            id="analytics-market"
            value={market}
            onChange={(event) => setMarket(event.target.value)}
            className={selectClass}
          >
            <option value="all">All agents & markets</option>
            {Object.entries(MARKET_LABELS)
              .filter(([key]) => key !== 'all')
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </select>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className={`${buttonClass} disabled:opacity-50`}
        >
          <RefreshCw
            className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
        <p className="basis-full text-xs leading-5 text-muted">
          {currentData
            ? `${shortDate(currentData.window.from)} – ${shortDate(currentData.window.to)} · `
            : ''}
          UTC dates · Calls grouped by their start date. Outcomes reflect the
          latest recorded state.
          {currentData ? (
            <span className="mt-1 block">
              Updated {new Date(currentData.generated_at).toLocaleString()}
            </span>
          ) : null}
        </p>
      </section>

      {exportError ? (
        <p
          role="alert"
          className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          {exportError}
        </p>
      ) : null}
      {exportMessage ? (
        <p
          role="status"
          className="text-sm text-emerald-700 dark:text-emerald-400"
        >
          {exportMessage}
        </p>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div>
            <p className="font-semibold">Unable to load analytics</p>
            <p className="mt-1">
              {typeof error === 'string' ? error : error.message} Use Refresh to
              try again.
            </p>
            {currentData ? (
              <p className="mt-1">The last loaded report is shown below.</p>
            ) : null}
          </div>
        </div>
      ) : null}
      {loading && !currentData ? (
        <div className={`${panelClass} p-10 text-center`} role="status">
          <LoadingState label="Loading recorded analytics" rows={3} />
        </div>
      ) : null}

      {currentData ? (
        <div className="space-y-6" aria-busy={loading}>
          {totals.calls === 0 ? (
            <div
              role="status"
              className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-5 dark:border-blue-500/20 dark:bg-blue-500/5"
            >
              <BarChart3
                className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400"
                aria-hidden="true"
              />
              <div>
                <h2 className="font-semibold">No calls in this selection</h2>
                <p className="mt-1 text-sm text-muted">
                  Choose a wider date range or another agent. Calls recorded in
                  Voice Studio will appear here.
                </p>
              </div>
            </div>
          ) : null}
          <div className="metrics-strip">
            <MetricCard
              label="Recorded calls"
              value={number.format(totals.calls)}
              detail={`${number.format(totals.active)} currently active in this selection`}
              icon={PhoneCall}
              flat
            />
            <MetricCard
              label="Completed calls"
              value={number.format(totals.completed)}
              detail={
                totals.calls
                  ? `${formatPercent((totals.completed / totals.calls) * 100)} of selected calls`
                  : 'No calls recorded'
              }
              icon={CheckCircle2}
              flat
            />
            <MetricCard
              label="Handoff requests"
              value={number.format(totals.handoffs)}
              detail={
                totals.calls
                  ? `${formatPercent((totals.handoffs / totals.calls) * 100)} of selected calls`
                  : 'No calls recorded'
              }
              icon={Users}
              flat
            />
            <MetricCard
              label="Average duration"
              value={formatDuration(totals.avg_duration_ms)}
              detail={`${number.format(totals.duration_samples)} calls with recorded duration`}
              icon={Clock}
              flat
            />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-6 xl:grid-cols-5">
            <section
              className={`${panelClass} min-w-0 p-5 sm:p-6 xl:col-span-3`}
              aria-labelledby="volume-title"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 id="volume-title" className="text-lg font-bold">
                    Recorded call volume
                  </h2>
                  <p className="mt-1 text-xs text-muted">
                    Daily start-date cohorts · UTC
                  </p>
                </div>
                <div className="flex gap-3 text-xs text-slate-600 dark:text-slate-300">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    Calls
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    Completed
                  </span>
                </div>
              </div>
              {totals.calls ? (
                <>
                  <p id="volume-summary" className="sr-only">
                    {number.format(totals.calls)} calls started in the selected{' '}
                    {days} days; {number.format(totals.completed)} have
                    completed and {number.format(totals.handoffs)} have handoff
                    requests. Daily values are available in the data table
                    below.
                  </p>
                  <div
                    className="mt-6 h-64 min-w-0"
                    role="img"
                    aria-label="Daily recorded calls and completed calls"
                    aria-describedby="volume-summary"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={currentData.daily}
                        margin={{ top: 8, right: 8, left: -22, bottom: 0 }}
                        accessibilityLayer
                      >
                        <defs>
                          <linearGradient
                            id="analytics-call-fill"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="0%"
                              stopColor="#3b82f6"
                              stopOpacity={0.25}
                            />
                            <stop
                              offset="100%"
                              stopColor="#3b82f6"
                              stopOpacity={0.01}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          stroke="#94a3b8"
                          strokeOpacity={0.15}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="date"
                          tickFormatter={shortDate}
                          tick={{ fill: 'var(--muted)', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          minTickGap={32}
                        />
                        <YAxis
                          allowDecimals={false}
                          tick={{ fill: 'var(--muted)', fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip content={<VolumeTooltip />} />
                        <Area
                          name="Calls"
                          type="linear"
                          dataKey="calls"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          fill="url(#analytics-call-fill)"
                          isAnimationActive={false}
                        />
                        <Area
                          name="Completed"
                          type="linear"
                          dataKey="completed"
                          stroke="#10b981"
                          strokeWidth={2}
                          fill="transparent"
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <DailyTable daily={currentData.daily} />
                </>
              ) : (
                <EmptyPanel>
                  The call volume chart will appear when calls are recorded in
                  this date range.
                </EmptyPanel>
              )}
            </section>

            <section
              className={`${panelClass} min-w-0 p-5 sm:p-6 xl:col-span-2`}
              aria-labelledby="market-title"
            >
              <h2
                id="market-title"
                className="flex items-center gap-2 text-lg font-bold"
              >
                <Globe className="h-4 w-4 text-blue-500" aria-hidden="true" />
                Agent distribution
              </h2>
              <p className="mt-1 text-xs text-muted">
                Share of recorded calls in this selection
              </p>
              {totals.calls ? (
                <div className="mt-6 space-y-6">
                  {currentData.markets
                    .filter((row) => row.calls > 0)
                    .map((row) => {
                      const share = (row.calls / totals.calls) * 100;
                      return (
                        <div key={row.market}>
                          <div className="mb-2 flex items-start justify-between gap-3 text-sm">
                            <span className="font-medium">
                              {MARKET_LABELS[row.market] ||
                                row.market ||
                                'Unassigned'}
                            </span>
                            <span className="shrink-0 font-mono text-xs text-muted">
                              {formatPercent(share)}
                            </span>
                          </div>
                          <div
                            className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                            aria-hidden="true"
                          >
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{ width: `${share}%` }}
                            />
                          </div>
                          <p className="mt-2 text-xs text-muted">
                            {number.format(row.calls)} calls ·{' '}
                            {number.format(row.completed)} completed ·{' '}
                            {number.format(row.handoffs)} with handoff requests
                          </p>
                        </div>
                      );
                    })}
                </div>
              ) : (
                <EmptyPanel>
                  No agent distribution is available for this selection.
                </EmptyPanel>
              )}
            </section>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section
              className={`${panelClass} p-5 sm:p-6`}
              aria-labelledby="latency-title"
            >
              <h2
                id="latency-title"
                className="flex items-center gap-2 text-lg font-bold"
              >
                <Activity
                  className="h-4 w-4 text-blue-500"
                  aria-hidden="true"
                />
                Gateway reply latency
              </h2>
              <p className="mt-1 text-xs text-muted">
                {number.format(totals.latency_samples)} recorded reply-time
                samples
              </p>
              <dl className="my-6 grid grid-cols-3 gap-3">
                {[
                  ['Average', totals.avg_latency_ms],
                  ['Median / P50', totals.p50_latency_ms],
                  ['P95', totals.p95_latency_ms],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50"
                  >
                    <dt className="text-[11px] text-muted">{label}</dt>
                    <dd className="mt-2 text-base font-bold tabular-nums sm:text-xl">
                      {formatLatency(value)}
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="text-xs leading-5 text-muted">
                Recorded gateway reply time excludes unmeasured speech-to-audio
                timing. P95 is the value at or below which 95% of recorded
                samples fall. Missing telemetry is excluded.
              </p>
            </section>

            <section
              className={`${panelClass} p-5 sm:p-6`}
              aria-labelledby="citation-title"
            >
              <h2
                id="citation-title"
                className="flex items-center gap-2 text-lg font-bold"
              >
                <FileCheck2
                  className="h-4 w-4 text-blue-500"
                  aria-hidden="true"
                />
                Citation coverage
              </h2>
              <p className="mt-1 text-xs text-muted">
                Assistant turns containing at least one citation
              </p>
              <div className="my-6">
                <p className="text-3xl font-bold tabular-nums">
                  {totals.assistant_turns
                    ? formatPercent(totals.citation_coverage_pct)
                    : '—'}
                </p>
                <p className="mt-2 text-sm text-muted">
                  {number.format(totals.cited_turns)} cited turns /{' '}
                  {number.format(totals.assistant_turns)} assistant turns
                </p>
                <div
                  className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
                  aria-hidden="true"
                >
                  <div
                    className="h-full rounded-full bg-blue-500"
                    style={{
                      width: `${Math.max(0, Math.min(100, totals.citation_coverage_pct || 0))}%`,
                    }}
                  />
                </div>
              </div>
              <p className="text-xs leading-5 text-muted">
                Coverage measures citation presence, not answer accuracy or
                citation correctness. Turns without citations are included in
                the denominator.
              </p>
            </section>
          </div>
        </div>
      ) : null}
    </div>
  );
}
