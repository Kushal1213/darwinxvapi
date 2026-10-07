import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ClipboardCheck, MessageSquarePlus, Save } from 'lucide-react';
import { useWorkspaceAuth } from './WorkspaceAuth';
import { EmptyState, LoadingState, StatusBadge } from './WorkspaceUI';

async function request(path, options = {}) {
  const response = await fetch('/api/qa' + path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'QA review request failed.');
  return data;
}

function draftFor(review) {
  if (!review) return [];
  const byCriterion = new Map((review.findings || []).map((finding) => [finding.criterion_id, finding]));
  return review.rubric.criteria.map((criterion) => {
    const finding = byCriterion.get(criterion.id);
    return {
      criterion_id: criterion.id,
      verdict: finding?.verdict || '',
      note: finding?.note || '',
      turn_index: finding?.turn_index ?? '',
      source_index: finding?.source_index ?? '',
    };
  });
}

function ReviewSummary({ review, onNavigateEvidence }) {
  const criteria = useMemo(() => new Map(review.rubric.criteria.map((criterion) => [criterion.id, criterion])), [review.rubric.criteria]);
  const failures = review.findings.filter((finding) => finding.verdict === 'fail');
  return (
    <article className="qa-review-summary">
      <div className="flex justify-between items-start gap-3">
        <div><h3>{review.reviewer_email}</h3><p>{review.rubric.name} v{review.rubric.version}</p></div>
        <StatusBadge tone={review.state === 'completed' ? 'success' : 'accent'}>{review.state}</StatusBadge>
      </div>
      {review.state === 'completed' && <p className="qa-score">{review.score_earned}/{review.score_possible} <span>weighted points</span></p>}
      {failures.map((finding) => (
        <div className="qa-failure" key={finding.id}>
          <strong>{criteria.get(finding.criterion_id)?.label || 'Failed criterion'}</strong>
          <p>{finding.note}</p>
          {finding.turn_index != null && <button type="button" className="text-action" onClick={() => onNavigateEvidence(finding.turn_index, finding.source_index)}>View transcript evidence</button>}
        </div>
      ))}
      {review.coaching.length > 0 && <div className="qa-coaching-history"><strong>Coaching history</strong>{review.coaching.map((note) => <div key={note.id}><p>{note.note}</p><small>{note.actor_email} · {new Date(note.created_at).toLocaleString()}</small></div>)}</div>}
    </article>
  );
}

