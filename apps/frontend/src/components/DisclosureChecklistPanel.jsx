import React, { useCallback, useEffect, useState } from 'react';
import { Archive, Check, ClipboardCheck, Plus, Trash2, X } from 'lucide-react';

import { StatusBadge } from './WorkspaceUI';

const today = new Date().toISOString().slice(0, 10);
let itemSeed = 0;
const emptyItem = () => {
  itemSeed += 1;
  return {
    client_key: `checklist-item-${itemSeed}`,
    id: `topic_${itemSeed}`,
    label: '',
    description: '',
    applicability: 'required',
    condition_note: '',
    roles: ['assistant'],
    phrases: '',
    require_sources: true,
    source: '',
  };
};
const initialForm = () => ({
  title: '',
  version: `${today}.1`,
  market: 'india-loan',
  channel: 'text',
  workflow: 'loan_information',
  effective_from: today,
  effective_to: '',
  owner_note: '',
  items: [emptyItem()],
});

async function requestJson(path, options = {}) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Checklist request failed.');
  return data;
}

function ChecklistCard({ checklist, canManage, currentUserId, busy, onApprove, onRetire }) {
  const [retiring, setRetiring] = useState(false);
  const [retirementNote, setRetirementNote] = useState('');
  const isAuthor = checklist.created_by === currentUserId;
  return (
    <article className="signal-tile !p-4 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">{checklist.title}</h3>
          <p className="text-[10px] text-muted mt-1">
            {checklist.market} · {checklist.channel} · {checklist.workflow} · version {checklist.version}
          </p>
        </div>
        <StatusBadge tone={checklist.effective_status === 'active' ? 'success' : checklist.status === 'draft' ? 'warning' : 'neutral'}>
          {checklist.effective_status}
        </StatusBadge>
      </div>
      <p className="text-xs text-muted leading-5">{checklist.owner_note}</p>
      <p className="text-[10px] text-muted">
        {checklist.items.length} topic{checklist.items.length === 1 ? '' : 's'} · effective {checklist.effective_from}
        {checklist.effective_to ? ` through ${checklist.effective_to}` : ' with no end date'} UTC
      </p>
      <details className="source-detail">
        <summary>Review checklist topics and source bindings</summary>
        <ul className="mt-3 space-y-3 text-[10px] text-muted">
          {checklist.items.map((item) => (
            <li key={item.id}>
              <strong className="text-[var(--ink)]">{item.label}</strong> · {item.applicability} · {item.roles.join(', ')}
              <p className="mt-1">Phrases: {item.phrases.join(' · ')}</p>
              <p className="mt-1 break-all">
                Sources: {item.source_refs.map((source) => `${source.document_id} revision ${source.revision}`).join(' · ')}
              </p>
            </li>
          ))}
        </ul>
      </details>
      {canManage && checklist.status === 'draft' ? (
        isAuthor ? (
          <p className="notice notice-warning !p-2 text-xs">A different administrator must approve this version.</p>
        ) : (
          <button type="button" className="btn" disabled={busy} onClick={() => onApprove(checklist.id)}>
            <Check size={14} aria-hidden="true" /> Approve immutable version
          </button>
        )
      ) : null}
      {canManage && checklist.status === 'approved' ? (
        retiring ? (
          <div className="space-y-2">
            <label className="block text-xs space-y-1">
              <span>Retirement note</span>
              <textarea rows={2} maxLength={1_000} value={retirementNote} onChange={(event) => setRetirementNote(event.target.value)} />
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-danger" disabled={busy || !retirementNote.trim()} onClick={() => onRetire(checklist.id, retirementNote.trim())}>
                <Archive size={14} aria-hidden="true" /> Retire version
              </button>
              <button type="button" className="btn" disabled={busy} onClick={() => setRetiring(false)}>
                <X size={14} aria-hidden="true" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="btn btn-danger" disabled={busy} onClick={() => setRetiring(true)}>
            <Archive size={14} aria-hidden="true" /> Retire
          </button>
        )
      ) : null}
    </article>
  );
}

