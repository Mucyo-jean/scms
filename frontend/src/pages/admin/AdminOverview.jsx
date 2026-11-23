import { Link } from 'react-router-dom';
import { Users, ClipboardList, Clock, AlertTriangle, BadgeCheck, Wallet, ArrowRight } from 'lucide-react';
import { useDb } from '../../api/db';
import { OVERALL_STATUS, TASK_STATUS, overallStatus } from '../../api/api';
import { Card, PageHeader, ProgressBar, StatCard, StatusBadge, fmtMoney, timeAgo } from '../../components/ui';
import { DeptIcon } from '../../components/Tracker';

const SEGMENTS = [
  { key: TASK_STATUS.APPROVED, cls: 'approved' },
  { key: TASK_STATUS.PENDING, cls: 'pending' },
  { key: TASK_STATUS.REJECTED, cls: 'rejected' },
];

export default function AdminOverview() {
  const { users, requests, departments, audit } = useDb();
  const students = users.filter((u) => u.role === 'student').length;
  const byStatus = (s) => requests.filter((r) => overallStatus(r) === s).length;
  const collected = requests.reduce((s, r) => s + (r.payment?.status === 'Paid' ? r.payment.amount : 0), 0);

  const cleared = requests.filter((r) => r.certificate);
  const avgDays = cleared.length
    ? (cleared.reduce((s, r) => s + (new Date(r.certificate.issuedAt) - new Date(r.createdAt)), 0) / cleared.length / 864e5).toFixed(1)
    : '—';

  const workload = departments.map((d) => {
    const tasks = requests.flatMap((r) => r.tasks.filter((t) => t.departmentId === d.id));
    return { d, total: tasks.length, ...Object.fromEntries(SEGMENTS.map(({ key }) => [key, tasks.filter((t) => t.status === key).length])) };
  });

  return (
    <>
      <PageHeader title="Administration overview" subtitle="Clearance activity across all departments." />
      <div className="stats five">
        <StatCard label="Registered students" value={students} icon={Users} tone="blue" />
        <StatCard label="Clearance requests" value={requests.length} icon={ClipboardList} tone="blue" />
        <StatCard label="In progress" value={byStatus(OVERALL_STATUS.IN_PROGRESS)} icon={Clock} tone="amber" />
        <StatCard label="Requires attention" value={byStatus(OVERALL_STATUS.ATTENTION)} icon={AlertTriangle} tone="red" />
        <StatCard label="Cleared" value={byStatus(OVERALL_STATUS.CLEARED)} icon={BadgeCheck} tone="green" hint={`avg ${avgDays} days to clear`} />
      </div>

      <div className="grid-main">
        <Card title="Department workload" actions={
          <div className="legend">
            {SEGMENTS.map(({ key, cls }) => <span key={key}><i className={`sw sw-${cls}`} />{key}</span>)}
          </div>
        }>
          <ul className="workload">
            {workload.map(({ d, total, ...counts }) => (
              <li key={d.id}>
                <div className="workload-head">
                  <span className="title-with-icon"><span className="dept-icon sm"><DeptIcon code={d.code} size={15} /></span>{d.name}{!d.active && <span className="muted small"> (inactive)</span>}</span>
                  <span className="muted small">{counts.Approved} approved · {counts.Pending} pending · {counts.Rejected} rejected</span>
                </div>
                <div className="stack-bar">
                  {total === 0 && <span className="stack-empty" />}
                  {SEGMENTS.map(({ key, cls }) => counts[key] > 0 && (
                    <span key={key} className={`seg seg-${cls}`} style={{ flexGrow: counts[key] }} title={`${d.name} · ${key}: ${counts[key]} of ${total}`} />
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <div className="muted small mt"><Wallet size={14} className="inline-icon" /> Clearance fees collected: <strong>{fmtMoney(collected)}</strong></div>
        </Card>

        <Card title="Recent activity" actions={<Link to="/admin/audit" className="btn btn-ghost btn-sm">Audit trail <ArrowRight size={15} /></Link>}>
          <ul className="activity">
            {audit.slice(0, 7).map((a) => (
              <li key={a.id}>
                <div className="small">{a.details}</div>
                <div className="muted small">{a.actorName} · {timeAgo(a.at)}</div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Latest requests" pad={false} actions={<Link to="/admin/requests" className="btn btn-ghost btn-sm">All records <ArrowRight size={15} /></Link>}>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Request</th><th>Student</th><th>Purpose</th><th>Progress</th><th>Status</th></tr></thead>
            <tbody>
              {requests.slice(0, 5).map((r) => (
                <tr key={r.id}>
                  <td><Link to={`/admin/requests/${r.id}`} className="strong">{r.ref}</Link></td>
                  <td>{users.find((u) => u.id === r.studentId)?.name}</td>
                  <td>{r.reason}</td>
                  <td className="w-progress"><ProgressBar request={r} /></td>
                  <td><StatusBadge status={overallStatus(r)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
