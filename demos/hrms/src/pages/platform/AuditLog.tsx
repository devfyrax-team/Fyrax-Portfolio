import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { Empty, Loading, Pager } from '../../components/ui';

const LABELS: Record<string, string> = {
  COMPANY_CREATED: 'Company created',
  COMPANY_UPDATED: 'Company edited',
  COMPANY_SUSPENDED: 'Company suspended',
  COMPANY_REACTIVATED: 'Company reactivated',
  COMPANY_SEATS_UPDATED: 'Seats or price changed',
  BILLING_EXPORTED: 'Billing exported',
  COMPANY_ADMIN_ADDED: 'Administrator invited',
  RESET_LINK_SENT: 'Password reset link sent',
  SUPER_ADMIN_ADDED: 'Super admin added',
  SUPER_ADMIN_DEACTIVATED: 'Super admin deactivated',
  SUPER_ADMIN_ACTIVATED: 'Super admin reactivated',
  LOGIN: 'Signed in',
  ACCOUNT_LOCKED: 'Account locked after failed sign-ins',
  PASSWORD_CHANGED: 'Password changed',
  REFRESH_TOKEN_REUSE: 'Possible stolen session (all sessions revoked)',
};
export const actionLabel = (a: string) => LABELS[a] ?? a.toLowerCase().replace(/_/g, ' ');

/** The useful part of an entry's details, in words: a suspension reason, or what a seat change went from and to. */
export function actionDetail(action: string, m: any): string {
  if (!m) return '';
  if (m.reason) return m.reason;
  if (action === 'COMPANY_SEATS_UPDATED' && m.from && m.to) {
    const parts: string[] = [];
    if (m.from.seatLimit !== m.to.seatLimit) parts.push(`seats ${m.from.seatLimit} → ${m.to.seatLimit}`);
    if (m.from.pricePerSeat !== m.to.pricePerSeat || m.from.currency !== m.to.currency) {
      parts.push(`price ${m.from.pricePerSeat} ${m.from.currency} → ${m.to.pricePerSeat} ${m.to.currency}`);
    }
    return parts.join(', ');
  }
  return '';
}

interface Item {
  id: string;
  action: string;
  at: string;
  by: string | null;
  company: { id: string; name: string; slug: string } | null;
  metadata: any;
}

export function AuditLog() {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['platform-audit', page],
    queryFn: () => api.get<{ total: number; page: number; pageSize: number; items: Item[] }>(`/platform/audit?page=${page}&pageSize=25`),
  });
  return (
    <>
      <h1>Audit log</h1>
      <div className="card table-wrap">
        {q.isLoading ? <Loading /> : q.error ? <p className="error">{(q.error as Error).message}</p> : !q.data?.items.length ? <Empty>Nothing has happened yet.</Empty> : (
          <table>
            <thead><tr><th>When</th><th>What</th><th>Company</th><th>By</th></tr></thead>
            <tbody>
              {q.data.items.map((a) => (
                <tr key={a.id}>
                  <td>{new Date(a.at).toLocaleString()}</td>
                  <td>{actionLabel(a.action)}{actionDetail(a.action, a.metadata) && <span className="muted"> · {actionDetail(a.action, a.metadata)}</span>}</td>
                  <td>{a.company ? <Link to={`/platform/companies/${a.company.id}`}>{a.company.name}</Link> : <span className="muted">—</span>}</td>
                  <td className="muted">{a.by ?? 'system'}</td>
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
