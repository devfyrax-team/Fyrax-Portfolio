import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { Empty, ErrorText, Field, Loading, money, useAction } from './ui';

interface Slab { from: number; to: number | null; rate: number }
interface Rule {
  id: string; code: string; name: string; kind: 'DEDUCTION' | 'EMPLOYER'; method: 'PERCENT' | 'SLABS'; base: 'BASIC' | 'GROSS';
  rate: number | null; minBase: number | null; maxBase: number | null; slabs: Slab[] | null;
  effectiveFrom: string; effectiveTo: string | null; active: boolean; inForce: boolean;
}
interface Preview {
  month: string; deductions: { code: string; name: string; base: number; amount: number }[]; employer: { code: string; name: string; base: number; amount: number }[];
  totalDeductions: number; employerCost: number; netAfterStatutory: number;
}

const blank = { code: '', name: '', kind: 'DEDUCTION', method: 'PERCENT', base: 'GROSS', rate: '', minBase: '', maxBase: '', effectiveFrom: new Date().toISOString().slice(0, 10), effectiveTo: '', active: true };
type Form = typeof blank;
const TEMPLATES: { label: string; hint: string; form: Partial<Form>; bands?: { to: string; rate: string }[] }[] = [
  { label: 'Percentage of pay', hint: 'A flat share of pay, such as a contribution', form: { method: 'PERCENT', rate: '5' } },
  { label: 'Percentage with a limit', hint: 'Only pay between a floor and a cap counts', form: { method: 'PERCENT', rate: '5', minBase: '1000', maxBase: '5000' } },
  { label: 'Income tax with bands', hint: 'Higher rates on higher slices of income', form: { method: 'SLABS', base: 'BASIC' }, bands: [{ to: '12000', rate: '0' }, { to: '36000', rate: '10' }, { to: '', rate: '20' }] },
];

const describe = (r: Rule) =>
  r.method === 'PERCENT'
    ? `${r.rate}% of ${r.base === 'BASIC' ? 'basic' : 'gross'} pay${r.minBase !== null ? `, from ${money(r.minBase)}` : ''}${r.maxBase !== null ? `, up to ${money(r.maxBase)}` : ''}`
    : `Bands on yearly ${r.base === 'BASIC' ? 'basic' : 'gross'} pay: ${(r.slabs ?? []).map((s) => `${s.rate}% ${s.to === null ? `above ${money(s.from)}` : `to ${money(s.to)}`}`).join(', ')}`;

