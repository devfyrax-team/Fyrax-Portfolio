import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, downloadFile } from '../../api';
import { Badge, Empty, ErrorText, Field, Loading, Modal, formatMoney, useAction } from '../../components/ui';

export interface Invoice {
  id: string; number: string; tenantId: string; company: string; periodMonth: string;
  status: 'ISSUED' | 'PAID' | 'VOID'; displayStatus: 'ISSUED' | 'PAID' | 'VOID' | 'OVERDUE' | 'CREDITED';
  creditedTotal: number; balanceDue: number; creditNotes?: { id: string; number: string; total: number }[];
  seats: number; pricePerSeat: number; currency: string; taxPercent: number; subtotal: number; taxAmount: number; total: number;
  issuedAt: string; dueOn: string; paidOn: string | null; paymentRef: string | null; voidReason: string | null;
}
export interface CreditNote {
  id: string; number: string; invoiceNumber: string | null; company: string; currency: string; subtotal: number; taxAmount: number; total: number; reason: string; issuedAt: string;
}
interface Listing { items: Invoice[]; outstanding: { currency: string; invoices: number; amount: number; overdueInvoices: number; overdueAmount: number }[] }

const lastMonth = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
};

function MarkPaid({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const qc = useQueryClient();
  const { run, pending, error } = useAction();
  const today = new Date().toISOString().slice(0, 10);
  const [paidOn, setPaidOn] = useState(today);
  const [ref, setRef] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => api.post(`/platform/invoices/${inv.id}/paid`, { paidOn, paymentRef: ref || undefined }), () => { qc.invalidateQueries(); onClose(); });
  };
  return (
    <Modal title={`Mark ${inv.number} as paid`} onClose={onClose}>
      <form onSubmit={submit}>
        <p style={{ marginTop: 0 }}>{inv.company} · {formatMoney(inv.total, inv.currency)}</p>
        <div className="form-grid">
          <Field label="Paid on"><input type="date" value={paidOn} max={today} onChange={(e) => setPaidOn(e.target.value)} required /></Field>
          <Field label="Payment reference (optional)" hint="A bank reference or receipt number"><input value={ref} onChange={(e) => setRef(e.target.value)} maxLength={100} /></Field>
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="row">
          <button className="btn primary" disabled={pending}>{pending ? 'Saving…' : 'Mark as paid'}</button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

function CreditNoteDialog({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const qc = useQueryClient();
  const { run, pending, error } = useAction();
  const [whole, setWhole] = useState(false);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const left = Math.round((inv.total - inv.creditedTotal) * 100) / 100;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => api.post(`/platform/invoices/${inv.id}/credit-notes`, whole ? { full: true, reason } : { amount: Number(amount), reason }), () => { qc.invalidateQueries(); onClose(); });
  };
  return (
    <Modal title={`Credit note for ${inv.number}`} onClose={onClose}>
      <form onSubmit={submit}>
        <p style={{ marginTop: 0 }}>
          {inv.company}: invoiced {formatMoney(inv.total, inv.currency)}{inv.creditedTotal > 0 ? `, already credited ${formatMoney(inv.creditedTotal, inv.currency)}` : ''}. Up to {formatMoney(left, inv.currency)} (tax included) can still be credited.
        </p>
        <label className="check"><input type="checkbox" checked={whole} onChange={(e) => setWhole(e.target.checked)} /> Credit everything that is left</label>
        {!whole && <Field label="Amount to credit, before tax" hint={inv.taxPercent > 0 ? `Tax at ${inv.taxPercent}% is added in proportion` : 'This invoice has no tax'}><input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>}
        <Field label="Reason" hint="Printed on the credit note and shown to the company"><input value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} maxLength={300} required /></Field>
        <ErrorText>{error}</ErrorText>
        <div className="row">
          <button className="btn primary" disabled={pending}>{pending ? 'Issuing…' : 'Issue credit note'}</button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

function VoidInvoice({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const qc = useQueryClient();
  const { run, pending, error } = useAction();
  const [reason, setReason] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => api.post(`/platform/invoices/${inv.id}/void`, { reason }), () => { qc.invalidateQueries(); onClose(); });
  };
  return (
    <Modal title={`Void ${inv.number}?`} onClose={onClose}>
      <form onSubmit={submit}>
        <p style={{ marginTop: 0 }}>
          The invoice for <b>{inv.company}</b> ({inv.periodMonth}, {formatMoney(inv.total, inv.currency)}) stays on record as void, and the month can be invoiced again.
        </p>
        <Field label="Reason" hint="Kept with the invoice"><input value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} maxLength={300} required autoFocus /></Field>
        <ErrorText>{error}</ErrorText>
        <div className="row">
          <button className="btn danger" disabled={pending}>{pending ? 'Voiding…' : 'Void invoice'}</button>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

// Page pattern: List. Every invoice issued, what is still owed, and the actions that move an invoice along.
export function Invoices() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState({ month: '', status: '' });
  const [genMonth, setGenMonth] = useState(lastMonth());
  const [dialog, setDialog] = useState<{ kind: 'paid' | 'void' | 'credit'; inv: Invoice } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const gen = useAction();
  const dl = useAction();
  const notes = useQuery({ queryKey: ['platform-credit-notes'], queryFn: () => api.get<CreditNote[]>('/platform/invoices/credit-notes') });
  const q = useQuery({
    queryKey: ['platform-invoices', filter],
    queryFn: () => {
      const p = new URLSearchParams();
      if (filter.month) p.set('month', filter.month);
      if (filter.status) p.set('status', filter.status);
      return api.get<Listing>(`/platform/invoices?${p}`);
    },
  });

  const generate = () => {
    setNotice(null);
    gen.run(async () => {
      const r = await api.post<{ created: number; alreadyInvoiced: number; noPrice: number }>('/platform/invoices/generate', { month: genMonth });
      setNotice(`${r.created} invoice${r.created === 1 ? '' : 's'} issued for ${genMonth}. ${r.alreadyInvoiced} already had one${r.noPrice ? `, ${r.noPrice} ha${r.noPrice === 1 ? 's' : 've'} no price set` : ''}.`);
      qc.invalidateQueries({ queryKey: ['platform-invoices'] });
    });
  };

  return (
    <>
      <div className="row between">
        <h1>Invoices</h1>
        <button className="btn" disabled={dl.pending} onClick={() => dl.run(() => downloadFile('/platform/invoices/export.csv', 'invoices.csv'))}>{dl.pending ? 'Preparing…' : 'Download CSV'}</button>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Each company is billed monthly for the seats it has bought. Invoices are issued automatically in the first days of the month, and you can issue a month by hand here.
        An invoice keeps the seats and price it was issued with.
      </p>
      <ErrorText>{gen.error ?? dl.error}</ErrorText>

      {q.data && q.data.outstanding.length > 0 && (
        <div className="stats" style={{ marginBottom: 16 }}>
          {q.data.outstanding.map((o) => (
            <div className="stat" key={o.currency}>
              <b>{formatMoney(o.amount, o.currency)}</b>
              <span>owed · {o.invoices} invoice{o.invoices === 1 ? '' : 's'}</span>
              {o.overdueInvoices > 0 && <span style={{ display: 'block', color: 'var(--bad)' }}>{formatMoney(o.overdueAmount, o.currency)} overdue ({o.overdueInvoices})</span>}
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <h2 style={{ marginBottom: 12 }}>Issue invoices</h2>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          <Field label="Month"><input type="month" value={genMonth} max={new Date().toISOString().slice(0, 7)} onChange={(e) => setGenMonth(e.target.value)} /></Field>
          <div style={{ marginBottom: 12 }}><button className="btn primary" disabled={gen.pending || !genMonth} onClick={generate}>{gen.pending ? 'Issuing…' : 'Issue invoices'}</button></div>
        </div>
        <p className="muted" style={{ margin: 0 }}>Every active company with a price and no invoice yet for that month. Running it again is harmless.</p>
        {notice && <p className="notice" role="status">{notice}</p>}
      </div>

      <div className="row" style={{ marginBottom: 12 }}>
        <Field label="Month"><input type="month" value={filter.month} onChange={(e) => setFilter({ ...filter, month: e.target.value })} /></Field>
        <Field label="Status">
          <select value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
            <option value="">All</option><option value="ISSUED">Issued</option><option value="OVERDUE">Overdue</option><option value="PAID">Paid</option><option value="VOID">Void</option>
          </select>
        </Field>
      </div>

      <div className="card table-wrap">
        {q.isLoading ? <Loading /> : !q.data?.items.length ? <Empty>No invoices {filter.month || filter.status ? 'match these filters' : 'yet. Issue the first ones above'}.</Empty> : (
          <table>
            <thead><tr><th>Number</th><th>Company</th><th>Month</th><th className="num">Total</th><th>Due</th><th>Status</th><th className="actions" /></tr></thead>
            <tbody>
              {q.data.items.map((i) => (
                <tr key={i.id}>
                  <td>{i.number}</td>
                  <td>{i.company}</td>
                  <td>{i.periodMonth}</td>
                  <td className="num">{formatMoney(i.total, i.currency)}{i.creditedTotal > 0 && <div className="muted">credited {formatMoney(i.creditedTotal, i.currency)}</div>}</td>
                  <td>{i.dueOn}</td>
                  <td><Badge value={i.displayStatus} />{i.paidOn && <span className="muted"> · {i.paidOn}{i.paymentRef ? ` · ${i.paymentRef}` : ''}</span>}{i.voidReason && <span className="muted"> · {i.voidReason}</span>}</td>
                  <td className="actions">
                    <div className="row">
                      <button className="btn small" onClick={() => dl.run(() => downloadFile(`/platform/invoices/${i.id}/pdf`, `${i.number}.pdf`))}>PDF</button>
                      {i.status === 'ISSUED' && i.balanceDue > 0 && <button className="btn small primary" onClick={() => setDialog({ kind: 'paid', inv: i })}>Mark paid</button>}
                      {i.status !== 'VOID' && i.creditedTotal < i.total && <button className="btn small" onClick={() => setDialog({ kind: 'credit', inv: i })} aria-label={`Credit note for ${i.number}`}>Credit note</button>}
                      {i.status === 'ISSUED' && i.creditedTotal === 0 && <button className="btn small danger" onClick={() => setDialog({ kind: 'void', inv: i })}>Void</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {dialog?.kind === 'paid' && <MarkPaid inv={dialog.inv} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'void' && <VoidInvoice inv={dialog.inv} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'credit' && <CreditNoteDialog inv={dialog.inv} onClose={() => setDialog(null)} />}

      <h2>Credit notes</h2>
      <div className="card table-wrap">
        {notes.isLoading ? <Loading /> : !notes.data?.length ? <Empty>No credit notes issued.</Empty> : (
          <table>
            <thead><tr><th>Number</th><th>Company</th><th>Invoice</th><th className="num">Credited</th><th>Reason</th><th>Issued</th><th className="actions" /></tr></thead>
            <tbody>
              {notes.data.map((n) => (
                <tr key={n.id}>
                  <td>{n.number}</td><td>{n.company}</td><td>{n.invoiceNumber}</td>
                  <td className="num">{formatMoney(n.total, n.currency)}</td><td>{n.reason}</td><td>{n.issuedAt.slice(0, 10)}</td>
                  <td className="actions"><button className="btn small" onClick={() => dl.run(() => downloadFile(`/platform/invoices/credit-notes/${n.id}/pdf`, `${n.number}.pdf`))} aria-label={`Download ${n.number}`}>PDF</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
