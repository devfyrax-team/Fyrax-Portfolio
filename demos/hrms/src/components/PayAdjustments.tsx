import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { Empty, ErrorText, Field, Loading, money, useAction } from './ui';

interface Employee { id: string; employeeCode: string; firstName: string; lastName: string; status: string }
interface Adjustment {
  id: string; payMonth: string; forMonth: string | null; type: 'EARNING' | 'DEDUCTION'; amount: number; description: string; locked: boolean;
  employee: { employeeCode: string; firstName: string; lastName: string };
}
interface Listing { defaultPayMonth: string; lockedMonths: string[]; items: Adjustment[] }
interface Suggestion {
  forMonth: string;
  paid: { net: number } | null;
  shouldHaveBeen: { net: number };
  alreadyAdjusted: number;
  difference: number;
  suggestion: { type: 'EARNING' | 'DEDUCTION'; amount: number; description: string } | null;
  note: string | null;
}

const signed = (a: { type: string; amount: number }) => `${a.type === 'EARNING' ? '+' : '−'}${money(a.amount)}`;

// Page pattern: Form + List. HR adds one-off amounts to a payroll that can still change (arrears, final pay, corrections).
export function PayAdjustments() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['adjustments'], queryFn: () => api.get<Listing>('/payroll/adjustments') });
  const people = useQuery({ queryKey: ['employees', 'for-pay'], queryFn: () => api.get<{ items: Employee[] }>('/employees?pageSize=100') });
  const add = useAction();
  const calc = useAction();
  const del = useAction();
  const [f, setF] = useState({ employeeId: '', type: 'EARNING', amount: '', description: '', payMonth: '', forMonth: '' });
  const [forMonth, setForMonth] = useState('');
  const [found, setFound] = useState<Suggestion | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  const employeeId = f.employeeId || people.data?.items[0]?.id || '';
  const months = list.data?.lockedMonths ?? [];
  const refresh = () => { qc.invalidateQueries({ queryKey: ['adjustments'] }); qc.invalidateQueries({ queryKey: ['runs'] }); qc.invalidateQueries({ queryKey: ['run'] }); };

  const calculate = () => {
    setFound(null);
    calc.run(async () => setFound(await api.post<Suggestion>('/payroll/adjustments/suggest', { employeeId, forMonth: forMonth || months[0] })));
  };
  const useSuggestion = (s: Suggestion) => {
    if (!s.suggestion) return;
    setF({ ...f, employeeId, type: s.suggestion.type, amount: String(s.suggestion.amount), description: s.suggestion.description, forMonth: s.forMonth });
  };
  const checkAmount = (v: string) => {
    const n = Number(v);
    const bad = !v || !(n > 0) ? 'Enter an amount above zero' : null;
    setAmountError(bad);
    return !bad;
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!checkAmount(f.amount)) return;
    add.run(
      () => api.post('/payroll/adjustments', {
        employeeId, type: f.type, amount: Number(f.amount), description: f.description,
        ...(f.payMonth ? { payMonth: f.payMonth } : {}), ...(f.forMonth ? { forMonth: f.forMonth } : {}),
      }),
      () => { setF({ ...f, amount: '', description: '', forMonth: '' }); setFound(null); refresh(); },
    );
  };
  const remove = (a: Adjustment) => {
    if (!window.confirm(`Delete the adjustment "${a.description}" for ${a.employee.firstName} ${a.employee.lastName}?`)) return;
    del.run(() => api.del(`/payroll/adjustments/${a.id}`), refresh);
  };

  return (
    <>
      <form className="card" onSubmit={submit}>
        <h2 style={{ marginBottom: 4 }}>Add an adjustment</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          A one-off amount paid with a payroll that can still change: arrears for a month that is already approved, the final pay of someone who left after it, or a correction.
          {list.data && <> It will be paid with the <b>{f.payMonth || list.data.defaultPayMonth}</b> payroll.</>}
        </p>

        <Field label="Employee">
          <select value={employeeId} onChange={(e) => { setF({ ...f, employeeId: e.target.value }); setFound(null); }}>
            {people.data?.items.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.employeeCode}){p.status === 'TERMINATED' ? ' — left' : ''}</option>)}
          </select>
        </Field>

        {months.length > 0 && (
          <div className="card" style={{ background: 'var(--bg)', boxShadow: 'none' }}>
            <h3>Work out what is owed for a closed month</h3>
            <div className="row" style={{ alignItems: 'flex-end' }}>
              <Field label="Month"><select value={forMonth || months[0]} onChange={(e) => { setForMonth(e.target.value); setFound(null); }}>{months.map((m) => <option key={m}>{m}</option>)}</select></Field>
              <div style={{ marginBottom: 12 }}><button type="button" className="btn" disabled={calc.pending || !employeeId} onClick={calculate}>{calc.pending ? 'Calculating…' : 'Calculate'}</button></div>
            </div>
            <ErrorText>{calc.error}</ErrorText>
            {found && (
              <>
                <dl className="facts">
                  <div><dt>Paid then</dt><dd>{found.paid ? money(found.paid.net) : 'Not in that payroll'}</dd></div>
                  <div><dt>Should have been</dt><dd>{money(found.shouldHaveBeen.net)}</dd></div>
                  {found.alreadyAdjusted !== 0 && <div><dt>Already adjusted</dt><dd>{money(found.alreadyAdjusted)}</dd></div>}
                  <div><dt>Still owed</dt><dd><b>{money(found.difference)}</b></dd></div>
                </dl>
                {found.note && <p className="muted">{found.note}</p>}
                {found.suggestion
                  ? <button type="button" className="btn" onClick={() => useSuggestion(found)}>Use {found.suggestion.type === 'EARNING' ? 'this amount' : 'this deduction'} below</button>
                  : <p className="notice" role="status">Nothing more is owed for {found.forMonth}.</p>}
              </>
            )}
          </div>
        )}

        <div className="form-grid">
          <Field label="Type">
            <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
              <option value="EARNING">Add to pay</option>
              <option value="DEDUCTION">Take from pay</option>
            </select>
          </Field>
          <Field label="Amount">
            <input type="number" inputMode="decimal" min="0.01" step="0.01" value={f.amount} aria-invalid={!!amountError}
              onChange={(e) => { setF({ ...f, amount: e.target.value }); if (amountError) checkAmount(e.target.value); }} onBlur={(e) => checkAmount(e.target.value)} required />
            {amountError && <span className="field-error" role="alert">{amountError}</span>}
          </Field>
          <Field label="Description" hint="Shown on the payslip"><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} minLength={3} maxLength={150} required /></Field>
          <Field label="Paid with payroll month" hint="Leave as it is for the next open payroll"><input type="month" value={f.payMonth || list.data?.defaultPayMonth || ''} onChange={(e) => setF({ ...f, payMonth: e.target.value })} /></Field>
        </div>
        <ErrorText>{add.error}</ErrorText>
        <button className="btn primary" disabled={add.pending || !employeeId}>{add.pending ? 'Adding…' : 'Add adjustment'}</button>
      </form>

      <div className="card table-wrap">
        <h2 style={{ marginBottom: 12 }}>Adjustments</h2>
        <ErrorText>{del.error}</ErrorText>
        {list.isLoading ? <Loading /> : !list.data?.items.length ? <Empty>No adjustments yet. Add one above when pay needs correcting.</Empty> : (
          <table>
            <thead><tr><th>Paid with</th><th>Employee</th><th>Description</th><th className="num">Amount</th><th>Corrects</th><th>Status</th><th className="actions" /></tr></thead>
            <tbody>
              {list.data.items.map((a) => (
                <tr key={a.id}>
                  <td>{a.payMonth}</td>
                  <td>{a.employee.firstName} {a.employee.lastName} <span className="muted">{a.employee.employeeCode}</span></td>
                  <td>{a.description}</td>
                  <td className="num">{signed(a)}</td>
                  <td>{a.forMonth ?? <span className="muted">—</span>}</td>
                  <td>{a.locked ? <span className="badge ok">paid</span> : <span className="badge warn">waiting</span>}</td>
                  <td className="actions">{!a.locked && <button className="btn small danger" disabled={del.pending} onClick={() => remove(a)}>Delete</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
