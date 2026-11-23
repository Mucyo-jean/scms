import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle, FileCheck2, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDb } from '../../api/db';
import { TASK_STATUS, decideTask, overallStatus } from '../../api/api';
import { Card, DocumentList, EmptyState, Field, Modal, PageHeader, ProgressBar, Spinner, StatusBadge, fmtDate, fmtDateTime, fmtMoney } from '../../components/ui';
import { DepartmentTracker, RequestTimeline } from '../../components/Tracker';

const QUICK_REASONS = {
  LIB: ['Borrowed books not returned', 'Unpaid library fine', 'Lost library card not reported'],
  FIN: ['Outstanding tuition balance', 'Clearance fee payment not confirmed', 'Unpaid accommodation fees'],
  ACA: ['Missing module results', 'Outstanding coursework or retakes', 'Final project not submitted'],
  ICT: ['ICT equipment not returned', 'Lab account issues pending', 'Damaged equipment not settled'],
};

export default function Review({ readOnly = false }) {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const req = useDb((s) => s.requests.find((r) => r.id === id));
  const student = useDb((s) => s.users.find((u) => u.id === req?.studentId));
  const dept = useDb((s) => s.departments.find((d) => d.id === user.departmentId));
  const allRequests = useDb((s) => s.requests);
  const [modal, setModal] = useState(null); // 'Approved' | 'Rejected'
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);

  const backTo = readOnly ? '/admin/requests' : '/officer';
  if (!req) return <EmptyState title="Request not found"><Link to={backTo}>Back</Link></EmptyState>;

  const task = !readOnly && req.tasks.find((t) => t.departmentId === user.departmentId);
  const paymentBlocks = dept?.requiresPayment && req.payment?.status !== 'Paid';
  const lastResubmission = task && [...task.history].reverse().find((h) => h.status === 'Resubmitted');

  const nextPending = () => allRequests
    .filter((r) => r.id !== req.id && r.tasks.some((t) => t.departmentId === user.departmentId && t.status === TASK_STATUS.PENDING))
    .sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt))[0];

  const decide = async () => {
    setBusy(true);
    try {
      await decideTask(user.id, req.id, modal, comment);
      toast(`${req.ref} ${modal.toLowerCase()}.`, modal === TASK_STATUS.APPROVED ? 'success' : 'info');
      setModal(null);
      setComment('');
      const next = nextPending();
      if (next) navigate(`/officer/requests/${next.id}`);
      else navigate('/officer');
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };

  return (
    <>
      <Link to={backTo} className="back-link"><ArrowLeft size={16} /> {readOnly ? 'All clearance records' : 'Review queue'}</Link>
      <PageHeader
        title={<>{req.ref} <StatusBadge status={overallStatus(req)} size="lg" /></>}
        subtitle={`Submitted ${fmtDateTime(req.createdAt)} · Purpose: ${req.reason}`}
        actions={req.certificate && readOnly && <Link to={`/student/requests/${req.id}/certificate`} className="btn btn-success"><FileCheck2 size={18} /> Certificate</Link>}
      />

      {task && (
        <div className={`decision-bar status-${task.status.toLowerCase()}`}>
          <div className="grow">
            <div className="muted small">{dept?.name} decision</div>
            <StatusBadge status={task.status} size="lg" />
            {lastResubmission && task.status === TASK_STATUS.PENDING && (
              <div className="resub-note"><strong>Student resubmitted:</strong> “{lastResubmission.note}” <span className="muted small">· {fmtDateTime(lastResubmission.at)}</span></div>
            )}
            {task.status !== TASK_STATUS.PENDING && task.comment && <div className="small mt">“{task.comment}”</div>}
          </div>
          {task.status === TASK_STATUS.PENDING && (
            <div className="decision-actions">
              {paymentBlocks && <span className="warn-text small"><AlertTriangle size={15} /> Clearance fee unpaid</span>}
              <button className="btn btn-danger" onClick={() => setModal(TASK_STATUS.REJECTED)}><XCircle size={18} /> Reject</button>
              <button className="btn btn-success" onClick={() => setModal(TASK_STATUS.APPROVED)} disabled={paymentBlocks} title={paymentBlocks ? 'The clearance fee must be paid first' : ''}><CheckCircle2 size={18} /> Approve</button>
            </div>
          )}
        </div>
      )}

      <div className="grid-main">
        <div className="stack">
          <Card title={<span className="title-with-icon"><User size={18} /> Student</span>}>
            <dl className="dl compact">
              <dt>Name</dt><dd>{student?.name}</dd>
              <dt>Email</dt><dd>{student?.email}</dd>
              <dt>Student no.</dt><dd>{req.form.studentNumber}</dd>
              <dt>Programme</dt><dd>{req.form.programme}</dd>
              <dt>Faculty</dt><dd>{req.form.faculty}</dd>
              <dt>Year</dt><dd>{req.form.yearOfStudy}</dd>
              <dt>Phone</dt><dd>{req.form.phone}</dd>
              {req.form.notes && <><dt>Notes</dt><dd>{req.form.notes}</dd></>}
            </dl>
          </Card>
          <Card title="Supporting documents"><DocumentList documents={req.documents} /></Card>
          {req.payment && (
            <Card title="Clearance fee">
              <dl className="dl compact">
                <dt>Amount</dt><dd>{fmtMoney(req.payment.amount)}</dd>
                <dt>Status</dt><dd><StatusBadge status={req.payment.status} /></dd>
                {req.payment.txRef && <><dt>Method</dt><dd>{req.payment.method}</dd><dt>Reference</dt><dd className="mono">{req.payment.txRef}</dd><dt>Paid on</dt><dd>{fmtDate(req.payment.paidAt)}</dd></>}
              </dl>
            </Card>
          )}
        </div>
        <div className="stack">
          <Card title="All departments">
            <ProgressBar request={req} />
            <DepartmentTracker request={req} highlight={user.departmentId} />
          </Card>
          <Card title="History"><RequestTimeline request={req} /></Card>
        </div>
      </div>

      <Modal
        open={!!modal}
        title={modal === TASK_STATUS.APPROVED ? `Approve ${req.ref}` : `Reject ${req.ref}`}
        onClose={() => { setModal(null); setComment(''); }}
        footer={<>
          <button className="btn btn-ghost" onClick={() => { setModal(null); setComment(''); }}>Cancel</button>
          <button className={`btn ${modal === TASK_STATUS.APPROVED ? 'btn-success' : 'btn-danger'}`} onClick={decide} disabled={busy || (modal === TASK_STATUS.REJECTED && !comment.trim())}>
            {busy ? <Spinner /> : modal === TASK_STATUS.APPROVED ? <CheckCircle2 size={16} /> : <XCircle size={16} />} Confirm {modal === TASK_STATUS.APPROVED ? 'approval' : 'rejection'}
          </button>
        </>}
      >
        <div className="form">
          <p className="muted">
            {modal === TASK_STATUS.APPROVED
              ? `${student?.name} will be cleared by ${dept?.name}. The student will be notified.`
              : `Tell ${student?.name} what needs to be resolved. The reason is shown on their dashboard.`}
          </p>
          {modal === TASK_STATUS.REJECTED && QUICK_REASONS[dept?.code] && (
            <div className="chips">
              {QUICK_REASONS[dept.code].map((r) => <button type="button" key={r} className="chip" onClick={() => setComment(r)}>{r}</button>)}
            </div>
          )}
          <Field label={modal === TASK_STATUS.APPROVED ? 'Comment (optional)' : 'Reason for rejection'} required={modal === TASK_STATUS.REJECTED}>
            <textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} autoFocus maxLength={400} />
          </Field>
        </div>
      </Modal>
    </>
  );
}
