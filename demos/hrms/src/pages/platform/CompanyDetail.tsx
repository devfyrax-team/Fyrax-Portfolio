import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { Badge, Empty, ErrorText, Field, Loading, Modal, SeatMeter, day, formatMoney, useAction } from '../../components/ui';
import { CurrencyInput, TimezoneInput } from './Companies';
import { actionDetail, actionLabel } from './AuditLog';

interface Detail {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  suspendedAt: string | null;
  suspendReason: string | null;
  employees: Record<string, number>;
  users: Record<string, number>;
  departments: number;
  designations: number;
  leaveTypes: number;
  payrollRuns: Record<string, number>;
  latestPayroll: { month: string; status: string } | null;
  pendingApprovals: number;
  admins: { id: string; email: string; active: boolean; lastLoginAt: string | null }[];
  seats: { limit: number; used: number; pricePerSeat: number; currency: string; taxPercent: number; monthly: number };
}
interface AuditItem { id: string; action: string; at: string; by: string | null; metadata: any }

function EditCompany({ c, onClose }: { c: Detail; onClose: () => void }) {
  const qc = useQueryClient();
  const { run, pending, error } = useAction();
  const [name, setName] = useState(c.name);
  const [timezone, setTimezone] = useState(c.timezone);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => api.patch(`/platform/companies/${c.id}`, { name, timezone }), () => { qc.invalidateQueries(); onClose(); });
  };
  return (
    <Modal title={`Edit ${c.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <Field label="Company name"><input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={100} /></Field>
        <Field label="Timezone" hint="Changing it affects how attendance dates and late arrivals are judged from now on">
          <TimezoneInput value={timezone} onChange={setTimezone} />
        </Field>
        <p className="muted">The company code <b>{c.slug}</b> cannot be changed.</p>
        <ErrorText>{error}</ErrorText>
        <div className="row">
          <button className="btn primary" disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

function EditSeats({ c, onClose }: { c: Detail; onClose: () => void }) {
  const qc = useQueryClient();
  const { run, pending, error } = useAction();
  const [limit, setLimit] = useState(String(c.seats.limit));
  const [price, setPrice] = useState(String(c.seats.pricePerSeat));
  const [currency, setCurrency] = useState(c.seats.currency);
  const [tax, setTax] = useState(String(c.seats.taxPercent));
  const monthly = Number(limit) * Number(price);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(
      () => api.patch(`/platform/companies/${c.id}/seats`, { seatLimit: Number(limit), pricePerSeat: Number(price), currency, taxPercent: Number(tax) }),
      () => { qc.invalidateQueries(); onClose(); },
    );
  };
  return (
    <Modal title={`Seats and billing for ${c.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Seats" hint={`${c.seats.used} in use now. The limit cannot go below that.`}>
            <input type="number" min={Math.max(1, c.seats.used)} step={1} value={limit} onChange={(e) => setLimit(e.target.value)} required autoFocus />
          </Field>
          <Field label="Price per seat, per month">
            <input type="number" min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} required />
          </Field>
          <Field label="Currency"><CurrencyInput value={currency} onChange={setCurrency} /></Field>
          <Field label="Tax on invoices (%)" hint="VAT, GST or similar. 0 for none."><input type="number" min={0} max={100} step="0.01" value={tax} onChange={(e) => setTax(e.target.value)} required /></Field>
        </div>
        <p className="muted" style={{ marginTop: 0 }}>
          The company is billed for the seats it has bought: <b>{Number.isFinite(monthly) ? formatMoney(monthly, /^[A-Z]{3}$/.test(currency) ? currency : 'USD') : '—'}</b> per month.
          New seats can be used straight away.
        </p>
        <ErrorText>{error}</ErrorText>
        <div className="row">
          <button className="btn primary" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

function SuspendCompany({ c, onClose }: { c: Detail; onClose: () => void }) {
  const qc = useQueryClient();
  const { run, pending, error } = useAction();
  const [reason, setReason] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => api.post(`/platform/companies/${c.id}/suspend`, { reason }), () => { qc.invalidateQueries(); onClose(); });
  };
  return (
    <Modal title={`Suspend ${c.name}?`} onClose={onClose}>
      <form onSubmit={submit}>
        <p style={{ marginTop: 0 }}>
          Everyone in <b>{c.name}</b> is signed out immediately and cannot sign in until you reactivate it.
          Nothing is deleted.
        </p>
        <Field label="Reason" hint="Recorded in the audit log and shown here">
          <input value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={300} autoFocus />
        </Field>
        <ErrorText>{error}</ErrorText>
        <div className="row">
          <button className="btn danger" disabled={pending}>{pending ? 'Suspending…' : `Suspend ${c.name}`}</button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

export function CompanyDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<'edit' | 'suspend' | 'seats' | null>(null);
  const [newAdmin, setNewAdmin] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['platform-company', id], queryFn: () => api.get<Detail>(`/platform/companies/${id}`) });
  const audit = useQuery({
    queryKey: ['platform-company-audit', id],
    queryFn: () => api.get<{ items: AuditItem[] }>(`/platform/audit?companyId=${id}&pageSize=8`),
  });
  const act = useAction();
  const addAdmin = useAction();
  const refresh = () => qc.invalidateQueries();

  if (q.isLoading) return <Loading />;
  if (q.error) return <p className="error">{(q.error as Error).message}</p>;
  const c = q.data!;
  const suspended = c.status === 'SUSPENDED';
  const count = (m: Record<string, number>, k: string) => m[k] ?? 0;
  const stats: [string, number | string][] = [
    ['Employees using a seat', count(c.employees, 'ACTIVE') + count(c.employees, 'ON_LEAVE')],
    ['Former employees', count(c.employees, 'TERMINATED')],
    ['Administrators', count(c.users, 'ADMIN')],
    ['Other accounts', Object.entries(c.users).filter(([r]) => r !== 'ADMIN').reduce((n, [, v]) => n + v, 0)],
    ['Departments', c.departments],
    ['Waiting for approval', c.pendingApprovals],
    ['Latest payroll', c.latestPayroll ? `${c.latestPayroll.month} (${c.latestPayroll.status.toLowerCase()})` : 'None yet'],
  ];

  return (
    <>
      <p style={{ marginTop: 0 }}><Link to="/platform/companies">← Companies</Link></p>
      <div className="row between">
        <h1 style={{ marginBottom: 0 }}>{c.name} <Badge value={c.status} /></h1>
        <div className="row">
          <button className="btn" onClick={() => setDialog('edit')}>Edit</button>
          {suspended ? (
            <button
              className="btn primary"
              disabled={act.pending}
              onClick={() => window.confirm(`Reactivate ${c.name}? Its people will be able to sign in again.`) && act.run(() => api.post(`/platform/companies/${c.id}/reactivate`), refresh)}
            >
              Reactivate
            </button>
          ) : (
            <button className="btn danger" onClick={() => setDialog('suspend')}>Suspend</button>
          )}
        </div>
      </div>
      <p className="muted">
        Company code <b>{c.slug}</b> · {c.timezone} · created {day(c.createdAt)}
      </p>
      <ErrorText>{act.error}</ErrorText>
      {suspended && (
        <p className="error" role="status">
          Suspended {c.suspendedAt ? day(c.suspendedAt) : ''}: {c.suspendReason}. Nobody in this company can sign in.
        </p>
      )}

      <div className="card">
        <div className="row between">
          <h2>Seats and billing</h2>
          <button className="btn" onClick={() => setDialog('seats')}>Change seats or price</button>
        </div>
        <div className="row" style={{ marginTop: 12, alignItems: 'flex-end', gap: 32 }}>
          <div style={{ minWidth: 220, flex: 1 }}>
            <b style={{ fontSize: 22 }}><SeatMeter used={c.seats.used} limit={c.seats.limit} /></b>
            <div className="muted">seats in use</div>
            <div className={`seat-bar ${c.seats.used >= c.seats.limit ? 'full' : c.seats.used >= c.seats.limit * 0.9 ? 'near' : ''}`} aria-hidden="true">
              <span style={{ width: `${Math.min(100, (c.seats.used / c.seats.limit) * 100)}%` }} />
            </div>
          </div>
          <div><b style={{ fontSize: 22 }}>{formatMoney(c.seats.pricePerSeat, c.seats.currency)}</b><div className="muted">per seat, per month</div></div>
          <div><b style={{ fontSize: 22 }}>{formatMoney(c.seats.monthly, c.seats.currency)}</b><div className="muted">per month ({c.seats.limit} seats){suspended ? ', not billed while suspended' : ''}</div></div>
        </div>
        {c.seats.used >= c.seats.limit && <p className="muted" style={{ marginBottom: 0 }}>Every seat is used, so this company cannot add or reinstate employees until it has more.</p>}
      </div>

      <div className="stats" style={{ marginBottom: 16 }}>
        {stats.map(([label, value]) => <div className="stat" key={label}><b>{value}</b><span>{label}</span></div>)}
      </div>

      <div className="card table-wrap">
        <h2 style={{ marginBottom: 12 }}>Administrators</h2>
        {notice && <p className="notice" role="status">{notice}</p>}
        <ErrorText>{addAdmin.error}</ErrorText>
        <table>
          <thead><tr><th>Email</th><th>Status</th><th>Last sign-in</th><th /></tr></thead>
          <tbody>
            {c.admins.map((a) => (
              <tr key={a.id}>
                <td>{a.email}</td>
                <td><Badge value={a.active ? 'ACTIVE' : 'CANCELLED'} /></td>
                <td>{a.lastLoginAt ? day(a.lastLoginAt) : <span className="muted">Never</span>}</td>
                <td>
                  {a.active && (
                    <button
                      className="btn small"
                      disabled={act.pending}
                      onClick={() => act.run(async () => { await api.post(`/platform/companies/${c.id}/users/${a.id}/send-reset`); setNotice(`A password reset link was emailed to ${a.email}.`); })}
                    >
                      Send reset link
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form
          className="row"
          style={{ marginTop: 12, alignItems: 'flex-end' }}
          onSubmit={(e) => {
            e.preventDefault();
            addAdmin.run(async () => { await api.post(`/platform/companies/${c.id}/admins`, { email: newAdmin }); setNotice(`An invitation was emailed to ${newAdmin}.`); }, () => { setNewAdmin(''); refresh(); });
          }}
        >
          <div style={{ flex: 1, maxWidth: 360 }}>
            <Field label="Add another administrator" hint="They get an email to choose their password">
              <input type="email" value={newAdmin} onChange={(e) => setNewAdmin(e.target.value)} required placeholder="email@company.com" />
            </Field>
          </div>
          <button className="btn" disabled={addAdmin.pending} style={{ marginBottom: 24 }}>Invite</button>
        </form>
      </div>

      <div className="card table-wrap">
        <h2 style={{ marginBottom: 12 }}>Recent activity</h2>
        {!audit.data?.items.length ? <Empty>Nothing recorded for this company yet.</Empty> : (
          <table>
            <thead><tr><th>When</th><th>What</th><th>By</th></tr></thead>
            <tbody>
              {audit.data.items.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.at).toLocaleString()}</td>
                  <td>{actionLabel(a.action)}{actionDetail(a.action, a.metadata) && <span className="muted"> · {actionDetail(a.action, a.metadata)}</span>}</td>
                  <td className="muted">{a.by ?? 'system'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {dialog === 'edit' && <EditCompany c={c} onClose={() => setDialog(null)} />}
      {dialog === 'suspend' && <SuspendCompany c={c} onClose={() => setDialog(null)} />}
      {dialog === 'seats' && <EditSeats c={c} onClose={() => setDialog(null)} />}
    </>
  );
}
