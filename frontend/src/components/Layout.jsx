import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, FilePlus2, Bell, User, LogOut, Menu, Inbox, Users, Building2, ClipboardList, History, ShieldCheck, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDb } from '../api/db';
import { markAllNotificationsRead, markNotificationRead } from '../api/api';
import { timeAgo } from './ui';

const NAV = {
  student: [
    { to: '/student', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/student/apply', label: 'Apply for Clearance', icon: FilePlus2 },
  ],
  officer: [
    { to: '/officer', label: 'Review Queue', icon: Inbox, end: true },
  ],
  admin: [
    { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/admin/requests', label: 'Clearance Records', icon: ClipboardList },
    { to: '/admin/users', label: 'Users', icon: Users },
    { to: '/admin/departments', label: 'Departments', icon: Building2 },
    { to: '/admin/audit', label: 'Audit Trail', icon: History },
  ],
};
const COMMON = [
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/profile', label: 'My Profile', icon: User },
];

export const Logo = ({ light }) => (
  <span className={`logo ${light ? 'logo-light' : ''}`}>
    <span className="logo-mark"><ShieldCheck size={18} /></span>
    S-Clearance
  </span>
);

function NotificationBell({ userId }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const items = useDb((s) => s.notifications.filter((n) => n.userId === userId));
  const unread = items.filter((n) => !n.read).length;

  useEffect(() => {
    const close = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const go = (n) => {
    markNotificationRead(userId, n.id);
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  return (
    <div className="bell" ref={ref}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label={`Notifications (${unread} unread)`}>
        <Bell size={20} />
        {unread > 0 && <span className="bell-count">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="dropdown">
          <div className="dropdown-head">
            <strong>Notifications</strong>
            {unread > 0 && <button className="link-btn" onClick={() => markAllNotificationsRead(userId)}>Mark all read</button>}
          </div>
          {items.length === 0 && <p className="muted small pad">You're all caught up.</p>}
          <ul className="notif-list">
            {items.slice(0, 6).map((n) => (
              <li key={n.id} className={n.read ? '' : 'unread'} onClick={() => go(n)}>
                <div className="notif-title">{n.title}</div>
                <div className="notif-msg">{n.message}</div>
                <div className="muted small">{timeAgo(n.createdAt)}</div>
              </li>
            ))}
          </ul>
          <button className="dropdown-foot" onClick={() => { setOpen(false); navigate('/notifications'); }}>View all</button>
        </div>
      )}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const dept = useDb((s) => s.departments.find((d) => d.id === user?.departmentId));

  useEffect(() => { setNavOpen(false); }, [location.pathname]);

  const roleLabel = user.role === 'officer' ? `${dept?.name ?? ''} Officer` : user.role === 'admin' ? 'Administrator' : 'Student';
  const initials = user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="shell">
      <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
        <div className="sidebar-top">
          <Logo light />
          <button className="icon-btn mobile-only" onClick={() => setNavOpen(false)} aria-label="Close menu"><X size={20} /></button>
        </div>
        <nav>
          <div className="nav-section">Menu</div>
          {NAV[user.role].map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-link"><Icon size={18} /> {label}</NavLink>
          ))}
          <div className="nav-section">Account</div>
          {COMMON.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className="nav-link"><Icon size={18} /> {label}</NavLink>
          ))}
        </nav>
        <button className="nav-link logout" onClick={() => { logout(); navigate('/login'); }}><LogOut size={18} /> Sign out</button>
      </aside>
      {navOpen && <div className="scrim" onClick={() => setNavOpen(false)} />}

      <div className="main">
        <header className="topbar">
          <button className="icon-btn mobile-only" onClick={() => setNavOpen(true)} aria-label="Open menu"><Menu size={22} /></button>
          <div className="topbar-spacer" />
          <NotificationBell userId={user.id} />
          <NavLink to="/profile" className="user-chip">
            <span className="avatar">{initials}</span>
            <span className="user-chip-text">
              <strong>{user.name}</strong>
              <span className="muted small">{roleLabel}</span>
            </span>
          </NavLink>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
