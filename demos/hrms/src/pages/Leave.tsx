import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api';
import { useCompanySettings } from '../components/CompanySettings';
import { canView, isHR, useAuth } from '../auth';
import { EncashmentCard, EncashmentPayouts } from '../components/Encashment';
import { Badge, Empty, ErrorText, Field, Loading, Pager, Tabs, dateNow, day, useAction } from '../components/ui';

interface LeaveType { id: string; name: string; paid: boolean }
interface Balance {
  id: string; entitled: string; carriedOver: string; used: string; pending: string; leaveType: { name: string };
}
interface Request {
  id: string; startDate: string; endDate: string; days: string; halfDay: boolean; reason: string | null; status: string;
  decisionNote: string | null; waitingFor: string | null; leaveType: { name: string };
  employee: { employeeCode: string; firstName: string; lastName: string };
}

const todayStr = () => new Date().toISOString().slice(0, 10);

function Mine() {
  const qc = useQueryClient();
  const types = useQuery({ queryKey: ['leave-types'], queryFn: () => api.get<LeaveType[]>('/leave-types') });
  const balances = useQuery({ queryKey: ['balances-me'], queryFn: () => api.get<Balance[]>('/leave/balances/me') });
  const requests = useQuery({ queryKey: ['leave-mine'], queryFn: () => api.get<Request[]>('/leave/requests/me') });
  const company = useCompanySettings();
  const apply = useAction();
  const act = useAction();
  const [f, setF] = useState({ leaveTypeId: '', startDate: todayStr(), endDate: todayStr(), halfDay: false, reason: '' });
  const refresh = () => qc.invalidateQueries();

  if (balances.error instanceof ApiError && balances.error.status === 409) {
    return <Empty>Your login is not linked to an employee profile, so you cannot request leave.</Empty>;
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    apply.run(
      () => api.post('/leave/requests', { ...f, leaveTypeId: f.leaveTypeId || types.data?.[0]?.id, reason: f.reason || undefined }),
      () => { setF({ ...f, reason: '' }); refresh(); },
    );
  };

  return (
    <>
      <div className="card">
        <h2 style={{ marginBottom: 4 }}>Balances</h2>
        {company.data && (
          <p className="muted" style={{ marginTop: 0 }}>
            Leave year {day(company.data.leaveYear.start)} to {day(company.data.leaveYear.end)}
          </p>
        )}
        {!balances.data ? <Loading /> : balances.data.length === 0 ? <Empty>No paid leave types yet.</Empty> : (
          <div className="stats">
            {balances.data.map((b) => (
              <div className="stat" key={b.id}>
                <b>{Number(b.entitled) + Number(b.carriedOver) - Number(b.used) - Number(b.pending)}</b>
                <span>{b.leaveType.name} available</span>
                <span style={{ display: 'block' }}>{Number(b.used)} used · {Number(b.pending)} pending</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <form className="card" onSubmit={submit}>
        <h2 style={{ marginBottom: 12 }}>Request leave</h2>
        <div className="form-grid">
          <Field label="Type">
            <select value={f.leaveTypeId || types.data?.[0]?.id || ''} onChange={(e) => setF({ ...f, leaveTypeId: e.target.value })} required>
              {types.data?.map((t) => <option key={t.id} value={t.id}>{t.name}{t.paid ? '' : ' (unpaid)'}</option>)}
            </select>
          </Field>
          <Field label="From"><input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value, endDate: f.halfDay ? e.target.value : f.endDate })} required /></Field>
          <Field label="To"><input type="date" value={f.endDate} min={f.startDate} disabled={f.halfDay} onChange={(e) => setF({ ...f, endDate: e.target.value })} required /></Field>
        </div>
        <label className="check">
          <input type="checkbox" checked={f.halfDay} onChange={(e) => setF({ ...f, halfDay: e.target.checked, endDate: e.target.checked ? f.startDate : f.endDate })} />
          Half day
        </label>
        <Field label="Reason (optional)"><input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} maxLength={500} /></Field>
        <ErrorText>{apply.error}</ErrorText>
        <button className="btn primary" disabled={apply.pending || !types.data?.length}>{apply.pending ? 'Sending…' : 'Request leave'}</button>
        {types.data?.length === 0 && <p className="muted">HR has not set up any leave types yet.</p>}
      </form>

      <EncashmentCard />

      <div className="card table-wrap">
        <h2 style={{ marginBottom: 12 }}>My requests</h2>
        <ErrorText>{act.error}</ErrorText>
        {requests.isLoading ? <Loading /> : !requests.data?.length ? <Empty>You have not requested any leave.</Empty> : (
          <table>
            <thead><tr><th>Type</th><th>Dates</th><th className="num">Days</th><th>Status</th><th>Note</th><th /></tr></thead>
            <tbody>
              {requests.data.map((r) => (
                <tr key={r.id}>
                  <td>{r.leaveType.name}</td>
                  <td>{day(r.startDate)}{r.startDate !== r.endDate && ` → ${day(r.endDate)}`}</td>
                  <td className="num">{Number(r.days)}</td>
                  <td><Badge value={r.status} />{r.waitingFor && <span className="muted"> · waiting for {r.waitingFor}</span>}</td>
                  <td className="muted">{r.decisionNote ?? ''}</td>
                  <td>
                    {/* Approved leave can only be cancelled before it starts; the server enforces this too. */}
                    {(r.status === 'PENDING' || (r.status === 'APPROVED' && day(r.startDate) > dateNow())) && (
                      <button className="btn small danger" disabled={act.pending} onClick={() => act.run(() => api.post(`/leave/requests/${r.id}/cancel`), refresh)}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Approvals() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [status, setStatus] = useState('PENDING');
  const [page, setPage] = useState(1);
  const [note, setNote] = useState('');
  const q = useQuery({
    queryKey: ['leave-requests', status, page],
    queryFn: () => api.get<{ total: number; page: number; pageSize: number; items: Request[] }>(`/leave/requests?status=${status}&page=${page}`),
  });
  const act = useAction();
  const alloc = useAction();
  const [allocated, setAllocated] = useState<string | null>(null);
  const decide = (id: string, verb: 'approve' | 'reject') =>
    act.run(() => api.post(`/leave/requests/${id}/${verb}`, { note: note || undefined }), () => { setNote(''); qc.invalidateQueries(); });

  return (
    <>
      <div className="row between" style={{ marginBottom: 12 }}>
        <Field label="Status">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            {['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((s) => <option key={s}>{s}</option>)}
          </select>
        </Field>
        {status === 'PENDING' && (
          <div style={{ flex: 1, maxWidth: 320 }}>
            <Field label="Note for the next decision (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
          </div>
        )}
        {isHR(user!.role) && (
          <div>
            <button
              className="btn"
              disabled={alloc.pending}
              onClick={() => alloc.run(async () => {
                const r = await api.post<{ year: number; created: number }>('/leave/balances/allocate', {});
                setAllocated(`${r.created} balance${r.created === 1 ? '' : 's'} created for ${r.year}`);
              })}
            >
              Allocate this year's balances
            </button>
            {allocated && <p className="muted" style={{ margin: '4px 0 0' }}>{allocated}</p>}
          </div>
        )}
      </div>
      <ErrorText>{act.error ?? alloc.error}</ErrorText>
      <div className="card table-wrap">
        {q.isLoading ? <Loading /> : q.error ? <p className="error">{(q.error as Error).message}</p> : !q.data?.items.length ? <Empty>No {status.toLowerCase()} requests.</Empty> : (
          <table>
            <thead><tr><th>Employee</th><th>Type</th><th>Dates</th><th className="num">Days</th><th>Reason</th><th className="actions" /></tr></thead>
            <tbody>
              {q.data.items.map((r) => (
                <tr key={r.id}>
                  <td>{r.employee.firstName} {r.employee.lastName} <span className="muted">{r.employee.employeeCode}</span></td>
                  <td>{r.leaveType.name}</td>
                  <td>{day(r.startDate)}{r.startDate !== r.endDate && ` → ${day(r.endDate)}`}</td>
                  <td className="num">{Number(r.days)}</td>
                  <td className="muted wrap">{r.reason ?? ''}</td>
                  <td className="actions">
                    {r.status === 'PENDING' && (
                      <div className="row">
                        <button className="btn small primary" disabled={act.pending} onClick={() => decide(r.id, 'approve')}>Approve</button>
                        <button className="btn small danger" disabled={act.pending} onClick={() => decide(r.id, 'reject')}>Reject</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {q.data && <Pager page={q.data.page} pageSize={q.data.pageSize} total={q.data.total} onChange={setPage} />}
      </div>
    </>
  );
}

export function Leave() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'mine' | 'approvals' | 'payouts'>('mine');
  return (
    <>
      <h1>Time off</h1>
      {canView(user!.role) && (
        <Tabs tabs={[{ id: 'mine', label: 'My leave' }, { id: 'approvals', label: user!.role === 'MANAGER' ? 'Team requests' : 'All requests' }, ...(isHR(user!.role) ? [{ id: 'payouts' as const, label: 'Payouts' }] : [])]} value={tab} onChange={setTab} />
      )}
      {tab === 'mine' || !canView(user!.role) ? <Mine /> : tab === 'payouts' ? <EncashmentPayouts /> : <Approvals />}
    </>
  );
}
