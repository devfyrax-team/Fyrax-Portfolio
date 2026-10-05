import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { Badge, Empty, ErrorText, Field, Loading, Modal, Pager, SeatMeter, day, formatMoney, useAction } from '../../components/ui';

export interface CompanyRow {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  status: 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  suspendReason: string | null;
  users: number;
  employees: number;
  admins: number;
  lastLoginAt: string | null;
  seatLimit: number;
  seatsUsed: number;
  pricePerSeat: number;
  currency: string;
  monthly: number;
}

const CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'SGD', 'JPY', 'AED', 'ZAR'];

export function CurrencyInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <>
      <input list="currencies" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} required maxLength={3} pattern="[A-Z]{3}" />
      <datalist id="currencies">{CURRENCIES.map((c) => <option key={c} value={c} />)}</datalist>
    </>
  );
}

const timezones: string[] = (() => {
  try {
    return (Intl as any).supportedValuesOf('timeZone') as string[];
  } catch {
    return ['UTC'];
  }
})();

export function TimezoneInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <>
      <input list="timezones" value={value} onChange={(e) => onChange(e.target.value)} required />
      <datalist id="timezones">{timezones.map((t) => <option key={t} value={t} />)}</datalist>
    </>
  );
}

// "Acme Corp" -> "acme-corp": a starting suggestion for the company code, which the person can edit.
const slugOf = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

function NewCompany({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { run, pending, error } = useAction();
  const [f, setF] = useState({
    name: '', slug: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, adminEmail: '', adminPassword: '',
    seatLimit: '10', pricePerSeat: '0', currency: 'USD',
  });
  const [slugTouched, setSlugTouched] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const made = await api.post<{ id: string }>('/platform/companies', {
        name: f.name, slug: f.slug, timezone: f.timezone, adminEmail: f.adminEmail, adminPassword: f.adminPassword || undefined,
        seatLimit: Number(f.seatLimit), pricePerSeat: Number(f.pricePerSeat), currency: f.currency,
      });
      qc.invalidateQueries();
      navigate(`/platform/companies/${made.id}`);
    });
  };

  return (
    <Modal title="New company" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Company name">
            <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, slug: slugTouched ? f.slug : slugOf(e.target.value) })} required minLength={2} maxLength={100} />
          </Field>
          <Field label="Company code" hint="People type this to sign in. It cannot be changed later.">
            <input value={f.slug} onChange={(e) => { setSlugTouched(true); setF({ ...f, slug: e.target.value }); }} required minLength={2} maxLength={40} pattern="[a-z0-9]+(-[a-z0-9]+)*" autoCapitalize="none" />
          </Field>
          <Field label="Timezone" hint="Used to judge attendance and late arrivals">
            <TimezoneInput value={f.timezone} onChange={(v) => setF({ ...f, timezone: v })} />
          </Field>
          <Field label="First administrator's email">
            <input type="email" value={f.adminEmail} onChange={(e) => setF({ ...f, adminEmail: e.target.value })} required />
          </Field>
          <Field label="Seats" hint="How many employees the company may have">
            <input type="number" min={1} step={1} value={f.seatLimit} onChange={(e) => setF({ ...f, seatLimit: e.target.value })} required />
          </Field>
          <Field label="Price per seat, per month">
            <input type="number" min={0} step="0.01" value={f.pricePerSeat} onChange={(e) => setF({ ...f, pricePerSeat: e.target.value })} required />
          </Field>
          <Field label="Currency">
            <CurrencyInput value={f.currency} onChange={(v) => setF({ ...f, currency: v })} />
          </Field>
        </div>
        <Field label="Password (optional)" hint="Leave blank to email them an invitation so they choose their own">
          <input type="password" value={f.adminPassword} onChange={(e) => setF({ ...f, adminPassword: e.target.value })} autoComplete="new-password" />
        </Field>
        <ErrorText>{error}</ErrorText>
        <div className="row">
          <button className="btn primary" disabled={pending}>{pending ? 'Creating…' : 'Create company'}</button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

export function Companies() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const creating = params.get('new') === '1';

  const list = useQuery({
    queryKey: ['platform-companies', q, status, page],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page) });
      if (q) p.set('q', q);
      if (status) p.set('status', status);
      return api.get<{ total: number; page: number; pageSize: number; items: CompanyRow[] }>(`/platform/companies?${p}`);
    },
  });

  return (
    <>
      <div className="row between">
        <h1>Companies</h1>
        <button className="btn primary" onClick={() => setParams({ new: '1' })}>New company</button>
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <Field label="Search"><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Name or company code" /></Field>
        </div>
        <Field label="Status">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </Field>
      </div>
      <div className="card">
        {list.isLoading ? <Loading /> : list.error ? <p className="error">{(list.error as Error).message}</p> : !list.data?.items.length ? (
          <Empty>{q || status ? 'No companies match these filters.' : 'No companies yet. Create the first one.'}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Company</th><th>Code</th><th>Status</th><th>Seats used</th><th className="num">Monthly</th>
                  <th className="num">Accounts</th><th>Last sign-in</th><th>Created</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((c) => (
                  <tr key={c.id}>
                    <td><Link to={`/platform/companies/${c.id}`}>{c.name}</Link></td>
                    <td className="muted">{c.slug}</td>
                    <td><Badge value={c.status} /></td>
                    <td><SeatMeter used={c.seatsUsed} limit={c.seatLimit} /></td>
                    <td className="num">{formatMoney(c.monthly, c.currency)}</td>
                    <td className="num">{c.users}</td>
                    <td>{c.lastLoginAt ? day(c.lastLoginAt) : <span className="muted">Never</span>}</td>
                    <td>{day(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />}
      </div>
      {creating && <NewCompany onClose={() => setParams({})} />}
    </>
  );
}
