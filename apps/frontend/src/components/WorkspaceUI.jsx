import React, { createContext, useContext, useEffect, useState } from 'react';
import { ArrowUpRight, AudioLines } from 'lucide-react';
const ThemeContext = createContext(null);
export const useTheme = () => useContext(ThemeContext);
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('veyra-theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem('veyra-theme', theme);
    } catch {
      /* Storage may be disabled. */
    }
  }, [theme]);
  return (
    <ThemeContext.Provider
      value={{
        theme,
        toggleTheme: () =>
          setTheme((value) => (value === 'dark' ? 'light' : 'dark')),
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
export function Brand({ compact = false }) {
  return (
    <span className="brand">
      <span className="brand-mark" aria-hidden="true">
        <AudioLines size={22} strokeWidth={2.2} />
      </span>
      {!compact && (
        <span>
          veyra<span className="brand-period">.</span>
        </span>
      )}
    </span>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
  children,
}) {
  return (
    <header className="page-heading">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <div className="flex items-center gap-3">
          {children}
          <h1>{title}</h1>
        </div>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
export function StatusBadge({ tone = 'neutral', children, dot = true }) {
  const tones = {
    neutral: '',
    success: 'status-success',
    warning: 'status-warning',
    error: 'status-error',
    accent: 'status-accent',
  };
  return (
    <span className={`status-badge ${tones[tone] || ''}`}>
      {dot && <span className="status-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}
export function EmptyState({
  icon: Icon = AudioLines,
  title,
  children,
  action,
  compact = false,
}) {
  return (
    <div className={`empty-state ${compact ? 'empty-compact' : ''}`}>
      <span className="empty-icon">
        <Icon size={24} strokeWidth={1.5} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      <div className="empty-description">{children}</div>
      {action}
    </div>
  );
}
export function LoadingState({ label = 'Loading workspace', rows = 3 }) {
  return (
    <div className="loading-state" role="status">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton-row">
          <span className="skeleton skeleton-icon" />
          <span className="flex-1 space-y-2">
            <span className="skeleton block h-3 w-2/3" />
            <span className="skeleton block h-2 w-1/3" />
          </span>
        </div>
      ))}
    </div>
  );
}
export function TextAction({ children, onClick }) {
  return (
    <button type="button" className="text-action" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} aria-hidden="true" />
    </button>
  );
}
