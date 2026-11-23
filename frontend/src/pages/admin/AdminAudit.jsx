import { useState } from 'react';
import { Search, History } from 'lucide-react';
import { useDb } from '../../api/db';
import { Card, EmptyState, PageHeader, fmtDateTime } from '../../components/ui';

const TONE = {
  TASK_APPROVED: 'approved', CLEARANCE_COMPLETED: 'approved', PAYMENT_COMPLETED: 'approved',
  TASK_REJECTED: 'rejected', PAYMENT_FAILED: 'rejected',
  REQUEST_SUBMITTED: 'pending', TASK_RESUBMITTED: 'pending',
};
const PAGE = 25;

export default function AdminAudit() {
  const audit = useDb((s) => s.audit);
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const actions = [...new Set(audit.map((a) => a.action))].sort();
  const needle = q.trim().toLowerCase();
  const rows = audit
    .filter((a) => !action || a.action === action)
    .filter((a) => !needle || [a.actorName, a.details].some((v) => v?.toLowerCase().includes(needle)));

  return (
    <>
      <PageHeader title="Audit trail" subtitle="A permanent record of submissions, decisions, payments and account changes." />
      <Card pad={false}>
        <div className="toolbar">
          <select className="select-sm" value={action} onChange={(e) => { setAction(e.target.value); setLimit(PAGE); }}>
            <option value="">All actions ({audit.length})</option>
            {actions.map((a) => <option key={a} value={a}>{a.replace(/_/g, ' ').toLowerCase()}</option>)}
          </select>
          <label className="search"><Search size={16} /><input value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE); }} placeholder="Search actor or details" /></label>
        </div>
        {rows.length === 0 ? <EmptyState icon={History} title="No audit entries match" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Details</th></tr></thead>
              <tbody>
                {rows.slice(0, limit).map((a) => (
                  <tr key={a.id}>
                    <td className="nowrap">{fmtDateTime(a.at)}</td>
                    <td>{a.actorName}</td>
                    <td><span className={`action-tag tone-${TONE[a.action] ?? 'neutral'}`}>{a.action.replace(/_/g, ' ').toLowerCase()}</span></td>
                    <td>{a.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length > limit && <div className="center pad"><button className="btn btn-outline btn-sm" onClick={() => setLimit(limit + PAGE)}>Show more ({rows.length - limit} remaining)</button></div>}
      </Card>
    </>
  );
}
