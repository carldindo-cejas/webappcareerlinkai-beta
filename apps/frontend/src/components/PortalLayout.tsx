import { ReactNode, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import Logo from './Logo';
import { useAuth } from '../lib/auth';

type PortalNavItem = {
  label: string;
  to: string;
};

function ChevronIcon({ direction = 'left' }: { direction?: 'left' | 'right' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d={direction === 'left' ? 'M9 3L5 7l4 4' : 'M5 3l4 4-4 4'}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

function SignOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function getInitials(name?: string | null) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}

type PortalLayoutProps = {
  title: string;
  subtitle?: string;
  navItems: PortalNavItem[];
  rightHeader?: ReactNode;
  children: ReactNode;
};

export default function PortalLayout({
  title,
  subtitle,
  navItems,
  rightHeader,
  children
}: PortalLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, signOut } = useAuth();
  const settingsPath =
    user?.role === 'student'
      ? '/portal/student/settings'
      : user?.role === 'counselor'
        ? '/portal/counselor/settings'
        : null;

  return (
    <div className="min-h-screen bg-cream-100 flex">
      <aside
        className={`fixed z-40 inset-y-0 left-0 bg-forest-700 text-cream-50 transition-all duration-200 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 ${collapsed ? 'md:w-20' : 'md:w-64'} w-72`}
      >
        <div className="h-full flex flex-col">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <Link to="/" className="inline-flex items-center" title="CareerLinkAI" aria-label="CareerLinkAI">
              {collapsed ? <span className="text-xl font-display">CL</span> : <Logo invert size="sm" />}
            </Link>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCollapsed(v => !v)}
                className="hidden md:inline-flex w-8 h-8 items-center justify-center rounded border border-white/20 hover:bg-white/10 text-cream-50"
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <ChevronIcon direction={collapsed ? 'right' : 'left'} />
              </button>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="md:hidden inline-flex w-8 h-8 items-center justify-center rounded border border-white/20 hover:bg-white/10 text-cream-50"
                aria-label="Close menu"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          {!collapsed && (
            <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
              {navItems.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) => `block px-3 py-2.5 rounded text-sm transition ${isActive ? 'bg-white/15 text-cream-50' : 'text-cream-200 hover:bg-white/10'}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          )}
          {collapsed && <div className="flex-1" />}

          <div className="mt-auto p-3 border-t border-white/10 space-y-2">
            {!collapsed ? (
              <div className="flex items-center gap-3 px-2 py-2 rounded">
                <div className="w-9 h-9 rounded-full bg-white/15 text-cream-50 inline-flex items-center justify-center font-mono text-[12px] tracking-wide shrink-0">
                  {getInitials(user?.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-cream-200/70">Signed in as</div>
                  <div className="text-sm text-cream-50 truncate">{user?.name || 'Guest'}</div>
                </div>
                {settingsPath && (
                  <Link
                    to={settingsPath}
                    onClick={() => setMobileOpen(false)}
                    className="w-8 h-8 inline-flex items-center justify-center rounded border border-white/20 text-cream-50 hover:bg-white/10 shrink-0"
                    title="Settings"
                    aria-label="Settings"
                  >
                    <SettingsIcon />
                  </Link>
                )}
              </div>
            ) : (
              settingsPath && (
                <Link
                  to={settingsPath}
                  onClick={() => setMobileOpen(false)}
                  className="w-full inline-flex items-center justify-center gap-2 px-2 py-2.5 rounded text-sm text-cream-200 hover:bg-white/10"
                  title="Settings"
                  aria-label="Settings"
                >
                  <SettingsIcon />
                </Link>
              )
            )}
            <button
              type="button"
              onClick={signOut}
              className={`w-full inline-flex items-center gap-2 px-3 py-2.5 rounded text-sm text-cream-200 hover:bg-white/10 ${collapsed ? 'justify-center px-2' : ''}`}
              title="Sign out"
              aria-label="Sign out"
            >
              <SignOutIcon />
              {!collapsed && <span>Sign out</span>}
            </button>
          </div>
        </div>
      </aside>

      {mobileOpen && (
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/35 z-30 md:hidden"
          aria-label="Close sidebar overlay"
        />
      )}

      <div className={`flex-1 w-full transition-all duration-200 ${collapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        <header className="sticky top-0 z-20 bg-cream-100/90 backdrop-blur border-b border-cream-300">
          <div className="px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="md:hidden inline-flex w-9 h-9 items-center justify-center rounded border border-cream-300 bg-white text-ink-900"
                aria-label="Open menu"
              >
                <MenuIcon />
              </button>
              <div className="min-w-0">
                <h1 className="text-2xl sm:text-3xl truncate">{title}</h1>
                {subtitle && <p className="text-sm text-ink-500 truncate">{subtitle}</p>}
              </div>
            </div>
            <div>{rightHeader}</div>
          </div>
        </header>

        <main className="p-4 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
