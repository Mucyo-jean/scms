import { Link } from 'react-router-dom';
import { FilePlus2, ArrowRight, Wallet, FileCheck2, AlertTriangle, ClipboardList, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDb } from '../../api/db';
import { OVERALL_STATUS, TASK_STATUS, overallStatus } from '../../api/api';
import { Card, EmptyState, PageHeader, ProgressBar, StatCard, StatusBadge, fmtDate, fmtMoney, timeAgo } from '../../components/ui';
import { DepartmentTracker } from '../../components/Tracker';

export default function StudentDashboard() {
  const { user } = useAuth();
  const requests = useDb((s) => s.requests.filter((r) => r.studentId === user.id));
  const notifications = useDb((s) => s.notifications.filter((n) => n.userId === user.id).slice(0, 4));
  const current = requests.find((r) => overallStatus(r) !== OVERALL_STATUS.CLEARED) ?? requests[0];
  const status = current && overallStatus(current);
  const count = (st) => current?.tasks.filter((t) => t.status === st).length ?? 0;
  const canApply = !requests.some((r) => overallStatus(r) !== OVERALL_STATUS.CLEARED);

  return (
    <>
      <PageHeader
        title={`Hello, ${user.name.split(' ')[0]} 👋`}
        subtitle={`${user.studentNumber} · ${user.programme} · Year ${user.yearOfStudy}`}
        actions={canApply && <Link to="/student/apply" className="btn btn-primary"><FilePlus2 size={18} /> New clearance request</Link>}
      />

      {!current ? (
        <Card>
          <EmptyState icon={ClipboardList} title="You haven't started your clearance yet">
            <p>Submit one request and it will be sent to every department that needs to clear you.</p>
            <Link to="/student/apply" className="btn btn-primary"><FilePlus2 size={18} /> Apply for clearance</Link>
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="stats">
            <StatCard label="Approved" value={count(TASK_STATUS.APPROVED)} icon={CheckCircle2} tone="green" />
            <StatCard label="Pending" value={count(TASK_STATUS.PENDING)} icon={Clock} tone="amber" />
            <StatCard label="Rejected" value={count(TASK_STATUS.REJECTED)} icon={XCircle} tone="red" />
            <StatCard label="Clearance fee" value={current.payment ? current.payment.status : 'None'} icon={Wallet} tone="blue" hint={current.payment ? fmtMoney(current.payment.amount) : 'No fee required'} />
          </div>

          {status === OVERALL_STATUS.ATTENTION && (
            <div className="alert alert-error with-action">
              <AlertTriangle size={20} />
              <span className="grow">One or more departments rejected your clearance. Review the reason, resolve the issue and resubmit.</span>
              <Link to={`/student/requests/${current.id}`} className="btn btn-sm btn-danger">Resolve now</Link>
            </div>
          )}
          {current.payment?.status === 'Unpaid' && (
            <div className="alert alert-warn with-action">
              <Wallet size={20} />
              <span className="grow">Your clearance fee of <strong>{fmtMoney(current.payment.amount)}</strong> is unpaid. Finance cannot approve until it is paid.</span>
              <Link to={`/student/requests/${current.id}/payment`} className="btn btn-sm btn-primary">Pay now</Link>
            </div>
          )}
          {status === OVERALL_STATUS.CLEARED && (
            <div className="alert alert-success with-action">
              <FileCheck2 size={20} />
              <span className="grow">Congratulations — you are fully cleared. Your digital clearance certificate is ready.</span>
              <Link to={`/student/requests/${current.id}/certificate`} className="btn btn-sm btn-success">View certificate</Link>
            </div>
          )}

          <div className="grid-main">
            <Card
              title={<>Clearance {current.ref} <StatusBadge status={status} /></>}
              actions={<Link to={`/student/requests/${current.id}`} className="btn btn-ghost btn-sm">Details <ArrowRight size={16} /></Link>}
            >
              <p className="muted small">Submitted {fmtDate(current.createdAt)} · Purpose: {current.reason}</p>
              <ProgressBar request={current} />
              <DepartmentTracker request={current} />
            </Card>

            <div className="stack">
              <Card title="Recent notifications" actions={<Link to="/notifications" className="btn btn-ghost btn-sm">All</Link>}>
                {notifications.length === 0 ? <p className="muted small">Nothing yet.</p> : (
                  <ul className="mini-list">
                    {notifications.map((n) => (
                      <li key={n.id} className={n.read ? '' : 'unread'}>
                        <Link to={n.link ?? '/notifications'}><strong>{n.title}</strong></Link>
                        <span className="muted small">{timeAgo(n.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              {requests.length > 1 && (
                <Card title="Previous requests">
                  <ul className="mini-list">
                    {requests.filter((r) => r.id !== current.id).map((r) => (
                      <li key={r.id}>
                        <Link to={`/student/requests/${r.id}`}><strong>{r.ref}</strong></Link>
                        <StatusBadge status={overallStatus(r)} />
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
