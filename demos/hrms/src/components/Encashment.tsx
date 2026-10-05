import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { Badge, Empty, ErrorText, Field, Loading, Modal, money, useAction } from './ui';

interface Option { leaveTypeId: string; name: string; available: number }
interface Item {
  id: string; leaveType: string; days: number; year: number; status: string; decisionNote: string | null; amount: number | null; payMonth: string | null; requestId: string | null;
}
interface HrItem extends Item { employee: { id: string; employeeCode: string; name: string }; dayValue: number | null; suggestedAmount: number | null }

const STATUS_LABEL: Record<string, string> = { PENDING: 'Waiting for approval', APPROVED: 'Approved, payment to be arranged', REJECTED: 'Rejected', CANCELLED: 'Withdrawn', PAID: 'Scheduled for payment' };
const keys = ['encashments-mine', 'encashments-hr', 'encash-options', 'balances-me', 'requests', 'inbox-count'];

/** Leave > My leave: turn unused days of a payable leave type into money. Shows nothing when the company has no such type. */
export function EncashmentCard() {
  const qc = useQueryClient();
  const options = useQuery({ queryKey: ['encash-options'], queryFn: () => api.get<Option[]>('/encashments/options') });
  const mine = useQuery({ queryKey: ['encashments-mine'], queryFn: () => api.get<Item[]>('/encashments/mine') });
  const act = useAction();
  const cancel = useAction();
  const [f, setF] = useState({ leaveTypeId: '', days: '' });
  const refresh = () => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  if (!options.data?.length && !mine.data?.length) return null;

  const current = options.data?.find((o) => o.leaveTypeId === (f.leaveTypeId || options.data?.[0]?.leaveTypeId));
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!current) return;
    act.run(() => api.post('/requests', { type: 'ENCASHMENT', payload: { leaveTypeId: current.leaveTypeId, days: Number(f.days) } }), () => { setF({ ...f, days: '' }); refresh(); });
  };
  return (
    <div className="card">
      <h2 style={{ marginBottom: 4 }}>Pay out unused leave</h2>
      {options.data?.length ? (
        <form onSubmit={submit}>
          <p className="muted" style={{ marginTop: 0 }}>Turn days you will not take into money on a payslip. The days are taken off your balance once approved.</p>
          <div className="form-grid">
            <Field label="Leave type">
              <select value={current?.leaveTypeId ?? ''} onChange={(e) => setF({ ...f, leaveTypeId: e.target.value })}>
                {options.data.map((o) => <option key={o.leaveTypeId} value={o.leaveTypeId}>{o.name} ({o.available} available)</option>)}
              </select>
            </Field>
            <Field label="Number of days" hint="Whole or half days"><input type="number" min="0.5" step="0.5" max={current?.available} value={f.days} onChange={(e) => setF({ ...f, days: e.target.value })} required /></Field>
          </div>
          <ErrorText>{act.error}</ErrorText>
          <button className="btn primary" disabled={act.pending}>Request payout</button>
        </form>
      ) : null}
      {!!mine.data?.length && (
        <table style={{ marginTop: 12 }}>
          <thead><tr><th>Type</th><th className="num">Days</th><th>Status</th><th /></tr></thead>
          <tbody>
            {mine.data.map((c) => (
              <tr key={c.id}>
                <td>{c.leaveType}</td><td className="num">{c.days}</td>
                <td>
                  <Badge value={c.status} /> <span className="muted">{STATUS_LABEL[c.status]}</span>
                  {c.status === 'PAID' && <div className="muted">{money(c.amount ?? 0)} with the {c.payMonth} payroll</div>}
                  {c.decisionNote && <div className="muted">Note: {c.decisionNote}</div>}
                </td>
                <td>{c.status === 'PENDING' && c.requestId && <button className="btn small danger" disabled={cancel.pending} onClick={() => cancel.run(() => api.post(`/requests/${c.requestId}/cancel`, {}), refresh)}>Withdraw</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ErrorText>{cancel.error}</ErrorText>
    </div>
  );
}

function PayDialog({ item, defaultMonth, perMonth, onClose }: { item: HrItem; defaultMonth: string; perMonth: number; onClose: () => void }) {
  const qc = useQueryClient();
  const act = useAction();
  const [amount, setAmount] = useState(item.suggestedAmount !== null ? String(item.suggestedAmount) : '');
  const [month, setMonth] = useState(defaultMonth);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(() => api.post(`/encashments/${item.id}/pay`, { amount: Number(amount), payMonth: month }), () => {
      keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] })); qc.invalidateQueries({ queryKey: ['adjustments'] }); qc.invalidateQueries({ queryKey: ['runs'] }); onClose();
    });
  };
  return (
    <Modal title="Pay out leave" onClose={onClose}>
      <p style={{ marginTop: 0 }}><b>{item.employee.name}</b>: {item.days} day{item.days === 1 ? '' : 's'} of {item.leaveType}</p>
      {item.dayValue !== null
        ? <p className="muted">Basic pay divided by {perMonth} gives {money(item.dayValue)} a day. Change the amount if your policy values a day differently.</p>
        : <p className="muted">This person has no salary on record, so there is no suggestion. Enter the amount.</p>}
      <form onSubmit={submit}>
        <Field label="Amount to pay"><input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
        <Field label="Payroll month" hint="Must be a payroll that is not yet approved. It appears on the payslip as an earning."><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} required /></Field>
        <ErrorText>{act.error}</ErrorText>
        <div className="row"><button className="btn primary" disabled={act.pending}>Add to payroll</button><button type="button" className="btn" onClick={onClose}>Cancel</button></div>
      </form>
    </Modal>
  );
}

/** Leave > Payouts (HR): approved encashments waiting to be put on a payroll. */
export function EncashmentPayouts() {
  const q = useQuery({ queryKey: ['encashments-hr', 'APPROVED'], queryFn: () => api.get<{ defaultPayMonth: string; payDaysPerMonth: number; items: HrItem[] }>('/encashments?status=APPROVED') });
  const [paying, setPaying] = useState<HrItem | null>(null);
  if (q.isLoading) return <Loading />;
  const items = q.data?.items ?? [];
  return (
    <div className="card">
      <h2 style={{ marginBottom: 4 }}>Leave payouts to arrange</h2>
      {!items.length ? <Empty>Nothing is waiting to be paid.</Empty> : (
        <table>
          <thead><tr><th>Employee</th><th>Type</th><th className="num">Days</th><th className="num">Suggested</th><th /></tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>{c.employee.name} <span className="muted">{c.employee.employeeCode}</span></td>
                <td>{c.leaveType}</td><td className="num">{c.days}</td>
                <td className="num">{c.suggestedAmount !== null ? money(c.suggestedAmount) : <span className="muted">no salary</span>}</td>
                <td><button className="btn primary" onClick={() => setPaying(c)} aria-label={`Pay out ${c.days} days for ${c.employee.name}`}>Pay out</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {paying && <PayDialog item={paying} defaultMonth={q.data!.defaultPayMonth} perMonth={q.data!.payDaysPerMonth} onClose={() => setPaying(null)} />}
    </div>
  );
}
