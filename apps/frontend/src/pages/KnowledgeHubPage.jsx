import React, { useEffect, useRef, useState } from 'react';
import {
  Archive,
  ArrowLeft,
  BookOpen,
  Check,
  Eye,
  FilePlus2,
  RefreshCw,
  Search,
  Upload,
} from 'lucide-react';
import { useWorkspaceAuth } from '../components/WorkspaceAuth';
import {
  EmptyState,
  LoadingState,
  PageHeading,
  StatusBadge,
} from '../components/WorkspaceUI';

const inputClass = 'field';
const buttonClass = 'btn';
const markets = ['india', 'philippines', 'indonesia'];
const products = [
  'loan',
  'personal-loan',
  'auto-loan',
  'insurance',
  'life-insurance',
  'health-insurance',
  'bancassurance',
  'finance',
  'general',
];
const productLabel = (value) =>
  value === 'general' ? 'Shared across products' : value.replaceAll('-', ' ');
async function api(path, options) {
  const response = await fetch(path, options);
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error || 'The request failed. Please try again.');
  return data;
}

export default function KnowledgeHubPage() {
  const user = useWorkspaceAuth().user;
  const canManage = user.role === 'admin';
  const [documents, setDocuments] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [jobBusy, setJobBusy] = useState(null);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [busy, setBusy] = useState(null);
  const [filter, setFilter] = useState('');
  const [status, setStatus] = useState('all');
  const [selected, setSelected] = useState(null);
  const [revisionTarget, setRevisionTarget] = useState(null);
  const [revisions, setRevisions] = useState([]);
  const [comparison, setComparison] = useState(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [detailLoading, setDetailLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [market, setMarket] = useState('india');
  const [product, setProduct] = useState('');
  const [searching, setSearching] = useState(false);
  const [result, setResult] = useState(null);
  const [searchError, setSearchError] = useState('');
  const alive = useRef(true);
  const detailRequest = useRef(0);

  async function refresh() {
    try {
      const [data, queue] = await Promise.all([
        api('/api/knowledge/documents'),
        canManage ? api('/api/knowledge/jobs') : Promise.resolve({ jobs: [] }),
      ]);
      if (alive.current) {
        setDocuments(data.documents);
        setJobs(queue.jobs);
        setListError('');
      }
    } catch (err) {
      if (alive.current) setListError(err.message);
    } finally {
      if (alive.current) setLoading(false);
    }
  }
  useEffect(() => {
    alive.current = true;
    refresh();
    const timer = setInterval(refresh, 3000);
    return () => {
      alive.current = false;
      clearInterval(timer);
      detailRequest.current += 1;
    };
  }, []);

  async function upload(event) {
    event.preventDefault();
    const form = event.currentTarget;
    setUploading(true);
    setError('');
    try {
      await api(
        '/api/knowledge/documents' +
          (revisionTarget ? '/' + revisionTarget.id + '/revisions' : ''),
        { method: 'POST', body: new FormData(form) }
      );
      form.reset();
      setRevisionTarget(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }
  async function action(doc, name) {
    if (
      name === 'archive' &&
      !window.confirm(
        'Archive "' + doc.title + '" and remove its chunks from retrieval?'
      )
    )
      return;
    setBusy(doc.id);
    setError('');
    try {
      const data = await api(
        '/api/knowledge/documents/' + doc.id + '/' + name,
        {
          method: 'POST',
          ...(name === 'reject'
            ? {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: rejectionReason }),
              }
            : {}),
        }
      );
      setResult(null);
      await refresh();
      if (selected) await inspect(data.document);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }
  async function jobAction(job, name) {
    setJobBusy(job.id);
    setError('');
    try {
      await api('/api/knowledge/jobs/' + job.id + '/' + name, {
        method: 'POST',
      });
      await refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setJobBusy(null);
    }
  }
  async function inspect(doc) {
    const request = ++detailRequest.current;
    setSelected({ document: doc, chunks: [] });
    setRevisions([]);
    setComparison(null);
    setRejectionReason('');
    setDetailLoading(true);
    setError('');
    try {
      const [data, history] = await Promise.all([
        api('/api/knowledge/documents/' + doc.id),
        api('/api/knowledge/documents/' + doc.id + '/revisions'),
      ]);
      const previous = history.revisions.find(
        (item) => item.id === data.document.previousRevisionId
      );
      const before =
        previous && canManage
          ? await api('/api/knowledge/documents/' + previous.id)
          : null;
      if (request === detailRequest.current) {
        setSelected(data);
        setRevisions(history.revisions);
        setComparison(before);
      }
    } catch (err) {
      if (request === detailRequest.current) setError(err.message);
    } finally {
      if (request === detailRequest.current) setDetailLoading(false);
    }
  }
  async function search(event) {
    event.preventDefault();
    setSearching(true);
    setSearchError('');
    setResult(null);
    try {
      setResult(
        await api('/api/rag/retrieve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: query.trim(),
            market,
            ...(product ? { product } : {}),
            top_k: 3,
          }),
        })
      );
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearching(false);
    }
  }
  const latest = documents.filter((doc) => doc.isLatest !== false);
  const visible = latest.filter(
    (doc) =>
      (status === 'all' ||
        (status === 'rejected'
          ? doc.reviewStatus === 'rejected'
          : doc.status === status)) &&
      (doc.title + ' ' + doc.filename + ' ' + doc.market)
        .toLowerCase()
        .includes(filter.toLowerCase())
  );
  const selectedDoc =
    selected &&
    (documents.find((doc) => doc.id === selected.document.id) ||
      selected.document);
  useEffect(() => {
    if (
      selectedDoc &&
      selectedDoc.status !== selected.document.status &&
      ['ready', 'indexed', 'archived'].includes(selectedDoc.status)
    )
      void inspect(selectedDoc);
  }, [selectedDoc?.id, selectedDoc?.status, selected?.document.status]);
  function newRevision(doc) {
    detailRequest.current += 1;
    setSelected(null);
    setRevisionTarget(doc);
    setShowUpload(true);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function actions(doc) {
    const isLatest = doc.isLatest !== false;
    return (
      <div className="flex flex-wrap gap-2">
        {canManage &&
          isLatest &&
          !['uploaded', 'processing', 'publishing', 'withdrawing'].includes(
            doc.status
          ) &&
          !(doc.status === 'ready' && doc.reviewStatus === 'pending') && (
            <button
              className={buttonClass}
              disabled={busy !== null}
              onClick={() => newRevision(doc)}
            >
              <FilePlus2 size={16} />
              New revision
            </button>
          )}
        {canManage &&
          isLatest &&
          ['failed', 'archived'].includes(doc.status) && (
            <button
              className={buttonClass}
              disabled={busy !== null}
              onClick={() => action(doc, 'retry')}
            >
              <RefreshCw size={16} />
              {doc.status === 'archived'
                ? 'Restore as new revision'
                : 'Retry processing'}
            </button>
          )}
        {canManage &&
          !['archived', 'superseded', 'withdrawing'].includes(doc.status) && (
            <button
              className={buttonClass}
              title="Archive document"
              aria-label={'Archive ' + doc.title}
              disabled={
                busy !== null || ['uploaded', 'processing'].includes(doc.status)
              }
              onClick={() => action(doc, 'archive')}
            >
              <Archive size={16} />
            </button>
          )}
      </div>
    );
  }

  return (
    <section className="page">
      <PageHeading
        eyebrow="The source of better answers"
        title="Knowledge Hub"
        description="Publish reviewed knowledge. Keep every revision traceable."
        actions={
          <>
            <button
              className="btn"
              aria-label="Refresh documents"
              onClick={() =>
                selected ? inspect(selected.document) : refresh()
              }
            >
              <RefreshCw size={14} />
              Refresh
            </button>
            {canManage && !selected && (
              <button
                className="btn btn-primary"
                aria-expanded={showUpload}
                aria-controls="knowledge-upload"
                onClick={() => setShowUpload((value) => !value)}
              >
                <Upload size={14} />
                {showUpload ? 'Close upload' : 'Upload document'}
              </button>
            )}
          </>
        }
      >
        {selected && (
          <button
            className="icon-button"
            aria-label="Back to documents"
            onClick={() => {
              detailRequest.current += 1;
              setSelected(null);
              setError('');
            }}
          >
            <ArrowLeft size={18} />
          </button>
        )}
      </PageHeading>
      {error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {listError && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {listError}
        </p>
      )}
      {canManage && jobs.length > 0 && (
        <details
          className="panel !p-5"
          open={jobs.some((job) =>
            ['queued', 'running', 'retry', 'failed'].includes(job.state)
          )}
        >
          <summary className="cursor-pointer font-semibold">
            Knowledge jobs ·{' '}
            {
              jobs.filter((job) =>
                ['queued', 'running', 'retry'].includes(job.state)
              ).length
            }{' '}
            pending · {jobs.filter((job) => job.state === 'failed').length}{' '}
            failed
          </summary>
          <p className="text-sm text-muted mt-2">
            Work is saved and resumes after a restart. Publication and
            withdrawal take effect when their jobs finish.
          </p>
          <div className="mt-4 space-y-3 max-h-72 overflow-y-auto">
            {jobs.map((job) => {
              const doc = documents.find((item) => item.id === job.document_id);
              return (
                <article
                  key={job.id}
                  className="border-t border-slate-200 dark:border-white/10 pt-3 flex flex-wrap justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium break-words">
                      {doc?.title || 'Document'} · v{doc?.revision || 1} ·{' '}
                      {
                        {
                          process: 'Processing',
                          publish: 'Publication',
                          withdraw: 'Withdrawal',
                        }[job.kind]
                      }
                    </p>
                    <p className="text-xs mt-1 capitalize">
                      {job.state} · {job.attempts} attempt
                      {job.attempts === 1 ? '' : 's'}
                      {job.state === 'retry'
                        ? ' · Next retry ' +
                          new Date(job.next_attempt_at).toLocaleTimeString()
                        : ''}
                    </p>
                    {job.error && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                        {job.error}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 items-start">
                    {job.state === 'failed' && (
                      <button
                        className={buttonClass}
                        disabled={jobBusy !== null}
                        onClick={() => jobAction(job, 'retry')}
                      >
                        Retry job
                      </button>
                    )}
                    {job.kind === 'process' &&
                      ['queued', 'retry', 'failed'].includes(job.state) && (
                        <button
                          className={buttonClass}
                          disabled={jobBusy !== null}
                          onClick={() => jobAction(job, 'cancel')}
                        >
                          Cancel job
                        </button>
                      )}
                  </div>
                </article>
              );
            })}
          </div>
        </details>
      )}
      {selected ? (
        <div className="panel space-y-5 min-w-0">
          <div className="flex flex-wrap gap-3 items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold break-words">
                {selectedDoc.title}{' '}
                <span className="text-muted">
                  / Revision {selectedDoc.revision || 1}
                </span>
              </h2>
              <p className="text-sm capitalize mt-2">
                {selectedDoc.market} /{' '}
                {selectedDoc.product
                  ? productLabel(selectedDoc.product)
                  : 'Unclassified product'}{' '}
                / {selectedDoc.status} /{' '}
                {selectedDoc.reviewStatus || 'Legacy review state unavailable'}
              </p>
            </div>
            {actions(selectedDoc)}
          </div>
          {selectedDoc.contentHash && (
            <details className="text-xs text-muted">
              <summary className="cursor-pointer">
                Revision identity and authorship
              </summary>
              <div className="mt-2 space-y-1 break-all">
                <p>SHA-256: {selectedDoc.contentHash}</p>
                <p>Revision ID: {selectedDoc.id}</p>
                <p>
                  Uploaded {new Date(selectedDoc.createdAt).toLocaleString()} by{' '}
                  {selectedDoc.createdById}
                </p>
                {selectedDoc.approvedAt && (
                  <p>
                    Approved {new Date(selectedDoc.approvedAt).toLocaleString()}{' '}
                    by {selectedDoc.approvedById}
                  </p>
                )}
              </div>
            </details>
          )}
          {selectedDoc.rejectionReason && (
            <p className="rounded-lg border border-red-300 p-4 text-sm">
              <strong>Changes requested:</strong> {selectedDoc.rejectionReason}
            </p>
          )}
          {!selectedDoc.product && (
            <p className="text-sm text-amber-700 dark:text-amber-300">
              This revision has no product classification and is excluded from
              product-specific agent answers. Create and review a classified
              revision to use it in those agents.
            </p>
          )}
          {['publishing', 'withdrawing'].includes(selectedDoc.status) && (
            <p
              role="status"
              className="text-sm text-amber-700 dark:text-amber-300"
            >
              {selectedDoc.status === 'publishing'
                ? 'Approval saved. Publication is pending; check the job status above.'
                : 'Withdrawal requested. This revision may remain searchable until the withdrawal job completes.'}
            </p>
          )}
          {selectedDoc.activeRevision && (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              Revision {selectedDoc.activeRevision} is currently live.{' '}
              {selectedDoc.activeRevisionId !== selectedDoc.id &&
                'This revision is not used to answer questions.'}
            </p>
          )}
          {canManage &&
            selectedDoc.status === 'ready' &&
            selectedDoc.reviewStatus === 'pending' && (
              <div className="rounded-lg border border-amber-300 dark:border-amber-700 p-5 space-y-3">
                <h3 className="font-semibold">Review this revision</h3>
                {selectedDoc.createdById === user.id ? (
                  <p className="text-sm">
                    Another administrator must review your revision before it
                    can go live.
                  </p>
                ) : (
                  <>
                    <p className="text-sm">
                      Check the content and scope below. Approval replaces the
                      currently published revision.
                    </p>
                    <button
                      className={buttonClass}
                      disabled={
                        busy !== null ||
                        detailLoading ||
                        selected.chunks.length === 0
                      }
                      onClick={() => action(selectedDoc, 'approve')}
                    >
                      <Check size={16} />
                      Approve and publish revision {selectedDoc.revision}
                    </button>
                    <form
                      className="space-y-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        action(selectedDoc, 'reject');
                      }}
                    >
                      <label className="block text-sm space-y-2">
                        <span>Reason for requesting changes</span>
                        <textarea
                          className={inputClass}
                          value={rejectionReason}
                          onChange={(event) =>
                            setRejectionReason(event.target.value)
                          }
                          maxLength={2000}
                          required
                          rows={2}
                        />
                      </label>
                      <button
                        className={buttonClass}
                        disabled={busy !== null || !rejectionReason.trim()}
                      >
                        Reject revision
                      </button>
                    </form>
                  </>
                )}
              </div>
            )}
          <div className="space-y-3">
            <h3 className="font-semibold">Revision history</h3>
            <div className="flex flex-wrap gap-2">
              {revisions
                .filter((doc) => canManage || doc.status === 'indexed')
                .map((doc) => (
                  <button
                    key={doc.id}
                    className={
                      buttonClass +
                      (doc.id === selectedDoc.id
                        ? ' !border-emerald-500 bg-emerald-50 dark:bg-emerald-950'
                        : '')
                    }
                    aria-pressed={doc.id === selectedDoc.id}
                    onClick={() => inspect(doc)}
                  >
                    v{doc.revision} ·{' '}
                    {doc.reviewStatus === 'rejected' ? 'Rejected' : doc.status}
                  </button>
                ))}
            </div>
          </div>
          {detailLoading ? (
            <p role="status">Loading revision...</p>
          ) : (
            <div
              className={'grid gap-6 ' + (comparison ? 'lg:grid-cols-2' : '')}
            >
              {comparison && (
                <div className="signal-tile space-y-4">
                  <h3 className="font-semibold">
                    Previous · Revision {comparison.document.revision}
                  </h3>
                  <p className="text-sm text-muted">
                    {comparison.document.title} · {comparison.document.market} ·{' '}
                    {comparison.document.category}
                  </p>
                  {comparison.chunks.length ? (
                    comparison.chunks.map((chunk) => (
                      <p
                        key={chunk.chunk_id}
                        className="whitespace-pre-wrap break-words text-sm"
                      >
                        {chunk.content}
                      </p>
                    ))
                  ) : (
                    <p className="text-sm">
                      No retained content available for this revision.
                    </p>
                  )}
                </div>
              )}
              <div className="signal-tile space-y-4">
                <h3 className="font-semibold">
                  Selected · Revision {selectedDoc.revision}
                </h3>
                <p className="text-sm text-muted">
                  {selectedDoc.title} · {selectedDoc.market} ·{' '}
                  {selectedDoc.category}
                </p>
                {selected.chunks.length === 0 ? (
                  <p>No processed content available.</p>
                ) : (
                  selected.chunks.map((chunk) => (
                    <article key={chunk.chunk_id} className="space-y-2">
                      <p className="whitespace-pre-wrap break-words text-sm">
                        {chunk.content}
                      </p>
                      <p className="font-mono text-xs break-all text-muted">
                        {chunk.chunk_id}
                      </p>
                    </article>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="metrics-strip stats-three">
            {[
              ['Documents', latest.length],
              [
                'Published revisions',
                documents.filter((doc) => doc.status === 'indexed').length,
              ],
              [
                'Awaiting review',
                latest.filter(
                  (doc) =>
                    doc.status === 'ready' && doc.reviewStatus === 'pending'
                ).length,
              ],
            ].map(([label, value]) => (
              <div key={label} className="metric">
                <p className="metric-label">{label}</p>
                <p className="metric-value">{loading ? '…' : value}</p>
              </div>
            ))}
          </div>
          {canManage && showUpload && (
            <form
              id="knowledge-upload"
              key={revisionTarget?.id || 'new'}
              onSubmit={upload}
              className="form-panel space-y-5"
            >
              <h2 className="text-lg font-semibold">
                {revisionTarget
                  ? `New revision of ${revisionTarget.title}`
                  : 'Upload Document'}
              </h2>
              {revisionTarget && (
                <p className="text-sm text-muted">
                  Upload the replacement file. The published revision stays live
                  until a different administrator approves this update.
                </p>
              )}
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <label className="text-sm space-y-2">
                  <span>Title</span>
                  <input
                    name="title"
                    defaultValue={revisionTarget?.title || ''}
                    required
                    maxLength={180}
                    className={inputClass}
                  />
                </label>
                <label className="text-sm space-y-2">
                  <span>Market</span>
                  <select
                    name="market"
                    defaultValue={revisionTarget?.market || 'india'}
                    className={inputClass}
                  >
                    {markets.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm space-y-2">
                  <span>Product scope</span>
                  <select
                    name="product"
                    required
                    defaultValue={revisionTarget?.product || ''}
                    className={inputClass}
                  >
                    <option value="">Choose a product</option>
                    {[
                      ...new Set([
                        ...products,
                        ...(revisionTarget?.product
                          ? [revisionTarget.product]
                          : []),
                      ]),
                    ].map((value) => (
                      <option key={value} value={value}>
                        {productLabel(value)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm space-y-2">
                  <span>Category</span>
                  <input
                    name="category"
                    defaultValue={revisionTarget?.category || 'policy'}
                    required
                    maxLength={80}
                    className={inputClass}
                  />
                </label>
                <label className="text-sm space-y-2">
                  <span>File (PDF, TXT, MD; max 5 MB)</span>
                  <input
                    name="file"
                    type="file"
                    accept=".pdf,.txt,.md"
                    required
                    className="block w-full min-w-0 text-sm"
                  />
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={uploading}
                >
                  <Upload size={16} />
                  {uploading
                    ? 'Uploading...'
                    : revisionTarget
                      ? 'Upload revision'
                      : 'Upload'}
                </button>
                {revisionTarget && (
                  <button
                    type="button"
                    className={buttonClass}
                    disabled={uploading}
                    onClick={() => setRevisionTarget(null)}
                  >
                    Cancel revision
                  </button>
                )}
              </div>
            </form>
          )}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3 justify-between items-center">
              <h2 className="text-lg font-semibold">
                Workspace documents{' '}
                <span className="text-sm font-normal">({latest.length})</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                <input
                  aria-label="Filter documents"
                  placeholder="Find document"
                  value={filter}
                  onChange={(event) => setFilter(event.target.value)}
                  className={inputClass + ' sm:!w-56'}
                />
                <select
                  aria-label="Document status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className={inputClass + ' sm:!w-40'}
                >
                  {[
                    'all',
                    'uploaded',
                    'processing',
                    'ready',
                    'publishing',
                    'indexed',
                    'withdrawing',
                    'rejected',
                    'failed',
                    'archived',
                  ].map((value) => (
                    <option key={value} value={value}>
                      {value === 'all' ? 'All statuses' : value}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {loading ? (
              <div className="panel">
                <LoadingState label="Loading documents" />
              </div>
            ) : visible.length === 0 ? (
              <div className="panel">
                <EmptyState
                  icon={BookOpen}
                  title={
                    filter || status !== 'all'
                      ? 'No matching documents'
                      : 'Build a trusted knowledge library'
                  }
                >
                  {filter || status !== 'all'
                    ? 'Try another search or status filter.'
                    : canManage
                      ? 'Upload a document, check its content, and have another administrator review it before publication.'
                      : 'Published knowledge will appear here once your administrators have reviewed it.'}
                </EmptyState>
              </div>
            ) : (
              <div className="data-table">
                <table className="w-full text-sm text-left">
                  <thead className="border-b border-slate-300 dark:border-white/20">
                    <tr>
                      {[
                        'Document',
                        'Market',
                        'Status',
                        'Chunks',
                        'PII signal',
                        'Actions',
                      ].map((value) => (
                        <th key={value} className="p-3 font-medium">
                          {value}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((doc) => (
                      <tr
                        key={doc.id}
                        className="border-b border-slate-200 dark:border-white/10"
                      >
                        <td className="p-3 min-w-48 max-w-80 break-words">
                          <p className="font-medium">{doc.title}</p>
                          <p className="text-xs text-muted break-all">
                            {doc.filename}
                          </p>
                          <p className="text-xs mt-1">
                            Revision {doc.revision || 1}
                            {doc.activeRevision && (
                              <span className="text-emerald-700 dark:text-emerald-300">
                                {' '}
                                · v{doc.activeRevision} live
                              </span>
                            )}
                          </p>
                          <p className="text-xs mt-1 capitalize">
                            {doc.product
                              ? productLabel(doc.product)
                              : 'Unclassified product'}
                          </p>
                          {doc.rejectionReason && (
                            <p className="text-xs text-red-600 mt-1">
                              Changes requested: {doc.rejectionReason}
                            </p>
                          )}
                          {doc.error && (
                            <p className="text-red-600 dark:text-red-400 mt-2">
                              {doc.error}
                            </p>
                          )}
                        </td>
                        <td className="p-3 capitalize">{doc.market}</td>
                        <td className="p-3">
                          <StatusBadge
                            tone={
                              doc.status === 'indexed'
                                ? 'success'
                                : doc.status === 'failed' ||
                                    doc.reviewStatus === 'rejected'
                                  ? 'error'
                                  : [
                                        'ready',
                                        'publishing',
                                        'processing',
                                        'withdrawing',
                                      ].includes(doc.status)
                                    ? 'warning'
                                    : 'neutral'
                            }
                          >
                            {doc.reviewStatus === 'rejected'
                              ? 'Rejected'
                              : doc.status}
                          </StatusBadge>
                          {doc.status === 'ready' &&
                            doc.reviewStatus === 'pending' && (
                              <span className="block text-[10px] text-muted mt-2">
                                Awaiting approval
                              </span>
                            )}
                        </td>
                        <td className="p-3">{doc.chunks}</td>
                        <td className="p-3">
                          {doc.piiDetected === null
                            ? 'Pending'
                            : doc.piiDetected
                              ? 'Detected, unmasked'
                              : 'Not detected'}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            {(canManage || doc.status === 'indexed') && (
                              <button
                                className={buttonClass}
                                title="Review revision and history"
                                aria-label={'Inspect ' + doc.title}
                                onClick={() => inspect(doc)}
                              >
                                <Eye size={16} />
                                Review
                              </button>
                            )}
                            {!canManage &&
                              doc.activeRevisionId &&
                              doc.status !== 'indexed' && (
                                <button
                                  className={buttonClass}
                                  onClick={() =>
                                    inspect(
                                      documents.find(
                                        (item) =>
                                          item.id === doc.activeRevisionId
                                      )
                                    )
                                  }
                                >
                                  View live revision
                                </button>
                              )}
                            {actions(doc)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="panel space-y-4">
            <div>
              <h2 className="panel-title">Test your knowledge</h2>
              <p className="panel-description">
                Ask a question to inspect the sources available for a market and
                product.
              </p>
            </div>
            <form onSubmit={search} className="flex flex-wrap gap-3">
              <input
                aria-label="Knowledge query"
                placeholder="Ask a policy question"
                required
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className={inputClass + ' flex-1 !w-auto basis-64'}
              />
              <select
                aria-label="Retrieval market"
                value={market}
                onChange={(event) => setMarket(event.target.value)}
                className={inputClass + ' !w-auto'}
              >
                {markets.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
              <select
                aria-label="Retrieval product"
                value={product}
                onChange={(event) => setProduct(event.target.value)}
                className={inputClass + ' !w-auto'}
              >
                <option value="">All products</option>
                {products
                  .filter((value) => value !== 'general')
                  .map((value) => (
                    <option key={value} value={value}>
                      {productLabel(value)}
                    </option>
                  ))}
              </select>
              <button
                className="btn btn-primary"
                title="Search knowledge"
                aria-label="Search knowledge"
                disabled={searching || !query.trim()}
              >
                <Search size={16} />
                Search
              </button>
            </form>
            {searching && <p role="status">Retrieving...</p>}
            {searchError && (
              <p role="alert" className="text-red-600 dark:text-red-400">
                {searchError}
              </p>
            )}
            {result && (
              <div className="space-y-4">
                <p className="break-words">{result.answer}</p>
                <p className="text-sm">
                  {result.sources?.length || 0} sources /{' '}
                  {result.latency_ms ?? '-'} ms
                </p>
                {result.sources?.map((source, index) => (
                  <article
                    key={source.chunk_id || index}
                    className="border-l-2 border-emerald-500 pl-4 space-y-1 break-words"
                  >
                    <h3 className="font-medium">
                      {source.title || source.source}
                    </h3>
                    {source.revision && (
                      <p className="text-xs">Revision {source.revision}</p>
                    )}
                    {source.product && (
                      <p className="text-xs capitalize">
                        {productLabel(source.product)}
                      </p>
                    )}
                    <p className="text-xs font-mono break-all">
                      {source.chunk_id}
                    </p>
                    <p className="text-sm">{source.excerpt}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
