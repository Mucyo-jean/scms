import { useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Send, UploadCloud, Check } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDb } from '../../api/db';
import {
  ALLOWED_FILE_TYPES, CLEARANCE_REASONS, MAX_FILES, MAX_FILE_SIZE, OVERALL_STATUS, overallStatus, readFile, submitRequest, validateFile,
} from '../../api/api';
import { Card, DocumentList, Field, PageHeader, Spinner, fmtMoney } from '../../components/ui';
import { DeptIcon } from '../../components/Tracker';

const STEPS = ['Application details', 'Supporting documents', 'Review & submit'];

export function FileDrop({ onFiles, disabled }) {
  const input = useRef(null);
  const [drag, setDrag] = useState(false);
  return (
    <div
      className={`dropzone ${drag ? 'drag' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={() => !disabled && input.current.click()}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); !disabled && onFiles([...e.dataTransfer.files]); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current.click()}
    >
      <UploadCloud size={30} />
      <strong>Drop files here or click to browse</strong>
      <span className="muted small">{Object.values(ALLOWED_FILE_TYPES).join(', ')} · max {MAX_FILE_SIZE / 1048576} MB each · up to {MAX_FILES} files</span>
      <input ref={input} type="file" hidden multiple accept={Object.keys(ALLOWED_FILE_TYPES).join(',')} onChange={(e) => { onFiles([...e.target.files]); e.target.value = ''; }} />
    </div>
  );
}

// Reads valid files and reports invalid ones; shared by apply + add-documents.
export async function processFiles(files, existingCount, toast) {
  const room = MAX_FILES - existingCount;
  if (files.length > room) toast(`Only ${MAX_FILES} documents are allowed; extra files were ignored.`, 'error');
  const accepted = [];
  for (const f of files.slice(0, Math.max(0, room))) {
    const err = validateFile(f);
    if (err) toast(err, 'error');
    else accepted.push(await readFile(f));
  }
  return accepted;
}

export default function Apply() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const departments = useDb((s) => s.departments.filter((d) => d.active));
  const openRequest = useDb((s) => s.requests.find((r) => r.studentId === user.id && overallStatus(r) !== OVERALL_STATUS.CLEARED));

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    studentNumber: user.studentNumber ?? '', programme: user.programme ?? '', faculty: user.faculty ?? '',
    yearOfStudy: user.yearOfStudy ?? '', phone: user.phone ?? '', reason: '', notes: '', confirm: false,
  });
  const [docs, setDocs] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const fee = departments.reduce((s, d) => s + (d.requiresPayment ? Number(d.fee) : 0), 0);

  if (openRequest && !busy) return <Navigate to={`/student/requests/${openRequest.id}`} replace />;

  const validateDetails = () => {
    const e = {};
    ['studentNumber', 'programme', 'faculty', 'yearOfStudy'].forEach((k) => { if (!String(form[k]).trim()) e[k] = 'Required.'; });
    if (!/^\+?[\d\s-]{9,}$/.test(form.phone)) e.phone = 'Enter a valid phone number.';
    if (!form.reason) e.reason = 'Select the purpose of clearance.';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const next = () => {
    if (step === 0 && !validateDetails()) return;
    setStep(step + 1);
  };

  const addFiles = async (files) => {
    const accepted = await processFiles(files, docs.length, toast);
    if (accepted.length) setDocs((d) => [...d, ...accepted]);
  };

  const submit = async () => {
    if (!form.confirm) return setErrors({ confirm: 'Please confirm the information is correct.' });
    setBusy(true);
    try {
      const { confirm, ...data } = form;
      const req = await submitRequest(user.id, data, docs);
      toast(`Clearance request ${req.ref} submitted.`);
      navigate(req.payment ? `/student/requests/${req.id}/payment` : `/student/requests/${req.id}`, { replace: true });
    } catch (e) {
      toast(e.message, 'error');
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Apply for Clearance" subtitle="Your request will be sent to every participating department at once." />
      <ol className="stepper">
        {STEPS.map((s, i) => (
          <li key={s} className={i < step ? 'done' : i === step ? 'active' : ''}>
            <span className="step-num">{i < step ? <Check size={14} /> : i + 1}</span>
            <span className="step-label">{s}</span>
          </li>
        ))}
      </ol>

      <div className="grid-main">
        <Card>
          {step === 0 && (
            <div className="form">
              <div className="grid-2">
                <Field label="Full name"><input value={user.name} disabled /></Field>
                <Field label="Student number" error={errors.studentNumber} required><input value={form.studentNumber} onChange={set('studentNumber')} /></Field>
                <Field label="Programme" error={errors.programme} required><input value={form.programme} onChange={set('programme')} /></Field>
                <Field label="Faculty" error={errors.faculty} required><input value={form.faculty} onChange={set('faculty')} /></Field>
                <Field label="Year of study" error={errors.yearOfStudy} required>
                  <select value={form.yearOfStudy} onChange={set('yearOfStudy')}>
                    <option value="">Select…</option>
                    {['1', '2', '3', '4', '5'].map((y) => <option key={y} value={y}>Year {y}</option>)}
                  </select>
                </Field>
                <Field label="Phone" error={errors.phone} required><input value={form.phone} onChange={set('phone')} /></Field>
              </div>
              <Field label="Purpose of clearance" error={errors.reason} required>
                <div className="chips">
                  {CLEARANCE_REASONS.map((r) => (
                    <button type="button" key={r} className={`chip ${form.reason === r ? 'active' : ''}`} onClick={() => setForm({ ...form, reason: r })}>{r}</button>
                  ))}
                </div>
              </Field>
              <Field label="Additional notes" hint="Optional — anything the departments should know.">
                <textarea rows={3} value={form.notes} onChange={set('notes')} maxLength={500} />
              </Field>
            </div>
          )}

          {step === 1 && (
            <div className="form">
              <p className="muted">Upload supporting documents such as a transfer letter, payment receipts or a library card. Documents are optional but help departments process your request faster.</p>
              <FileDrop onFiles={addFiles} disabled={docs.length >= MAX_FILES} />
              <DocumentList documents={docs} onRemove={(id) => setDocs(docs.filter((d) => d.id !== id))} />
            </div>
          )}

          {step === 2 && (
            <div className="form">
              <dl className="dl">
                <dt>Student</dt><dd>{user.name} ({form.studentNumber})</dd>
                <dt>Programme</dt><dd>{form.programme}, {form.faculty} — Year {form.yearOfStudy}</dd>
                <dt>Phone</dt><dd>{form.phone}</dd>
                <dt>Purpose</dt><dd>{form.reason}</dd>
                {form.notes && <><dt>Notes</dt><dd>{form.notes}</dd></>}
                <dt>Documents</dt><dd>{docs.length ? docs.map((d) => d.name).join(', ') : 'None'}</dd>
                <dt>Clearance fee</dt><dd>{fee ? fmtMoney(fee) + ' (payable after submission)' : 'None'}</dd>
              </dl>
              <label className="checkbox">
                <input type="checkbox" checked={form.confirm} onChange={set('confirm')} />
                I confirm that the information provided is correct.
              </label>
              {errors.confirm && <span className="field-error">{errors.confirm}</span>}
            </div>
          )}

          <div className="form-actions">
            {step > 0 ? <button className="btn btn-outline" onClick={() => setStep(step - 1)} disabled={busy}><ArrowLeft size={18} /> Back</button> : <Link to="/student" className="btn btn-ghost">Cancel</Link>}
            {step < 2
              ? <button className="btn btn-primary" onClick={next}>Continue <ArrowRight size={18} /></button>
              : <button className="btn btn-primary" onClick={submit} disabled={busy}>{busy ? <Spinner /> : <Send size={18} />} Submit request</button>}
          </div>
        </Card>

        <Card title="Departments that will review">
          <ul className="dept-mini">
            {departments.map((d) => (
              <li key={d.id}>
                <span className="dept-icon"><DeptIcon code={d.code} /></span>
                <div>
                  <strong>{d.name}</strong>
                  <div className="muted small">{d.description}</div>
                  {d.requiresPayment && <div className="small fee">Fee: {fmtMoney(d.fee)}</div>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
