import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { AttendanceRecord, Summary, SummaryStats } from '../components/AttendanceBits';
import { Badge, Empty, ErrorText, Loading, dateNow, monthNow, time, useAction, day } from '../components/ui';
import { Link } from 'react-router-dom';
import { Icon, IconName } from '../components/Icon';
import { MyOnboardingSteps } from '../components/Onboarding';

interface Balance {
  id: string;
  entitled: string;
  carriedOver: string;
  used: string;
  pending: string;
  leaveType: { name: string };
}

const quickActions: { to: string; label: string; icon: IconName }[] = [
  { to: '/leave', label: 'Take time off', icon: 'calendar' },
  { to: '/expenses', label: 'Claim an expense', icon: 'card' },
  { to: '/payroll', label: 'See my payslip', icon: 'wallet' },
  { to: '/profile', label: 'Update my details', icon: 'user' },
];

const noProfile = (e: unknown) => e instanceof ApiError && e.status === 409;

export function Dashboard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const month = monthNow();
  const att = useQuery({
    queryKey: ['att-me', month],
    queryFn: () => api.get<{ records: AttendanceRecord[]; summary: Summary }>(`/attendance/me?month=${month}`),
  });
  const balances = useQuery({
    queryKey: ['balances-me'],
    queryFn: () => api.get<Balance[]>('/leave/balances/me'),
  });
  const action = useAction();

  // "Today" is taken from the browser clock; the server decides the real date in the company's timezone.
  const today = att.data?.records.find((r) => day(r.date) === dateNow());
  const refresh = () => qc.invalidateQueries({ queryKey: ['att-me'] });

  const name = user!.email.split('@')[0].split(/[._-]+/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const longDate = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <header className="hero">
        <div>
          <p className="eyebrow">{longDate}</p>
          <h1>{greeting}, <span style={{ textTransform: 'capitalize' }}>{name}</span></h1>
        </div>
      </header>

      <MyOnboardingSteps />

      {noProfile(att.error) && (
        <div className="card">
          <h3>No employee profile</h3>
          <p className="muted" style={{ margin: 0 }}>
            Your login is not linked to an employee record, so check-in, leave and payslips are unavailable.
            {user!.role === 'ADMIN' || user!.role === 'HR' ? ' Create an employee under Employees and link it to your user.' : ' Ask HR to link your account.'}
          </p>
        </div>
      )}

      {att.data && (
        <section className="card today-card" aria-label="Today">
          <div>
            <h2>Today {today && <Badge value={today.status} />}</h2>
            <div className="clock">
              {today?.checkOut ? 'All done for today' : today ? "You're checked in" : 'Ready to start your day?'}
            </div>
            <div className="punches">
              <div className="punch"><span>Check in</span><b>{time(today?.checkIn)}</b></div>
              <div className="punch"><span>Check out</span><b>{time(today?.checkOut)}</b></div>
            </div>
            <ErrorText>{action.error}</ErrorText>
          </div>
          <div className="row">
            <button className="btn primary" disabled={!!today || action.pending} onClick={() => action.run(() => api.post('/attendance/check-in'), refresh)}>
              <Icon name="login" size={16} /> Check in
            </button>
            <button className="btn" disabled={!today || !!today.checkOut || action.pending} onClick={() => action.run(() => api.post('/attendance/check-out'), refresh)}>
              <Icon name="logout" size={16} /> Check out
            </button>
          </div>
        </section>
      )}

      {att.isLoading && <Loading />}

      <nav className="quick-grid" aria-label="Quick actions">
        {quickActions.map((a) => (
          <Link key={a.to} to={a.to} className="quick">
            <span className="chip"><Icon name={a.icon} size={18} /></span>
            {a.label}
          </Link>
        ))}
      </nav>

      {att.data && (
        <div className="card">
          <div className="card-head">
            <h2>This month</h2>
            <span className="muted" style={{ fontSize: 14 }}>{new Date().toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
          </div>
          <SummaryStats s={att.data.summary} />
        </div>
      )}

      {balances.data && (
        <div className="card">
          <div className="card-head"><h2>Leave balances</h2></div>
          {balances.data.length === 0 ? (
            <Empty>No paid leave types are set up yet.</Empty>
          ) : (
            <div className="balance-list">
              {balances.data.map((b) => {
                const total = Number(b.entitled) + Number(b.carriedOver);
                const used = Number(b.used);
                const pending = Number(b.pending);
                const left = total - used - pending;
                const pct = (n: number) => (total > 0 ? `${Math.min(100, (n / total) * 100)}%` : '0%');
                return (
                  <div className="balance" key={b.id}>
                    <div className="balance-top">
                      <span className="balance-name">{b.leaveType.name}</span>
                      <b>{left}</b>
                    </div>
                    <div className="meter" aria-hidden="true">
                      <span className="used" style={{ width: pct(used) }} />
                      <span className="pending" style={{ width: pct(pending) }} />
                    </div>
                    <div className="balance-meta">
                      {used} used{pending ? ` · ${pending} pending` : ''} · {total} total
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
