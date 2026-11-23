import { useState } from 'react';
import { UserPlus, Search, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDb } from '../../api/db';
import { adminCreateUser, adminUpdateUser } from '../../api/api';
import { Card, Field, Modal, PageHeader, Spinner, StatusBadge, fmtDate } from '../../components/ui';
import { validatePassword } from '../Register';

const ROLES = ['all', 'student', 'officer', 'admin'];
const EMPTY = { role: 'officer', name: '', email: '', departmentId: '', password: '' };

export default function AdminUsers() {
  const { user: me } = useAuth();
  const toast = useToast();
  const { users, departments } = useDb();
  const [role, setRole] = useState('all');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [formError, setFormError] = useState('');
  const [resetting, setResetting] = useState(null);
  const [newPw, setNewPw] = useState('');
  const [busy, setBusy] = useState(false);
  const needle = q.trim().toLowerCase();

  const rows = users
    .filter((u) => role === 'all' || u.role === role)
    .filter((u) => !needle || [u.name, u.email, u.studentNumber].some((v) => v?.toLowerCase().includes(needle)));

  const run = async (fn, ok) => {
    try { await fn(); if (ok) toast(ok); } catch (e) { toast(e.message, 'error'); }
  };

  const create = async () => {
    setFormError('');
    if (form.name.trim().length < 3) return setFormError('Enter the full name.');
    if (!/^\S+@\S+\.\S+$/.test(form.email)) return setFormError('Enter a valid email.');
    const pw = validatePassword(form.password);
    if (pw) return setFormError(`Password: ${pw}`);
    setBusy(true);
    try {
      await adminCreateUser(me.id, form);
      toast(`${form.role === 'officer' ? 'Officer' : 'Administrator'} account created.`);
      setCreating(false);
      setForm(EMPTY);
    } catch (e) { setFormError(e.message); }
    setBusy(false);
  };

  const resetPassword = async () => {
    const pw = validatePassword(newPw);
    if (pw) return toast(pw, 'error');
    setBusy(true);
    await run(() => adminUpdateUser(me.id, resetting.id, { password: newPw }), `Password reset for ${resetting.name}.`);
    setBusy(false);
    setResetting(null);
    setNewPw('');
  };

  return (
    <>
      <PageHeader title="Users" subtitle="Students register themselves; officers and administrators are created here."
        actions={<button className="btn btn-primary" onClick={() => setCreating(true)}><UserPlus size={18} /> Add staff account</button>} />
      <Card pad={false}>
        <div className="toolbar">
          <div className="tabs flush">
            {ROLES.map((r) => (
              <button key={r} className={`tab ${role === r ? 'active' : ''}`} onClick={() => setRole(r)}>
                {r === 'all' ? 'All' : r[0].toUpperCase() + r.slice(1) + 's'} <span className="tab-count">{r === 'all' ? users.length : users.filter((u) => u.role === r).length}</span>
              </button>
            ))}
          </div>
          <label className="search"><Search size={16} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users" /></label>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Name</th><th>Role</th><th>Department / Programme</th><th>Joined</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className={u.active ? '' : 'inactive'}>
                  <td><strong>{u.name}</strong><div className="muted small">{u.email}</div></td>
                  <td><span className={`role-pill role-${u.role}`}>{u.role}</span></td>
                  <td>
                    {u.role === 'officer' ? (
                      <select className="select-sm" value={u.departmentId} onChange={(e) => run(() => adminUpdateUser(me.id, u.id, { departmentId: e.target.value }), `${u.name} moved to ${departments.find((d) => d.id === e.target.value)?.name}.`)}>
                        {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    ) : u.role === 'student' ? <>{u.programme}<div className="muted small">{u.studentNumber}</div></> : <span className="muted">—</span>}
                  </td>
                  <td>{fmtDate(u.createdAt)}</td>
                  <td><StatusBadge status={u.active ? 'Active' : 'Inactive'} /></td>
                  <td className="row-actions">
                    <button className="btn btn-sm btn-ghost" onClick={() => setResetting(u)}><KeyRound size={15} /> Reset password</button>
                    {u.id !== me.id && (
                      <button className={`btn btn-sm ${u.active ? 'btn-outline-danger' : 'btn-outline'}`}
                        onClick={() => run(() => adminUpdateUser(me.id, u.id, { active: !u.active }), `${u.name} ${u.active ? 'deactivated' : 'activated'}.`)}>
                        {u.active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal open={creating} title="Add staff account" onClose={() => { setCreating(false); setFormError(''); }}
        footer={<><button className="btn btn-ghost" onClick={() => setCreating(false)}>Cancel</button><button className="btn btn-primary" onClick={create} disabled={busy}>{busy ? <Spinner /> : <UserPlus size={16} />} Create account</button></>}>
        <div className="form">
          {formError && <div className="alert alert-error">{formError}</div>}
          <Field label="Role">
            <div className="chips">
              {['officer', 'admin'].map((r) => <button type="button" key={r} className={`chip ${form.role === r ? 'active' : ''}`} onClick={() => setForm({ ...form, role: r })}>{r === 'officer' ? 'Department officer' : 'Administrator'}</button>)}
            </div>
          </Field>
          <Field label="Full name" required><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Email" required><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          {form.role === 'officer' && (
            <Field label="Department" required>
              <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                <option value="">Select…</option>
                {departments.filter((d) => d.active).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
          )}
          <Field label="Temporary password" required hint="8+ characters with upper, lower case and a number"><input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
        </div>
      </Modal>

      <Modal open={!!resetting} title={`Reset password — ${resetting?.name}`} onClose={() => { setResetting(null); setNewPw(''); }}
        footer={<><button className="btn btn-ghost" onClick={() => setResetting(null)}>Cancel</button><button className="btn btn-primary" onClick={resetPassword} disabled={busy}>{busy ? <Spinner /> : <KeyRound size={16} />} Reset</button></>}>
        <Field label="New password" hint="Share it with the user securely."><input type="text" value={newPw} onChange={(e) => setNewPw(e.target.value)} autoFocus /></Field>
      </Modal>
    </>
  );
}
