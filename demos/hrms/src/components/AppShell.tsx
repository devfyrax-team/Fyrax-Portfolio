import { Fragment, ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon, IconName } from './Icon';
import { useTheme } from './theme';

export interface ShellLink { to: string; label: string; icon: IconName; end?: boolean; badge?: number; group?: string }
export interface ShellBell { to: string; count?: number }
export interface ShellAccount { email: string; role: string; accountTo?: string; onSignOut: () => void }

const initials = (email: string) => {
  const name = email.split('@')[0].split(/[._-]+/).filter(Boolean);
  return ((name[0]?.[0] ?? '') + (name[1]?.[0] ?? name[0]?.[1] ?? '')).toUpperCase() || '?';
};

export function Brand({ sub }: { sub?: string }) {
  return (
    <>
      <span className="brand-mark"><Icon name="users" size={18} /></span>
      <span className="brand-text">
        HRMS
        {sub && <span className="muted">{sub}</span>}
      </span>
    </>
  );
}

/**
 * Page pattern: app chrome. A dark sidebar on medium/wide screens; on narrow screens the same
 * destinations sit behind a menu button, so the sidebar rail never eats the page.
 */
export function AppShell({ label, brand, links, account, bell }: { label: string; brand: ReactNode; links: ShellLink[]; account: ShellAccount; bell?: ShellBell }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { theme, toggle } = useTheme();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">{brand}</div>
        <button className="side-btn" aria-expanded={open} aria-controls="main-nav" aria-label={open ? 'Close menu' : 'Open menu'} onClick={() => setOpen(!open)}>
          <Icon name={open ? 'x' : 'menu'} size={20} />
        </button>
      </header>
      <nav id="main-nav" className={open ? 'sidebar open' : 'sidebar'} aria-label={label}>
        <div className="brand brand-side">{brand}</div>
        {links.map((l, i) => (
          <Fragment key={l.to}>
            {(i === 0 || (l.group ?? 'Menu') !== (links[i - 1].group ?? 'Menu')) && <div className="nav-section">{l.group ?? 'Menu'}</div>}
            <NavLink to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}>
              <Icon name={l.icon} />
              <span className="label">{l.label}</span>
              {!!l.badge && <span className="nav-badge" aria-label={`${l.badge} waiting`}>{l.badge}</span>}
            </NavLink>
          </Fragment>
        ))}
        <div className="sidebar-foot">
          <div className="user-card">
            <span className="avatar" aria-hidden="true">{initials(account.email)}</span>
            <span className="user-meta">
              <span className="email" title={account.email}>{account.email}</span>
              <span className="role">{account.role}</span>
            </span>
          </div>
          <div className="foot-actions">
            {account.accountTo && (
              <Link to={account.accountTo} className="side-btn" aria-label="Change password" title="Change password">
                <Icon name="key" size={16} />
              </Link>
            )}
            <button className="side-btn" onClick={toggle} aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'} title={theme === 'dark' ? 'Light theme' : 'Dark theme'}>
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
            </button>
            <button className="side-btn grow" onClick={account.onSignOut}>
              <Icon name="logout" size={16} /> Sign out
            </button>
          </div>
        </div>
      </nav>
      <main className="content">
        {bell && (
          <div className="page-top">
            <Link to={bell.to} className="btn bell" aria-label={bell.count ? `Notifications, ${bell.count} unread` : 'Notifications'} title="Notifications">
              <Icon name="bell" size={18} />
              {!!bell.count && <span className="bell-dot" aria-hidden="true">{bell.count > 99 ? '99+' : bell.count}</span>}
            </Link>
          </div>
        )}
        <div className="page"><Outlet /></div>
      </main>
    </div>
  );
}