// Page pattern: Form + List. The company enters its own statutory figures; nothing country-specific is built in.
export function StatutoryRules() {
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ['statutory'], queryFn: () => api.get<Rule[]>('/payroll/statutory') });
  const save = useAction();
  const del = useAction();
  const calc = useAction();
  const [f, setF] = useState<Form>(blank);
  const [bands, setBands] = useState<{ to: string; rate: string }[]>([{ to: '', rate: '' }]);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [sample, setSample] = useState({ basic: '3000', gross: '3500' });
  const [preview, setPreview] = useState<Preview | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['statutory'] }); qc.invalidateQueries({ queryKey: ['runs'] }); qc.invalidateQueries({ queryKey: ['run'] }); setPreview(null); };

  const reset = () => { setF(blank); setBands([{ to: '', rate: '' }]); setEditing(null); };
  const applyTemplate = (t: (typeof TEMPLATES)[number]) => { setEditing(null); setF({ ...blank, ...t.form }); setBands(t.bands ?? [{ to: '', rate: '' }]); setNotice(null); };
  const startEdit = (r: Rule) => {
    setEditing(r);
    setF({ code: r.code, name: r.name, kind: r.kind, method: r.method, base: r.base, rate: r.rate === null ? '' : String(r.rate), minBase: r.minBase === null ? '' : String(r.minBase), maxBase: r.maxBase === null ? '' : String(r.maxBase), effectiveFrom: r.effectiveFrom, effectiveTo: r.effectiveTo ?? '', active: r.active });
    setBands(r.slabs ? r.slabs.map((s) => ({ to: s.to === null ? '' : String(s.to), rate: String(s.rate) })) : [{ to: '', rate: '' }]);
    setNotice(null);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = { code: f.code, name: f.name, kind: f.kind, method: f.method, base: f.base, effectiveFrom: f.effectiveFrom, active: f.active };
    if (f.effectiveTo) body.effectiveTo = f.effectiveTo;
    if (f.method === 'PERCENT') {
      body.rate = Number(f.rate);
      if (f.minBase !== '') body.minBase = Number(f.minBase);
      if (f.maxBase !== '') body.maxBase = Number(f.maxBase);
    } else {
      let from = 0;
      body.slabs = bands.map((b, i) => {
        const slab = { from, to: i === bands.length - 1 ? null : Number(b.to), rate: Number(b.rate) };
        from = Number(b.to);
        return slab;
      });
    }
    setNotice(null);
    save.run(
      () => (editing ? api.patch(`/payroll/statutory/${editing.id}`, body) : api.post('/payroll/statutory', body)),
      () => { setNotice(editing ? 'Rule updated. Any open payroll was recalculated.' : 'Rule added. Any open payroll was recalculated.'); reset(); refresh(); },
    );
  };

  const remove = (r: Rule) => {
    if (!window.confirm(`Delete the rule "${r.name}" (${r.code}) starting ${r.effectiveFrom}? Approved payrolls keep what they already deducted.`)) return;
    del.run(() => api.del(`/payroll/statutory/${r.id}`), () => { if (editing?.id === r.id) reset(); refresh(); });
  };

  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        Contributions and taxes your company must work out on pay. <b>You enter the rates and limits</b> (check them with a local adviser): the system holds no country's figures,
        because they differ and change. Rules apply to every payroll month they overlap, and an open payroll is recalculated when you change one. Approved payrolls never change.
      </p>

      <form className="card" onSubmit={submit}>
        <h2 style={{ marginBottom: 4 }}>{editing ? `Edit ${editing.code}` : 'Add a rule'}</h2>
        {!editing && (
          <div className="row" style={{ marginBottom: 12 }}>
            <span className="muted">Start from:</span>
            {TEMPLATES.map((t) => <button type="button" key={t.label} className="btn small" title={t.hint} onClick={() => applyTemplate(t)}>{t.label}</button>)}
          </div>
        )}
        <div className="form-grid">
          <Field label="Code" hint="Capital letters and digits, shown on the payslip"><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} pattern="[A-Z0-9_]{2,20}" maxLength={20} required disabled={!!editing} /></Field>
          <Field label="Name" hint="As employees will read it"><input value={f.name} onChange={set('name')} minLength={2} maxLength={80} required /></Field>
          <Field label="Who pays">
            <select value={f.kind} onChange={set('kind')}><option value="DEDUCTION">Deducted from the employee</option><option value="EMPLOYER">Paid by the employer on top</option></select>
          </Field>
          <Field label="How it is worked out" hint={editing ? 'To change the method, add a new rule' : undefined}>
            <select value={f.method} onChange={set('method')} disabled={!!editing}><option value="PERCENT">A percentage</option><option value="SLABS">Income bands (progressive)</option></select>
          </Field>
          <Field label="Worked out on"><select value={f.base} onChange={set('base')}><option value="GROSS">Gross pay</option><option value="BASIC">Basic pay</option></select></Field>
          {f.method === 'PERCENT' && (
            <>
              <Field label="Percentage"><input type="number" min="0" max="100" step="0.0001" value={f.rate} onChange={set('rate')} required /></Field>
              <Field label="Only above (optional)" hint="Nothing is due below this monthly amount"><input type="number" min="0" step="0.01" value={f.minBase} onChange={set('minBase')} /></Field>
              <Field label="Only up to (optional)" hint="Pay above this monthly amount is ignored"><input type="number" min="0.01" step="0.01" value={f.maxBase} onChange={set('maxBase')} /></Field>
            </>
          )}
          <Field label="Starts"><input type="date" value={f.effectiveFrom} onChange={set('effectiveFrom')} required /></Field>
          <Field label="Ends (optional)"><input type="date" value={f.effectiveTo} min={f.effectiveFrom} onChange={set('effectiveTo')} /></Field>
        </div>

        {f.method === 'SLABS' && (
          <>
            <h3>Income bands (yearly amounts)</h3>
            {bands.map((b, i) => {
              const from = i === 0 ? 0 : Number(bands[i - 1].to) || 0;
              const last = i === bands.length - 1;
              return (
                <div className="row" key={i} style={{ alignItems: 'flex-end' }}>
                  <div style={{ width: 130 }}><Field label="From"><input value={from} disabled aria-label={`Band ${i + 1} from`} /></Field></div>
                  <div style={{ width: 150 }}><Field label="Up to">{last ? <input value="no limit" disabled aria-label={`Band ${i + 1} up to`} /> : <input type="number" min={from + 0.01} step="0.01" value={b.to} onChange={(e) => setBands(bands.map((x, j) => (j === i ? { ...x, to: e.target.value } : x)))} required aria-label={`Band ${i + 1} up to`} />}</Field></div>
                  <div style={{ width: 120 }}><Field label="Rate %"><input type="number" min="0" max="100" step="0.01" value={b.rate} onChange={(e) => setBands(bands.map((x, j) => (j === i ? { ...x, rate: e.target.value } : x)))} required aria-label={`Band ${i + 1} rate`} /></Field></div>
                  <div style={{ marginBottom: 12 }}>{bands.length > 1 && last && <button type="button" className="btn small danger" onClick={() => setBands(bands.slice(0, -1).map((x, j, a) => (j === a.length - 1 ? { ...x, to: '' } : x)))}>Remove</button>}</div>
                </div>
              );
            })}
            {bands.length < 12 && <button type="button" className="btn small" onClick={() => setBands([...bands.map((x, j) => (j === bands.length - 1 ? { ...x, to: x.to || String((Number(bands[j - 1]?.to) || 0) + 10000) } : x)), { to: '', rate: '' }])}>Add a band</button>}
          </>
        )}

        <label className="check" style={{ marginTop: 12 }}><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> In use (untick to switch it off without deleting it)</label>
        <ErrorText>{save.error}</ErrorText>
        {notice && <p className="notice" role="status">{notice}</p>}
        <div className="row">
          <button className="btn primary" disabled={save.pending}>{save.pending ? 'Saving…' : editing ? 'Save changes' : 'Add rule'}</button>
          {editing && <button type="button" className="btn" onClick={reset}>Cancel</button>}
        </div>
      </form>

      <div className="card table-wrap">
        <h2 style={{ marginBottom: 12 }}>Rules</h2>
        <ErrorText>{del.error}</ErrorText>
        {list.isLoading ? <Loading /> : !list.data?.length ? <Empty>No statutory rules yet. Payroll deducts only what the salary components say. Add a rule above when something is required by law.</Empty> : (
          <table>
            <thead><tr><th>Rule</th><th>Who pays</th><th>How</th><th>Dates</th><th>Status</th><th className="actions" /></tr></thead>
            <tbody>
              {list.data.map((r) => (
                <tr key={r.id}>
                  <td>{r.name} <span className="muted">{r.code}</span></td>
                  <td>{r.kind === 'DEDUCTION' ? 'Employee' : 'Employer'}</td>
                  <td className="wrap">{describe(r)}</td>
                  <td>{r.effectiveFrom} → {r.effectiveTo ?? 'open'}</td>
                  <td>{!r.active ? <span className="badge">off</span> : r.inForce ? <span className="badge ok">in force</span> : <span className="badge warn">not now</span>}</td>
                  <td className="actions"><div className="row"><button className="btn small" onClick={() => startEdit(r)}>Edit</button><button className="btn small danger" disabled={del.pending} onClick={() => remove(r)}>Delete</button></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 4 }}>Check the rules on a sample payslip</h2>
        <p className="muted" style={{ marginTop: 0 }}>Enter a month's pay and see what the rules in force today would take.</p>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <Field label="Basic pay"><input type="number" min="0" step="0.01" value={sample.basic} onChange={(e) => setSample({ ...sample, basic: e.target.value })} /></Field>
          <Field label="Gross pay"><input type="number" min="0" step="0.01" value={sample.gross} onChange={(e) => setSample({ ...sample, gross: e.target.value })} /></Field>
          <div style={{ marginBottom: 12 }}><button className="btn" disabled={calc.pending} onClick={() => calc.run(async () => setPreview(await api.post<Preview>('/payroll/statutory/preview', { basic: Number(sample.basic), gross: Number(sample.gross) })))}>Calculate</button></div>
        </div>
        <ErrorText>{calc.error}</ErrorText>
        {preview && (
          <table>
            <tbody>
              {preview.deductions.map((d) => <tr key={d.code}><td>{d.name} <span className="muted">on {money(d.base)}</span></td><td className="num">− {money(d.amount)}</td></tr>)}
              {!preview.deductions.length && <tr><td className="muted" colSpan={2}>Nothing is deducted by the rules in force.</td></tr>}
              <tr><td><b>Gross after statutory deductions</b></td><td className="num"><b>{money(preview.netAfterStatutory)}</b></td></tr>
              {preview.employer.map((d) => <tr key={d.code}><td className="muted">{d.name} (employer, on top)</td><td className="num muted">{money(d.amount)}</td></tr>)}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
