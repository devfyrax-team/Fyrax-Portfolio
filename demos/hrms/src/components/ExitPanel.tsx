import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { ErrorText, Field, Loading, Modal, money, useAction } from './ui';
import { useCompanySettings } from './CompanySettings';

export interface SeparationInfo {
  id: string; status: 'NOTICE' | 'COMPLETED' | 'WITHDRAWN'; lastWorkingDay: string; reason: string | null; daysLeft: number;
}
interface Settlement {
  separation: SeparationInfo;
  noticePeriodDays: number;
  resignedOn: string | null;
  payroll: { month: string; state: string; message: string };
  leave: { type: string; available: number; leaveTypeId: string; payable: boolean; suggestedAmount: number | null }[];
  dayValue: number | null;
  payDaysPerMonth: number;
  owed: { expenses: { count: number; total: number }; payouts: { count: number; days: number } };
  openItems: { pendingRequests: number; directReports: number; assets: string[] };
  canComplete: boolean;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const addDays = (ymd: string, n: number) => new Date(Date.parse(`${ymd}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** The person's current exit, if any. Visible to them, to HR, and to their manager. */
export function useSeparation(employeeId: string | undefined) {
  return useQuery({ queryKey: ['separation', employeeId], enabled: !!employeeId, queryFn: () => api.get<SeparationInfo | null>(`/separations/employee/${employeeId}`) });
}

export function NoticeBanner({ sep, own }: { sep: SeparationInfo; own: boolean }) {
  if (sep.status !== 'NOTICE') return null;
  const when = sep.daysLeft > 0 ? `${plural(sep.daysLeft, 'day')} left` : sep.daysLeft === 0 ? 'today' : 'the date has passed';
  return (
    <p className="notice-warn" role="status">
      {own ? 'You are serving notice.' : 'Serving notice.'} The last working day is <b>{sep.lastWorkingDay}</b> ({when}).
    </p>
  );
}

/** The employee's own way to resign. The request goes to the approval chain; nothing changes until it is approved. */
export function ResignationCard({ employeeId }: { employeeId: string }) {
  const qc = useQueryClient();
  const settings = useCompanySettings();
  const sep = useSeparation(employeeId);
  const send = useAction();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const notice = settings.data?.noticePeriodDays ?? 30;
  const earliest = settings.data ? addDays(settings.data.today, notice) : '';
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);
  const lwd = date || earliest;

  if (sep.isLoading || !settings.data) return <Loading />;
  // Already serving notice, or the exit is finished: nothing to submit.
  if (sep.data && sep.data.status === 'NOTICE') return null;

  const check = (v: string) => {
    const bad = !v ? 'Choose a last working day' : v < earliest ? `The notice period is ${plural(notice, 'day')}, so the earliest date is ${earliest}` : null;
    setDateError(bad);
    return !bad;
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!check(lwd)) return;
    send.run(
      () => api.post('/requests', { type: 'RESIGNATION', payload: { lastWorkingDay: lwd, reason: reason || undefined } }),
      () => { setSent(true); setOpen(false); qc.invalidateQueries(); },
    );
  };

  return (
    <div className="card">
      <h2 style={{ marginBottom: 4 }}>Resignation</h2>
      {sent ? (
        <p className="notice" role="status">Your resignation was sent for approval. You can follow it under Requests, and withdraw it there until it is decided.</p>
      ) : !open ? (
        <>
          <p className="muted" style={{ marginTop: 0 }}>Thinking of leaving? Your notice period is {plural(notice, 'day')}.</p>
          <button className="btn" onClick={() => setOpen(true)}>Resign</button>
        </>
      ) : (
        <form onSubmit={submit}>
          <p className="muted" style={{ marginTop: 0 }}>Your manager approves it first. Nothing changes until it is approved.</p>
          <div className="form-grid">
            <Field label="Last working day" hint={`Earliest: ${earliest} (${plural(notice, 'day')} notice)`}>
              <input type="date" value={lwd} min={earliest} onChange={(e) => { setDate(e.target.value); if (dateError) check(e.target.value); }} onBlur={(e) => check(e.target.value)} aria-invalid={!!dateError} required />
              {dateError && <span className="field-error" role="alert">{dateError}</span>}
            </Field>
            <Field label="Reason (optional)"><input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} /></Field>
          </div>
          <ErrorText>{send.error}</ErrorText>
          <div className="row">
            <button className="btn danger" disabled={send.pending}>{send.pending ? 'Sending…' : 'Submit resignation'}</button>
            <button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

/** HR's view of someone serving notice: what is left to settle, and the buttons to finish or take it back. */
type LeaveLine = Settlement['leave'][number];

/** Final settlement: pay out unused leave, as an earning on a payroll that can still change. HR confirms days and amount. */
function LeavePayoutDialog({ sepId, line, dayValue, perMonth, onClose }: { sepId: string; line: LeaveLine; dayValue: number | null; perMonth: number; onClose: () => void }) {
  const qc = useQueryClient();
  const act = useAction();
  const [days, setDays] = useState(String(line.available));
  const [amount, setAmount] = useState(line.suggestedAmount !== null ? String(line.suggestedAmount) : '');
  const [month, setMonth] = useState('');
  const changeDays = (v: string) => {
    setDays(v);
    if (dayValue !== null && Number(v) > 0) setAmount((Math.round(dayValue * Number(v) * 100) / 100).toString());
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(() => api.post(`/separations/${sepId}/leave-payout`, { leaveTypeId: line.leaveTypeId, days: Number(days), amount: Number(amount), ...(month ? { payMonth: month } : {}) }), () => {
      qc.invalidateQueries(); onClose();
    });
  };
  return (
    <Modal title={`Pay out ${line.type}`} onClose={onClose}>
      {dayValue !== null
        ? <p className="muted" style={{ marginTop: 0 }}>Basic pay divided by {perMonth} gives {money(dayValue)} a day. Change the amount if your policy values a day differently.</p>
        : <p className="muted" style={{ marginTop: 0 }}>There is no salary on record, so there is no suggestion. Enter the amount.</p>}
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Days to pay out" hint={`Up to ${line.available}`}><input type="number" min="0.5" step="0.5" max={line.available} value={days} onChange={(e) => changeDays(e.target.value)} required /></Field>
          <Field label="Amount"><input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
          <Field label="Payroll month (optional)" hint="Left empty: the next payroll that is not yet approved"><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></Field>
        </div>
        <ErrorText>{act.error}</ErrorText>
        <div className="row"><button className="btn primary" disabled={act.pending}>Add to payroll</button><button type="button" className="btn" onClick={onClose}>Cancel</button></div>
      </form>
    </Modal>
  );
}

export function HrExitCard({ sep, name }: { sep: SeparationInfo; name: string }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['settlement', sep.id], queryFn: () => api.get<Settlement>(`/separations/${sep.id}/settlement`) });
  const act = useAction();
  const [paying, setPaying] = useState<LeaveLine | null>(null);
  const refresh = () => qc.invalidateQueries();

  if (sep.status !== 'NOTICE') return null;
  const s = q.data;
  const complete = () => {
    const left = s ? [
      s.owed.expenses.count ? `${plural(s.owed.expenses.count, 'approved expense claim')} (${money(s.owed.expenses.total)}) not yet paid` : '',
      s.owed.payouts.count ? `${plural(s.owed.payouts.count, 'approved leave payout')} (${s.owed.payouts.days} days) not yet paid` : '',
      s.leave.some((l) => l.payable) ? 'unused leave that could still be paid out' : '',
      s.openItems.assets.length ? `${plural(s.openItems.assets.length, 'company asset')} not yet returned` : '',
    ].filter(Boolean) : [];
    const warn = left.length ? `\n\nStill open: ${left.join('; ')}. You can pay these after the exit too.` : '';
    if (!window.confirm(`Complete ${name}'s exit? They will be terminated, their seat is freed and they can no longer sign in.${warn}`)) return;
    act.run(() => api.post(`/separations/${sep.id}/complete`), refresh);
  };
  const withdraw = () => {
    if (!window.confirm(`Withdraw ${name}'s resignation? They stay employed and the approved request is cancelled.`)) return;
    act.run(() => api.post(`/separations/${sep.id}/withdraw`), refresh);
  };

  return (
    <div className="card">
      <h2 style={{ marginBottom: 4 }}>Exit</h2>
      {!s ? <Loading /> : (
        <>
          <dl className="facts">
            <div><dt>Last day</dt><dd>{s.separation.lastWorkingDay} ({s.separation.daysLeft > 0 ? `${plural(s.separation.daysLeft, 'day')} left` : s.separation.daysLeft === 0 ? 'today' : `${plural(-s.separation.daysLeft, 'day')} ago`})</dd></div>
            {s.resignedOn && <div><dt>Resigned on</dt><dd>{s.resignedOn}</dd></div>}
            {sep.reason && <div><dt>Reason</dt><dd>{sep.reason}</dd></div>}
            <div><dt>Final pay</dt><dd>{s.payroll.message}{(s.payroll.state === 'MISSING_FROM_RUN') && <> <Link to="/payroll?tab=adjustments">Add an adjustment</Link></>}</dd></div>
            <div>
              <dt>Unused leave</dt>
              <dd>
                {s.leave.length ? s.leave.map((l) => (
                  <div key={l.leaveTypeId} className="row" style={{ gap: 8 }}>
                    <span>{l.type}: {l.available} day{l.available === 1 ? '' : 's'}{l.payable && l.suggestedAmount !== null ? ` (about ${money(l.suggestedAmount)})` : ''}</span>
                    {l.payable && <button className="btn small" onClick={() => setPaying(l)} aria-label={`Pay out ${l.type}`}>Pay out</button>}
                  </div>
                )) : 'No balances recorded'}
              </dd>
            </div>
            <div>
              <dt>Still to pay</dt>
              <dd>
                {s.owed.expenses.count === 0 && s.owed.payouts.count === 0 ? 'Nothing approved is waiting' : [
                  s.owed.expenses.count ? <span key="e">{plural(s.owed.expenses.count, 'expense claim')} ({money(s.owed.expenses.total)}): <Link to="/expenses">pay under Expenses</Link>. </span> : null,
                  s.owed.payouts.count ? <span key="p">{plural(s.owed.payouts.count, 'leave payout')} ({s.owed.payouts.days} days): <Link to="/leave">arrange under Leave &gt; Payouts</Link>.</span> : null,
                ]}
              </dd>
            </div>
            <div>
              <dt>Open items</dt>
              <dd>
                {s.openItems.pendingRequests === 0 && s.openItems.directReports === 0 && s.openItems.assets.length === 0 ? 'None' : [
                  s.openItems.pendingRequests ? `${plural(s.openItems.pendingRequests, 'pending request')} from them (decide or cancel before completing)` : '',
                  s.openItems.directReports ? `${plural(s.openItems.directReports, 'person')} still report${s.openItems.directReports === 1 ? 's' : ''} to them (reassign a manager)` : '',
                  s.openItems.assets.length ? `still holding ${s.openItems.assets.join(', ')} (take back under Assets)` : '',
                ].filter(Boolean).join('; ')}
              </dd>
            </div>
          </dl>
          <ErrorText>{act.error}</ErrorText>
          <div className="row">
            <button className="btn primary" disabled={!s.canComplete || act.pending} onClick={complete}
              title={s.canComplete ? undefined : s.separation.daysLeft > 0 ? `Available from ${s.separation.lastWorkingDay}` : 'Deal with their pending requests first'}>
              Complete exit
            </button>
            <button className="btn danger" disabled={act.pending} onClick={withdraw}>Withdraw resignation</button>
          </div>
          {paying && <LeavePayoutDialog sepId={sep.id} line={paying} dayValue={s.dayValue} perMonth={s.payDaysPerMonth} onClose={() => setPaying(null)} />}
          {!s.canComplete && <p className="muted" style={{ marginBottom: 0 }}>{s.separation.daysLeft > 0 ? `The exit can be completed from ${s.separation.lastWorkingDay}.` : 'Deal with their pending requests to complete the exit.'}</p>}
        </>
      )}
    </div>
  );
}
