import { FormEvent, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, downloadFile, uploadFile } from '../api';
import { isHR, useAuth } from '../auth';
import { Badge, Empty, ErrorText, Field, Loading, Modal, Tabs, dateNow, formatMoney, useAction } from '../components/ui';

// Page pattern: Form + List. Employees claim money they spent for work; the approval happens in Requests (like every other
// approval), and HR pays approved claims back here, either with a payroll or outside it.

const CATEGORIES = [
  { value: 'TRAVEL', label: 'Travel' }, { value: 'MEALS', label: 'Meals' }, { value: 'ACCOMMODATION', label: 'Accommodation' },
  { value: 'SUPPLIES', label: 'Supplies' }, { value: 'TRAINING', label: 'Training' }, { value: 'OTHER', label: 'Other' },
];
const categoryLabel = (c: string) => CATEGORIES.find((x) => x.value === c)?.label ?? c;
const STATUS_LABEL: Record<string, string> = { PENDING: 'Waiting for approval', APPROVED: 'Approved, to be paid', REJECTED: 'Rejected', CANCELLED: 'Withdrawn', PAID: 'Paid' };

export interface Policy { receiptRequiredOver: number | null; limits: Partial<Record<string, number>> }
export const usePolicy = () => useQuery({ queryKey: ['expense-policy'], queryFn: () => api.get<Policy>('/expenses/policy') });

export interface Receipt { id: string; fileName: string; sizeBytes: number }
const MAX_RECEIPTS = 5;
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

interface Claim {
  id: string; expenseOn: string; category: string; amount: number; currency: string; description: string; status: string; decisionNote: string | null;
  paidAt: string | null; paidVia: string | null; payMonth: string | null; reference: string | null; requestId: string | null;
  receipts: Receipt[];
}
interface HrClaim extends Claim { employee: { id: string; employeeCode: string; name: string } }

const paidNote = (c: Claim) =>
  c.status !== 'PAID' ? null : c.paidVia === 'PAYROLL' ? `Paid with the ${c.payMonth} payroll` : `Paid directly${c.reference ? `, reference ${c.reference}` : ''}`;


/** The receipts of one claim: everyone who may see the claim can download; the claimant can add and remove while it waits. */
export function ReceiptList({ claimId, receipts, canEdit, onChange }: { claimId: string; receipts: Receipt[]; canEdit?: boolean; onChange?: () => void }) {
  const act = useAction();
  const ref = useRef<HTMLInputElement>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const add = (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    if (!TYPES.includes(file.type)) return setFileError('Use a PDF, PNG or JPEG file');
    if (file.size > MAX_BYTES) return setFileError('The file is larger than 5 MB');
    act.run(() => uploadFile(`/expenses/${claimId}/receipts?filename=${encodeURIComponent(file.name)}`, file), () => { if (ref.current) ref.current.value = ''; onChange?.(); });
  };
  return (
    <div>
      {receipts.length === 0 && <span className="muted">No receipt</span>}
      {receipts.map((r) => (
        <div key={r.id} className="row" style={{ gap: 6 }}>
          <button type="button" className="btn small" onClick={() => act.run(() => downloadFile(`/expenses/${claimId}/receipts/${r.id}/file`, r.fileName))} aria-label={`Download receipt ${r.fileName}`}>{r.fileName}</button>
          {canEdit && <button type="button" className="btn small danger" disabled={act.pending} aria-label={`Remove receipt ${r.fileName}`} onClick={() => act.run(() => api.del(`/expenses/${claimId}/receipts/${r.id}`), onChange)}>Remove</button>}
        </div>
      ))}
      {canEdit && receipts.length < MAX_RECEIPTS && (
        <label className="btn small" style={{ cursor: 'pointer', display: 'inline-block', marginTop: 4 }}>
          Add receipt
          <input ref={ref} type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" hidden onChange={(e) => add(e.target.files?.[0])} />
        </label>
      )}
      <ErrorText>{fileError ?? act.error}</ErrorText>
    </div>
  );
}

