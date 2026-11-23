import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Wallet, FileCheck2, RotateCcw, Send } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDb } from '../../api/db';
import { MAX_FILES, OVERALL_STATUS, TASK_STATUS, addDocuments, overallStatus, resubmitTask } from '../../api/api';
import { Card, DocumentList, EmptyState, Field, Modal, PageHeader, ProgressBar, Spinner, StatusBadge, fmtDate, fmtDateTime, fmtMoney } from '../../components/ui';
import { DepartmentTracker, RequestTimeline } from '../../components/Tracker';
import { FileDrop, processFiles } from './Apply';

export default function RequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const req = useDb((s) => s.requests.find((r) => r.id === id && r.studentId === user.id));
  const [resolving, setResolving] = useState(null); // { task, dept }
  const [note, setNote] = useState('');
  const [newDocs, setNewDocs] = useState([]);
  const [busy, setBusy] = useState(false);

  if (!req) return <EmptyState title="Request not found"><Link to="/student">Back to dashboard</Link></EmptyState>;
  const status = overallStatus(req);

  const closeResolve = () => { setResolving(null); setNote(''); setNewDocs([]); };

  const resolve = async () => {
    if (note.trim().length < 5) return toast('Describe how you resolved the issue (at least 5 characters).', 'error');
    setBusy(true);
    try {
      if (newDocs.length) await addDocuments(user.id, req.id, newDocs);
      await resubmitTask(user.id, req.id, resolving.task.departmentId, note.trim());
      toast(`Resubmitted to ${resolving.dept.name}.`);
      closeResolve();
    } catch (e) { toast(e.message, 'error'); }
    setBusy(false);
  };

  const uploadMore = async (files) => {
    const accepted = await processFiles(files, req.documents.length, toast);
    if (!accepted.length) return;
    try { await addDocuments(user.id, req.id, accepted); toast(`${accepted.length} document(s) uploaded.`); }
    catch (e) { toast(e.message, 'error'); }
  };

  return (
    <>
      <Link to="/student" className="back-link"><ArrowLeft size={16} /> Dashboard</Link>
      <PageHeader
        title={<>Clearance {req.ref} <StatusBadge status={status} size="lg" /></>}
        subtitle={`Submitted ${fmtDateTime(req.createdAt)} · Last updated ${fmtDateTime(req.updatedAt)}`}
        actions={
          <>
            {req.payment?.status === 'Unpaid' && <Link to={`/student/requests/${req.id}/payment`} className="btn btn-primary"><Wallet size={18} /> Pay {fmtMoney(req.payment.amount)}</Link>}
            {req.certificate && <Link to={`/student/requests/${req.id}/certificate`} className="btn btn-success"><FileCheck2 size={18} /> View certificate</Link>}
          </>
        }
      />

      <div className="grid-main">
        <div className="stack">
          <Card title="Department status">
            <ProgressBar request={req} />
            <DepartmentTracker
              request={req}
              renderAction={(t, d) => t.status === TASK_STATUS.REJECTED && (
                <button className="btn btn-sm btn-danger mt" onClick={() => setResolving({ task: t, dept: d })}><RotateCcw size={15} /> I've resolved this — resubmit</button>
              )}
            />
            {status === OVERALL_STATUS.IN_PROGRESS && <p className="muted small mt">Departments review requests independently. You'll be notified of every decision.</p>}
          </Card>

          <Card title="Supporting documents" actions={<span className="muted small">{req.documents.length}/{MAX_FILES}</span>}>
            <DocumentList documents={req.documents} />
            {status !== OVERALL_STATUS.CLEARED && req.documents.length < MAX_FILES && <div className="mt"><FileDrop onFiles={uploadMore} /></div>}
          </Card>
        </div>

        <div className="stack">
          <Card title="Application">
            <dl className="dl compact">
              <dt>Purpose</dt><dd>{req.reason}</dd>
              <dt>Student no.</dt><dd>{req.form.studentNumber}</dd>
              <dt>Programme</dt><dd>{req.form.programme}</dd>
              <dt>Faculty</dt><dd>{req.form.faculty}</dd>
              <dt>Year</dt><dd>{req.form.yearOfStudy}</dd>
              <dt>Phone</dt><dd>{req.form.phone}</dd>
              {req.form.notes && <><dt>Notes</dt><dd>{req.form.notes}</dd></>}
            </dl>
          </Card>
          {req.payment && (
            <Card title="Clearance fee">
              <dl className="dl compact">
                <dt>Amount</dt><dd>{fmtMoney(req.payment.amount)}</dd>
                <dt>Status</dt><dd><StatusBadge status={req.payment.status} /></dd>
                {req.payment.txRef && <><dt>Method</dt><dd>{req.payment.method}</dd><dt>Reference</dt><dd className="mono">{req.payment.txRef}</dd><dt>Paid on</dt><dd>{fmtDate(req.payment.paidAt)}</dd></>}
              </dl>
            </Card>
          )}
          <Card title="History"><RequestTimeline request={req} /></Card>
        </div>
      </div>

      <Modal
        open={!!resolving}
        title={`Resubmit to ${resolving?.dept?.name}`}
        onClose={closeResolve}
        footer={<>
          <button className="btn btn-ghost" onClick={closeResolve}>Cancel</button>
          <button className="btn btn-primary" onClick={resolve} disabled={busy}>{busy ? <Spinner /> : <Send size={16} />} Resubmit</button>
        </>}
      >
        {resolving && (
          <div className="form">
            <div className="alert alert-error"><strong>Rejection reason:</strong>&nbsp;{resolving.task.comment}</div>
            <Field label="How did you resolve it?" required>
              <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Returned the charger to the ICT office on Monday." autoFocus />
            </Field>
            <Field label="Supporting evidence (optional)">
              <FileDrop onFiles={async (f) => { const a = await processFiles(f, req.documents.length + newDocs.length, toast); setNewDocs((d) => [...d, ...a]); }} />
            </Field>
            <DocumentList documents={newDocs} onRemove={(rid) => setNewDocs(newDocs.filter((d) => d.id !== rid))} />
          </div>
        )}
      </Modal>
    </>
  );
}
