import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Printer, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDb } from '../../api/db';
import { EmptyState, fmtDate } from '../../components/ui';

export default function Certificate() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const req = useDb((s) => s.requests.find((r) => r.id === id && (user.role === 'admin' || r.studentId === user.id)));
  const student = useDb((s) => s.users.find((u) => u.id === req?.studentId));
  const departments = useDb((s) => s.departments);
  const users = useDb((s) => s.users);

  if (!req?.certificate) {
    return (
      <div className="auth-page">
        <EmptyState title="Certificate not available">
          <p>The certificate is issued once every department has approved the clearance.</p>
          <button className="btn btn-primary" onClick={() => navigate(-1)}>Go back</button>
        </EmptyState>
      </div>
    );
  }

  const verifyUrl = `${window.location.origin}/verify?code=${req.certificate.code}`;

  return (
    <div className="cert-page">
      <div className="cert-toolbar no-print">
        <Link to={user.role === 'admin' ? `/admin/requests/${req.id}` : `/student/requests/${req.id}`} className="btn btn-ghost"><ArrowLeft size={18} /> Back</Link>
        <button className="btn btn-primary" onClick={() => window.print()}><Printer size={18} /> Print / Save as PDF</button>
      </div>

      <article className="certificate">
        <div className="cert-border">
          <header className="cert-head">
            <span className="cert-seal"><ShieldCheck size={34} /></span>
            <div>
              <div className="cert-org">S-Clearance · Student Clearance Management System</div>
              <h1>Certificate of Clearance</h1>
            </div>
          </header>

          <p className="cert-lead">This is to certify that</p>
          <p className="cert-name">{student?.name}</p>
          <p className="cert-lead">
            Student number <strong>{req.form.studentNumber}</strong>, {req.form.programme} ({req.form.faculty}),
            has been cleared by all departments listed below for the purpose of <strong>{req.reason.toLowerCase()}</strong>.
          </p>

          <table className="cert-table">
            <thead><tr><th>Department</th><th>Status</th><th>Cleared by</th><th>Date</th></tr></thead>
            <tbody>
              {req.tasks.map((t) => (
                <tr key={t.departmentId}>
                  <td>{departments.find((d) => d.id === t.departmentId)?.name}</td>
                  <td><span className="cert-ok"><CheckCircle2 size={14} /> {t.status}</span></td>
                  <td>{users.find((u) => u.id === t.officerId)?.name ?? '—'}</td>
                  <td>{fmtDate(t.decidedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <footer className="cert-foot">
            <dl>
              <dt>Certificate no.</dt><dd className="mono">{req.certificate.number}</dd>
              <dt>Request ref.</dt><dd className="mono">{req.ref}</dd>
              <dt>Date issued</dt><dd>{fmtDate(req.certificate.issuedAt)}</dd>
            </dl>
            <div className="cert-verify">
              <div className="muted small">Verification code</div>
              <div className="cert-code mono">{req.certificate.code}</div>
              <div className="muted small">Verify at {verifyUrl}</div>
            </div>
          </footer>
          <p className="cert-note muted small">This certificate was generated electronically and is valid without a signature.</p>
        </div>
      </article>
    </div>
  );
}