function NewClaim({ onDone }: { onDone: () => void }) {
  const act = useAction();
  const [f, setF] = useState({ expenseOn: dateNow(), category: 'TRAVEL', amount: '', description: '' });
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const policy = usePolicy().data;
  const limit = policy?.limits[f.category];
  const amount = Number(f.amount);
  const limitError = limit !== undefined && amount > limit ? `The limit for ${categoryLabel(f.category).toLowerCase()} claims is ${limit.toFixed(2)} per claim` : null;
  const needsReceipt = policy?.receiptRequiredOver != null && amount > policy.receiptRequiredOver;
  const receiptError = needsReceipt && files.length === 0 ? `Claims above ${policy!.receiptRequiredOver!.toFixed(2)} need a receipt` : null;
  const pick = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    setFiles([]);
    if (picked.length > MAX_RECEIPTS) return setFileError(`At most ${MAX_RECEIPTS} receipts`);
    const bad = picked.find((x) => !TYPES.includes(x.type) || x.size > MAX_BYTES);
    if (bad) return setFileError(`${bad.name}: use a PDF, PNG or JPEG of at most 5 MB`);
    setFileError(null);
    setFiles(picked);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (fileError || limitError || receiptError) return;
    act.run(
      async () => {
        const req = await api.post<{ id: string }>('/requests', { type: 'EXPENSE', payload: { expenseOn: f.expenseOn, category: f.category, amount: Number(f.amount), description: f.description } });
        if (!files.length) return;
        // The claim exists as soon as it is submitted; the receipts are attached to it straight after.
        const mine = await api.get<{ items: Claim[] }>('/expenses/mine');
        const claim = mine.items.find((c) => c.requestId === req.id);
        if (!claim) return;
        for (const file of files) await uploadFile(`/expenses/${claim.id}/receipts?filename=${encodeURIComponent(file.name)}`, file);
      },
      () => { setF({ ...f, amount: '', description: '' }); setFiles([]); if (ref.current) ref.current.value = ''; onDone(); },
    );
  };
  return (
    <form className="card" onSubmit={submit}>
      <h2 style={{ marginBottom: 12 }}>New claim</h2>
      <div className="form-grid">
        <Field label="Date of expense"><input type="date" value={f.expenseOn} max={dateNow()} onChange={(e) => setF({ ...f, expenseOn: e.target.value })} required /></Field>
        <Field label="Category"><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select></Field>
        <Field label="Amount" hint={limit !== undefined ? `What you paid. At most ${limit.toFixed(2)} for ${categoryLabel(f.category).toLowerCase()}` : 'What you paid, in the company currency'}><input type="number" min="0.01" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} required /></Field>
        <Field label="What was it for?"><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} minLength={3} maxLength={300} required /></Field>
        <Field label="Receipts (optional)" hint={policy?.receiptRequiredOver != null ? `Required above ${policy.receiptRequiredOver.toFixed(2)}. PDF, PNG or JPEG, up to 5 files of 5 MB each` : 'PDF, PNG or JPEG, up to 5 files of 5 MB each'}><input ref={ref} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={(e) => pick(e.target.files)} /></Field>
      </div>
      <ErrorText>{fileError ?? limitError ?? receiptError ?? act.error}</ErrorText>
      <button className="btn primary" disabled={act.pending}>Submit claim</button>
    </form>
  );
}

