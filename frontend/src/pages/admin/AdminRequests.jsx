import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Download, ClipboardList } from 'lucide-react';
import { useDb } from '../../api/db';
import { OVERALL_STATUS, overallStatus } from '../../api/api';
import { Card, EmptyState, PageHeader, StatusBadge, fmtDate } from '../../components/ui';

const FILTERS = ['All', OVERALL_STATUS.IN_PROGRESS, OVERALL_STATUS.ATTENTION, OVERALL_STATUS.CLEARED];

export default function AdminRequests() {
  const { requests, users, departments } = useDb();
  const [filter, setFilter] = useState('All');
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();

  const rows = requests
    .map((r) => ({ r, status: overallStatus(r), student: users.find((u) => u.id === r.studentId) }))
    .filter((x) => filter === 'All' || x.status === filter)
    .filter((x) => !needle || [x.r.ref, x.student?.name, x.r.form.studentNumber, x.r.form.programme, x.r.reason].some((v) => v?.toLowerCase().includes(needle)));

  const exportCsv = () => {
    const header = ['Reference', 'Student', 'Student number', 'Programme', 'Purpose', 'Submitted', 'Status', ...departments.map((d) => d.name), 'Fee status', 'Certificate'];
    const lines = rows.map(({ r, status, student }) => [
      r.ref, student?.name, r.form.studentNumber, r.form.programme, r.reason, fmtDate(r.createdAt), status,
      ...departments.map((d) => r.tasks.find((t) => t.departmentId === d.id)?.status ?? 'N/A'),
      r.payment?.status ?? 'N/A', r.certificate?.number ?? '',
    ]);
    const csv = [header, ...lines].map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `mclears-clearance-records-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <>
      <PageHeader title="Clearance records" subtitle={`${requests.length} requests in total`} actions={<button className="btn btn-outline" onClick={exportCsv} disabled={!rows.length}><Download size={18} /> Export CSV</button>} />
      <Card pad={false}>
        <div className="toolbar">
          <div className="tabs flush">
            {FILTERS.map((f) => (
              <button key={f} className={`tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f} <span className="tab-count">{f === 'All' ? requests.length : requests.filter((r) => overallStatus(r) === f).length}</span>
              </button>
            ))}
          </div>
          <label className="search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search records" /></label>
        </div>
        {rows.length === 0 ? <EmptyState icon={ClipboardList} title="No records match" /> : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Request</th><th>Student</th><th>Purpose</th>
                  {departments.map((d) => <th key={d.id} className="center">{d.code}</th>)}
                  <th>Fee</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ r, status, student }) => (
                  <tr key={r.id}>
                    <td><Link to={`/admin/requests/${r.id}`} className="strong">{r.ref}</Link><div className="muted small">{fmtDate(r.createdAt)}</div></td>
                    <td>{student?.name}<div className="muted small">{r.form.studentNumber}</div></td>
                    <td>{r.reason}</td>
                    {departments.map((d) => {
                      const t = r.tasks.find((x) => x.departmentId === d.id);
                      return <td key={d.id} className="center">{t ? <span className={`dot-status ${t.status.toLowerCase()}`} title={`${d.name}: ${t.status}`} aria-label={`${d.name}: ${t.status}`}>{t.status[0]}</span> : <span className="muted">–</span>}</td>;
                    })}
                    <td>{r.payment ? <StatusBadge status={r.payment.status} /> : <span className="muted">–</span>}</td>
                    <td><StatusBadge status={status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="muted small mt">Department columns: <strong>A</strong> Approved · <strong>P</strong> Pending · <strong>R</strong> Rejected</p>
    </>
  );
}
