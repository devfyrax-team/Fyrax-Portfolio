import { FormEvent, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../auth';
import { ErrorText, Field, Loading, useAction } from './ui';

export interface CompanySettingsData {
  name: string;
  slug: string;
  timezone: string;
  fiscalYearStartMonth: number;
  backdateWindowDays: number;
  noticePeriodDays: number;
  probationMonths: number;
  today: string;
  leaveYear: { year: number; start: string; end: string };
  fiscalYearLocked: boolean;
}

/** The company's settings, shared by every screen that words a hint with them. */
export const useCompanySettings = () =>
  useQuery({ queryKey: ['company-settings'], queryFn: () => api.get<CompanySettingsData>('/company/settings'), staleTime: 60_000 });

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const timezones = (): string[] => {
  try {
    return (Intl as any).supportedValuesOf('timeZone');
  } catch {
    return ['UTC'];
  }
};

const longDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function CompanySettings() {
  const { user } = useAuth();
  const canEdit = user!.role === 'ADMIN';
  const qc = useQueryClient();
  const q = useCompanySettings();
  const save = useAction();
  const [f, setF] = useState({ timezone: 'UTC', fiscalYearStartMonth: 1, backdateWindowDays: '31', noticePeriodDays: '30', probationMonths: '3' });
  const [saved, setSaved] = useState(false);
  const [windowError, setWindowError] = useState<string | null>(null);
  const [noticeError, setNoticeError] = useState<string | null>(null);
  const [probationError, setProbationError] = useState<string | null>(null);
  const checkProbation = (v: string) => {
    const n = Number(v);
    const bad = v === '' || !Number.isInteger(n) || n < 0 || n > 12 ? 'Enter a whole number of months from 0 to 12' : null;
    setProbationError(bad);
    return !bad;
  };
  const checkNotice = (v: string) => {
    const n = Number(v);
    const bad = v === '' || !Number.isInteger(n) || n < 0 || n > 365 ? 'Enter a whole number of days from 0 to 365' : null;
    setNoticeError(bad);
    return !bad;
  };

  useEffect(() => {
    if (q.data) setF({ timezone: q.data.timezone, fiscalYearStartMonth: q.data.fiscalYearStartMonth, backdateWindowDays: String(q.data.backdateWindowDays), noticePeriodDays: String(q.data.noticePeriodDays), probationMonths: String(q.data.probationMonths) });
  }, [q.data]);

  if (q.isLoading || !q.data) return <Loading />;
  const s = q.data;
  const zones = timezones();
  const zoneOptions = zones.includes(f.timezone) ? zones : [f.timezone, ...zones];

  const checkWindow = (v: string) => {
    const n = Number(v);
    const bad = !Number.isInteger(n) || n < 1 || n > 366 ? 'Enter a whole number of days from 1 to 366' : null;
    setWindowError(bad);
    return !bad;
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!checkWindow(f.backdateWindowDays) || !checkNotice(f.noticePeriodDays) || !checkProbation(f.probationMonths)) return;
    setSaved(false);
    save.run(
      () => api.put('/company/settings', { ...f, backdateWindowDays: Number(f.backdateWindowDays), noticePeriodDays: Number(f.noticePeriodDays), probationMonths: Number(f.probationMonths) }),
      () => { setSaved(true); qc.invalidateQueries(); },
    );
  };

  return (
    <form className="card" onSubmit={submit}>
      <h2 style={{ marginBottom: 4 }}>{s.name}</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        {canEdit ? 'These settings apply to everyone in the company.' : 'Only an administrator can change these settings.'}
      </p>

      <div className="form-grid">
        <Field label="Time zone" hint={`Used for check-in times, "today" and payroll cut-offs. It is ${s.today} here now.`}>
          <select value={f.timezone} disabled={!canEdit} onChange={(e) => { setF({ ...f, timezone: e.target.value }); setSaved(false); }}>
            {zoneOptions.map((z) => <option key={z} value={z}>{z}</option>)}
          </select>
        </Field>

        <Field
          label="Financial year starts in"
          hint={s.fiscalYearLocked
            ? 'Locked: leave balances already exist, and they are kept per leave year.'
            : 'Leave allowances and balances run for twelve months from this month.'}
        >
          <select
            value={f.fiscalYearStartMonth}
            disabled={!canEdit || s.fiscalYearLocked}
            onChange={(e) => { setF({ ...f, fiscalYearStartMonth: Number(e.target.value) }); setSaved(false); }}
          >
            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </Field>

        <Field label="Request back-dating window (days)" hint="How far back people may ask to correct attendance or log work done outside the office.">
          <input
            type="number" inputMode="numeric" min={1} max={366} step={1}
            value={f.backdateWindowDays} disabled={!canEdit}
            onChange={(e) => { setF({ ...f, backdateWindowDays: e.target.value }); setSaved(false); if (windowError) checkWindow(e.target.value); }}
            onBlur={(e) => checkWindow(e.target.value)}
            aria-invalid={!!windowError}
          />
          {windowError && <span className="field-error" role="alert">{windowError}</span>}
        </Field>
        <Field label="Notice period (days)" hint="The earliest last working day an employee can name when they resign is today plus this.">
          <input
            type="number" inputMode="numeric" min={0} max={365} step={1}
            value={f.noticePeriodDays} disabled={!canEdit}
            onChange={(e) => { setF({ ...f, noticePeriodDays: e.target.value }); setSaved(false); if (noticeError) checkNotice(e.target.value); }}
            onBlur={(e) => checkNotice(e.target.value)}
            aria-invalid={!!noticeError}
          />
          {noticeError && <span className="field-error" role="alert">{noticeError}</span>}
        </Field>
        <Field label="Probation (months)" hint="How long new joiners are on probation. 0 means no probation. Applies to people added from now on.">
          <input
            type="number" inputMode="numeric" min={0} max={12} step={1}
            value={f.probationMonths} disabled={!canEdit}
            onChange={(e) => { setF({ ...f, probationMonths: e.target.value }); setSaved(false); if (probationError) checkProbation(e.target.value); }}
            onBlur={(e) => checkProbation(e.target.value)}
            aria-invalid={!!probationError}
          />
          {probationError && <span className="field-error" role="alert">{probationError}</span>}
        </Field>
      </div>

      <p className="muted">
        Current leave year: <strong>{longDate(s.leaveYear.start)}</strong> to <strong>{longDate(s.leaveYear.end)}</strong>.
      </p>

      <ErrorText>{save.error}</ErrorText>
      {saved && <p className="notice" role="status">Settings saved.</p>}
      {canEdit && <button className="btn primary" disabled={save.pending}>{save.pending ? 'Saving…' : 'Save settings'}</button>}
    </form>
  );
}