function MyClaims() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['expenses-mine'], queryFn: () => api.get<{ items: Claim[]; owed: number; currency: string | null }>('/expenses/mine') });
  const cancel = useAction();
  const refresh = () => { qc.invalidateQueries({ queryKey: ['expenses-mine'] }); qc.invalidateQueries({ queryKey: ['expenses-hr'] }); qc.invalidateQueries({ queryKey: ['requests'] }); qc.invalidateQueries({ queryKey: ['inbox-count'] }); };
  const owed = q.data?.owed ?? 0;
  return (
    <>
      <NewClaim onDone={refresh} />
      <div className="card">
        <h2 style={{ marginBottom: 4 }}>My claims</h2>
        {owed > 0 && <p style={{ marginTop: 0 }}>Approved and waiting to be paid to you: <b>{formatMoney(owed, q.data!.currency ?? 'USD')}</b></p>}
        <ErrorText>{cancel.error}</ErrorText>
        {q.isLoading ? <Loading /> : !q.data?.items.length ? <Empty>No claims yet.</Empty> : (
          <table>
            <thead><tr><th>Date</th><th>Category</th><th>For</th><th style={{ textAlign: 'right' }}>Amount</th><th>Receipts</th><th>Status</th><th /></tr></thead>
            <tbody>
              {q.data.items.map((c) => (
                <tr key={c.id}>
                  <td>{c.expenseOn}</td><td>{categoryLabel(c.category)}</td><td>{c.description}</td>
                  <td style={{ textAlign: 'right' }}>{formatMoney(c.amount, c.currency)}</td>
                  <td><ReceiptList claimId={c.id} receipts={c.receipts} canEdit={c.status === 'PENDING'} onChange={refresh} /></td>
                  <td>
                    <Badge value={c.status} /> <span className="muted">{STATUS_LABEL[c.status]}</span>
                    {paidNote(c) && <div className="muted">{paidNote(c)}</div>}
                    {c.decisionNote && <div className="muted">Note: {c.decisionNote}</div>}
                  </td>
                  <td>
                    {c.status === 'PENDING' && c.requestId && (
                      <button className="btn" disabled={cancel.pending} aria-label={`Withdraw claim: ${c.description}`}
                        onClick={() => cancel.run(() => api.post(`/requests/${c.requestId}/cancel`, {}), refresh)}>Withdraw</button>
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

function PayDialog({ claim, defaultMonth, onClose }: { claim: HrClaim; defaultMonth: string; onClose: () => void }) {
  const qc = useQueryClient();
  const act = useAction();
  const [via, setVia] = useState<'PAYROLL' | 'DIRECT'>('PAYROLL');
  const [month, setMonth] = useState(defaultMonth);
  const [reference, setReference] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(() => api.post(`/expenses/${claim.id}/pay`, via === 'PAYROLL' ? { via, payMonth: month } : { via, reference: reference || undefined }), () => {
      qc.invalidateQueries({ queryKey: ['expenses-hr'] }); qc.invalidateQueries({ queryKey: ['adjustments'] }); qc.invalidateQueries({ queryKey: ['runs'] }); onClose();
    });
  };
  return (
    <Modal title="Pay back a claim" onClose={onClose}>
      <p style={{ marginTop: 0 }}><b>{claim.employee.name}</b>: {categoryLabel(claim.category)}, {formatMoney(claim.amount, claim.currency)}<br /><span className="muted">{claim.description}</span></p>
      <form onSubmit={submit}>
        <Field label="How is it paid?">
          <select value={via} onChange={(e) => setVia(e.target.value as 'PAYROLL' | 'DIRECT')}>
            <option value="PAYROLL">Add to a payroll (appears on the payslip)</option>
            <option value="DIRECT">Already paid directly (bank transfer, cash)</option>
          </select>
        </Field>
        {via === 'PAYROLL'
          ? <Field label="Payroll month" hint="Must be a payroll that is not yet approved"><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} required /></Field>
          : <Field label="Reference (optional)"><input value={reference} onChange={(e) => setReference(e.target.value)} maxLength={100} /></Field>}
        <ErrorText>{act.error}</ErrorText>
        <div className="row"><button className="btn primary" disabled={act.pending}>Mark as paid</button><button type="button" className="btn" onClick={onClose}>Cancel</button></div>
      </form>
    </Modal>
  );
}

function HrClaims({ status }: { status: 'APPROVED' | 'PAID' }) {
  const q = useQuery({ queryKey: ['expenses-hr', status], queryFn: () => api.get<{ defaultPayMonth: string; items: HrClaim[] }>(`/expenses?status=${status}`) });
  const [paying, setPaying] = useState<HrClaim | null>(null);
  if (q.isLoading) return <Loading />;
  const items = q.data?.items ?? [];
  return (
    <div className="card">
      <h2 style={{ marginBottom: 4 }}>{status === 'APPROVED' ? 'Approved claims to pay back' : 'Paid claims'}</h2>
      {!items.length ? <Empty>{status === 'APPROVED' ? 'Nothing waiting to be paid.' : 'No claims have been paid yet.'}</Empty> : (
        <table>
          <thead><tr><th>Employee</th><th>Date</th><th>Category</th><th>For</th><th>Receipts</th><th style={{ textAlign: 'right' }}>Amount</th><th /></tr></thead>
          <tbody>
            {items.map((c) => (
              <tr key={c.id}>
                <td>{c.employee.name} <span className="muted">{c.employee.employeeCode}</span></td>
                <td>{c.expenseOn}</td><td>{categoryLabel(c.category)}</td><td>{c.description}</td>
                <td><ReceiptList claimId={c.id} receipts={c.receipts} /></td>
                <td style={{ textAlign: 'right' }}>{formatMoney(c.amount, c.currency)}</td>
                <td>{status === 'APPROVED' ? <button className="btn primary" onClick={() => setPaying(c)} aria-label={`Pay ${c.employee.name}: ${c.description}`}>Pay</button> : <span className="muted">{paidNote(c)}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {status === 'APPROVED' && <p className="muted" style={{ marginBottom: 0 }}>Claims are approved in <Link to="/requests">Requests</Link>, by the approvers set under Settings → Approval flows.</p>}
      {paying && <PayDialog claim={paying} defaultMonth={q.data!.defaultPayMonth} onClose={() => setPaying(null)} />}
    </div>
  );
}


/** Expenses > Rules (administrators): when a receipt is required, and the most one claim of each kind may be. */
function PolicyForm() {
  const qc = useQueryClient();
  const q = usePolicy();
  const act = useAction();
  const [f, setF] = useState<{ over: string; limits: Record<string, string> } | null>(null);
  const [saved, setSaved] = useState(false);
  if (q.isLoading) return <Loading />;
  const cur = f ?? { over: q.data?.receiptRequiredOver != null ? String(q.data.receiptRequiredOver) : '', limits: Object.fromEntries(CATEGORIES.map((c) => [c.value, q.data?.limits[c.value] != null ? String(q.data.limits[c.value]) : ''])) };
  const set = (next: typeof cur) => { setF(next); setSaved(false); };
  const num = (v: string) => (v.trim() === '' ? null : Number(v));
  const save = (e: FormEvent) => {
    e.preventDefault();
    act.run(
      () => api.put('/expenses/policy', { receiptRequiredOver: num(cur.over), limits: Object.fromEntries(CATEGORIES.map((c) => [c.value, num(cur.limits[c.value])])) }),
      () => { setF(null); setSaved(true); qc.invalidateQueries({ queryKey: ['expense-policy'] }); },
    );
  };
  return (
    <form className="card" onSubmit={save}>
      <h2 style={{ marginTop: 0 }}>Expense rules</h2>
      <p className="muted">Leave a box empty for no rule. Amounts are in the company currency. Rules apply to claims submitted or approved from now on.</p>
      <div className="form-grid">
        <Field label="Receipt required above" hint="A claim above this amount cannot be approved without a receipt">
          <input type="number" min="0.01" step="0.01" value={cur.over} onChange={(e) => set({ ...cur, over: e.target.value })} />
        </Field>
      </div>
      <h3>Most one claim may be</h3>
      <div className="form-grid">
        {CATEGORIES.map((c) => (
          <Field key={c.value} label={`${c.label} limit`}>
            <input type="number" min="0.01" step="0.01" value={cur.limits[c.value]} onChange={(e) => set({ ...cur, limits: { ...cur.limits, [c.value]: e.target.value } })} />
          </Field>
        ))}
      </div>
      <ErrorText>{act.error}</ErrorText>
      <div className="row">
        <button className="btn primary" disabled={act.pending || f === null}>Save rules</button>
        {saved && <span className="badge ok" role="status">Saved</span>}
      </div>
    </form>
  );
}

export function Expenses() {
  const { user } = useAuth();
  const hr = isHR(user!.role);
  const [tab, setTab] = useState<'mine' | 'pay' | 'paid' | 'policy'>('mine');
  return (
    <>
      <h1>Expenses</h1>
      {hr && <Tabs tabs={[{ id: 'mine', label: 'My claims' }, { id: 'pay', label: 'To pay' }, { id: 'paid', label: 'Paid' }, ...(user!.role === 'ADMIN' ? [{ id: 'policy' as const, label: 'Rules' }] : [])]} value={tab} onChange={setTab} />}
      {tab === 'mine' ? <MyClaims /> : tab === 'policy' ? <PolicyForm /> : <HrClaims status={tab === 'pay' ? 'APPROVED' : 'PAID'} />}
    </>
  );
}
