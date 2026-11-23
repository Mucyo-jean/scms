import { BookOpen, Wallet, GraduationCap, Cpu, Building2 } from 'lucide-react';
import { useDb } from '../api/db';
import { StatusBadge, fmtDateTime } from './ui';

const DEPT_ICONS = { LIB: BookOpen, FIN: Wallet, ACA: GraduationCap, ICT: Cpu };
export const DeptIcon = ({ code, size = 18 }) => {
  const Icon = DEPT_ICONS[code] ?? Building2;
  return <Icon size={size} />;
};

// Per-department status list for one clearance request. `renderAction` lets
// callers inject a per-task control (e.g. the student's "Resolve" button).
export function DepartmentTracker({ request, renderAction, highlight }) {
  const departments = useDb((s) => s.departments);
  const users = useDb((s) => s.users);
  return (
    <ul className="tracker">
      {request.tasks.map((t) => {
        const d = departments.find((x) => x.id === t.departmentId);
        const officer = users.find((u) => u.id === t.officerId);
        return (
          <li key={t.departmentId} className={`tracker-item status-${t.status.toLowerCase()} ${highlight === t.departmentId ? 'highlight' : ''}`}>
            <span className="dept-icon"><DeptIcon code={d?.code} /></span>
            <div className="grow">
              <div className="tracker-head">
                <strong>{d?.name ?? 'Removed department'}</strong>
                <StatusBadge status={t.status} />
              </div>
              {t.status !== 'Pending' && (
                <div className="muted small">{t.status} by {officer?.name ?? 'officer'} · {fmtDateTime(t.decidedAt)}</div>
              )}
              {t.status === 'Pending' && <div className="muted small">{d?.description}</div>}
              {t.comment && <div className={`tracker-comment ${t.status === 'Rejected' ? 'reject' : ''}`}>“{t.comment}”</div>}
              {renderAction?.(t, d)}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Merged chronological history of every department's task.
export function RequestTimeline({ request }) {
  const departments = useDb((s) => s.departments);
  const events = request.tasks
    .flatMap((t) => t.history.map((h) => ({ ...h, dept: departments.find((d) => d.id === t.departmentId)?.name })))
    .filter((e, i, arr) => e.status !== 'Submitted' || arr.findIndex((x) => x.status === 'Submitted') === i)
    .sort((a, b) => new Date(b.at) - new Date(a.at));
  if (request.payment?.paidAt) events.push({ at: request.payment.paidAt, status: 'Paid', by: request.payment.method, note: `Ref ${request.payment.txRef}` });
  if (request.certificate) events.push({ at: request.certificate.issuedAt, status: 'Cleared', by: 'System', note: `Certificate ${request.certificate.number} issued` });
  events.sort((a, b) => new Date(b.at) - new Date(a.at));

  return (
    <ol className="timeline">
      {events.map((e, i) => (
        <li key={i} className={`tl-${e.status.toLowerCase()}`}>
          <span className="tl-dot" />
          <div>
            <div>
              <strong>{e.status === 'Submitted' ? 'Request submitted' : e.status === 'Paid' ? 'Clearance fee paid' : e.status === 'Cleared' ? 'Clearance completed' : `${e.dept}: ${e.status}`}</strong>
              <span className="muted small"> · {e.by}</span>
            </div>
            {e.note && <div className="small">{e.note}</div>}
            <div className="muted small">{fmtDateTime(e.at)}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
