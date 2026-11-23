import { useEffect } from 'react';
import { CheckCircle2, Clock, XCircle, FileText, Image as ImageIcon, Download, Eye, X, AlertTriangle, BadgeCheck } from 'lucide-react';
import { CURRENCY, OVERALL_STATUS, TASK_STATUS, fetchDocumentBlob, progressOf } from '../api/api';

// ---------- formatting ----------

export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
export const fmtMoney = (n) => `${Number(n || 0).toLocaleString()} ${CURRENCY}`;
export const fmtSize = (b) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1048576).toFixed(1)} MB`);

export function timeAgo(iso) {
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)} d ago`;
  return fmtDate(iso);
}

// ---------- status ----------

const STATUS_STYLE = {
  [TASK_STATUS.PENDING]: { cls: 'pending', Icon: Clock },
  [TASK_STATUS.APPROVED]: { cls: 'approved', Icon: CheckCircle2 },
  [TASK_STATUS.REJECTED]: { cls: 'rejected', Icon: XCircle },
  [OVERALL_STATUS.IN_PROGRESS]: { cls: 'pending', Icon: Clock },
  [OVERALL_STATUS.ATTENTION]: { cls: 'rejected', Icon: AlertTriangle },
  [OVERALL_STATUS.CLEARED]: { cls: 'approved', Icon: BadgeCheck },
  Paid: { cls: 'approved', Icon: CheckCircle2 },
  Unpaid: { cls: 'pending', Icon: Clock },
  Active: { cls: 'approved', Icon: CheckCircle2 },
  Inactive: { cls: 'neutral', Icon: XCircle },
};

export function StatusBadge({ status, size }) {
  const { cls, Icon } = STATUS_STYLE[status] ?? { cls: 'neutral', Icon: Clock };
  return (
    <span className={`badge badge-${cls} ${size === 'lg' ? 'badge-lg' : ''}`}>
      <Icon size={size === 'lg' ? 16 : 13} /> {status}
    </span>
  );
}

export function ProgressBar({ request, showLabel = true }) {
  const { done, total, pct } = progressOf(request);
  const rejected = request.tasks.some((t) => t.status === TASK_STATUS.REJECTED);
  return (
    <div className="progress-wrap">
      <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`progress-fill ${pct === 100 ? 'done' : rejected ? 'warn' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <span className="muted small">{done}/{total} cleared</span>}
    </div>
  );
}

// ---------- layout primitives ----------

export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="page-header">
    <div>
      <h1>{title}</h1>
      {subtitle && <p className="muted">{subtitle}</p>}
    </div>
    {actions && <div className="page-actions">{actions}</div>}
  </div>
);

export const Card = ({ title, actions, children, className = '', pad = true }) => (
  <section className={`card ${className}`}>
    {(title || actions) && (
      <header className="card-header">
        {title && <h2>{title}</h2>}
        {actions}
      </header>
    )}
    <div className={pad ? 'card-body' : ''}>{children}</div>
  </section>
);

export const StatCard = ({ label, value, icon: Icon, tone = 'blue', hint }) => (
  <div className="stat">
    <div className={`stat-icon tone-${tone}`}><Icon size={20} /></div>
    <div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="muted small">{hint}</div>}
    </div>
  </div>
);

export const EmptyState = ({ icon: Icon, title, children }) => (
  <div className="empty">
    {Icon && <Icon size={36} />}
    <h3>{title}</h3>
    {children && <div className="muted">{children}</div>}
  </div>
);

export function Modal({ open, title, onClose, children, footer, width = 520 }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: width }} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-header">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>
  );
}

export const Field = ({ label, error, hint, children, required }) => (
  <label className="field">
    <span className="field-label">{label}{required && <span className="req"> *</span>}</span>
    {children}
    {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
  </label>
);

export const Spinner = () => <span className="spinner" aria-hidden />;

// ---------- documents ----------

export function DocumentList({ documents, onRemove }) {
  if (!documents?.length) return <p className="muted small">No documents uploaded.</p>;

  const blobFor = async (d) => {
    if (d.url) return fetchDocumentBlob(d);
    return (await fetch(d.dataUrl)).blob();
  };

  const view = async (d) => {
    try {
      const url = URL.createObjectURL(await blobFor(d));
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      window.alert(error.message);
    }
  };

  const save = async (d) => {
    try {
      const url = URL.createObjectURL(await blobFor(d));
      const link = document.createElement('a');
      link.href = url;
      link.download = d.name;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      window.alert(error.message);
    }
  };

  return (
    <ul className="doc-list">
      {documents.map((d) => (
        <li key={d.id}>
          <span className="doc-icon">{d.type.startsWith('image/') ? <ImageIcon size={18} /> : <FileText size={18} />}</span>
          <div className="doc-meta">
            <span className="doc-name">{d.name}</span>
            <span className="muted small">{fmtSize(d.size)} · {fmtDate(d.uploadedAt)}</span>
          </div>
          {d.url || d.dataUrl ? (
            <>
              <button type="button" className="icon-btn" title="View" onClick={() => view(d)}><Eye size={16} /></button>
              <button type="button" className="icon-btn" title="Download" onClick={() => save(d)}><Download size={16} /></button>
            </>
          ) : !onRemove && <span className="muted small" title="Seeded demo record — no file content">sample</span>}
          {onRemove && <button type="button" className="icon-btn danger" title="Remove" onClick={() => onRemove(d.id)}><X size={16} /></button>}
        </li>
      ))}
    </ul>
  );
}
