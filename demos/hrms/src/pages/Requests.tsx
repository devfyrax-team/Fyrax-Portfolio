import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api';
import { useCompanySettings } from '../components/CompanySettings';
import { ReceiptList, Receipt } from './Expenses';
import { Badge, Empty, ErrorText, Field, Loading, Modal, Pager, Tabs, dateNow, day, useAction } from '../components/ui';

interface ProgressStep { label: string; state: 'DONE' | 'CURRENT' | 'WAITING' | 'REJECTED' }
interface Req {
  id: string;
  type: 'REGULARIZATION' | 'OUT_ON_WORK' | 'LEAVE' | 'RESIGNATION' | 'EXPENSE' | 'ENCASHMENT';
  typeLabel: string;
  summary: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  payload: Record<string, any>;
  createdAt: string;
  requester: { id: string; employeeCode: string; name: string };
  waitingFor: string | null;
  progress: ProgressStep[];
  canDecide: boolean;
  canCancel: boolean;
  history?: { id: string; action: string; note: string | null; at: string; by: string | null }[];
}
interface TypeInfo { type: Req['type']; label: string; isDefault: boolean; chain: { label: string }[] }
interface Page { total: number; page: number; pageSize: number; items: Req[] }

const stepMark: Record<ProgressStep['state'], string> = { DONE: '✓', CURRENT: '●', WAITING: '○', REJECTED: '✕' };

export function Chain({ steps }: { steps: ProgressStep[] }) {
  return (
    <span className="chain">
      {steps.map((s, i) => (
        <span key={i} className={`chain-step ${s.state.toLowerCase()}`}>
          {stepMark[s.state]} {s.label}
          {i < steps.length - 1 && <span className="muted"> → </span>}
        </span>
      ))}
    </span>
  );
}

// What the request asks for, in words. The server writes it, so lists, details and notifications all say the same thing.
const summary = (r: Req) => r.summary;

