import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Inbox, Clock, CheckCircle2, XCircle, Search, ChevronRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDb } from '../../api/db';
import { TASK_STATUS } from '../../api/api';
import { Card, EmptyState, PageHeader, ProgressBar, StatCard, StatusBadge, fmtDate, timeAgo } from '../../components/ui';
import { DeptIcon } from '../../components/Tracker';

const TABS = [TASK_STATUS.PENDING, TASK_STATUS.APPROVED, TASK_STATUS.REJECTED, 'All'];

export default function OfficerDashboard() {
  const { user } = useAuth();
  const dept = useDb((s) => s.departments.find((d) => d.id === user.departmentId));
  const allRequests = useDb((s) => s.requests);
  const users = useDb((s) => s.users);
  const [tab, setTab] = useState(TASK_STATUS.PENDING);
  const [q, setQ] = useState('');

  const rows = useMemo(() => allRequests
    .map((r) => ({ r, task: r.tasks.find((t) => t.departmentId === user.departmentId), student: users.find((u) => u.id === r.studentId) }))
    .filter((x) => x.task), [allRequests, users, user.departmentId]);

  const counts = Object.fromEntries(TABS.map((t) => [t, t === 'All' ? rows.length : rows.filter((x) => x.task.status === t).length]));
  const needle = q.trim().toLowerCase();
  const visible = rows
    .filter((x) => tab === 'All' || x.task.status === tab)
    .filter((x) => !needle || [x.r.ref, x.student?.name, x.r.form.studentNumber, x.r.form.programme].some((v) => v?.toLowerCase().includes(needle)))
    // Pending: oldest first (FIFO). Others: most recent first.
    .sort((a, b) => (tab === TASK_STATUS.PENDING ? new Date(a.r.updatedAt) - new Date(b.r.updatedAt) : new Date(b.r.updatedAt) - new Date(a.r.updatedAt)));

  const decidedToday = rows.filter((x) => x.task.decidedAt && new Date(x.task.decidedAt).toDateString() === new Date().toDateString()).length;

  return (
    <>
      <PageHeader
        title={<span className="title-with-icon"><span className="dept-icon lg"><DeptIcon code={dept?.code} size={22} /></span>{dept?.name} clearance queue</span>}
        subtitle={dept?.description}
      />
      <div className="stats">
        <StatCard label="Awaiting review" value={counts.Pending} icon={Clock} tone="amber" />
        <StatCard label="Approved" value={counts.Approved} icon={CheckCircle2} tone="green" />
        <StatCard label="Rejected" value={counts.Rejected} icon={XCircle} tone="red" />
        <StatCard label="Decided today" value={decidedToday} icon={Inbox} tone="blue" />
      </div>

      <Card pad={false}>
        <div className="toolbar">
          <div className="tabs flush">
            {TABS.map((t) => (
              <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t} <span className="tab-count">{counts[t]}</span></button>
            ))}
          </div>
          <label className="search">
            <Search size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, ref, student no." />
          </label>
        </div>
        {visible.length === 0 ? (
          <EmptyState icon={Inbox} title={tab === TASK_STATUS.PENDING && !needle ? 'Queue is clear' : 'No matching requests'}>
            {tab === TASK_STATUS.PENDING && !needle ? 'There are no requests waiting for your department.' : 'Try another filter or search term.'}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Request</th><th>Student</th><th>Purpose</th>
                  {dept?.requiresPayment && <th>Fee</th>}
                  <th>Overall progress</th><th>{dept?.name}</th><th />
                </tr>
              </thead>
              <tbody>
                {visible.map(({ r, task, student }) => (
                  <tr key={r.id}>
                    <td><Link to={`/officer/requests/${r.id}`} className="strong">{r.ref}</Link><div className="muted small">{tab === TASK_STATUS.PENDING ? `waiting ${timeAgo(r.updatedAt).replace(' ago', '')}` : fmtDate(r.updatedAt)}</div></td>
                    <td>{student?.name}<div className="muted small">{r.form.studentNumber}</div></td>
                    <td>{r.reason}</td>
                    {dept?.requiresPayment && <td><StatusBadge status={r.payment?.status ?? 'Paid'} /></td>}
                    <td className="w-progress"><ProgressBar request={r} /></td>
                    <td>
                      <StatusBadge status={task.status} />
                      {task.history.at(-1)?.status === 'Resubmitted' && task.status === TASK_STATUS.PENDING && <div className="small resub">Resubmitted</div>}
                    </td>
                    <td><Link to={`/officer/requests/${r.id}`} className="btn btn-sm btn-outline">{task.status === TASK_STATUS.PENDING ? 'Review' : 'View'} <ChevronRight size={15} /></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