export default function QAReviewPanel({ callId, turns, onNavigateEvidence }) {
  const { user } = useWorkspaceAuth();
  const [bundle, setBundle] = useState(null);
  const [draft, setDraft] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [coaching, setCoaching] = useState('');

  const refresh = useCallback(async (signal) => {
    try {
      const data = await request(`/calls/${encodeURIComponent(callId)}`, { signal });
      setBundle(data);
      setDraft(draftFor(data.my_review));
      setError('');
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [callId]);

  useEffect(() => {
    if (user.role !== 'admin') return undefined;
    const controller = new AbortController();
    setLoading(true);
    refresh(controller.signal);
    return () => controller.abort();
  }, [refresh, user.role]);

  async function mutate(key, path, options) {
    setBusy(key);
    setError('');
    try {
      const data = await request(path, options);
      await refresh();
      return data;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setBusy('');
    }
  }

  async function saveFindings() {
    const findings = draft.filter((finding) => finding.verdict).map((finding) => ({
      criterion_id: finding.criterion_id,
      verdict: finding.verdict,
      note: finding.note,
      turn_index: finding.turn_index === '' ? null : Number(finding.turn_index),
      source_index: finding.source_index === '' ? null : Number(finding.source_index),
    }));
    return mutate('save', `/reviews/${bundle.my_review.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ findings }),
    });
  }

  if (user.role !== 'admin') return null;
  if (loading) return <section className="panel"><LoadingState label="Loading QA review" rows={3} /></section>;
  const review = bundle?.my_review;
  const agreement = bundle?.agreement;
  return (
    <section className="panel" aria-labelledby="qa-review-title">
      <div className="panel-header">
        <div><h2 className="panel-title" id="qa-review-title">Manual QA review</h2><p className="panel-description">Human-authored findings only. Completed reviews and their rubric snapshots are immutable.</p></div>
        {agreement?.agreement_rate != null && <StatusBadge tone={agreement.agreement_rate >= 0.8 ? 'success' : 'warning'}>{Math.round(agreement.agreement_rate * 100)}% reviewer agreement · {agreement.reviewer_pairs} pairs</StatusBadge>}
      </div>
      {error && <p className="notice notice-error mb-4" role="alert">{error}</p>}
      {!bundle?.active_rubric && !review ? (
        <EmptyState compact icon={ClipboardCheck} title="No active QA rubric">Create and activate an immutable rubric from QA & Coaching before reviewing this call.</EmptyState>
      ) : !review ? (
        <div className="qa-start-review">
          <div><strong>{bundle.active_rubric.name} v{bundle.active_rubric.version}</strong><p>{bundle.active_rubric.description}</p></div>
          <button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={() => mutate('start', '/reviews', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ call_id: callId }) })}><ClipboardCheck size={15} />{busy === 'start' ? 'Starting…' : 'Start my review'}</button>
        </div>
      ) : review.state === 'draft' ? (
        <div className="space-y-4">
          <div className="notice"><strong>{review.rubric.name} v{review.rubric.version}</strong><p className="mt-1 text-muted">{review.rubric.description}</p></div>
          {review.rubric.criteria.map((criterion, index) => {
            const finding = draft[index] || {};
            const selectedTurn = finding.turn_index === '' ? null : turns[Number(finding.turn_index)];
            return (
              <fieldset className="qa-finding-editor" key={criterion.id}>
                <legend>{index + 1}. {criterion.label} <span>{criterion.weight} point{criterion.weight === 1 ? '' : 's'}</span></legend>
                {criterion.description && <p>{criterion.description}</p>}
                <div className="qa-finding-grid">
                  <label><span>Verdict</span><select className="field" value={finding.verdict || ''} onChange={(event) => setDraft((current) => current.map((item) => item.criterion_id === criterion.id ? { ...item, verdict: event.target.value } : item))}><option value="">Choose…</option><option value="pass">Pass</option><option value="fail">Fail</option><option value="not_applicable">Not applicable</option></select></label>
                  <label><span>Transcript evidence</span><select className="field" value={finding.turn_index ?? ''} onChange={(event) => setDraft((current) => current.map((item) => item.criterion_id === criterion.id ? { ...item, turn_index: event.target.value, source_index: '' } : item))}><option value="">No turn selected</option>{turns.map((turn, turnIndex) => <option key={`${turn.ts}-${turnIndex}`} value={turnIndex}>{turnIndex + 1}. {turn.role === 'user' ? 'Customer' : 'Agent'} · {String(turn.content).slice(0, 80)}</option>)}</select></label>
                  <label><span>Citation evidence</span><select className="field" disabled={!selectedTurn?.sources?.length} value={finding.source_index ?? ''} onChange={(event) => setDraft((current) => current.map((item) => item.criterion_id === criterion.id ? { ...item, source_index: event.target.value } : item))}><option value="">No citation selected</option>{(selectedTurn?.sources || []).map((source, sourceIndex) => <option key={`${source.chunk_id || source.document_id || sourceIndex}-${sourceIndex}`} value={sourceIndex}>{source.title || source.source || `Source ${sourceIndex + 1}`}</option>)}</select></label>
                </div>
                <label className="block mt-3"><span>Reviewer note {finding.verdict === 'fail' || finding.verdict === 'not_applicable' ? '(required)' : '(optional)'}</span><textarea className="field mt-2" rows={2} maxLength={2000} value={finding.note || ''} onChange={(event) => setDraft((current) => current.map((item) => item.criterion_id === criterion.id ? { ...item, note: event.target.value } : item))} /></label>
              </fieldset>
            );
          })}
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn" disabled={Boolean(busy)} onClick={saveFindings}><Save size={14} />{busy === 'save' ? 'Saving…' : 'Save draft'}</button>
            <button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={async () => { const saved = await saveFindings(); if (saved && window.confirm('Complete this review? Its findings and score will become immutable.')) await mutate('complete', `/reviews/${review.id}/complete`, { method: 'POST' }); }}><CheckCircle2 size={14} />Complete review</button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <ReviewSummary review={review} onNavigateEvidence={onNavigateEvidence} />
          <form className="qa-coaching-form" onSubmit={async (event) => { event.preventDefault(); const result = await mutate('coaching', `/reviews/${review.id}/coaching`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note: coaching }) }); if (result) setCoaching(''); }}>
            <label><span>Add coaching note</span><textarea className="field mt-2" required rows={3} maxLength={2000} value={coaching} onChange={(event) => setCoaching(event.target.value)} placeholder="Record specific, actionable coaching linked to this review." /></label>
            <div><button className="btn" disabled={Boolean(busy)}><MessageSquarePlus size={14} />Add to coaching history</button><p>Stored internally with actor and timestamp; no external delivery is implied.</p></div>
          </form>
        </div>
      )}
      {bundle?.reviews.filter((item) => item.id !== review?.id).length > 0 && (
        <div className="qa-other-reviews"><h3>Other reviewer records</h3>{bundle.reviews.filter((item) => item.id !== review?.id).map((item) => <ReviewSummary key={item.id} review={item} onNavigateEvidence={onNavigateEvidence} />)}</div>
      )}
    </section>
  );
}