export default function DisclosureChecklistPanel({ canManage, currentUserId, documents }) {
  const [checklists, setChecklists] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const published = documents.filter((document) => document.status === 'indexed'
    && (!document.publicationStatus || document.publicationStatus === 'published'));

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const data = await requestJson('/api/disclosure-checklists', { signal });
      setChecklists(data.checklists);
    } catch (requestError) {
      if (requestError.name !== 'AbortError') setError(requestError.message);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const updateItem = (index, patch) => setForm((current) => ({
    ...current,
    items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
  }));

  const create = async (event) => {
    event.preventDefault();
    setBusy('create');
    setError('');
    setMessage('');
    try {
      const payload = {
        ...form,
        effective_to: form.effective_to || null,
        items: form.items.map((item) => {
          const [documentId, revision] = item.source.split('::');
          return {
            id: item.id.trim(),
            label: item.label.trim(),
            description: item.description.trim(),
            applicability: item.applicability,
            condition_note: item.condition_note.trim(),
            roles: item.roles,
            phrases: item.phrases.split('\n').map((phrase) => phrase.trim()).filter(Boolean),
            require_sources: item.require_sources,
            source_refs: [{ document_id: documentId, revision: Number(revision) }],
            human_confirmation_required: true,
          };
        }),
      };
      await requestJson('/api/disclosure-checklists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setForm(initialForm());
      setShowForm(false);
      setMessage('Draft created. A different administrator must approve it before shadow mode can use it.');
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  };

  const act = async (id, action, body) => {
    setBusy(id);
    setError('');
    setMessage('');
    try {
      await requestJson(`/api/disclosure-checklists/${encodeURIComponent(id)}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      setMessage(action === 'approve' ? 'Checklist approved.' : 'Checklist retired.');
      await load();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy('');
    }
  };

  return (
    <section className="panel space-y-5" aria-labelledby="disclosure-governance-title">
      <div className="panel-header !mb-0">
        <div>
          <h2 id="disclosure-governance-title" className="panel-title flex items-center gap-2">
            <ClipboardCheck size={16} aria-hidden="true" /> Disclosure checklist governance
          </h2>
          <p className="panel-description">
            Customer-authored workflow aids for shadow mode. They are not legal or compliance determinations.
          </p>
        </div>
        {canManage ? (
          <button type="button" className="btn" aria-expanded={showForm} aria-controls="disclosure-checklist-form" onClick={() => setShowForm((value) => !value)}>
            {showForm ? <X size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
            {showForm ? 'Close' : 'New version'}
          </button>
        ) : null}
      </div>
      {error ? <p role="alert" className="notice notice-error">{error}</p> : null}
      {message ? <p role="status" className="notice notice-success">{message}</p> : null}

      {showForm ? (
        <form id="disclosure-checklist-form" className="form-panel space-y-5" onSubmit={create}>
          <div className="notice notice-warning">
            Only enter a checklist supplied by the customer’s authorized policy owner. Every item must reference a published knowledge revision.
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <label className="text-sm space-y-2"><span>Title</span><input className="field" required maxLength={180} value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
            <label className="text-sm space-y-2"><span>Version</span><input className="field" required maxLength={50} value={form.version} onChange={(event) => setForm((current) => ({ ...current, version: event.target.value }))} /></label>
            <label className="text-sm space-y-2"><span>Workflow ID</span><input className="field" required maxLength={80} value={form.workflow} onChange={(event) => setForm((current) => ({ ...current, workflow: event.target.value }))} /></label>
            <label className="text-sm space-y-2"><span>Market</span><select className="field" value={form.market} onChange={(event) => setForm((current) => ({ ...current, market: event.target.value }))}><option value="india-loan">India loans</option><option value="india-insurance">India insurance</option><option value="ph-bancassurance">Philippines bancassurance</option><option value="id-finance">Indonesia finance</option></select></label>
            <label className="text-sm space-y-2"><span>Channel</span><select className="field" value={form.channel} onChange={(event) => setForm((current) => ({ ...current, channel: event.target.value }))}><option value="text">Text</option><option value="voice">Voice</option></select></label>
            <label className="text-sm space-y-2"><span>Effective from</span><input type="date" className="field" required value={form.effective_from} onChange={(event) => setForm((current) => ({ ...current, effective_from: event.target.value }))} /></label>
            <label className="text-sm space-y-2"><span>Effective through (optional)</span><input type="date" className="field" min={form.effective_from} value={form.effective_to} onChange={(event) => setForm((current) => ({ ...current, effective_to: event.target.value }))} /></label>
          </div>
          <label className="text-sm space-y-2 block"><span>Policy-owner note</span><textarea required rows={3} maxLength={2_000} value={form.owner_note} onChange={(event) => setForm((current) => ({ ...current, owner_note: event.target.value }))} placeholder="Identify the approved workflow purpose and customer owner; do not enter a legal conclusion." /></label>

          <div className="space-y-4">
            {form.items.map((item, index) => (
              <fieldset key={item.client_key} className="signal-tile !p-4 space-y-4">
                <legend className="text-xs font-semibold px-1">Topic {index + 1}</legend>
                <div className="grid md:grid-cols-2 gap-4">
                  <label className="text-sm space-y-2"><span>Stable item ID</span><input className="field" required pattern="[a-z][a-z0-9_-]{1,63}" value={item.id} onChange={(event) => updateItem(index, { id: event.target.value })} /></label>
                  <label className="text-sm space-y-2"><span>Display label</span><input className="field" required maxLength={180} value={item.label} onChange={(event) => updateItem(index, { label: event.target.value })} /></label>
                  <label className="text-sm space-y-2"><span>Applicability</span><select className="field" value={item.applicability} onChange={(event) => updateItem(index, { applicability: event.target.value })}><option value="required">Required</option><option value="conditional">Conditional</option></select></label>
                  <label className="text-sm space-y-2"><span>Evidence speaker</span><select className="field" value={item.roles[0]} onChange={(event) => updateItem(index, { roles: [event.target.value] })}><option value="assistant">Agent</option><option value="user">Customer</option></select></label>
                  <label className="text-sm space-y-2 md:col-span-2"><span>Description</span><textarea rows={2} maxLength={1_000} value={item.description} onChange={(event) => updateItem(index, { description: event.target.value })} /></label>
                  {item.applicability === 'conditional' ? <label className="text-sm space-y-2 md:col-span-2"><span>Applicability condition</span><textarea required rows={2} maxLength={1_000} value={item.condition_note} onChange={(event) => updateItem(index, { condition_note: event.target.value })} /></label> : null}
                  <label className="text-sm space-y-2"><span>Literal evidence phrases, one per line</span><textarea required rows={4} value={item.phrases} onChange={(event) => updateItem(index, { phrases: event.target.value })} /></label>
                  <label className="text-sm space-y-2"><span>Published source revision</span><select className="field" required value={item.source} onChange={(event) => updateItem(index, { source: event.target.value })}><option value="">Select a published revision</option>{published.map((document) => <option key={document.id} value={`${document.id}::${document.revision}`}>{document.title} · revision {document.revision}</option>)}</select></label>
                </div>
                <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={item.require_sources} onChange={(event) => updateItem(index, { require_sources: event.target.checked })} /> Require the configured source revision in agent-turn citations</label>
                {form.items.length > 1 ? <button type="button" className="btn btn-danger" onClick={() => setForm((current) => ({ ...current, items: current.items.filter((_, itemIndex) => itemIndex !== index) }))}><Trash2 size={13} aria-hidden="true" /> Remove topic</button> : null}
              </fieldset>
            ))}
          </div>
          <div className="flex flex-wrap justify-between gap-3">
            <button type="button" className="btn" onClick={() => setForm((current) => ({ ...current, items: [...current.items, emptyItem()] }))}><Plus size={14} aria-hidden="true" /> Add topic</button>
            <button type="submit" className="btn btn-primary" disabled={busy === 'create' || published.length === 0}><ClipboardCheck size={14} aria-hidden="true" /> {busy === 'create' ? 'Creating…' : 'Create immutable draft'}</button>
          </div>
          {published.length === 0 ? <p className="notice notice-warning">Publish an approved knowledge revision before creating a checklist.</p> : null}
        </form>
      ) : null}

      {loading ? <p role="status" className="text-xs text-muted">Loading checklist versions…</p> : null}
      {!loading && checklists.length === 0 ? <p className="text-xs text-muted">No checklist versions have been created. Live calls remain in an explicit “no approved checklist” state.</p> : null}
      <div className="grid lg:grid-cols-2 gap-4">
        {checklists.map((checklist) => (
          <ChecklistCard
            key={checklist.id}
            checklist={checklist}
            canManage={canManage}
            currentUserId={currentUserId}
            busy={busy === checklist.id}
            onApprove={(id) => act(id, 'approve')}
            onRetire={(id, note) => act(id, 'retire', { note })}
          />
        ))}
      </div>
    </section>
  );
}
