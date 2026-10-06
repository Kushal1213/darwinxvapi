import React from 'react';
import { MessageSquareText, Pencil, Sparkles, Timer, XCircle } from 'lucide-react';
import { formatLatency, formatPercent, panelClass } from './AnalyticsShared';

const number = new Intl.NumberFormat();
const REASON_LABELS = {
  not_relevant: 'Not relevant',
  incorrect_or_unsupported: 'Incorrect or unsupported',
  too_verbose: 'Too verbose',
  already_answered: 'Already answered',
  prefer_human: 'Prefer human assistance',
  other: 'Other',
  unclassified: 'Legacy / unclassified',
};

function GuidanceMetric({ icon: Icon, label, value, detail }) {
  return (
    <article className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/50">
      <p className="flex items-center gap-2 text-xs text-muted"><Icon size={14} aria-hidden="true" /> {label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] leading-5 text-muted">{detail}</p>
    </article>
  );
}

export default function GuidanceAnalyticsPanel({ guidance }) {
  if (!guidance) return null;
  return (
    <section className={`${panelClass} p-5 sm:p-6`} aria-labelledby="guidance-analytics-title">
      <div>
        <h2 id="guidance-analytics-title" className="flex items-center gap-2 text-lg font-bold">
          <Sparkles className="h-4 w-4 text-blue-500" aria-hidden="true" /> Guidance effectiveness
        </h2>
        <p className="mt-1 text-xs text-muted">
          Operator interaction with grounded live replies in this selection
        </p>
      </div>
      {guidance.suggestions === 0 ? (
        <p className="flex min-h-40 items-center justify-center text-center text-sm text-muted">
          Guidance metrics will appear after grounded reply tips are generated.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <GuidanceMetric
              icon={MessageSquareText}
              label="Applied"
              value={formatPercent(guidance.apply_rate_pct)}
              detail={`${number.format(guidance.applied)} of ${number.format(guidance.suggestions)} generated suggestions`}
            />
            <GuidanceMetric
              icon={Pencil}
              label="Edited before delivery"
              value={formatPercent(guidance.edit_rate_pct)}
              detail={`${number.format(guidance.edited)} of ${number.format(guidance.applied)} applied replies`}
            />
            <GuidanceMetric
              icon={XCircle}
              label="Dismissed"
              value={formatPercent(guidance.dismissal_rate_pct)}
              detail={`${number.format(guidance.dismissed)} dismissed suggestions`}
            />
            <GuidanceMetric
              icon={Timer}
              label="Decision time"
              value={formatLatency(guidance.avg_decision_ms)}
              detail={`${number.format(guidance.decision_samples)} apply or dismiss decisions`}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div>
              <h3 className="text-sm font-semibold">Guidance funnel</h3>
              <dl className="mt-3 space-y-2 text-xs">
                {[
                  ['Generated', guidance.suggestions],
                  ['Displayed', guidance.displayed],
                  ['Applied', guidance.applied],
                  ['Dismissed', guidance.dismissed],
                  ['Expired', guidance.expired],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 border-b py-2">
                    <dt className="text-muted">{label}</dt>
                    <dd className="font-semibold tabular-nums">{number.format(value)}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div>
              <h3 className="text-sm font-semibold">Origin and evidence</h3>
              <dl className="mt-3 space-y-2 text-xs">
                <div className="flex justify-between gap-4 border-b py-2">
                  <dt className="text-muted">Customer-turn suggestions</dt>
                  <dd className="font-semibold tabular-nums">{number.format(guidance.origins.customer_turn)}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b py-2">
                  <dt className="text-muted">Private operator searches</dt>
                  <dd className="font-semibold tabular-nums">{number.format(guidance.origins.operator_query)}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b py-2">
                  <dt className="text-muted">Citation presence</dt>
                  <dd className="font-semibold tabular-nums">{formatPercent(guidance.citation_coverage_pct)}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b py-2">
                  <dt className="text-muted">Generation latency</dt>
                  <dd className="font-semibold tabular-nums">{formatLatency(guidance.avg_generation_latency_ms)}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="text-sm font-semibold">Dismissal reasons</h3>
              {guidance.dismiss_reasons.length ? (
                <ul className="mt-3 space-y-2 text-xs">
                  {guidance.dismiss_reasons.map((item) => (
                    <li key={item.reason} className="flex justify-between gap-4 border-b py-2">
                      <span className="text-muted">{REASON_LABELS[item.reason] || item.reason}</span>
                      <span className="font-semibold tabular-nums">{number.format(item.count)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs leading-5 text-muted">No grounded replies were dismissed in this selection.</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 border-t pt-4 text-xs text-muted sm:grid-cols-3">
            <p><strong className="text-[var(--ink)]">Feedback:</strong> {number.format(guidance.feedback_count)} rated · {formatPercent(guidance.useful_feedback_pct)} marked useful among ratings</p>
            <p><strong className="text-[var(--ink)]">Calls:</strong> {number.format(guidance.calls_with_guidance)} with guidance · {number.format(guidance.calls_with_handoff)} with handoff outcomes</p>
            <p><strong className="text-[var(--ink)]">Display coverage:</strong> {formatPercent(guidance.display_rate_pct)} · {formatPercent(guidance.feedback_response_pct)} feedback response</p>
          </div>
          <p className="text-xs leading-5 text-muted">
            These are interaction and workflow metrics. Applying, editing, or rating a suggestion does not prove that its answer or citation was correct.
          </p>
        </div>
      )}
    </section>
  );
}
