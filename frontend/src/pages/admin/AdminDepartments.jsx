import { useState } from 'react';
import { Plus, Pencil, Users, Clock } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDb } from '../../api/db';
import { CURRENCY, TASK_STATUS, adminSaveDepartment } from '../../api/api';
import { Field, Modal, PageHeader, Spinner, StatusBadge, fmtMoney } from '../../components/ui';
import { DeptIcon } from '../../components/Tracker';

const EMPTY = { code: '', name: '', description: '', requiresPayment: false, fee: 0 };

export default function AdminDepartments() {
  const { user: me } = useAuth();
  const toast = useToast();
  const { departments, users, requests } = useDb();
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const save = async (data = editing) => {
    setError('');
    if (!/^[A-Za-z]{2,5}$/.test(data.code.trim())) return setError('Code must be 2–5 letters.');
    if (data.name.trim().length < 2) return setError('Enter a department name.');
    setBusy(true);
    try {
      await adminSaveDepartment(me.id, data);
      toast(data.id ? 'Department updated.' : 'Department created. It will be included in new clearance requests.');
      setEditing(null);
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const toggle = async (d) => {
    try {
      await adminSaveDepartment(me.id, { ...d, active: !d.active });
      toast(`${d.name} ${d.active ? 'deactivated — it will be skipped for new requests' : 'activated'}.`);
    } catch (e) { toast(e.message, 'error'); }
  };

  return (
    <>
      <PageHeader title="Departments" subtitle="Active departments are automatically included in every new clearance request."
        actions={<button className="btn btn-primary" onClick={() => setEditing({ ...EMPTY })}><Plus size={18} /> Add department</button>} />
      <div className="dept-grid">
        {departments.map((d) => {
          const officers = users.filter((u) => u.role === 'officer' && u.departmentId === d.id && u.active).length;
          const pending = requests.filter((r) => r.tasks.some((t) => t.departmentId === d.id && t.status === TASK_STATUS.PENDING)).length;
          return (
            <div key={d.id} className={`card dept-card ${d.active ? '' : 'inactive'}`}>
              <div className="card-body">
                <div className="dept-card-head">
                  <span className="dept-icon lg"><DeptIcon code={d.code} size={22} /></span>
                  <div className="grow">
                    <h3>{d.name}</h3>
                    <span className="mono muted small">{d.code}</span>
                  </div>
                  <StatusBadge status={d.active ? 'Active' : 'Inactive'} />
                </div>
                <p className="muted small">{d.description || 'No description.'}</p>
                <div className="dept-meta">
                  <span><Users size={14} /> {officers} officer{officers === 1 ? '' : 's'}</span>
                  <span><Clock size={14} /> {pending} pending</span>
                  {d.requiresPayment && <span className="fee">Fee {fmtMoney(d.fee)}</span>}
                </div>
                {officers === 0 && d.active && <div className="alert alert-warn small">No active officer — requests for this department cannot be reviewed.</div>}
                <div className="dept-actions">
                  <button className="btn btn-sm btn-outline" onClick={() => setEditing({ ...d })}><Pencil size={14} /> Edit</button>
                  <button className={`btn btn-sm ${d.active ? 'btn-outline-danger' : 'btn-outline'}`} onClick={() => toggle(d)}>{d.active ? 'Deactivate' : 'Activate'}</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={!!editing} title={editing?.id ? `Edit ${editing.name}` : 'Add department'} onClose={() => { setEditing(null); setError(''); }}
        footer={<><button className="btn btn-ghost" onClick={() => setEditing(null)}>Cancel</button><button className="btn btn-primary" onClick={() => save()} disabled={busy}>{busy && <Spinner />} Save</button></>}>
        {editing && (
          <div className="form">
            {error && <div className="alert alert-error">{error}</div>}
            <div className="grid-2">
              <Field label="Code" required hint="2–5 letters, e.g. HST"><input value={editing.code} onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })} maxLength={5} /></Field>
              <Field label="Name" required><input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            </div>
            <Field label="Description"><textarea rows={2} value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <label className="checkbox">
              <input type="checkbox" checked={editing.requiresPayment} onChange={(e) => setEditing({ ...editing, requiresPayment: e.target.checked })} />
              Students must pay a clearance fee before this department can approve
            </label>
            {editing.requiresPayment && (
              <Field label={`Fee (${CURRENCY})`}><input type="number" min={0} step={500} value={editing.fee} onChange={(e) => setEditing({ ...editing, fee: e.target.value })} /></Field>
            )}
            {editing.id && <p className="muted small">Changes to the fee apply to new requests only.</p>}
          </div>
        )}
      </Modal>
    </>
  );
}
