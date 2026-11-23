import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Smartphone, CreditCard, Lock, CheckCircle2, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useDb } from '../../api/db';
import { payClearanceFee } from '../../api/api';
import { Card, EmptyState, Field, PageHeader, Spinner, fmtDateTime, fmtMoney } from '../../components/ui';

export default function Payment() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const req = useDb((s) => s.requests.find((r) => r.id === id && r.studentId === user.id));
  const [method, setMethod] = useState('Mobile Money');
  const [form, setForm] = useState({ phone: user.phone ?? '', card: '', expiry: '', cvc: '', name: user.name });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  if (!req?.payment) return <EmptyState title="No payment required"><Link to="/student">Back to dashboard</Link></EmptyState>;

  if (req.payment.status === 'Paid') {
    return (
      <Card className="narrow">
        <div className="success-panel">
          <CheckCircle2 size={48} />
          <h2>Payment successful</h2>
          <p className="muted">{fmtMoney(req.payment.amount)} paid via {req.payment.method}</p>
          <dl className="dl compact">
            <dt>Reference</dt><dd className="mono">{req.payment.txRef}</dd>
            <dt>Request</dt><dd>{req.ref}</dd>
            <dt>Date</dt><dd>{fmtDateTime(req.payment.paidAt)}</dd>
          </dl>
          <Link to={`/student/requests/${req.id}`} className="btn btn-primary">Back to my request</Link>
        </div>
      </Card>
    );
  }

  const validate = () => {
    if (method === 'Mobile Money') return /^\+?[\d\s-]{9,}$/.test(form.phone) ? '' : 'Enter a valid mobile money number.';
    if (form.card.replace(/\s/g, '').length !== 16) return 'Card number must be 16 digits.';
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(form.expiry)) return 'Expiry must be MM/YY.';
    if (!/^\d{3}$/.test(form.cvc)) return 'CVC must be 3 digits.';
    return '';
  };

  const pay = async (e) => {
    e.preventDefault();
    const v = validate();
    setError(v);
    if (v) return;
    setBusy(true);
    try {
      await payClearanceFee(user.id, req.id, method, form);
      toast('Payment received. Finance has been notified.');
    } catch (err) {
      setError(err.message);
    }
    setBusy(false);
  };

  return (
    <>
      <Link to={`/student/requests/${req.id}`} className="back-link"><ArrowLeft size={16} /> {req.ref}</Link>
      <PageHeader title="Pay clearance fee" subtitle="Simulated payment — no real money is charged." />
      <div className="grid-main">
        <Card>
          <div className="tabs">
            <button className={`tab ${method === 'Mobile Money' ? 'active' : ''}`} onClick={() => { setMethod('Mobile Money'); setError(''); }}><Smartphone size={16} /> Mobile Money</button>
            <button className={`tab ${method === 'Card' ? 'active' : ''}`} onClick={() => { setMethod('Card'); setError(''); }}><CreditCard size={16} /> Card</button>
          </div>
          <form className="form" onSubmit={pay} noValidate>
            {error && <div className="alert alert-error">{error}</div>}
            {method === 'Mobile Money' ? (
              <Field label="Mobile Money number" hint="Tip: a number ending in 0000 simulates a declined payment.">
                <input type="tel" value={form.phone} onChange={set('phone')} />
              </Field>
            ) : (
              <>
                <Field label="Name on card"><input value={form.name} onChange={set('name')} /></Field>
                <Field label="Card number" hint="Any 16 digits, e.g. 4242 4242 4242 4242">
                  <input inputMode="numeric" value={form.card} placeholder="4242 4242 4242 4242"
                    onChange={(e) => setForm({ ...form, card: e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 ') })} />
                </Field>
                <div className="grid-2">
                  <Field label="Expiry (MM/YY)">
                    <input value={form.expiry} placeholder="12/28" onChange={(e) => {
                      const d = e.target.value.replace(/\D/g, '').slice(0, 4);
                      setForm({ ...form, expiry: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d });
                    }} />
                  </Field>
                  <Field label="CVC"><input inputMode="numeric" value={form.cvc} onChange={(e) => setForm({ ...form, cvc: e.target.value.replace(/\D/g, '').slice(0, 3) })} /></Field>
                </div>
              </>
            )}
            <button className="btn btn-primary btn-block btn-lg" disabled={busy}>
              {busy ? <><Spinner /> {method === 'Mobile Money' ? 'Waiting for confirmation on your phone…' : 'Processing…'}</> : <><Lock size={18} /> Pay {fmtMoney(req.payment.amount)}</>}
            </button>
          </form>
        </Card>
        <Card title="Summary">
          <dl className="dl compact">
            <dt>Request</dt><dd>{req.ref}</dd>
            <dt>Student</dt><dd>{user.name}</dd>
            <dt>Item</dt><dd>Clearance fee</dd>
            <dt>Total</dt><dd><strong>{fmtMoney(req.payment.amount)}</strong></dd>
          </dl>
          <div className="alert alert-info small mt"><Info size={16} /> Finance can only approve your clearance after this fee is paid.</div>
          <button className="btn btn-ghost btn-block mt" onClick={() => navigate(`/student/requests/${req.id}`)}>Pay later</button>
        </Card>
      </div>
    </>
  );
}
