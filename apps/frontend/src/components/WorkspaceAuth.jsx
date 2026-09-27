import React, { createContext, useContext, useEffect, useState } from 'react';
import { ArrowRight, Moon, Sun } from 'lucide-react';
import { Brand, useTheme, LoadingState } from './WorkspaceUI';

const AuthContext = createContext(null);
export const useWorkspaceAuth = () => useContext(AuthContext);

export default function WorkspaceAuth({ children }) {
  const { theme, toggleTheme } = useTheme();
  const [auth, setAuth] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function refresh() {
      try {
        const response = await fetch('/api/auth/session', {
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok)
          throw new Error('Workspace is unavailable. Please try again.');
        const data = await response.json();
        if (mounted) {
          setAuth(data);
          setError('');
        }
      } catch (err) {
        if (mounted) setError(err.message);
      }
    }
    refresh();
    const timer = setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => {
      mounted = false;
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [retry]);

  async function submit(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form));
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `/api/auth/${joining ? 'accept-invite' : auth.setup_required ? 'setup' : 'login'}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Setup-Token': values.setupToken || '',
          },
          body: JSON.stringify({
            email: values.email,
            password: values.password,
            workspace: values.workspace,
            token: values.token?.trim(),
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to sign in');
      form.reset();
      setAuth(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    const response = await fetch('/api/auth/logout', { method: 'POST' });
    if (!response.ok) throw new Error('Sign out failed. Please try again.');
    setAuth((current) => ({ ...current, user: null }));
  }

  if (auth?.user)
    return (
      <AuthContext.Provider value={{ ...auth, logout }}>
        {children}
      </AuthContext.Provider>
    );
  const field = 'field';
  return (
    <main className="auth-shell">
      <section className="auth-story">
        <Brand />
        <div className="auth-story-content">
          <p className="eyebrow">Conversation intelligence</p>
          <h2>
            Good conversations.
            <br />
            <span className="text-accent">Better understanding.</span>
          </h2>
          <p>
            Bring your agents, knowledge, and conversation insights into one
            considered workspace.
          </p>
          <div className="auth-art" aria-hidden="true">
            {Array.from({ length: 44 }, (_, i) => (
              <i
                key={i}
                style={{
                  height:
                    16 +
                    Math.abs(Math.sin(i * 0.46) * Math.cos(i * 0.12)) * 124,
                }}
              />
            ))}
          </div>
        </div>
        <small className="text-muted text-[10px]">
          Veyra / A clearer picture of every conversation
        </small>
      </section>
      <section className="auth-form-side">
        <button
          className="icon-button theme-toggle auth-theme"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="auth-form">
          {!auth ? (
            <div>
              {error ? (
                <p role="alert" className="notice notice-error">
                  {error}
                  <button
                    className="btn block mt-4"
                    onClick={() => setRetry((value) => value + 1)}
                  >
                    Retry
                  </button>
                </p>
              ) : (
                <LoadingState label="Loading workspace" />
              )}
            </div>
          ) : (
            <>
              <p className="eyebrow">
                {joining
                  ? 'Your team is waiting'
                  : auth.setup_required
                    ? 'Make room for better conversations'
                    : 'Welcome back'}
              </p>
              <h1>
                {joining
                  ? 'Join Workspace'
                  : auth.setup_required
                    ? 'Create Your Workspace'
                    : 'Sign In'}
              </h1>
              <p className="page-description mb-8">
                {joining
                  ? 'Use your invitation to join the conversation.'
                  : auth.setup_required
                    ? 'Set up your workspace and your administrator account.'
                    : `Continue to ${auth.workspace.name}.`}
              </p>
              <form onSubmit={submit} className="space-y-5">
                {auth.setup_required && (
                  <label>
                    Workspace name
                    <input
                      name="workspace"
                      required
                      maxLength={100}
                      autoComplete="organization"
                      className={field}
                      placeholder="Your company or team"
                    />
                  </label>
                )}
                {joining ? (
                  <label>
                    Invitation token
                    <input
                      name="token"
                      autoComplete="off"
                      required
                      maxLength={64}
                      className={field}
                    />
                  </label>
                ) : (
                  <label>
                    Email
                    <input
                      name="email"
                      type="email"
                      autoComplete="username"
                      required
                      maxLength={254}
                      className={field}
                      placeholder="you@company.com"
                    />
                  </label>
                )}
                <label>
                  {auth.setup_required || joining
                    ? 'Password (at least 12 characters)'
                    : 'Password'}
                  <input
                    name="password"
                    type="password"
                    autoComplete={
                      auth.setup_required || joining
                        ? 'new-password'
                        : 'current-password'
                    }
                    required
                    minLength={auth.setup_required || joining ? 12 : 1}
                    maxLength={256}
                    className={field}
                  />
                </label>
                {auth.setup_required && auth.setup_token_required && (
                  <label>
                    Setup token
                    <input
                      name="setupToken"
                      type="password"
                      autoComplete="off"
                      required
                      className={field}
                    />
                  </label>
                )}
                {error && (
                  <p role="alert" className="notice notice-error">
                    {error}
                  </p>
                )}
                <button
                  disabled={busy}
                  className="btn btn-primary w-full justify-between"
                >
                  {busy
                    ? 'Please wait...'
                    : joining
                      ? 'Join Workspace'
                      : auth.setup_required
                        ? 'Create Workspace'
                        : 'Sign In'}
                  <ArrowRight size={16} />
                </button>
                {!auth.setup_required && (
                  <button
                    type="button"
                    className="text-action"
                    onClick={() => {
                      setJoining((value) => !value);
                      setError('');
                    }}
                  >
                    {joining ? 'Back to sign in' : 'Join with invitation'}
                  </button>
                )}
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