function ExpenseReceipts({ requestId }: { requestId: string }) {
  const q = useQuery({ queryKey: ['expense-of-request', requestId], queryFn: () => api.get<{ id: string; receipts: Receipt[] }>(`/expenses/request/${requestId}`) });
  if (q.isLoading) return <Loading />;
  if (!q.data) return <span className="muted">Not available</span>;
  return <ReceiptList claimId={q.data.id} receipts={q.data.receipts} />;
}

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ['request', id], queryFn: () => api.get<Req>(`/requests/${id}`) });
  const r = q.data;
  return (
    <Modal title={r ? r.typeLabel : 'Request'} onClose={onClose}>
      {q.isLoading && <Loading />}
      {q.error && <ErrorText>{(q.error as Error).message}</ErrorText>}
      {r && (
        <>
          <p style={{ marginTop: 0 }}>
            <b>{r.requester.name}</b> <span className="muted">{r.requester.employeeCode}</span> <Badge value={r.status} />
          </p>
          <dl className="facts">
            <div><dt>Request</dt><dd>{r.summary}</dd></div>
            {r.payload.reason && <div><dt>Reason</dt><dd>{String(r.payload.reason)}</dd></div>}
            <div><dt>Submitted</dt><dd>{new Date(r.createdAt).toLocaleString()}</dd></div>
            {r.type === 'EXPENSE' && <div><dt>Receipts</dt><dd><ExpenseReceipts requestId={r.id} /></dd></div>}
          </dl>
          <h3>Approval</h3>
          <p><Chain steps={r.progress} /></p>
          <h3>History</h3>
          <ul className="history">
            {r.history?.map((h) => (
              <li key={h.id}>
                <b>{h.action.toLowerCase()}</b> <span className="muted">{h.by ?? 'system'} · {new Date(h.at).toLocaleString()}</span>
                {h.note && <div>“{h.note}”</div>}
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}

function NewRequest() {
  const qc = useQueryClient();
  const types = useQuery({ queryKey: ['request-types'], queryFn: () => api.get<TypeInfo[]>('/requests/types') });
  const [type, setType] = useState<Req['type']>('REGULARIZATION');
  const [f, setF] = useState({ date: dateNow(), checkIn: '09:00', checkOut: '18:00', halfDay: false, nature: '', reason: '' });
  const { run, pending, error } = useAction();
  const company = useCompanySettings();
  // Leave has its own form (balances, date ranges) on the Leave page; every other kind of request is raised here.
  const available = types.data?.filter((t) => t.type !== 'LEAVE' && t.type !== 'RESIGNATION' && t.type !== 'EXPENSE' && t.type !== 'ENCASHMENT');
  const info = types.data?.find((t) => t.type === type);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const payload =
      type === 'REGULARIZATION'
        ? { date: f.date, checkIn: f.checkIn, checkOut: f.checkOut || undefined, reason: f.reason }
        : { date: f.date, halfDay: f.halfDay, nature: f.nature, reason: f.reason || undefined };
    run(() => api.post('/requests', { type, payload }), () => {
      setF({ ...f, reason: '', nature: '' });
      qc.invalidateQueries({ queryKey: ['requests'] });
      qc.invalidateQueries({ queryKey: ['inbox-count'] });
    });
  };

  return (
    <form className="card" onSubmit={submit}>
      <h2 style={{ marginBottom: 12 }}>New request</h2>
      <div className="form-grid">
        <Field label="Type">
          <select value={type} onChange={(e) => setType(e.target.value as Req['type'])}>
            {available?.map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}
          </select>
        </Field>
        <Field label="Date" hint={`Up to ${company.data?.backdateWindowDays ?? 31} days back`}>
          <input type="date" value={f.date} max={dateNow()} onChange={set('date')} required />
        </Field>
        {type === 'REGULARIZATION' ? (
          <>
            <Field label="Check-in time"><input type="time" value={f.checkIn} onChange={set('checkIn')} required /></Field>
            <Field label="Check-out time"><input type="time" value={f.checkOut} onChange={set('checkOut')} /></Field>
          </>
        ) : (
          <Field label="Nature of work"><input value={f.nature} onChange={set('nature')} required minLength={2} maxLength={100} placeholder="e.g. Client site visit" /></Field>
        )}
      </div>
      {type === 'OUT_ON_WORK' && (
        <label className="check"><input type="checkbox" checked={f.halfDay} onChange={(e) => setF({ ...f, halfDay: e.target.checked })} /> Half day</label>
      )}
      <Field label={type === 'REGULARIZATION' ? 'Reason' : 'Reason (optional)'}>
        <input value={f.reason} onChange={set('reason')} required={type === 'REGULARIZATION'} minLength={type === 'REGULARIZATION' ? 3 : 0} maxLength={500} />
      </Field>
      {info && <p className="muted" style={{ marginTop: 0 }}>Approval: {info.chain.map((c) => c.label).join(' → ')}</p>}
      <ErrorText>{error}</ErrorText>
      <button className="btn primary" disabled={pending}>{pending ? 'Sending…' : 'Submit request'}</button>
    </form>
  );
}

function Mine() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['requests', 'mine', page], queryFn: () => api.get<Page>(`/requests/mine?page=${page}`) });
  const act = useAction();
  const noProfile = q.error instanceof ApiError && q.error.status === 409;

  if (noProfile) return <Empty>Your login is not linked to an employee profile, so you cannot raise requests.</Empty>;
  return (
    <>
      <NewRequest />
      <div className="card table-wrap">
        <h2 style={{ marginBottom: 12 }}>My requests</h2>
        <ErrorText>{act.error}</ErrorText>
        {q.isLoading ? <Loading /> : !q.data?.items.length ? <Empty>You have not raised any requests.</Empty> : (
          <table>
            <thead><tr><th>Request</th><th>Details</th><th>Status</th><th>Approval</th><th className="actions" /></tr></thead>
            <tbody>
              {q.data.items.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => setOpen(r.id)}>
                  <td>{r.typeLabel}</td>
                  <td>{summary(r)}</td>
                  <td><Badge value={r.status} /></td>
                  <td className="wrap"><Chain steps={r.progress} /></td>
                  <td className="actions" onClick={(e) => e.stopPropagation()}>
                    {r.canCancel && (
                      <button className="btn small danger" disabled={act.pending} onClick={() => act.run(() => api.post(`/requests/${r.id}/cancel`), () => qc.invalidateQueries({ queryKey: ['requests'] }))}>
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {q.data && <Pager page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onChange={setPage} />}
      </div>
      {open && <Detail id={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function Inbox() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [note, setNote] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ['requests', 'inbox', page], queryFn: () => api.get<Page>(`/requests/inbox?page=${page}`) });
  const act = useAction();
  const decide = (id: string, verb: 'approve' | 'reject') =>
    act.run(() => api.post(`/requests/${id}/${verb}`, { note: note || undefined }), () => {
      setNote('');
      qc.invalidateQueries({ queryKey: ['requests'] });
      qc.invalidateQueries({ queryKey: ['inbox-count'] });
      qc.invalidateQueries({ queryKey: ['att-me'] });
    });

  return (
    <>
      <div style={{ maxWidth: 360 }}>
        <Field label="Note for the next decision (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
      </div>
      <ErrorText>{act.error}</ErrorText>
      <div className="card table-wrap">
        {q.isLoading ? <Loading /> : !q.data?.items.length ? <Empty>Nothing is waiting for your approval.</Empty> : (
          <table>
            <thead><tr><th>Employee</th><th>Request</th><th>Details</th><th>Your step</th><th className="actions" /></tr></thead>
            <tbody>
              {q.data.items.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => setOpen(r.id)}>
                  <td>{r.requester.name} <span className="muted">{r.requester.employeeCode}</span></td>
                  <td>{r.typeLabel}</td>
                  <td>{summary(r)}</td>
                  <td className="wrap"><Chain steps={r.progress} /></td>
                  <td className="actions" onClick={(e) => e.stopPropagation()}>
                    <div className="row">
                      <button className="btn small primary" disabled={act.pending} onClick={() => decide(r.id, 'approve')}>Approve</button>
                      <button className="btn small danger" disabled={act.pending} onClick={() => decide(r.id, 'reject')}>Reject</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {q.data && <Pager page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onChange={setPage} />}
      </div>
      {open && <Detail id={open} onClose={() => setOpen(null)} />}
    </>
  );
}

export function Requests() {
  const [tab, setTab] = useState<'mine' | 'inbox'>('mine');
  const count = useQuery({
    queryKey: ['inbox-count'],
    queryFn: () => api.get<Page>('/requests/inbox?pageSize=1'),
    refetchInterval: 60_000,
  });
  const n = count.data?.total ?? 0;
  return (
    <>
      <h1>Requests</h1>
      <Tabs
        tabs={[{ id: 'mine', label: 'My requests' }, { id: 'inbox', label: n ? `To approve (${n})` : 'To approve' }]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'mine' ? <Mine /> : <Inbox />}
    </>
  );
}

export const requestsDay = day;
