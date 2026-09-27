import React, { useEffect, useState } from 'react';
import { Copy, RefreshCw, UserPlus, X } from 'lucide-react';
import { useWorkspaceAuth } from '../components/WorkspaceAuth';
import {
  EmptyState,
  LoadingState,
  PageHeading,
} from '../components/WorkspaceUI';

const field = 'field';
const button = 'btn';
async function request(path = '', options = {}) {
  const response = await fetch('/api/team' + path, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Team request failed');
  return data;
}
export default function TeamPage() {
  const { user } = useWorkspaceAuth();
  const [data, setData] = useState({ users: [], invites: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [invitation, setInvitation] = useState(null);
  const [copied, setCopied] = useState(false);
  async function refresh() {
    setLoading(true);
    try {
      const result = await request();
      setData(result);
      setError('');
      setInvitation((current) =>
        current && result.invites.some((invite) => invite.id === current.id)
          ? current
          : null
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    if (user.role === 'admin') refresh();
  }, [user.role]);
  async function mutate(path, method, body) {
    setBusy(true);
    setError('');
    try {
      const result = await request(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      await refresh();
      return result;
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  if (user.role !== 'admin')
    return (
      <section className="page">
        <PageHeading
          eyebrow="Workspace access"
          title="Team"
          description="Manage the people and permissions behind your workspace."
        />
        <div className="panel">
          <EmptyState icon={UserPlus} title="Administrator access required">
            Ask a workspace administrator to manage members and invitations.
          </EmptyState>
        </div>
      </section>
    );
  return (
    <section className="page">
      <PageHeading
        eyebrow="Better together"
        title="Team"
        description="Manage the people and permissions behind your workspace."
        actions={
          <button
            className="btn"
            aria-label="Refresh team"
            disabled={busy || loading}
            onClick={refresh}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        }
      />
      {error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <form
        className="form-panel space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          setInvitation(null);
          setCopied(false);
          const result = await mutate(
            '/invites',
            'POST',
            Object.fromEntries(new FormData(form))
          );
          if (result) {
            setInvitation(result);
            form.reset();
          }
        }}
      >
        <div>
          <h2 className="panel-title">Invite a teammate</h2>
          <p className="panel-description">
            Operators work with conversations. Administrators also manage
            knowledge and access.
          </p>
        </div>
        <div className="grid sm:grid-cols-[1fr_180px_auto] gap-4 items-end">
          <label className="text-sm space-y-2">
            <span>Email</span>
            <input
              name="email"
              type="email"
              required
              maxLength={254}
              className={field}
            />
          </label>
          <label className="text-sm space-y-2">
            <span>Role</span>
            <select name="role" className={field}>
              <option value="operator">Operator</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button className="btn btn-primary" disabled={busy}>
            <UserPlus size={18} />
            Invite
          </button>
        </div>
      </form>
      {invitation && (
        <div className="border-l-2 border-emerald-500 pl-4 space-y-3">
          <h2 className="font-semibold">Invitation Token</h2>
          <p className="font-mono text-sm break-all">{invitation.token}</p>
          <p className="text-sm">
            Expires {new Date(invitation.expires_at).toLocaleString()}
          </p>
          <button
            className={button}
            title="Copy invitation token"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(invitation.token);
                setCopied(true);
              } catch {
                setError(
                  'Clipboard unavailable. Select the invitation token to copy it.'
                );
              }
            }}
          >
            <Copy size={16} />
            {copied ? 'Copied' : 'Copy token'}
          </button>
          <button
            className={button + ' ml-2'}
            aria-label="Dismiss invitation token"
            title="Dismiss invitation token"
            onClick={() => setInvitation(null)}
          >
            <X size={16} />
          </button>
        </div>
      )}
      {loading && <LoadingState label="Loading team" />}
      <div className="data-table">
        <table className="w-full text-sm text-left">
          <thead className="border-b border-slate-300 dark:border-white/20">
            <tr>
              <th className="py-3">Member</th>
              <th className="py-3">Access</th>
            </tr>
          </thead>
          <tbody>
            {data.users.map((member) => (
              <tr
                key={member.id}
                className="border-b border-slate-200 dark:border-white/10"
              >
                <td className="py-4 pr-4 break-all">
                  {member.email}
                  {member.id === user.id ? ' (you)' : ''}
                </td>
                <td className="py-4 w-40">
                  <select
                    aria-label={'Access for ' + member.email}
                    value={member.role}
                    disabled={busy}
                    className={field}
                    onChange={async (event) => {
                      const role = event.target.value;
                      if (
                        !window.confirm(
                          'Change access for ' +
                            member.email +
                            ' to ' +
                            role +
                            '? Active sessions will be signed out.'
                        )
                      )
                        return;
                      const result = await mutate(
                        '/users/' + member.id,
                        'PATCH',
                        { role }
                      );
                      if (result && member.id === user.id)
                        window.location.reload();
                    }}
                  >
                    <option value="admin">Admin</option>
                    <option value="operator">Operator</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel space-y-3">
        <h2 className="panel-title">Pending invitations</h2>
        {!loading && data.invites.length === 0 && (
          <EmptyState compact icon={UserPlus} title="Everyone is accounted for">
            New invitations will appear here until accepted, revoked, or
            expired.
          </EmptyState>
        )}
        {data.invites.map((invite) => (
          <div
            key={invite.id}
            className="flex justify-between items-center gap-3 border-b border-slate-200 dark:border-white/10 py-3"
          >
            <div className="min-w-0">
              <p className="break-all">{invite.email}</p>
              <p className="text-sm capitalize">
                {invite.role} / Expires{' '}
                {new Date(invite.expires_at).toLocaleString()}
              </p>
            </div>
            <button
              className={button}
              title="Revoke invitation"
              aria-label={'Revoke invitation for ' + invite.email}
              disabled={busy}
              onClick={() =>
                mutate('/invites/' + invite.id + '/revoke', 'POST', {})
              }
            >
              <X size={18} />
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
