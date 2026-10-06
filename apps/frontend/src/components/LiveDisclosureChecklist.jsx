import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Eye,
  Link2,
  ShieldCheck,
  Slash,
} from 'lucide-react';

const statePresentation = {
  observed: { label: 'Observed signal', icon: CheckCircle2, className: 'text-emerald-600' },
  missing: { label: 'Needs attention', icon: AlertTriangle, className: 'text-amber-600' },
  uncertain: { label: 'Uncertain', icon: CircleHelp, className: 'text-muted' },
  not_applicable: { label: 'Not applicable', icon: Slash, className: 'text-muted' },
};

async function readJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Disclosure checklist request failed.');
  return data;
}

function ChecklistItem({ item, busy, onConfirm, onNavigateEvidence }) {
  const [decision, setDecision] = useState(item.confirmation?.decision || item.suggested_state);
  const [note, setNote] = useState(item.confirmation?.note || '');
  const presentation = statePresentation[item.state] || statePresentation.uncertain;
  const Icon = presentation.icon;
  const noteRequired = ['missing', 'not_applicable'].includes(decision);

  return (
    <li className="border-t border-[var(--line)] pt-3 first:border-0 first:pt-0">
      <div className="flex gap-2">
        <Icon size={15} className={`${presentation.className} shrink-0 mt-0.5`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium">{item.label}</p>
            <span className={`text-[10px] font-semibold ${presentation.className}`}>
              {item.confirmed ? `Human confirmed · ${presentation.label}` : `Suggested · ${presentation.label}`}
            </span>
          </div>
          {item.description ? <p className="text-[10px] text-muted leading-5 mt-1">{item.description}</p> : null}
          {item.applicability === 'conditional' ? (
            <p className="text-[10px] text-muted leading-5 mt-1">Condition: {item.condition_note}</p>
          ) : null}
          <p className="text-[10px] text-muted leading-5 mt-1">{item.reason}</p>
          {item.evidence ? (
            <div className="flex flex-wrap gap-2 mt-2">
              <button
                type="button"
                className="text-action !text-[10px]"
                onClick={() => onNavigateEvidence(item.evidence.turn_index)}
              >
                <Link2 size={11} aria-hidden="true" /> Turn {item.evidence.turn_index + 1}
              </button>
              {item.evidence.citations.map((citation) => (
                <button
                  type="button"
                  className="text-action !text-[10px]"
                  key={`${citation.source_index}-${citation.document_id || citation.title}`}
                  onClick={() => onNavigateEvidence(item.evidence.turn_index, citation.source_index)}
                >
                  <Link2 size={11} aria-hidden="true" />
                  {citation.title}{citation.page ? ` · page ${citation.page}` : ''}
                </button>
              ))}
            </div>
          ) : null}
          <details className="mt-2 text-[10px] text-muted">
            <summary className="cursor-pointer">Human review</summary>
            <div className="space-y-2 mt-2">
              <label className="block space-y-1">
                <span>Decision</span>
                <select className="field" value={decision} onChange={(event) => setDecision(event.target.value)}>
                  <option value="observed">Observed</option>
                  <option value="missing">Missing</option>
                  <option value="uncertain">Uncertain</option>
                  <option value="not_applicable">Not applicable</option>
                </select>
              </label>
              <label className="block space-y-1">
                <span>Review note {noteRequired ? '(required)' : '(optional)'}</span>
                <textarea rows={2} maxLength={1_000} value={note} onChange={(event) => setNote(event.target.value)} />
              </label>
              <button
                type="button"
                className="btn w-full"
                disabled={busy || (noteRequired && !note.trim())}
                onClick={() => onConfirm(item.id, { decision, note: note.trim() })}
              >
                <ShieldCheck size={13} aria-hidden="true" />
                {busy ? 'Saving…' : 'Save human decision'}
              </button>
            </div>
          </details>
          <details className="mt-2 text-[10px] text-muted">
            <summary className="cursor-pointer">Configured source revisions</summary>
            <ul className="mt-1 space-y-1">
              {item.source_refs.map((source) => (
                <li key={`${source.document_id}-${source.revision}`}>
                  {source.title} · revision {source.revision}
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </li>
  );
}

export default function LiveDisclosureChecklist({ callId, turnCount, onNavigateEvidence }) {
  const [checklist, setChecklist] = useState(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyItem, setBusyItem] = useState('');

  const loadChecklist = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const data = await readJson(
        `/api/voice/session/${encodeURIComponent(callId)}/disclosure-checklist`,
        { signal },
      );
      setChecklist(data.checklist);
      setReason(data.reason || '');
    } catch (requestError) {
      if (requestError.name !== 'AbortError') setError(requestError.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [callId]);

  useEffect(() => {
    const controller = new AbortController();
    loadChecklist(controller.signal);
    return () => controller.abort();
  }, [loadChecklist, turnCount]);

  const confirm = async (itemId, values) => {
    setBusyItem(itemId);
    setError('');
    try {
      const data = await readJson(
        `/api/voice/session/${encodeURIComponent(callId)}/disclosure-checklist/items/${encodeURIComponent(itemId)}/confirm`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(values),
        },
      );
      setChecklist(data.checklist);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusyItem('');
    }
  };

  if (loading) return <p role="status" className="text-xs text-muted">Evaluating disclosure checklist…</p>;
  if (error && !checklist) return <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>;
  if (!checklist) {
    return (
      <section className="signal-tile !p-3" aria-label="Disclosure checklist shadow mode">
        <p className="text-xs font-semibold flex items-center gap-2">
          <Eye size={14} aria-hidden="true" /> Disclosure shadow mode
        </p>
        <p className="text-[10px] text-muted mt-2 leading-5">{reason}</p>
      </section>
    );
  }

  return (
    <section className="signal-tile !p-3 space-y-3" aria-labelledby="disclosure-checklist-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="disclosure-checklist-title" className="text-xs font-semibold flex items-center gap-2">
            <Eye size={14} className="text-accent" aria-hidden="true" /> {checklist.title}
          </h2>
          <p className="text-[10px] text-muted mt-1">
            Shadow mode · version {checklist.version} · {checklist.channel}
          </p>
        </div>
        <span className="status-badge status-accent">Advisory</span>
      </div>
      <p className="text-[10px] text-muted leading-5">{checklist.disclaimer}</p>
      <div className="grid grid-cols-4 gap-2 text-center" aria-label="Checklist suggested and confirmed states">
        <div><strong className="block text-sm">{checklist.counts.observed}</strong><span className="text-[9px] text-muted">Observed</span></div>
        <div><strong className="block text-sm">{checklist.counts.missing}</strong><span className="text-[9px] text-muted">Attention</span></div>
        <div><strong className="block text-sm">{checklist.counts.uncertain}</strong><span className="text-[9px] text-muted">Uncertain</span></div>
        <div><strong className="block text-sm">{checklist.counts.not_applicable}</strong><span className="text-[9px] text-muted">N/A</span></div>
      </div>
      {error ? <p role="alert" className="notice notice-error !p-2 text-xs">{error}</p> : null}
      <ul className="space-y-3">
        {checklist.items.map((item) => (
          <ChecklistItem
            key={`${item.id}-${item.suggested_state}-${item.confirmation?.updated_at || 'unconfirmed'}`}
            item={item}
            busy={busyItem === item.id}
            onConfirm={confirm}
            onNavigateEvidence={onNavigateEvidence}
          />
        ))}
      </ul>
      <p className="text-[9px] text-muted leading-4">
        Effective {checklist.effective_from}{checklist.effective_to ? ` through ${checklist.effective_to}` : ' with no configured end date'} UTC.
      </p>
    </section>
  );
}
