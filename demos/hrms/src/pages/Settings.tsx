import { FormEvent, ReactNode, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { useAuth } from '../auth';
import { ApprovalFlows } from '../components/ApprovalFlows';
import { BillingTab } from '../components/BillingTab';
import { OnboardingTemplate } from '../components/Onboarding';
import { CompanySettings } from '../components/CompanySettings';
import { useSearchParams } from 'react-router-dom';
import { Badge, Empty, ErrorText, Field, Loading, Tabs, day, useAction } from '../components/ui';

type FieldDef = {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'checkbox' | 'time' | 'date' | 'weekdays' | 'password' | 'email';
  options?: { value: string; label: string }[];
  initial?: unknown;
  hint?: string;
  optional?: boolean;
};

interface Section {
  id: string;
  label: string;
  singular: string;
  listPath: string;
  fields: FieldDef[];
  columns: { header: string; cell: (row: any) => ReactNode }[];
  createPath: string;
  deletePath?: (row: any) => string;
  deleteLabel?: (row: any) => string;
  // Extra per-row button; `done` refreshes the list.
  rowAction?: (row: any, done: () => void) => ReactNode;
  adminOnly?: boolean;
  empty: string;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const year = new Date().getFullYear();

const sections: Section[] = [
  {
    id: 'departments', label: 'Departments', singular: 'department', listPath: '/departments', createPath: '/departments', empty: 'No departments yet.',
    fields: [{ name: 'name', label: 'Name', type: 'text' }],
    columns: [{ header: 'Name', cell: (r) => r.name }],
    deletePath: (r) => `/departments/${r.id}`, deleteLabel: (r) => r.name,
  },
  {
    id: 'designations', label: 'Designations', singular: 'designation', listPath: '/designations', createPath: '/designations', empty: 'No designations yet.',
    fields: [{ name: 'title', label: 'Title', type: 'text' }],
    columns: [{ header: 'Title', cell: (r) => r.title }],
    deletePath: (r) => `/designations/${r.id}`, deleteLabel: (r) => r.title,
  },
  {
    id: 'shifts', label: 'Shifts', singular: 'shift', listPath: '/shifts', createPath: '/shifts', empty: 'No shifts yet. Employees without a shift use Monday–Friday, 09:00–18:00.',
    fields: [
      { name: 'name', label: 'Name', type: 'text' },
      { name: 'startTime', label: 'Starts', type: 'time', initial: '09:00' },
      { name: 'endTime', label: 'Ends', type: 'time', initial: '18:00' },
      { name: 'graceMinutes', label: 'Grace minutes', type: 'number', initial: 10, hint: 'Check-ins within this window are not late' },
      { name: 'workDays', label: 'Work days', type: 'weekdays', initial: [1, 2, 3, 4, 5] },
    ],
    columns: [
      { header: 'Name', cell: (r) => r.name },
      { header: 'Hours', cell: (r) => `${r.startTime}–${r.endTime}` },
      { header: 'Grace', cell: (r) => `${r.graceMinutes} min` },
      { header: 'Days', cell: (r) => (r.workDays as number[]).map((d) => WEEKDAYS[d]).join(' ') },
    ],
    deletePath: (r) => `/shifts/${r.id}`, deleteLabel: (r) => r.name,
  },
  {
    id: 'holidays', label: 'Holidays', singular: 'holiday', listPath: `/holidays?year=${year}`, createPath: '/holidays', empty: `No holidays for ${year}.`,
    fields: [{ name: 'date', label: 'Date', type: 'date' }, { name: 'name', label: 'Name', type: 'text' }],
    columns: [{ header: 'Date', cell: (r) => day(r.date) }, { header: 'Name', cell: (r) => r.name }],
    deletePath: (r) => `/holidays/${r.id}`, deleteLabel: (r) => r.name,
  },
  {
    id: 'leave-types', label: 'Leave types', singular: 'leave type', listPath: '/leave-types', createPath: '/leave-types', empty: 'No leave types yet.',
    fields: [
      { name: 'name', label: 'Name', type: 'text' },
      { name: 'code', label: 'Code', type: 'text', hint: 'Uppercase, e.g. ANNUAL' },
      { name: 'daysPerYear', label: 'Days per year', type: 'number', initial: 20 },
      { name: 'paid', label: 'Paid leave', type: 'checkbox', initial: true },
      { name: 'carryForward', label: 'Carry unused days into next year', type: 'checkbox', initial: false },
      { name: 'maxCarryDays', label: 'Max days carried', type: 'number', initial: 0 },
      { name: 'encashable', label: 'Unused days can be paid out (encashment)', type: 'checkbox', initial: false },
    ],
    columns: [
      { header: 'Name', cell: (r) => `${r.name} (${r.code})` },
      { header: 'Days/year', cell: (r) => Number(r.daysPerYear) },
      { header: 'Paid', cell: (r) => (r.paid ? 'Yes' : 'No') },
      { header: 'Carry forward', cell: (r) => (r.carryForward ? `up to ${Number(r.maxCarryDays)}` : 'No') },
      { header: 'Payout', cell: (r) => (r.encashable ? 'Yes' : 'No') },
    ],
    deletePath: (r) => `/leave-types/${r.id}`, deleteLabel: (r) => r.name,
  },
  {
    id: 'components', label: 'Salary components', singular: 'salary component', listPath: '/payroll/components', createPath: '/payroll/components', empty: 'No salary components yet.',
    fields: [
      { name: 'name', label: 'Name', type: 'text' },
      { name: 'code', label: 'Code', type: 'text', hint: 'Uppercase, e.g. HRA' },
      { name: 'type', label: 'Type', type: 'select', initial: 'EARNING', options: [{ value: 'EARNING', label: 'Earning' }, { value: 'DEDUCTION', label: 'Deduction' }] },
      { name: 'calcType', label: 'Calculated as', type: 'select', initial: 'FIXED', options: [{ value: 'FIXED', label: 'Fixed amount' }, { value: 'PERCENT_OF_BASIC', label: '% of basic pay' }] },
    ],
    columns: [
      { header: 'Name', cell: (r) => `${r.name} (${r.code})` },
      { header: 'Type', cell: (r) => <Badge value={r.type === 'EARNING' ? 'ACTIVE' : 'PENDING'} /> },
      { header: 'Calculated as', cell: (r) => (r.calcType === 'FIXED' ? 'Fixed amount' : '% of basic') },
    ],
    deletePath: (r) => `/payroll/components/${r.id}`, deleteLabel: (r) => r.name,
  },
  {
    id: 'users', label: 'Users', singular: 'user', listPath: '/users', createPath: '/users', empty: 'No users.', adminOnly: true,
    fields: [
      { name: 'email', label: 'Email', type: 'email' },
      {
        name: 'password', label: 'Password', type: 'password', optional: true,
        hint: 'Leave blank to email them an invitation so they choose their own',
      },
      {
        name: 'role', label: 'Role', type: 'select', initial: 'EMPLOYEE',
        options: [
          { value: 'EMPLOYEE', label: 'Employee' }, { value: 'MANAGER', label: 'Manager' },
          { value: 'HR', label: 'HR' }, { value: 'ADMIN', label: 'Admin' },
        ],
      },
    ],
    columns: [
      { header: 'Email', cell: (r) => r.email },
      { header: 'Role', cell: (r) => r.role.toLowerCase() },
      { header: 'Last sign-in', cell: (r) => (r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleDateString() : <span className="muted">Never</span>) },
    ],
    // Only people who have never signed in can be re-invited; everyone else uses "Forgot password".
    rowAction: (row, done) => (row.lastLoginAt ? null : <ResendInvite id={row.id} onDone={done} />),
  },
];

function ResendInvite({ id, onDone }: { id: string; onDone: () => void }) {
  const { run, pending, error } = useAction();
  const [sent, setSent] = useState(false);
  return (
    <>
      <button className="btn small" disabled={pending || sent} onClick={() => run(() => api.post(`/users/${id}/resend-invite`), () => { setSent(true); onDone(); })}>
        {sent ? 'Invitation sent' : 'Resend invite'}
      </button>
      {error && <span className="error" role="alert"> {error}</span>}
    </>
  );
}

const initialValues = (s: Section) => Object.fromEntries(s.fields.map((f) => [f.name, f.initial ?? (f.type === 'checkbox' ? false : '')]));

function SectionView({ section }: { section: Section }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['settings', section.id], queryFn: () => api.get<any[]>(section.listPath) });
  const create = useAction();
  const del = useAction();
  const [values, setValues] = useState<Record<string, any>>(initialValues(section));
  const [notice, setNotice] = useState<string | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body: Record<string, unknown> = {};
    for (const f of section.fields) {
      const v = values[f.name];
      if (f.type === 'number') body[f.name] = Number(v);
      else if (v === '' && f.optional) continue;
      else body[f.name] = v;
    }
    setNotice(null);
    create.run(async () => {
      const created = await api.post<{ invited?: boolean; email?: string }>(section.createPath, body);
      if (created?.invited) setNotice(`An invitation was emailed to ${created.email}. It works once and expires in 7 days.`);
    }, () => {
      setValues(initialValues(section));
      qc.invalidateQueries({ queryKey: ['settings', section.id] });
      qc.invalidateQueries({ queryKey: [section.id] });
    });
  };

  const remove = (row: any) => {
    if (!window.confirm(`Delete ${section.deleteLabel?.(row) ?? 'this item'}?`)) return;
    del.run(() => api.del(section.deletePath!(row)), () => qc.invalidateQueries({ queryKey: ['settings', section.id] }));
  };

  return (
    <>
      <form className="card" onSubmit={submit}>
        <h2 style={{ marginBottom: 12 }}>Add {section.singular}</h2>
        <div className="form-grid">
          {section.fields.map((f) => {
            const set = (v: unknown) => setValues({ ...values, [f.name]: v });
            if (f.type === 'checkbox') {
              return (
                <label className="check" key={f.name}>
                  <input type="checkbox" checked={!!values[f.name]} onChange={(e) => set(e.target.checked)} /> {f.label}
                </label>
              );
            }
            if (f.type === 'weekdays') {
              return (
                <Field label={f.label} key={f.name}>
                  <div className="weekdays">
                    {WEEKDAYS.map((d, i) => (
                      <label key={d}>
                        <input
                          type="checkbox"
                          checked={(values[f.name] as number[]).includes(i)}
                          onChange={(e) => set(e.target.checked ? [...values[f.name], i] : (values[f.name] as number[]).filter((x) => x !== i))}
                        />
                        {d}
                      </label>
                    ))}
                  </div>
                </Field>
              );
            }
            return (
              <Field label={f.label} hint={f.hint} key={f.name}>
                {f.type === 'select' ? (
                  <select value={values[f.name]} onChange={(e) => set(e.target.value)}>
                    {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.type}
                    value={values[f.name]}
                    onChange={(e) => set(f.name === 'code' ? e.target.value.toUpperCase() : e.target.value)}
                    required={!f.optional}
                    step={f.type === 'number' ? 'any' : undefined}
                    min={f.type === 'number' ? 0 : undefined}
                    autoComplete={f.type === 'password' ? 'new-password' : undefined}
                  />
                )}
              </Field>
            );
          })}
        </div>
        <ErrorText>{create.error}</ErrorText>
        {notice && <p className="notice" role="status">{notice}</p>}
        <button className="btn primary" disabled={create.pending}>{create.pending ? 'Adding…' : `Add`}</button>
      </form>

      <div className="card table-wrap">
        <ErrorText>{del.error}</ErrorText>
        {q.isLoading ? <Loading /> : q.error ? <p className="error">{(q.error as Error).message}</p> : !q.data?.length ? <Empty>{section.empty}</Empty> : (
          <table>
            <thead><tr>{section.columns.map((c) => <th key={c.header}>{c.header}</th>)}{section.rowAction && <th />}{section.deletePath && <th />}</tr></thead>
            <tbody>
              {q.data.map((row) => (
                <tr key={row.id}>
                  {section.columns.map((c) => <td key={c.header}>{c.cell(row)}</td>)}
                  {section.rowAction && <td>{section.rowAction(row, () => qc.invalidateQueries({ queryKey: ['settings', section.id] }))}</td>}
                  {section.deletePath && (
                    <td><button className="btn small danger" disabled={del.pending} onClick={() => remove(row)}>Delete</button></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

export function Settings() {
  const { user } = useAuth();
  const visible = sections.filter((s) => !s.adminOnly || user!.role === 'ADMIN');
  const [params] = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') === 'billing' && user!.role === 'ADMIN' ? 'billing' : 'company');
  // Approval flows is a custom tab (not a simple list), and only administrators may change them.
  const tabs = [
    { id: 'company', label: 'Company' },
    ...visible.map((s) => ({ id: s.id, label: s.label })),
    { id: 'onboarding', label: 'Onboarding' },
    ...(user!.role === 'ADMIN' ? [{ id: 'flows', label: 'Approval flows' }, { id: 'billing', label: 'Billing' }] : []),
  ];
  const section = visible.find((s) => s.id === tab);
  return (
    <>
      <h1>Settings</h1>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'company' ? <CompanySettings /> : tab === 'onboarding' ? <OnboardingTemplate /> : tab === 'billing' && user!.role === 'ADMIN' ? <BillingTab /> : tab === 'flows' && user!.role === 'ADMIN' ? <ApprovalFlows /> : <SectionView key={(section ?? visible[0]).id} section={section ?? visible[0]} />}
    </>
  );
}
