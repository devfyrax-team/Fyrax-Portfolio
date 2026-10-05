import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { ErrorText, Field, Loading, useAction } from './ui';

interface Event {
  id: string; kind: 'EXTENDED' | 'CONFIRMED' | 'RECOMMENDATION'; recommendation: string | null; note: string | null;
  createdAt: string; by: string | null; fromDate: string | null; toDate: string | null;
}
export interface Probation {
  state: 'NONE' | 'ON_PROBATION' | 'CONFIRMED';
  probationEndsOn: string | null; confirmedOn: string | null; daysLeft: number | null;
  events?: Event[]; // not sent to the employee
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const RECOMMENDATIONS = [
  { value: 'CONFIRM', label: 'Confirm their employment' }, { value: 'EXTEND', label: 'Extend probation' }, { value: 'END', label: 'End their employment' },
];
const REC_LABEL: Record<string, string> = { CONFIRM: 'Confirm', EXTEND: 'Extend', END: 'End employment' };
const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

export function useProbation(employeeId: string | undefined) {
  return useQuery({ queryKey: ['probation', employeeId], enabled: !!employeeId, queryFn: () => api.get<Probation>(`/probation/employee/${employeeId}`) });
}

const when = (p: Probation) =>
  p.daysLeft === null ? '' : p.daysLeft > 0 ? `${plural(p.daysLeft, 'day')} left` : p.daysLeft === 0 ? 'ends today' : `review overdue by ${plural(-p.daysLeft, 'day')}`;

/** One employee's probation. HR decides, the manager advises, the employee just sees where it stands. */
export function ProbationCard({ employeeId, name, level }: { employeeId: string; name: string; level: 'hr' | 'manager' | 'self' }) {
  const qc = useQueryClient();
  const q = useProbation(employeeId);
  const act = useAction();
  const [mode, setMode] = useState<null | 'extend' | 'recommend'>(null);
  const [f, setF] = useState({ endsOn: '', reason: '', recommendation: 'CONFIRM', note: '' });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['probation'] }); qc.invalidateQueries({ queryKey: ['probation-due'] }); qc.invalidateQueries({ queryKey: ['employee'] }); qc.invalidateQueries({ queryKey: ['notif-count'] }); };

  if (q.isLoading) return <Loading />;
  const p = q.data;
  if (!p || p.state === 'NONE') return null;

  const confirm = () => {
    if (!window.confirm(`Confirm ${name}'s employment? This ends their probation.`)) return;
    act.run(() => api.post(`/probation/employee/${employeeId}/confirm`, {}), refresh);
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'extend') act.run(() => api.post(`/probation/employee/${employeeId}/extend`, { endsOn: f.endsOn, reason: f.reason }), () => { setMode(null); setF({ ...f, endsOn: '', reason: '' }); refresh(); });
    else act.run(() => api.post(`/probation/employee/${employeeId}/recommend`, { recommendation: f.recommendation, note: f.note || undefined }), () => { setMode(null); setF({ ...f, note: '' }); refresh(); });
  };

  const on = p.state === 'ON_PROBATION';
  return (
    <div className="card">
      <h2 style={{ marginBottom: 4 }}>Probation</h2>
      <p style={{ marginTop: 0 }}>
        {on
          ? <>{level === 'self' ? 'You are' : 'On probation'} until <b>{p.probationEndsOn}</b> <span className={p.daysLeft! < 0 ? 'badge bad' : p.daysLeft! <= 14 ? 'badge warn' : 'badge'}>{when(p)}</span></>
          : <>Confirmed on <b>{p.confirmedOn}</b>.</>}
      </p>

      {on && level !== 'self' && !mode && (
        <div className="row">
          {level === 'hr' && <button className="btn primary" disabled={act.pending} onClick={confirm}>Confirm employment</button>}
          {level === 'hr' && <button className="btn" onClick={() => { setMode('extend'); setF({ ...f, endsOn: addDays(p.probationEndsOn!, 30) }); }}>Extend probation</button>}
          {level === 'manager' && <button className="btn" onClick={() => setMode('recommend')}>Give a recommendation</button>}
        </div>
      )}
      <ErrorText>{act.error}</ErrorText>

      {mode && (
        <form onSubmit={submit}>
          {mode === 'extend' ? (
            <div className="form-grid">
              <Field label="New end date" hint={`Currently ${p.probationEndsOn}. At most 6 months later.`}><input type="date" value={f.endsOn} min={addDays(p.probationEndsOn!, 1)} onChange={(e) => setF({ ...f, endsOn: e.target.value })} required /></Field>
              <Field label="Reason" hint="The employee is told this"><input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} minLength={3} maxLength={500} required /></Field>
            </div>
          ) : (
            <div className="form-grid">
              <Field label="Your recommendation"><select value={f.recommendation} onChange={(e) => setF({ ...f, recommendation: e.target.value })}>{RECOMMENDATIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></Field>
              <Field label="Why (optional)" hint="HR reads this. The employee does not see it."><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={500} /></Field>
            </div>
          )}
          <div className="row">
            <button className="btn primary" disabled={act.pending}>{act.pending ? 'Saving…' : mode === 'extend' ? 'Extend probation' : 'Send recommendation'}</button>
            <button type="button" className="btn" onClick={() => setMode(null)}>Cancel</button>
          </div>
        </form>
      )}

      {p.events && p.events.length > 0 && (
        <>
          <h3 style={{ marginTop: 16 }}>History</h3>
          <ul className="history">
            {p.events.map((e) => (
              <li key={e.id}>
                <b>{e.kind === 'RECOMMENDATION' ? `Recommended: ${REC_LABEL[e.recommendation ?? ''] ?? e.recommendation}` : e.kind === 'EXTENDED' ? `Extended from ${e.fromDate} to ${e.toDate}` : 'Confirmed'}</b>
                {' '}<span className="muted">{e.by} · {e.createdAt.slice(0, 10)}</span>
                {e.note && <div className="muted">{e.note}</div>}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

interface Due {
  employee: { id: string; employeeCode: string; firstName: string; lastName: string };
  probationEndsOn: string; daysLeft: number; recommendation: { recommendation: string; note: string | null } | null;
}

/** Reviews coming up in the next 30 days, or overdue. HR sees everyone; a manager sees their own people. */
export function ProbationReviews() {
  const q = useQuery({ queryKey: ['probation-due'], queryFn: () => api.get<Due[]>('/probation/due') });
  if (!q.data?.length) return null;
  return (
    <div className="card table-wrap">
      <h2 style={{ marginBottom: 4 }}>Probation reviews</h2>
      <p className="muted" style={{ marginTop: 0 }}>Ending within 30 days, or overdue.</p>
      <table>
        <thead><tr><th>Employee</th><th>Probation ends</th><th>Recommendation</th></tr></thead>
        <tbody>
          {q.data.map((d) => (
            <tr key={d.employee.id}>
              <td><Link to={`/employees/${d.employee.id}`}>{d.employee.firstName} {d.employee.lastName}</Link> <span className="muted">{d.employee.employeeCode}</span></td>
              <td>{d.probationEndsOn} {d.daysLeft < 0 ? <span className="badge bad">overdue {-d.daysLeft} days</span> : <span className="badge warn">{d.daysLeft === 0 ? 'today' : `in ${d.daysLeft} days`}</span>}</td>
              <td>{d.recommendation ? <>{REC_LABEL[d.recommendation.recommendation] ?? d.recommendation.recommendation}{d.recommendation.note && <span className="muted"> — {d.recommendation.note}</span>}</> : <span className="muted">None yet</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
