import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LogIn, GraduationCap, Building2, ShieldCheck, RotateCcw } from 'lucide-react';
import { Logo } from '../components/Layout';
import { Field, Spinner } from '../components/ui';
import { homeFor, useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { resetDb } from '../api/db';

const DEMO = [
  { label: 'Student', email: 'student@mclears.ac', password: 'Student@123', icon: GraduationCap },
  { label: 'Library officer', email: 'library@mclears.ac', password: 'Officer@123', icon: Building2 },
  { label: 'Finance officer', email: 'finance@mclears.ac', password: 'Officer@123', icon: Building2 },
  { label: 'Academic officer', email: 'academic@mclears.ac', password: 'Officer@123', icon: Building2 },
  { label: 'ICT officer', email: 'ict@mclears.ac', password: 'Officer@123', icon: Building2 },
  { label: 'Administrator', email: 'admin@mclears.ac', password: 'Admin@123', icon: ShieldCheck },
];

export default function Login() {
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (creds = form) => {
    setError('');
    if (!creds.email || !creds.password) return setError('Enter your email and password.');
    setBusy(true);
    try {
      const u = await login(creds.email, creds.password);
      toast(`Welcome back, ${u.name.split(' ')[0]}!`);
      const from = location.state?.from;
      navigate(from && from.startsWith('/' + u.role) ? from : homeFor(u), { replace: true });
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <div className="card-body">
          <Link to="/"><Logo /></Link>
          <h1 className="auth-title">Sign in</h1>
          <p className="muted">Access your clearance dashboard.</p>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="form" noValidate>
            {error && <div className="alert alert-error">{error}</div>}
            <Field label="Email">
              <input type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@mclears.ac" autoFocus />
            </Field>
            <Field label="Password">
              <input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </Field>
            <button className="btn btn-primary btn-block" disabled={busy}>{busy ? <Spinner /> : <LogIn size={18} />} Sign in</button>
          </form>
          <p className="center small">New student? <Link to="/register">Create an account</Link></p>
        </div>
      </div>

      <div className="demo-box card">
        <div className="card-body">
          <h2>Demo accounts</h2>
          <p className="muted small">Seeded accounts in the backend database. Click one to sign in instantly.</p>
          <div className="demo-grid">
            {DEMO.map(({ label, email, password, icon: Icon }) => (
              <button key={email} className="demo-btn" disabled={busy} onClick={() => { setForm({ email, password }); submit({ email, password }); }}>
                <Icon size={16} />
                <span><strong>{label}</strong><span className="muted small">{email}</span></span>
              </button>
            ))}
          </div>
          <button className="link-btn small reset" onClick={async () => {
            try { await resetDb(); toast('Demo data reset to its initial state.', 'info'); }
            catch (error) { toast(error.message, 'error'); }
          }}>
            <RotateCcw size={14} /> Reset demo data
          </button>
        </div>
      </div>
    </div>
  );
}
