import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { Logo } from '../components/Layout';
import { Field, Spinner } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const EMPTY = { name: '', email: '', studentNumber: '', programme: '', faculty: '', yearOfStudy: '', phone: '', password: '', confirm: '' };

export function validatePassword(pw) {
  if (pw.length < 8) return 'Use at least 8 characters.';
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/\d/.test(pw)) return 'Include upper-case, lower-case letters and a number.';
  return null;
}

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const validate = () => {
    const e = {};
    if (form.name.trim().split(/\s+/).length < 2) e.name = 'Enter your first and last name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) e.email = 'Enter a valid email address.';
    if (!form.studentNumber.trim()) e.studentNumber = 'Student number is required.';
    if (!form.programme.trim()) e.programme = 'Programme is required.';
    if (!form.faculty.trim()) e.faculty = 'Faculty is required.';
    if (!form.yearOfStudy) e.yearOfStudy = 'Select your year of study.';
    if (!/^\+?[\d\s-]{9,}$/.test(form.phone)) e.phone = 'Enter a valid phone number.';
    const pw = validatePassword(form.password);
    if (pw) e.password = pw;
    if (form.confirm !== form.password) e.confirm = 'Passwords do not match.';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submit = async (e) => {
    e.preventDefault();
    setServerError('');
    if (!validate()) return;
    setBusy(true);
    try {
      await register(form);
      toast('Account created. Welcome to S-Clearance!');
      navigate('/student', { replace: true });
    } catch (err) {
      setServerError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card wide">
        <div className="card-body">
          <Link to="/"><Logo /></Link>
          <h1 className="auth-title">Create your student account</h1>
          <p className="muted">Officer and administrator accounts are created by the system administrator.</p>
          <form onSubmit={submit} className="form" noValidate>
            {serverError && <div className="alert alert-error">{serverError}</div>}
            <div className="grid-2">
              <Field label="Full name" error={errors.name} required><input value={form.name} onChange={set('name')} autoComplete="name" /></Field>
              <Field label="Email" error={errors.email} required><input type="email" value={form.email} onChange={set('email')} autoComplete="email" /></Field>
              <Field label="Student number" error={errors.studentNumber} required hint="e.g. 2023/BSE/014"><input value={form.studentNumber} onChange={set('studentNumber')} /></Field>
              <Field label="Phone" error={errors.phone} required><input type="tel" value={form.phone} onChange={set('phone')} placeholder="+250 7xx xxx xxx" autoComplete="tel" /></Field>
              <Field label="Programme" error={errors.programme} required><input value={form.programme} onChange={set('programme')} placeholder="BSc Software Engineering" /></Field>
              <Field label="Faculty" error={errors.faculty} required><input value={form.faculty} onChange={set('faculty')} placeholder="Computing & IT" /></Field>
              <Field label="Year of study" error={errors.yearOfStudy} required>
                <select value={form.yearOfStudy} onChange={set('yearOfStudy')}>
                  <option value="">Select…</option>
                  {['1', '2', '3', '4', '5'].map((y) => <option key={y} value={y}>Year {y}</option>)}
                </select>
              </Field>
              <div />
              <Field label="Password" error={errors.password} required hint="8+ characters with upper, lower case and a number"><input type="password" value={form.password} onChange={set('password')} autoComplete="new-password" /></Field>
              <Field label="Confirm password" error={errors.confirm} required><input type="password" value={form.confirm} onChange={set('confirm')} autoComplete="new-password" /></Field>
            </div>
            <button className="btn btn-primary btn-block" disabled={busy}>{busy ? <Spinner /> : <UserPlus size={18} />} Create account</button>
          </form>
          <p className="center small">Already registered? <Link to="/login">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
