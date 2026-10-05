import { useQuery } from '@tanstack/react-query';
import { api, downloadFile } from '../api';
import { Badge, Empty, ErrorText, Loading, formatMoney, useAction } from './ui';
import type { CreditNote, Invoice } from '../pages/platform/Invoices';

/** The company's own invoices (administrators only): what it was billed each month, and whether it is paid. */
export function BillingTab() {
  const q = useQuery({ queryKey: ['company-invoices'], queryFn: () => api.get<Invoice[]>('/company/invoices') });
  const credits = useQuery({ queryKey: ['company-credit-notes'], queryFn: () => api.get<CreditNote[]>('/company/credit-notes') });
  const dl = useAction();
  return (
    <>
    <div className="card table-wrap">
      <h2 style={{ marginBottom: 4 }}>Invoices</h2>
      <p className="muted" style={{ marginTop: 0 }}>You are billed each month for the seats your company has bought. Download an invoice for your records.</p>
      <ErrorText>{dl.error}</ErrorText>
      {q.isLoading ? <Loading /> : !q.data?.length ? <Empty>No invoices yet. The first one is issued at the start of the month.</Empty> : (
        <table>
          <thead><tr><th>Number</th><th>Month</th><th className="num">Seats</th><th className="num">Total</th><th>Due</th><th>Status</th><th className="actions" /></tr></thead>
          <tbody>
            {q.data.map((i) => (
              <tr key={i.id}>
                <td>{i.number}</td>
                <td>{i.periodMonth}</td>
                <td className="num">{i.seats}</td>
                <td className="num">{formatMoney(i.total, i.currency)}{i.creditedTotal > 0 && <div className="muted">credited {formatMoney(i.creditedTotal, i.currency)}</div>}</td>
                <td>{i.dueOn}</td>
                <td><Badge value={i.displayStatus} />{i.paidOn && <span className="muted"> · paid {i.paidOn}</span>}</td>
                <td className="actions"><button className="btn small" onClick={() => dl.run(() => downloadFile(`/company/invoices/${i.id}/pdf`, `${i.number}.pdf`))}>Download PDF</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
    {!!credits.data?.length && (
      <div className="card table-wrap">
        <h2 style={{ marginBottom: 4 }}>Credit notes</h2>
        <p className="muted" style={{ marginTop: 0 }}>A credit note corrects an invoice. The amount is deducted from what you owe on it.</p>
        <table>
          <thead><tr><th>Number</th><th>Invoice</th><th className="num">Credited</th><th>Reason</th><th>Issued</th><th className="actions" /></tr></thead>
          <tbody>
            {credits.data.map((n) => (
              <tr key={n.id}>
                <td>{n.number}</td><td>{n.invoiceNumber}</td><td className="num">{formatMoney(n.total, n.currency)}</td><td>{n.reason}</td><td>{n.issuedAt.slice(0, 10)}</td>
                <td className="actions"><button className="btn small" onClick={() => dl.run(() => downloadFile(`/company/credit-notes/${n.id}/pdf`, `${n.number}.pdf`))} aria-label={`Download ${n.number}`}>Download PDF</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
    </>
  );
}
