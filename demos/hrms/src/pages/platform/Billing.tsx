import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api, downloadFile } from '../../api';
import { Badge, Empty, ErrorText, Loading, SeatMeter, formatMoney, useAction } from '../../components/ui';

interface Row {
  id: string;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED';
  seatLimit: number;
  seatsUsed: number;
  pricePerSeat: number;
  currency: string;
  monthly: number;
}
interface Total { currency: string; companies: number; seatsLicensed: number; seatsUsed: number; monthly: number }

export function Billing() {
  const q = useQuery({ queryKey: ['platform-billing'], queryFn: () => api.get<{ items: Row[]; totals: Total[] }>('/platform/billing') });
  const dl = useAction();
  if (q.isLoading) return <Loading />;
  if (q.error) return <p className="error">{(q.error as Error).message}</p>;
  const { items, totals } = q.data!;

  return (
    <>
      <div className="row between">
        <h1>Billing</h1>
        <button className="btn" disabled={dl.pending} onClick={() => dl.run(() => downloadFile('/platform/billing.csv', 'billing.csv'))}>
          {dl.pending ? 'Preparing…' : 'Download CSV'}
        </button>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        The system is sold per seat. A seat is an employee who is not terminated. Each company is billed monthly for the seats it has
        bought (its limit), at its own price per seat. Suspended companies are listed but are not billed.
      </p>
      <ErrorText>{dl.error}</ErrorText>

      {!totals.length ? <Empty>No active companies to bill.</Empty> : (
        <div className="stats" style={{ marginBottom: 16 }}>
          {totals.map((t) => (
            <div className="stat" key={t.currency}>
              <b>{formatMoney(t.monthly, t.currency)}</b>
              <span>per month · {t.companies} {t.companies === 1 ? 'company' : 'companies'} · {t.seatsUsed} of {t.seatsLicensed} seats used</span>
            </div>
          ))}
        </div>
      )}

      <div className="card table-wrap">
        {!items.length ? <Empty>No companies yet.</Empty> : (
          <table>
            <thead>
              <tr><th>Company</th><th>Status</th><th>Seats used</th><th className="num">Monthly</th><th className="num">Per seat</th></tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} style={r.status === 'SUSPENDED' ? { opacity: 0.6 } : undefined}>
                  <td><Link to={`/platform/companies/${r.id}`}>{r.name}</Link> <span className="muted">{r.slug}</span></td>
                  <td><Badge value={r.status} /></td>
                  <td><SeatMeter used={r.seatsUsed} limit={r.seatLimit} /></td>
                  <td className="num"><b>{formatMoney(r.monthly, r.currency)}</b>{r.status === 'SUSPENDED' && <span className="muted"> (not billed)</span>}</td>
                  <td className="num muted">{formatMoney(r.pricePerSeat, r.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
