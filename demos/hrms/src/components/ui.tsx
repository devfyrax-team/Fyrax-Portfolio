import { ReactNode, useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<unknown>, after?: () => void) => {
    setPending(true);
    setError(null);
    try {
      await fn();
      after?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  };
  return { run, pending, error, setError };
}

export const ErrorText = ({ children }: { children?: ReactNode }) =>
  children ? <p className="error" role="alert">{children}</p> : null;

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    // Prefer the first form control over the close button in the header.
    (ref.current?.querySelector<HTMLElement>('input, select, textarea') ?? ref.current?.querySelector<HTMLElement>('button'))?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header className="modal-head">
          <h2>{title}</h2>
          <button className="btn ghost" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </header>
        {children}
      </div>
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={t.id === value} className={t.id === value ? 'tab active' : 'tab'} onClick={() => onChange(t.id)}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

const tone: Record<string, string> = {
  ACTIVE: 'ok', APPROVED: 'ok', PAID: 'ok', PRESENT: 'ok',
  PENDING: 'warn', DRAFT: 'warn', LATE: 'warn', HALF_DAY: 'warn', ON_LEAVE: 'warn',
  REJECTED: 'bad', TERMINATED: 'bad', SUSPENDED: 'bad', CANCELLED: 'muted',
  ISSUED: 'warn', OVERDUE: 'bad', VOID: 'muted', // invoices
};
export const Badge = ({ value }: { value: string }) => (
  <span className={`badge ${tone[value] ?? 'muted'}`}>{value.replace('_', ' ').toLowerCase()}</span>
);

export const Empty = ({ children }: { children: ReactNode }) => <p className="empty">{children}</p>;
/** A thin progress bar over shimmering placeholder rows; the words stay for screen readers. */
export const Loading = () => (
  <div className="loading" role="status" aria-live="polite">
    <span className="sr-only">Loading…</span>
    <div className="bar" aria-hidden="true"><i /></div>
    <div className="sk" style={{ height: 22, width: '40%' }} aria-hidden="true" />
    <div className="sk" style={{ height: 48 }} aria-hidden="true" />
    <div className="sk" style={{ height: 48 }} aria-hidden="true" />
    <div className="sk" style={{ height: 48, width: '70%' }} aria-hidden="true" />
  </div>
);

export const money = (n: number | string) =>
  Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Formats an amount in its own currency, e.g. "£27.00". Falls back to a plain number for unknown codes. */
export const formatMoney = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
};

/** "12 / 25", turning amber near the limit and red when every seat is used. */
export function SeatMeter({ used, limit }: { used: number; limit: number }) {
  const full = used >= limit;
  const near = !full && used >= limit * 0.9;
  return (
    <span className={full ? 'seat-meter full' : near ? 'seat-meter near' : 'seat-meter'}>
      {used} / {limit}
      {full && <span className="badge bad" style={{ marginLeft: 6 }}>full</span>}
      {near && <span className="badge warn" style={{ marginLeft: 6 }}>nearly full</span>}
    </span>
  );
}

export const monthNow = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
export const dateNow = () => {
  const d = new Date();
  return `${monthNow()}-${String(d.getDate()).padStart(2, '0')}`;
};
export const day = (iso: string) => iso.slice(0, 10);
export const time = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
export const num = (n: number | string) => Number(n);

export function Pager({ page, pageSize, total, onChange }: { page: number; pageSize: number; total: number; onChange: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <div className="pager">
      <button className="btn" disabled={page <= 1} onClick={() => onChange(page - 1)}>Previous</button>
      <span className="muted">Page {page} of {pages}</span>
      <button className="btn" disabled={page >= pages} onClick={() => onChange(page + 1)}>Next</button>
    </div>
  );
}
