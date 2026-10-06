import React, { useEffect, useState } from 'react';
import { BookOpen, CheckCircle2, Circle, Copy, Search } from 'lucide-react';

export default function LivePlaybook({ callId, turnCount, onPrepareGuidance }) {
  const [playbook, setPlaybook] = useState(null);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copyStatus, setCopyStatus] = useState('');

  useEffect(() => {
    if (!callId) return undefined;
    let live = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    fetch(`/api/voice/session/${encodeURIComponent(callId)}/playbook`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Live playbook is unavailable.');
        return data;
      })
      .then((data) => {
        if (!live) return;
        setPlaybook(data.playbook);
        setReason(data.reason || '');
        setCopyStatus('');
      })
      .catch((requestError) => {
        if (live && requestError.name !== 'AbortError') setError(requestError.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [callId, turnCount]);

  async function copyAction(text) {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      setCopyStatus('Suggested question copied');
    } catch (_) {
      setCopyStatus('Copy unavailable');
    }
  }

  if (loading) {
    return <p role="status" className="text-xs text-muted">Evaluating live playbook…</p>;
  }
  if (error) {
    return <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>;
  }
  if (!playbook) {
    return (
      <section className="signal-tile !p-3" aria-label="Live playbook">
        <p className="text-xs font-semibold flex items-center gap-2"><BookOpen size={14} /> Live playbook</p>
        <p className="text-[10px] text-muted mt-2 leading-5">{reason}</p>
      </section>
    );
  }

  const nextAction = playbook.paused_for_handoff ? null : playbook.next_step?.action;
  return (
    <section className="signal-tile !p-3 space-y-3" aria-labelledby="live-playbook-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="live-playbook-title" className="text-xs font-semibold flex items-center gap-2">
            <BookOpen size={14} className="text-accent" /> {playbook.title}
          </h2>
          <p className="text-[10px] text-muted mt-1">Version {playbook.version}</p>
        </div>
        <span className="text-xs font-semibold text-accent">{playbook.progress_percent}%</span>
      </div>
      <progress
        className="w-full h-2 accent-[var(--accent)]"
        value={playbook.observed_steps}
        max={playbook.total_steps}
        aria-label={`${playbook.observed_steps} of ${playbook.total_steps} playbook steps observed`}
      />
      <p className="text-[10px] text-muted leading-5">{playbook.disclaimer}</p>
      {playbook.paused_for_handoff ? (
        <p role="status" className="notice notice-warning !p-2 text-xs">
          Automated guidance is paused while human assistance is active.
        </p>
      ) : null}
      <ol className="space-y-2">
        {playbook.steps.map((step) => (
          <li key={step.id} className="flex gap-2 text-xs">
            {step.state === 'observed' ? (
              <CheckCircle2 size={15} className="text-emerald-600 shrink-0 mt-0.5" aria-label="Observed" />
            ) : (
              <Circle size={15} className="text-muted shrink-0 mt-0.5" aria-label="Open" />
            )}
            <div className="min-w-0">
              <span className={step.state === 'observed' ? 'text-muted' : 'font-medium'}>{step.label}</span>
              {step.evidence?.excerpt ? (
                <details className="text-[10px] text-muted mt-1">
                  <summary>Transcript evidence</summary>
                  <p className="mt-1 whitespace-pre-wrap break-words">{step.evidence.excerpt}</p>
                </details>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      {nextAction ? (
        <div className="border-t pt-3 space-y-2">
          <p className="text-[10px] uppercase tracking-widest text-muted">Recommended next step</p>
          <p className="text-xs font-medium">{playbook.next_step.label}</p>
          <p className="text-xs text-muted leading-5">{nextAction.text}</p>
          {nextAction.kind === 'search_knowledge' ? (
            <button type="button" className="btn w-full" onClick={() => onPrepareGuidance(nextAction.text)}>
              <Search size={14} /> Prepare in Ask Veyra
            </button>
          ) : (
            <button type="button" className="btn w-full" onClick={() => copyAction(nextAction.text)}>
              <Copy size={14} /> Copy suggested question
            </button>
          )}
          {copyStatus ? <p role="status" className="text-[10px] text-muted">{copyStatus}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
