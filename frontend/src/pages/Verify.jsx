import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, BadgeCheck, XCircle } from 'lucide-react';
import { Logo } from '../components/Layout';
import { Spinner, fmtDate } from '../components/ui';
import { verifyCertificate } from '../api/api';

export default function Verify() {
  const [params, setParams] = useSearchParams();
  const [code, setCode] = useState(params.get('code') ?? '');
  const [result, setResult] = useState(undefined); // undefined = not searched, null = not found
  const [busy, setBusy] = useState(false);

  const run = async (c) => {
    if (!c.trim()) return;
    setBusy(true);
    setParams({ code: c.trim() }, { replace: true });
    setResult(await verifyCertificate(c));
    setBusy(false);
  };

  useEffect(() => { if (params.get('code')) run(params.get('code')); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="auth-page">
      <div className="auth-card card wide">
        <div className="card-body">
          <Link to="/"><Logo /></Link>
          <h1 className="auth-title">Verify a clearance certificate</h1>
          <p className="muted">Enter the verification code or certificate number printed on the certificate.</p>
          <form className="inline-form" onSubmit={(e) => { e.preventDefault(); run(code); }}>
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. K7P4-9QXM or MCL-CERT-2026-0002" />
            <button className="btn btn-primary" disabled={busy}>{busy ? <Spinner /> : <Search size={18} />} Verify</button>
          </form>

          {result === null && (
            <div className="verify-result invalid">
              <XCircle size={28} />
              <div><strong>No matching certificate</strong><p className="muted small">The code is invalid or the certificate has not been issued.</p></div>
            </div>
          )}
          {result && (
            <div className="verify-result valid">
              <BadgeCheck size={28} />
              <div>
                <strong>Valid clearance certificate</strong>
                <dl className="dl">
                  <dt>Student</dt><dd>{result.studentName}</dd>
                  <dt>Student number</dt><dd>{result.studentNumber}</dd>
                  <dt>Programme</dt><dd>{result.programme}</dd>
                  <dt>Purpose</dt><dd>{result.reason}</dd>
                  <dt>Certificate</dt><dd>{result.number}</dd>
                  <dt>Issued</dt><dd>{fmtDate(result.issuedAt)}</dd>
                </dl>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
