import { useState } from 'react';
import { Save, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDb } from '../api/db';
import { changePassword, updateProfile } from '../api/api';
import { Card, Field, PageHeader, Spinner, fmtDate } from '../components/ui';
import { validatePassword } from './Register';

export default function Profile() {
  const { user } = useAuth();
  const toast = useToast();
  const dept = useDb((s) => s.departments.find((d) => d.id === user.departmentId));
  const isStudent = user.role === 'student';
  const [form, setForm] = useState({ name: user.name, phone: user.phone ?? '', programme: user.programme ?? '', faculty: user.faculty ?? '', yearOfStudy: user.yearOfStudy ?? '' });
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [busy, setBusy] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const saveProfile = async (e) => {
    e.preventDefault();
    if (form.name.trim().length < 3) return toast('Name is too short.', 'error');
    setBusy('profile');
    try { await updateProfile(user.id, isStudent ? form : { name: form.name }); toast('Profile updated.'); }
    catch (err) { toast(err.message, 'error'); }
    setBusy('');
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    const v = validatePassword(pw.next);
    if (v) return setPwError(v);
    if (pw.next !== pw.confirm) return setPwError('New passwords do not match.');
    setBusy('pw');
    try { await changePassword(user.id, pw.current, pw.next); toast('Password changed.'); setPw({ current: '', next: '', confirm: '' }); }
    catch (err) { setPwError(err.message); }
    setBusy('');
  };

  return (
    <>
      <PageHeader title="My Profile" subtitle={`Member since ${fmtDate(user.createdAt)}`} />
      <div className="grid-2 align-start">
        <Card title="Personal information">
          <form className="form" onSubmit={saveProfile}>
            <Field label="Full name"><input value={form.name} onChange={set('name')} /></Field>
            <Field label="Email" hint="Contact the administrator to change your email."><input value={user.email} disabled /></Field>
            {user.role === 'officer' && <Field label="Department"><input value={dept?.name ?? '—'} disabled /></Field>}
            {isStudent && (
              <>
                <Field label="Student number"><input value={user.studentNumber} disabled /></Field>
                <div className="grid-2">
                  <Field label="Programme"><input value={form.programme} onChange={set('programme')} /></Field>
                  <Field label="Faculty"><input value={form.faculty} onChange={set('faculty')} /></Field>
                  <Field label="Year of study">
                    <select value={form.yearOfStudy} onChange={set('yearOfStudy')}>
                      {['1', '2', '3', '4', '5'].map((y) => <option key={y} value={y}>Year {y}</option>)}
                    </select>
                  </Field>
                  <Field label="Phone"><input value={form.phone} onChange={set('phone')} /></Field>
                </div>
              </>
            )}
            <button className="btn btn-primary" disabled={busy === 'profile'}>{busy === 'profile' ? <Spinner /> : <Save size={18} />} Save changes</button>
          </form>
        </Card>
        <Card title="Change password">
          <form className="form" onSubmit={savePassword}>
            {pwError && <div className="alert alert-error">{pwError}</div>}
            <Field label="Current password"><input type="password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" /></Field>
            <Field label="New password" hint="8+ characters with upper, lower case and a number"><input type="password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} autoComplete="new-password" /></Field>
            <Field label="Confirm new password"><input type="password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" /></Field>
            <button className="btn btn-outline" disabled={busy === 'pw'}>{busy === 'pw' ? <Spinner /> : <KeyRound size={18} />} Update password</button>
          </form>
        </Card>
      </div>
    </>
  );
}
