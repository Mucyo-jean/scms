import { Link } from 'react-router-dom';
import { FilePlus2, UploadCloud, Activity, BellRing, FileCheck2, Building2, BookOpen, Wallet, GraduationCap, Cpu, ArrowRight, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Logo } from '../components/Layout';
import { useAuth, homeFor } from '../context/AuthContext';

const FEATURES = [
  { icon: FilePlus2, title: 'Apply online', text: 'Submit one clearance request instead of carrying a paper form from office to office.' },
  { icon: UploadCloud, title: 'Upload documents', text: 'Attach supporting documents (PDF, JPG, PNG up to 2 MB) directly with your application.' },
  { icon: Activity, title: 'Track every department', text: 'See which departments have approved, which are pending and which need your attention.' },
  { icon: BellRing, title: 'Instant notifications', text: 'Get notified the moment a department approves or rejects your clearance.' },
  { icon: Wallet, title: 'Pay clearance fees', text: 'Settle the clearance fee through a simulated Mobile Money or card payment.' },
  { icon: FileCheck2, title: 'Digital certificate', text: 'Download a verifiable clearance certificate once every department has cleared you.' },
];

const DEPTS = [
  { icon: BookOpen, name: 'Library', status: 'Approved' },
  { icon: Wallet, name: 'Finance', status: 'Pending' },
  { icon: GraduationCap, name: 'Academic', status: 'Approved' },
  { icon: Cpu, name: 'ICT', status: 'Rejected' },
];
const ICON = { Approved: CheckCircle2, Pending: Clock, Rejected: XCircle };

export default function Landing() {
  const { user } = useAuth();
  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <nav>
          <Link to="/verify" className="btn btn-ghost">Verify certificate</Link>
          {user ? (
            <Link to={homeFor(user)} className="btn btn-primary">Go to dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost">Sign in</Link>
              <Link to="/register" className="btn btn-primary">Create account</Link>
            </>
          )}
        </nav>
      </header>

      <section className="hero">
        <div className="hero-text">
          <span className="eyebrow">Student Clearance Management System</span>
          <h1>Get cleared without walking from office to office.</h1>
          <p className="lead">
            S-Clearance connects students with the Library, Finance, Academic Department and ICT in one place.
            Submit your request once, follow each department's decision, and download your clearance certificate when you're done.
          </p>
          <div className="hero-actions">
            <Link to={user ? homeFor(user) : '/register'} className="btn btn-primary btn-lg">Start your clearance <ArrowRight size={18} /></Link>
            <Link to="/login" className="btn btn-outline btn-lg">I already have an account</Link>
          </div>
        </div>
        <div className="hero-card card">
          <div className="card-body">
            <div className="hero-card-head">
              <div>
                <div className="muted small">Request CLR-2026-0001</div>
                <strong>Clearance progress</strong>
              </div>
              <span className="badge badge-rejected">Requires Attention</span>
            </div>
            <ul className="hero-depts">
              {DEPTS.map(({ icon: Icon, name, status }) => {
                const S = ICON[status];
                return (
                  <li key={name}>
                    <span className="dept-icon"><Icon size={18} /></span>
                    <span className="grow">{name}</span>
                    <span className={`badge badge-${status === 'Approved' ? 'approved' : status === 'Pending' ? 'pending' : 'rejected'}`}><S size={13} /> {status}</span>
                  </li>
                );
              })}
            </ul>
            <div className="progress"><div className="progress-fill warn" style={{ width: '50%' }} /></div>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Everything the clearance process needs</h2>
        <div className="feature-grid">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="feature">
              <span className="feature-icon"><Icon size={22} /></span>
              <h3>{title}</h3>
              <p className="muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">How it works</h2>
        <ol className="steps">
          {['Sign in and submit your clearance request', 'Upload any required documents and pay the clearance fee', 'Each department reviews and approves or rejects with a reason', 'Resolve any issues and resubmit to that department', 'Once all departments approve, download your certificate'].map((s, i) => (
            <li key={s}><span className="step-num">{i + 1}</span>{s}</li>
          ))}
        </ol>
      </section>

      <section className="section roles">
        {[
          { icon: GraduationCap, title: 'Students', text: 'Apply, upload documents, pay fees and track clearance status from one dashboard.' },
          { icon: Building2, title: 'Department officers', text: 'Review the requests assigned to your department and approve or reject them with a reason.' },
          { icon: Activity, title: 'Administrators', text: 'Manage users and departments, monitor every clearance record and review the audit trail.' },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="role-card">
            <Icon size={24} />
            <h3>{title}</h3>
            <p className="muted">{text}</p>
          </div>
        ))}
      </section>

      <footer className="landing-foot muted small">© {new Date().getFullYear()} S-Clearance · Student Clearance Management System</footer>
    </div>
  );
}
