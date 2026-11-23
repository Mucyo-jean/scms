import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDb } from '../api/db';
import { markAllNotificationsRead, markNotificationRead } from '../api/api';
import { Card, EmptyState, PageHeader, fmtDateTime, timeAgo } from '../components/ui';

export default function Notifications() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const all = useDb((s) => s.notifications.filter((n) => n.userId === user.id));
  const items = filter === 'unread' ? all.filter((n) => !n.read) : all;
  const unread = all.filter((n) => !n.read).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={`${unread} unread`}
        actions={unread > 0 && <button className="btn btn-outline" onClick={() => markAllNotificationsRead(user.id)}><CheckCheck size={18} /> Mark all read</button>}
      />
      <div className="tabs">
        {['all', 'unread'].map((f) => (
          <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>{f === 'all' ? `All (${all.length})` : `Unread (${unread})`}</button>
        ))}
      </div>
      <Card pad={false}>
        {items.length === 0 ? (
          <EmptyState icon={Bell} title="No notifications">You'll be notified about approvals, rejections and completed clearances.</EmptyState>
        ) : (
          <ul className="notif-page">
            {items.map((n) => (
              <li key={n.id} className={n.read ? '' : 'unread'} onClick={() => { markNotificationRead(user.id, n.id); n.link && navigate(n.link); }}>
                <span className="dot" />
                <div className="grow">
                  <div className="notif-title">{n.title}</div>
                  <div className="notif-msg">{n.message}</div>
                </div>
                <span className="muted small" title={fmtDateTime(n.createdAt)}>{timeAgo(n.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
