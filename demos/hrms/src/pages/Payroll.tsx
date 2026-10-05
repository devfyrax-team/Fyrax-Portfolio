import { FormEvent, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PayAdjustments } from '../components/PayAdjustments';
import { StatutoryRules } from '../components/StatutoryRules';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, downloadFile } from '../api';
import { isHR, useAuth } from '../auth';
import { Badge, Empty, ErrorText, Field, Loading, Tabs, day, money, useAction } from '../components/ui';

interface Payslip {
  id: string; workingDays: string; paidDays: string; unpaidDays: string; gross: string; totalDeductions: string; net: string;
  breakdown: { negativeNet?: boolean };
}
interface MyPayslip extends Payslip { run: { month: string; status: string } }
interface Run { id: string; month: string; status: 'DRAFT' | 'APPROVED' | 'PAID' }
interface RunDetail extends Run {
  totals: { payslips: number; gross: number; totalDeductions: number; net: number };
  payslips: (Payslip & { employee: { employeeCode: string; firstName: string; lastName: string } })[];
}
interface Component { id: string; name: string; code: string; type: string; calcType: string }
interface Structure {
  id: string; effectiveFrom: string; basic: string;
  items: { id: string; value: string; component: Component }[];
}

const prevMonth = () => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

function Mine() {
  const q = useQuery({ queryKey: ['payslips-me'], queryFn: () => api.get<MyPayslip[]>('/payroll/payslips/me') });
  const dl = useAction();
  if (q.isLoading) return <Loading />;
  if (q.error instanceof ApiError && q.error.status === 409) return <Empty>Your login is not linked to an employee profile.</Empty>;
  if (q.error) return <p className="error">{(q.error as Error).message}</p>;
  return (
    <div className="card table-wrap">
      <ErrorText>{dl.error}</ErrorText>
      {!q.data!.length ? <Empty>No payslips yet. They appear here once payroll for a month is approved.</Empty> : (
        <table>
          <thead><tr><th>Month</th><th className="num">Paid days</th><th className="num">Gross</th><th className="num">Deductions</th><th className="num">Net pay</th><th /></tr></thead>
          <tbody>
            {q.data!.map((p) => (
              <tr key={p.id}>
                <td>{p.run.month}</td>
                <td className="num">{Number(p.paidDays)} / {Number(p.workingDays)}</td>
                <td className="num">{money(p.gross)}</td>
                <td className="num">{money(p.totalDeductions)}</td>
                <td className="num"><b>{money(p.net)}</b></td>
                <td><button className="btn small" disabled={dl.pending} onClick={() => dl.run(() => downloadFile(`/payroll/payslips/${p.id}/pdf`, `payslip-${p.run.month}.pdf`))}>Download PDF</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function RunView({ id, onGone }: { id: string; onGone: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['run', id], queryFn: () => api.get<RunDetail>(`/payroll/runs/${id}`) });
  const act = useAction();
  const refresh = () => qc.invalidateQueries();
  if (q.isLoading) return <Loading />;
  if (q.error) return <p className="error">{(q.error as Error).message}</p>;
  const run = q.data!;
  const admin = user!.role === 'ADMIN';

  const confirmAnd = (msg: string, fn: () => Promise<unknown>, after: () => void = refresh) => window.confirm(msg) && act.run(fn, after);

  return (
    <div className="card">
      <div className="row between">
        <h2>Payroll for {run.month} <Badge value={run.status} /></h2>
        <div className="row">
          {run.status === 'DRAFT' && (
            <>
              <button className="btn" disabled={act.pending} onClick={() => act.run(() => api.post(`/payroll/runs/${id}/recalculate`), refresh)}>Recalculate</button>
              <button className="btn danger" disabled={act.pending} onClick={() => confirmAnd(`Delete the draft run for ${run.month}?`, () => api.del(`/payroll/runs/${id}`), () => { refresh(); onGone(); })}>Delete draft</button>
              {admin && <button className="btn primary" disabled={act.pending} onClick={() => confirmAnd(`Approve payroll for ${run.month}? It will be locked and employees will see their payslips.`, () => api.post(`/payroll/runs/${id}/approve`))}>Approve</button>}
            </>
          )}
          {run.status === 'APPROVED' && admin && (
            <button className="btn primary" disabled={act.pending} onClick={() => confirmAnd(`Mark payroll for ${run.month} as paid?`, () => api.post(`/payroll/runs/${id}/mark-paid`))}>Mark as paid</button>
          )}
        </div>
      </div>
      {run.status === 'DRAFT' && !admin && <p className="muted">Only an administrator can approve this run.</p>}
      <ErrorText>{act.error}</ErrorText>
      <div className="stats" style={{ margin: '12px 0' }}>
        <div className="stat"><b>{run.totals.payslips}</b><span>Payslips</span></div>
        <div className="stat"><b>{money(run.totals.gross)}</b><span>Gross</span></div>
        <div className="stat"><b>{money(run.totals.totalDeductions)}</b><span>Deductions</span></div>
        <div className="stat"><b>{money(run.totals.net)}</b><span>Net pay</span></div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Employee</th><th className="num">Paid days</th><th className="num">Unpaid</th><th className="num">Gross</th><th className="num">Deductions</th><th className="num">Net</th><th /></tr></thead>
          <tbody>
            {run.payslips.map((p) => (
              <tr key={p.id}>
                <td>{p.employee.firstName} {p.employee.lastName} <span className="muted">{p.employee.employeeCode}</span></td>
                <td className="num">{Number(p.paidDays)} / {Number(p.workingDays)}</td>
                <td className="num">{Number(p.unpaidDays)}</td>
                <td className="num">{money(p.gross)}</td>
                <td className="num">{money(p.totalDeductions)}</td>
                <td className="num"><b>{money(p.net)}</b>{p.breakdown.negativeNet && <span className="badge bad" style={{ marginLeft: 6 }}>negative</span>}</td>
                <td><button className="btn small" onClick={() => act.run(() => downloadFile(`/payroll/payslips/${p.id}/pdf`, `payslip-${run.month}-${p.employee.employeeCode}.pdf`))}>PDF</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Runs() {
  const qc = useQueryClient();
  const runs = useQuery({ queryKey: ['runs'], queryFn: () => api.get<Run[]>('/payroll/runs') });
  const [month, setMonth] = useState(prevMonth());
  const [selected, setSelected] = useState<string | null>(null);
  const [skipped, setSkipped] = useState<{ employeeCode: string; reason: string }[]>([]);
  const create = useAction();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.run(async () => {
      const r = await api.post<{ run: Run; skipped: typeof skipped }>('/payroll/runs', { month });
      setSkipped(r.skipped);
      setSelected(r.run.id);
      qc.invalidateQueries();
    });
  };

  return (
    <>
      <form className="card" onSubmit={submit}>
        <div className="row">
          <Field label="Month to run" hint="Only months that have ended can be run">
            <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} required />
          </Field>
          <button className="btn primary" disabled={create.pending}>{create.pending ? 'Calculating…' : 'Generate payroll'}</button>
        </div>
        <ErrorText>{create.error}</ErrorText>
        {skipped.length > 0 && (
          <p className="error">
            Not paid, no salary structure: {skipped.map((s) => s.employeeCode).join(', ')}. Add one under the Salary tab and recalculate the draft.
          </p>
        )}
      </form>

      <div className="card table-wrap">
        {runs.isLoading ? <Loading /> : !runs.data?.length ? <Empty>No payroll runs yet.</Empty> : (
          <table>
            <thead><tr><th>Month</th><th>Status</th><th /></tr></thead>
            <tbody>
              {runs.data.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => { setSelected(r.id); setSkipped([]); }}>
                  <td>{r.month}</td><td><Badge value={r.status} /></td>
                  <td className="muted">{selected === r.id ? 'Open' : 'View'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {selected && <RunView key={selected} id={selected} onGone={() => setSelected(null)} />}
    </>
  );
}

function Salary() {
  const qc = useQueryClient();
  const employees = useQuery({
    queryKey: ['employees-all'],
    queryFn: () => api.get<{ items: { id: string; employeeCode: string; firstName: string; lastName: string }[] }>('/employees?pageSize=100&status=ACTIVE'),
  });
  const components = useQuery({ queryKey: ['settings', 'components'], queryFn: () => api.get<Component[]>('/payroll/components') });
  const [employeeId, setEmployeeId] = useState('');
  const current = employeeId || employees.data?.items[0]?.id || '';
  const structures = useQuery({
    queryKey: ['structures', current],
    enabled: !!current,
    queryFn: () => api.get<Structure[]>(`/payroll/structures?employeeId=${current}`),
  });
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));
  const [basic, setBasic] = useState('');
  const [values, setValues] = useState<Record<string, string>>({});
  const create = useAction();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const items = Object.entries(values).filter(([, v]) => v !== '').map(([componentId, v]) => ({ componentId, value: Number(v) }));
    create.run(() => api.post('/payroll/structures', { employeeId: current, effectiveFrom, basic: Number(basic), items }), () => {
      setBasic('');
      setValues({});
      qc.invalidateQueries({ queryKey: ['structures', current] });
    });
  };

  if (employees.isLoading) return <Loading />;
  if (!employees.data?.items.length) return <Empty>Add employees first, then set their salaries here.</Empty>;

  return (
    <>
      <div className="card">
        <Field label="Employee">
          <select value={current} onChange={(e) => setEmployeeId(e.target.value)}>
            {employees.data.items.map((e) => <option key={e.id} value={e.id}>{e.employeeCode} · {e.firstName} {e.lastName}</option>)}
          </select>
        </Field>
      </div>

      <form className="card" onSubmit={submit}>
        <h2 style={{ marginBottom: 4 }}>New salary structure</h2>
        <p className="muted" style={{ marginTop: 0 }}>History is kept: a new structure applies from its effective date and never overwrites the old one.</p>
        <div className="form-grid">
          <Field label="Effective from"><input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required /></Field>
          <Field label="Monthly basic pay"><input type="number" min={0} step="0.01" value={basic} onChange={(e) => setBasic(e.target.value)} required /></Field>
        </div>
        {components.data && components.data.length > 0 && (
          <>
            <h3>Components (leave blank to skip)</h3>
            <div className="form-grid">
              {components.data.map((c) => (
                <Field key={c.id} label={`${c.name} (${c.type === 'EARNING' ? '+' : '−'})`} hint={c.calcType === 'FIXED' ? 'Amount per month' : 'Percent of basic pay'}>
                  <input type="number" min={0} step="0.01" value={values[c.id] ?? ''} onChange={(e) => setValues({ ...values, [c.id]: e.target.value })} />
                </Field>
              ))}
            </div>
          </>
        )}
        <ErrorText>{create.error}</ErrorText>
        <button className="btn primary" disabled={create.pending}>{create.pending ? 'Saving…' : 'Save structure'}</button>
      </form>

      <div className="card table-wrap">
        <h2 style={{ marginBottom: 12 }}>History</h2>
        {structures.isLoading ? <Loading /> : !structures.data?.length ? <Empty>No salary structure yet for this employee.</Empty> : (
          <table>
            <thead><tr><th>Effective from</th><th className="num">Basic</th><th>Components</th></tr></thead>
            <tbody>
              {structures.data.map((s) => (
                <tr key={s.id}>
                  <td>{day(s.effectiveFrom)}</td>
                  <td className="num">{money(s.basic)}</td>
                  <td className="muted">{s.items.map((i) => `${i.component.code} ${Number(i.value)}${i.component.calcType === 'PERCENT_OF_BASIC' ? '%' : ''}`).join(' · ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export function Payroll() {
  const { user } = useAuth();
  const hr = isHR(user!.role);
  const [params] = useSearchParams();
  const [tab, setTab] = useState<'mine' | 'runs' | 'salary' | 'adjustments' | 'statutory'>(params.get('tab') === 'adjustments' ? 'adjustments' : 'mine');
  return (
    <>
      <h1>Payroll</h1>
      {hr && (
        <Tabs
          tabs={[{ id: 'mine', label: 'My payslips' }, { id: 'runs', label: 'Payroll runs' }, { id: 'salary', label: 'Salary' }, { id: 'adjustments', label: 'Adjustments' }, { id: 'statutory', label: 'Statutory' }]}
          value={tab}
          onChange={setTab}
        />
      )}
      {!hr || tab === 'mine' ? <Mine /> : tab === 'runs' ? <Runs /> : tab === 'adjustments' ? <PayAdjustments /> : tab === 'statutory' ? <StatutoryRules /> : <Salary />}
    </>
  );
}
