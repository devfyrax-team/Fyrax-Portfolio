import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ProbationReviews } from '../components/ProbationPanel';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, downloadFile, postText } from '../api';
import { isHR, useAuth } from '../auth';
import { Badge, Empty, ErrorText, Field, Loading, Modal, Pager, day, useAction } from '../components/ui';

export interface Employee {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  workEmail: string;
  phone: string | null;
  dateOfJoining: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'TERMINATED';
  dateOfLeaving?: string | null;
  departmentId: string | null;
  designationId: string | null;
  managerId: string | null;
  shiftId: string | null;
  userId: string | null;
  department: { name: string } | null;
  designation: { title: string } | null;
}
interface Named { id: string; name: string }

const emptyForm = {
  employeeCode: '', firstName: '', lastName: '', workEmail: '', phone: '', dateOfJoining: '', status: 'ACTIVE',
  departmentId: '', designationId: '', shiftId: '', managerId: '', userId: '',
};
type Form = typeof emptyForm;

export function EmployeeForm({ employee, onClose }: { employee: Employee | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { run, pending, error } = useAction();
  const [f, setF] = useState<Form>(
    employee
      ? {
          employeeCode: employee.employeeCode, firstName: employee.firstName, lastName: employee.lastName,
          workEmail: employee.workEmail, phone: employee.phone ?? '', dateOfJoining: day(employee.dateOfJoining),
          status: employee.status, departmentId: employee.departmentId ?? '', designationId: employee.designationId ?? '',
          shiftId: employee.shiftId ?? '', managerId: employee.managerId ?? '', userId: employee.userId ?? '',
        }
      : emptyForm,
  );
  const set = (k: keyof Form) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const depts = useQuery({ queryKey: ['departments'], queryFn: () => api.get<Named[]>('/departments') });
  const desigs = useQuery({ queryKey: ['designations'], queryFn: () => api.get<{ id: string; title: string }[]>('/designations') });
  const shifts = useQuery({ queryKey: ['shifts'], queryFn: () => api.get<Named[]>('/shifts') });
  const people = useQuery({
    queryKey: ['org-chart'],
    queryFn: () => api.get<{ id: string; firstName: string; lastName: string }[]>('/employees/org-chart'),
  });
  const users = useQuery({ queryKey: ['users'], queryFn: () => api.get<{ id: string; email: string }[]>('/users') });

  const save = (e: FormEvent) => {
    e.preventDefault();
    const nullable = (v: string) => (v === '' ? null : v);
    const body = {
      employeeCode: f.employeeCode, firstName: f.firstName, lastName: f.lastName, workEmail: f.workEmail,
      phone: f.phone || undefined, dateOfJoining: f.dateOfJoining,
      ...(employee ? { status: f.status } : {}),
      departmentId: nullable(f.departmentId), designationId: nullable(f.designationId), shiftId: nullable(f.shiftId),
      managerId: nullable(f.managerId), userId: nullable(f.userId),
    };
    run(
      () => (employee ? api.patch(`/employees/${employee.id}`, body) : api.post('/employees', body)),
      () => { qc.invalidateQueries(); onClose(); },
    );
  };

  const terminate = () => {
    if (!employee || !window.confirm(`Terminate ${employee.firstName} ${employee.lastName}? They will lose access to payroll runs and check-in.`)) return;
    run(() => api.del(`/employees/${employee.id}`), () => { qc.invalidateQueries(); onClose(); });
  };

  return (
    <Modal title={employee ? `Edit ${employee.firstName} ${employee.lastName}` : 'Add employee'} onClose={onClose}>
      <form onSubmit={save}>
        <div className="form-grid">
          <Field label="Employee code"><input value={f.employeeCode} onChange={set('employeeCode')} required /></Field>
          <Field label="Work email"><input type="email" value={f.workEmail} onChange={set('workEmail')} required /></Field>
          <Field label="First name"><input value={f.firstName} onChange={set('firstName')} required /></Field>
          <Field label="Last name"><input value={f.lastName} onChange={set('lastName')} required /></Field>
          <Field label="Phone"><input value={f.phone} onChange={set('phone')} /></Field>
          <Field label="Date of joining"><input type="date" value={f.dateOfJoining} onChange={set('dateOfJoining')} required /></Field>
          <Field label="Department">
            <select value={f.departmentId} onChange={set('departmentId')}>
              <option value="">None</option>
              {depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Designation">
            <select value={f.designationId} onChange={set('designationId')}>
              <option value="">None</option>
              {desigs.data?.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}
            </select>
          </Field>
          <Field label="Shift" hint="No shift means Monday–Friday, 09:00–18:00">
            <select value={f.shiftId} onChange={set('shiftId')}>
              <option value="">Default</option>
              {shifts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </Field>
          <Field label="Manager">
            <select value={f.managerId} onChange={set('managerId')}>
              <option value="">None</option>
              {people.data?.filter((p) => p.id !== employee?.id).map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
            </select>
          </Field>
          <Field label="Login account" hint="Lets this person sign in, check in and see payslips">
            <select value={f.userId} onChange={set('userId')}>
              <option value="">Not linked</option>
              {users.data?.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
            </select>
          </Field>
          {employee && (
            <Field label="Status">
              <select value={f.status} onChange={set('status')}>
                <option value="ACTIVE">Active</option>
                <option value="ON_LEAVE">On leave</option>
                <option value="TERMINATED">Terminated</option>
              </select>
            </Field>
          )}
        </div>
        <ErrorText>{error}</ErrorText>
        <div className="row between">
          <div className="row">
            <button className="btn primary" disabled={pending}>{pending ? 'Saving…' : employee ? 'Save changes' : 'Add employee'}</button>
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
          </div>
          {employee && employee.status !== 'TERMINATED' && (
            <button type="button" className="btn danger" onClick={terminate} disabled={pending}>Terminate employee</button>
          )}
        </div>
      </form>
    </Modal>
  );
}

/** HR's reminder: documents that have expired or expire within 60 days. Shown only when there are some. */
function ExpiringDocuments() {
  const q = useQuery({
    queryKey: ['expiring-documents'],
    queryFn: () => api.get<{ id: string; title: string; expiresOn: string; daysLeft: number; employee: { id: string; employeeCode: string; firstName: string; lastName: string } }[]>('/employees/documents/expiring'),
  });
  if (!q.data?.length) return null;
  return (
    <div className="card table-wrap">
      <h2 style={{ marginBottom: 4 }}>Documents needing attention</h2>
      <p className="muted" style={{ marginTop: 0 }}>Expired or expiring within 60 days.</p>
      <table>
        <thead><tr><th>Employee</th><th>Document</th><th>Expires</th></tr></thead>
        <tbody>
          {q.data.map((d) => (
            <tr key={d.id}>
              <td><Link to={`/employees/${d.employee.id}`}>{d.employee.firstName} {d.employee.lastName}</Link> <span className="muted">{d.employee.employeeCode}</span></td>
              <td>{d.title}</td>
              <td>{d.expiresOn} {d.daysLeft < 0 ? <span className="badge bad">expired {-d.daysLeft} days ago</span> : <span className="badge warn">in {d.daysLeft} days</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** HR's list of people serving notice. Shown only when someone is. */
function OnNotice() {
  const q = useQuery({
    queryKey: ['separations', 'NOTICE'],
    queryFn: () => api.get<{ id: string; lastWorkingDay: string; daysLeft: number; employee: { id: string; employeeCode: string; firstName: string; lastName: string } }[]>('/separations'),
  });
  if (!q.data?.length) return null;
  return (
    <div className="card table-wrap">
      <h2 style={{ marginBottom: 4 }}>Serving notice</h2>
      <p className="muted" style={{ marginTop: 0 }}>Open a person to complete their exit on the last working day.</p>
      <table>
        <thead><tr><th>Employee</th><th>Last working day</th></tr></thead>
        <tbody>
          {q.data.map((s) => (
            <tr key={s.id}>
              <td><Link to={`/employees/${s.employee.id}`}>{s.employee.firstName} {s.employee.lastName}</Link> <span className="muted">{s.employee.employeeCode}</span></td>
              <td>{s.lastWorkingDay} {s.daysLeft <= 0 ? <span className="badge warn">{s.daysLeft === 0 ? 'today' : 'due'}</span> : <span className="badge">in {s.daysLeft} days</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface ImportReport {
  fileErrors: string[]; ignoredColumns: string[]; newDepartments: string[]; newDesignations: string[];
  total: number; valid: number; invalid: number; clean: boolean; committed: boolean; created?: number; error?: string;
  rows: { line: number; employeeCode: string; name: string; workEmail: string; department: string | null; managerCode: string | null; errors: string[] }[];
}

/** Employees > Import from CSV: check a file first, see every problem by line, import only when it is clean. */
function ImportDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const act = useAction();
  const [text, setText] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [createMissing, setCreateMissing] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  const query = (commit: boolean) => `?${commit ? 'commit=1&' : ''}${createMissing ? 'createMissing=1' : ''}`;
  const check = (t: string | null = text) => { if (t !== null) act.run(async () => setReport(await postText<ImportReport>(`/import/employees${query(false)}`, t))); };
  const pick = async (file: File | undefined) => {
    setReport(null);
    if (!file) { setText(null); return; }
    const t = await file.text();
    setText(t); setName(file.name);
    act.run(async () => setReport(await postText<ImportReport>(`/import/employees${query(false)}`, t)));
  };
  const doImport = () => {
    if (text === null) return;
    act.run(async () => {
      const r = await postText<ImportReport>(`/import/employees${query(true)}`, text);
      setReport(r);
      if (r.committed) { qc.invalidateQueries({ queryKey: ['employees'] }); qc.invalidateQueries({ queryKey: ['seats'] }); }
    });
  };
  const bad = report?.rows.filter((r) => r.errors.length) ?? [];

  return (
    <Modal title="Import employees from CSV" onClose={onClose}>
      {report?.committed ? (
        <>
          <p role="status" className="notice">Imported {report.created} employee{report.created === 1 ? '' : 's'}.</p>
          <button className="btn primary" onClick={onClose}>Done</button>
        </>
      ) : (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            One employee per row. Required columns: employeeCode, firstName, lastName, workEmail, dateOfJoining (YYYY-MM-DD). Optional: phone, department, designation, managerCode, status.{' '}
            <button type="button" className="btn small" onClick={() => downloadFile('/import/employees/template', 'employees-template.csv')}>Download a template</button>
          </p>
          <Field label="CSV file" hint="At most 500 rows. The file is checked first; nothing is imported until it has no problems."><input type="file" accept=".csv,text/csv" onChange={(e) => pick(e.target.files?.[0])} /></Field>
          <label className="check"><input type="checkbox" checked={createMissing} onChange={(e) => { setCreateMissing(e.target.checked); setReport(null); }} /> Create departments and designations that do not exist yet</label>
          {text !== null && !report && <button type="button" className="btn" disabled={act.pending} onClick={() => check()}>Check the file</button>}
          <ErrorText>{act.error}</ErrorText>
          {report && (
            <div style={{ marginTop: 8 }}>
              {report.fileErrors.map((e) => <p key={e} className="notice-warn" role="alert">{e}</p>)}
              {report.rows.length > 0 && (
                <p role="status" style={{ margin: '8px 0' }}>
                  <b>{name}</b>: {report.total} row{report.total === 1 ? '' : 's'}, {report.valid} fine{report.invalid ? `, ${report.invalid} with problems` : ''}.
                  {report.clean && (report.newDepartments.length || report.newDesignations.length) ? ` Will also create: ${[...report.newDepartments, ...report.newDesignations].join(', ')}.` : ''}
                </p>
              )}
              {report.ignoredColumns.length > 0 && <p className="muted">Ignored columns: {report.ignoredColumns.join(', ')}</p>}
              {bad.length > 0 && (
                <table>
                  <thead><tr><th>Line</th><th>Employee</th><th>Problem</th></tr></thead>
                  <tbody>{bad.slice(0, 100).map((r) => <tr key={r.line}><td>{r.line}</td><td>{r.employeeCode || r.name}</td><td>{r.errors.join('; ')}</td></tr>)}</tbody>
                </table>
              )}
              {bad.length > 100 && <p className="muted">And {bad.length - 100} more rows with problems.</p>}
              {report.error && <ErrorText>{report.error}</ErrorText>}
              {report.clean && (
                <div className="row" style={{ marginTop: 8 }}>
                  <button className="btn primary" disabled={act.pending} onClick={doImport}>Import {report.total} employee{report.total === 1 ? '' : 's'}</button>
                  <button className="btn" onClick={onClose}>Cancel</button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

export function Employees() {
  const { user } = useAuth();
  const hr = isHR(user!.role);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Employee | 'new' | null>(null);
  const [importing, setImporting] = useState(false);
  const navigate = useNavigate();

  // Seats the company has bought, and how many are in use (an employee who is not terminated uses one).
  const seats = useQuery({ queryKey: ['seats'], enabled: hr, queryFn: () => api.get<{ used: number; limit: number }>('/company/seats') });
  const full = !!seats.data && seats.data.used >= seats.data.limit;
  const left = seats.data ? seats.data.limit - seats.data.used : null;

  const list = useQuery({
    queryKey: ['employees', q, status, page],
    queryFn: () => {
      const p = new URLSearchParams({ page: String(page) });
      if (q) p.set('q', q);
      if (status) p.set('status', status);
      return api.get<{ total: number; page: number; pageSize: number; items: Employee[] }>(`/employees?${p}`);
    },
  });

  return (
    <>
      <div className="row between">
        <h1>{hr ? 'Employees' : 'My team'}</h1>
        {hr && (
          <button
            className="btn primary"
            disabled={full}
            title={full ? 'All seats are in use. Contact the platform provider to add more.' : undefined}
            onClick={() => setEditing('new')}
          >
            Add employee
          </button>
        )}
        {hr && <button className="btn" onClick={() => setImporting(true)}>Import from CSV</button>}
      </div>
      {hr && seats.data && (
        <p className={full ? 'error' : left !== null && left <= Math.max(1, seats.data.limit * 0.1) ? 'notice-warn' : 'muted'} role={full ? 'alert' : undefined} style={{ marginTop: 0 }}>
          Seats: <b>{seats.data.used}</b> of <b>{seats.data.limit}</b> in use
          {full
            ? '. Every seat is used, so you cannot add or reinstate employees. Contact the platform provider to add more seats.'
            : left !== null && left <= Math.max(1, seats.data.limit * 0.1)
              ? `. Only ${left} left.`
              : `. ${left} left.`}
          <span className="muted"> Terminating an employee frees their seat.</span>
        </p>
      )}
      <ProbationReviews />
      {hr && <OnNotice />}
      {hr && <ExpiringDocuments />}
      <div className="row" style={{ marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <Field label="Search"><input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Name or employee code" /></Field>
        </div>
        <Field label="Status">
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="ON_LEAVE">On leave</option>
            <option value="TERMINATED">Terminated</option>
          </select>
        </Field>
      </div>
      <div className="card">
        {list.isLoading ? <Loading /> : list.error ? <p className="error">{(list.error as Error).message}</p> : !list.data?.items.length ? (
          <Empty>{q || status ? 'No employees match these filters.' : hr ? 'No employees yet. Add the first one.' : 'No employees are assigned to you yet. HR sets who reports to you.'}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Name</th><th>Department</th><th>Designation</th><th>Joined</th><th>Status</th></tr></thead>
              <tbody>
                {list.data.items.map((e) => (
                  <tr key={e.id} className="clickable" onClick={() => navigate(`/employees/${e.id}`)}>
                    <td>{e.employeeCode}</td>
                    <td>{e.firstName} {e.lastName}<div className="muted">{e.workEmail}</div></td>
                    <td>{e.department?.name ?? '—'}</td>
                    <td>{e.designation?.title ?? '—'}</td>
                    <td>{day(e.dateOfJoining)}</td>
                    <td><Badge value={e.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {list.data && <Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} />}
      </div>
      {importing && <ImportDialog onClose={() => setImporting(false)} />}
      {editing && <EmployeeForm employee={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}
