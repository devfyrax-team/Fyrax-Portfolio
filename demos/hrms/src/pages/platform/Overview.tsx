import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api';
import { Badge, Empty, Loading, day, formatMoney } from '../../components/ui';

interface OverviewData {
  companies: { total: number; active: number; suspended: number };
  users: number;
  employees: number;
  pendingApprovals: number;
  payrollRuns: { draft: number; approved: number; paid: number };
  superAdmins: number;
  seats: { licensed: number; used: number };
  recurring: { currency: string; monthly: number }[];
  recentCompanies:{ id: string; name: string; slug: string; status: string; createdAt: string }[];
}

export function Overview() {
  const q = useQuery({ queryKey: ['platform-overview'], queryFn: () => api.get<OverviewData>('/platform/overview') });
  if (q.isLoading) return <Loading />;
  if (q.error) return <p className="error">{(q.error as Error).message}</p>;
  const o = q.data!;
  const stats: [string, number | string, string?][] = [
    ['Companies', o.companies.total],
    ['Active', o.companies.active],
    ['Suspended', o.companies.suspended],
    ['Seats in use', `${o.seats.used} of ${o.seats.licensed}`],
    ...o.recurring.map((r): [string, string] => [`Billed per month (${r.currency})`, formatMoney(r.monthly, r.currency)]),
    ['People (employees)', o.employees],
    ['Sign-in accounts', o.users],
    ['Waiting for approval', o.pendingApprovals],
    ['Payroll runs', `${o.payrollRuns.paid} paid · ${o.payrollRuns.approved} approved · ${o.payrollRuns.draft} draft`],
    ['Super admins', o.superAdmins],
  ];
  return (
    <>
      <div className="row between">
        <h1>System overview</h1>
        <Link className="btn primary" to="/platform/companies?new=1">New company</Link>
      </div>
      <div className="stats">
        {stats.map(([label, value]) => (
          <div className="stat" key={label}><b>{value}</b><span>{label}</span></div>
        ))}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="row between" style={{ marginBottom: 12 }}>
          <h2>Newest companies</h2>
          <Link to="/platform/companies">See all</Link>
        </div>
        {!o.recentCompanies.length ? <Empty>No companies yet. Create the first one.</Empty> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Company</th><th>Code</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>
                {o.recentCompanies.map((c) => (
                  <tr key={c.id}>
                    <td><Link to={`/platform/companies/${c.id}`}>{c.name}</Link></td>
                    <td className="muted">{c.slug}</td>
                    <td><Badge value={c.status} /></td>
                    <td>{day(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="muted">Super admins see company details and counts. Employee records, attendance and pay stay private to each company.</p>
    </>
  );
}
