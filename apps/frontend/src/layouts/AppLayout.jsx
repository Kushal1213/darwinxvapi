import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  History,
  Inbox,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  ShieldCheck,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useWorkspaceAuth } from '../components/WorkspaceAuth';
import { Brand, useTheme } from '../components/WorkspaceUI';
import OperationalStatusBanner from '../components/OperationalStatusBanner';
const groups = [
  {
    label: 'Workspace',
    items: [
      ['dashboard', 'Dashboard', LayoutDashboard],
      ['agents', 'Voice Agents', Phone],
      ['insights', 'Live Insights', Activity],
      ['history', 'Call History', History],
      ['handoffs', 'Handoff Inbox', Inbox],
    ],
  },
  {
    label: 'Intelligence',
    items: [
      ['knowledge', 'Knowledge Base', BookOpen],
      ['analytics', 'Analytics', BarChart3],
    ],
  },
  {
    label: 'Manage',
    items: [
      ['team', 'Team', Users],
      ['qa', 'QA & Coaching', ClipboardCheck],
      ['operations', 'Operations', ShieldCheck],
      ['architecture', 'Architecture', Network],
    ],
  },
];
export default function AppLayout({ activeTab, setActiveTab, children }) {
  const { workspace, user, logout } = useWorkspaceAuth();
  const { theme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [logoutError, setLogoutError] = useState('');
  const mobileNav = useRef(null);
  const pageFocus = useRef(null);
  const current = groups
    .flatMap((group) => group.items)
    .find((item) => item[0] === activeTab);
  const groupName = groups.find((group) =>
    group.items.some((item) => item[0] === activeTab)
  )?.label;
  const navigate = (tab) => {
    setActiveTab(tab);
    mobileNav.current?.close();
  };
  useEffect(() => {
    document.title = `${current?.[1] || 'Workspace'} · Veyra`;
    window.scrollTo({ top: 0, behavior: 'instant' });
    pageFocus.current?.focus({ preventScroll: true });
  }, [activeTab]);
  const navigation = (mobile = false) => (
    <>
      <div className="sidebar-brand">
        <button
          aria-label="Veyra dashboard"
          onClick={() => navigate('dashboard')}
        >
          <Brand compact={collapsed && !mobile} />
        </button>
        {mobile && (
          <button
            className="icon-button"
            aria-label="Close navigation"
            onClick={() => mobileNav.current.close()}
          >
            <X size={20} />
          </button>
        )}
      </div>
      <div className="workspace-switch" title={workspace.name}>
        <span className="workspace-avatar">
          {workspace.name.slice(0, 1).toUpperCase()}
        </span>
        <span className="nav-copy min-w-0">
          <strong className="truncate block">{workspace.name}</strong>
          <span>Workspace</span>
        </span>
      </div>
      <nav
        aria-label={mobile ? 'Mobile navigation' : 'Main navigation'}
        className="sidebar-nav"
      >
        {groups.map((group) => (
          <div className="nav-group" key={group.label}>
            <p className="nav-group-label">{group.label}</p>
            {group.items
              .filter(([id]) => !['team', 'qa', 'operations'].includes(id) || user.role === 'admin')
              .map(([id, label, Icon]) => (
                <button
                  key={id}
                  className={`nav-item ${activeTab === id ? 'is-active' : ''}`}
                  aria-current={activeTab === id ? 'page' : undefined}
                  title={label}
                  onClick={() => navigate(id)}
                >
                  <Icon size={18} strokeWidth={1.7} aria-hidden="true" />
                  <span className="nav-copy">{label}</span>
                  {activeTab === id && (
                    <span className="nav-active-dot nav-copy" />
                  )}
                </button>
              ))}
          </div>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-note nav-copy">
          <span className="mini-wave" aria-hidden="true">
            {[8, 16, 24, 12, 20, 30, 18, 10, 22, 14, 6].map((height, index) => (
              <i key={index} style={{ height }} />
            ))}
          </span>
          <p>
            Every conversation.
            <br />
            <strong>A clearer picture.</strong>
          </p>
        </div>
        <div className="account-row">
          <span className="account-avatar" aria-hidden="true">
            {user.email.slice(0, 1).toUpperCase()}
          </span>
          <span className="nav-copy min-w-0 flex-1">
            <strong className="truncate block" title={user.email}>
              {user.email.split('@')[0]}
            </strong>
            <span className="capitalize">{user.role}</span>
          </span>
          <button
            className="icon-button"
            aria-label="Sign out"
            title="Sign out"
            onClick={async () => {
              try {
                await logout();
              } catch (err) {
                setLogoutError(err.message);
              }
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </>
  );
  return (
    <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside
        className="desktop-sidebar"
        aria-label="Workspace navigation sidebar"
      >
        {navigation()}
      </aside>
      <dialog
        className="mobile-sidebar"
        ref={mobileNav}
        onClick={(event) => {
          if (event.target === mobileNav.current) mobileNav.current.close();
        }}
        aria-label="Workspace navigation"
      >
        <div className="mobile-sidebar-content">{navigation(true)}</div>
      </dialog>
      <div className="app-body">
        <header className="workspace-topbar">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="icon-button mobile-menu-button"
              aria-label="Open navigation"
              onClick={() => mobileNav.current.showModal()}
            >
              <Menu size={19} />
            </button>
            <button
              className="icon-button desktop-collapse"
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? (
                <PanelLeftOpen size={18} />
              ) : (
                <PanelLeftClose size={18} />
              )}
            </button>
            <div className="breadcrumb">
              <span>{groupName}</span>
              <ChevronRight size={13} />
              <strong>{current?.[1]}</strong>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="topbar-caption">Voice intelligence workspace</span>
            <button
              className="icon-button theme-toggle"
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>
        <main
          id="main-content"
          ref={pageFocus}
          tabIndex={-1}
          className="workspace-main"
        >
          {logoutError && (
            <p role="alert" className="notice notice-error mx-6 mt-6">
              {logoutError}
            </p>
          )}
          <OperationalStatusBanner onOpen={() => navigate('operations')} />
          {children}
        </main>
        <footer className="workspace-footer">
          <span>
            Veyra <span className="text-muted">/</span> Conversation
            intelligence
          </span>
          <button
            className="text-action"
            onClick={() => navigate('architecture')}
          >
            System overview
            <ArrowUpRight size={13} />
          </button>
        </footer>
      </div>
    </div>
  );
}
