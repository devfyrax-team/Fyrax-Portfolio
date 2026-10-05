import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '../api';
import { canView, useAuth } from '../auth';
import { AttendanceRecord, Summary, SummaryStats, hours, sourceNote } from '../components/AttendanceBits';
import { Badge, Empty, Field, Loading, Pager, Tabs, day, monthNow, time } from '../components/ui';

interface TeamRow extends Summary {
  employeeId: string;
  employeeCode: string;
  name: string;
}

function Mine({ month }: { month: string }) {
  const q = useQuery({
    queryKey: ['att-me', month],
    queryFn: () => api.get<{ records: AttendanceRecord[]; summary: Summary }>(`/attendance/me?month=${month}`),
  });
  if (q.isLoading) return <Loading />;
  if (q.error instanceof ApiError && q.error.status === 409) return <Empty>Your login is not linked to an employee profile.</Empty>;
  if (q.error) return <p className="error">{(q.error as Error).message}</p>;
  const { records, summary } = q.data!;
  return (
    <>
      <div className="card"><SummaryStats s={summary} /></div>
      <div className="card table-wrap">
        {records.length === 0 ? <Empty>No attendance recorded this month.</Empty> : (
          <table>
            <thead><tr><th>Date</th><th>In</th><th>Out</th><th className="num">Worked</th><th>Status</th></tr></thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{day(r.date)}</td><td>{time(r.checkIn)}</td><td>{time(r.checkOut)}</td>
                  <td className="num">{hours(r.workedMinutes)}</td>
                  <td><Badge value={r.status} />{sourceNote[r.source] && <span className="muted"> · {sourceNote[r.source]}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function Team({ month }: { month: string }) {
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['att-team', month, page],
    queryFn: () => api.get<{ total: number; page: number; pageSize: number; items: TeamRow[] }>(`/attendance/summary?month=${month}&page=${page}`),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <p className="error">{(q.error as Error).message}</p>;
  const d = q.data!;
  return (
    <div className="card">
      {d.items.length === 0 ? <Empty>No employees yet.</Empty> : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Employee</th><th className="num">Working</th><th className="num">Present</th><th className="num">Late</th>
                <th className="num">Half</th><th className="num">Absent</th><th className="num">Paid leave</th><th className="num">Unpaid leave</th><th className="num">Hours</th>
              </tr>
            </thead>
            <tbody>
              {d.items.map((r) => (
                <tr key={r.employeeId}>
                  <td>{r.name} <span className="muted">{r.employeeCode}</span></td>
                  <td className="num">{r.workingDays}</td><td className="num">{r.daysPresent}</td><td className="num">{r.daysLate}</td>
                  <td className="num">{r.halfDays}</td><td className="num">{r.absentDays}</td>
                  <td className="num">{r.paidLeaveDays}</td><td className="num">{r.unpaidLeaveDays}</td>
                  <td className="num">{hours(r.workedMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pager page={d.page} pageSize={d.pageSize} total={d.total} onChange={setPage} />
    </div>
  );
}

export function Attendance() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'mine' | 'team'>('mine');
  const [month, setMonth] = useState(monthNow());
  return (
    <>
      <div className="row between">
        <h1>Attendance</h1>
        <Field label="Month"><input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)} /></Field>
      </div>
      {canView(user!.role) && (
        <Tabs tabs={[{ id: 'mine', label: 'My attendance' }, { id: 'team', label: 'Team summary' }]} value={tab} onChange={setTab} />
      )}
      {tab === 'mine' || !canView(user!.role) ? <Mine month={month} /> : <Team month={month} />}
    </>
  );
}
