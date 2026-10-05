import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError, downloadFile, uploadFile } from '../api';
import { isHR, useAuth } from '../auth';
import { Badge, Empty, ErrorText, Field, Loading, Tabs, day, useAction } from '../components/ui';
import { HrExitCard, NoticeBanner, ResignationCard, useSeparation } from '../components/ExitPanel';
import { ProbationCard } from '../components/ProbationPanel';
import { OnboardingCard } from '../components/Onboarding';
import { AssetsCard } from './Assets';
import { Employee, EmployeeForm } from './Employees';

// Page pattern: Detail / Record. One employee: who they are, their personal details, their documents.
// What shows depends on who is looking (the server decides): HR and the person themself see everything,
// a manager sees only the work details of a direct report.

interface Profile {
  dateOfBirth: string | null; personalEmail: string | null; personalPhone: string | null;
  address: string | null; city: string | null; country: string | null;
  emergencyName: string | null; emergencyRelation: string | null; emergencyPhone: string | null;
  employmentType: string; workLocation: string | null; restricted: boolean;
}
interface Doc {
  id: string; category: string; title: string; fileName: string; mimeType: string; sizeBytes: number;
  expiresOn: string | null; createdAt: string; canDelete: boolean;
}

const EMPLOYMENT_TYPES = [
  { value: 'FULL_TIME', label: 'Full time' }, { value: 'PART_TIME', label: 'Part time' },
  { value: 'CONTRACT', label: 'Contract' }, { value: 'INTERN', label: 'Intern' },
];
const CATEGORIES = [
  { value: 'ID_PROOF', label: 'ID proof' }, { value: 'ADDRESS_PROOF', label: 'Address proof' },
  { value: 'CONTRACT', label: 'Contract' }, { value: 'CERTIFICATE', label: 'Certificate' }, { value: 'OTHER', label: 'Other' },
];
const label = (list: { value: string; label: string }[], v: string) => list.find((o) => o.value === v)?.label ?? v;
const MAX_BYTES = 5 * 1024 * 1024;
const size = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

function Details({ employeeId, profile, canEdit, hr }: { employeeId: string; profile: Profile; canEdit: boolean; hr: boolean }) {
  const qc = useQueryClient();
  const save = useAction();
  const [saved, setSaved] = useState(false);
  const blank = (v: string | null) => v ?? '';
  const [f, setF] = useState(() => ({
    dateOfBirth: blank(profile.dateOfBirth), personalEmail: blank(profile.personalEmail), personalPhone: blank(profile.personalPhone),
    address: blank(profile.address), city: blank(profile.city), country: blank(profile.country),
    emergencyName: blank(profile.emergencyName), emergencyRelation: blank(profile.emergencyRelation), emergencyPhone: blank(profile.emergencyPhone),
    employmentType: profile.employmentType, workLocation: blank(profile.workLocation),
  }));
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => { setF({ ...f, [k]: e.target.value }); setSaved(false); };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const { employmentType, workLocation, dateOfBirth, ...rest } = f;
    // Empty text means "clear it" (the API turns '' into nothing); an empty date is sent as null.
    const body: Record<string, unknown> = { ...rest, dateOfBirth: dateOfBirth || null };
    if (hr) Object.assign(body, { employmentType, workLocation });
    setSaved(false);
    save.run(() => api.put(`/employees/${employeeId}/profile`, body), () => { setSaved(true); qc.invalidateQueries({ queryKey: ['profile', employeeId] }); });
  };

  const ro = !canEdit;
  return (
    <form className="card" onSubmit={submit}>
      <h2 style={{ marginBottom: 12 }}>Personal details</h2>
      <div className="form-grid">
        <Field label="Date of birth"><input type="date" value={f.dateOfBirth} onChange={set('dateOfBirth')} disabled={ro} max={day(new Date().toISOString())} /></Field>
        <Field label="Personal email"><input type="email" value={f.personalEmail} onChange={set('personalEmail')} disabled={ro} maxLength={200} autoComplete="email" /></Field>
        <Field label="Personal phone"><input type="tel" value={f.personalPhone} onChange={set('personalPhone')} disabled={ro} maxLength={30} autoComplete="tel" /></Field>
        <Field label="Address"><input value={f.address} onChange={set('address')} disabled={ro} maxLength={300} autoComplete="street-address" /></Field>
        <Field label="City"><input value={f.city} onChange={set('city')} disabled={ro} maxLength={100} /></Field>
        <Field label="Country"><input value={f.country} onChange={set('country')} disabled={ro} maxLength={100} /></Field>
      </div>

      <h3 style={{ marginTop: 8 }}>Emergency contact</h3>
      <div className="form-grid">
        <Field label="Name"><input value={f.emergencyName} onChange={set('emergencyName')} disabled={ro} maxLength={100} /></Field>
        <Field label="Relationship"><input value={f.emergencyRelation} onChange={set('emergencyRelation')} disabled={ro} maxLength={50} /></Field>
        <Field label="Phone"><input type="tel" value={f.emergencyPhone} onChange={set('emergencyPhone')} disabled={ro} maxLength={30} /></Field>
      </div>

      <h3 style={{ marginTop: 8 }}>Employment</h3>
      <div className="form-grid">
        <Field label="Employment type" hint={hr ? undefined : 'Set by HR'}>
          <select value={f.employmentType} onChange={set('employmentType')} disabled={!hr}>
            {EMPLOYMENT_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Work location" hint={hr ? undefined : 'Set by HR'}><input value={f.workLocation} onChange={set('workLocation')} disabled={!hr} maxLength={100} /></Field>
      </div>

      <ErrorText>{save.error}</ErrorText>
      {saved && <p className="notice" role="status">Details saved.</p>}
      {canEdit && <button className="btn primary" disabled={save.pending}>{save.pending ? 'Saving…' : 'Save details'}</button>}
    </form>
  );
}

function Documents({ employeeId, hr }: { employeeId: string; hr: boolean }) {
  const qc = useQueryClient();
  const docs = useQuery({ queryKey: ['documents', employeeId], queryFn: () => api.get<Doc[]>(`/employees/${employeeId}/documents`) });
  const up = useAction();
  const act = useAction();
  const fileRef = useRef<HTMLInputElement>(null);
  const [f, setF] = useState({ title: '', category: 'ID_PROOF', expiresOn: '' });
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const today = day(new Date().toISOString());

  const pick = (picked: File | null) => {
    setFile(picked);
    if (!picked) return setFileError(null);
    if (!['application/pdf', 'image/png', 'image/jpeg'].includes(picked.type)) return setFileError('Choose a PDF, PNG or JPEG file');
    if (picked.size > MAX_BYTES) return setFileError('The file is larger than 5 MB. Choose a smaller one.');
    setFileError(null);
    if (!f.title) setF((x) => ({ ...x, title: picked.name.replace(/\.[^.]+$/, '').slice(0, 120) }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!file) return setFileError('Choose a file to upload');
    if (fileError) return;
    const q = new URLSearchParams({ category: f.category, title: f.title, filename: file.name });
    if (f.expiresOn) q.set('expiresOn', f.expiresOn);
    up.run(() => uploadFile(`/employees/${employeeId}/documents?${q}`, file), () => {
      setF({ title: '', category: 'ID_PROOF', expiresOn: '' });
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      qc.invalidateQueries({ queryKey: ['documents', employeeId] });
      qc.invalidateQueries({ queryKey: ['expiring-documents'] });
    });
  };

  const remove = (d: Doc) => {
    if (!window.confirm(`Delete "${d.title}"? The file is removed and cannot be recovered.`)) return;
    act.run(() => api.del(`/employees/${employeeId}/documents/${d.id}`), () => {
      qc.invalidateQueries({ queryKey: ['documents', employeeId] });
      qc.invalidateQueries({ queryKey: ['expiring-documents'] });
    });
  };

  return (
    <>
      <form className="card" onSubmit={submit}>
        <h2 style={{ marginBottom: 12 }}>Add a document</h2>
        <div className="form-grid">
          <Field label="Title"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={120} required /></Field>
          <Field label="Type">
            <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
              {CATEGORIES.filter((c) => hr || c.value !== 'CONTRACT').map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Expires on (optional)" hint="HR is reminded before it expires"><input type="date" value={f.expiresOn} onChange={(e) => setF({ ...f, expiresOn: e.target.value })} /></Field>
          <Field label="File" hint="PDF, PNG or JPEG, up to 5 MB">
            <input ref={fileRef} type="file" accept="application/pdf,image/png,image/jpeg" onChange={(e) => pick(e.target.files?.[0] ?? null)} aria-invalid={!!fileError} />
            {fileError && <span className="field-error" role="alert">{fileError}</span>}
          </Field>
        </div>
        <ErrorText>{up.error}</ErrorText>
        <button className="btn primary" disabled={up.pending}>{up.pending ? 'Uploading…' : 'Upload document'}</button>
      </form>

      <div className="card table-wrap">
        <h2 style={{ marginBottom: 12 }}>Documents</h2>
        <ErrorText>{act.error}</ErrorText>
        {docs.isLoading ? <Loading /> : !docs.data?.length ? <Empty>No documents yet. Add an ID, contract or certificate above.</Empty> : (
          <table>
            <thead><tr><th>Title</th><th>Type</th><th>File</th><th>Expires</th><th>Added</th><th className="actions" /></tr></thead>
            <tbody>
              {docs.data.map((d) => (
                <tr key={d.id}>
                  <td>{d.title}</td>
                  <td>{label(CATEGORIES, d.category)}</td>
                  <td className="muted">{d.fileName} · {size(d.sizeBytes)}</td>
                  <td>
                    {d.expiresOn ? <>{d.expiresOn} {d.expiresOn < today ? <span className="badge bad">expired</span> : d.expiresOn <= day(new Date(Date.now() + 30 * 86_400_000).toISOString()) ? <span className="badge warn">soon</span> : null}</> : <span className="muted">—</span>}
                  </td>
                  <td className="muted">{day(d.createdAt)}</td>
                  <td className="actions">
                    <div className="row">
                      <button className="btn small" onClick={() => act.run(() => downloadFile(`/employees/${employeeId}/documents/${d.id}/file`, d.fileName))}>Download</button>
                      {d.canDelete && <button className="btn small danger" disabled={act.pending} onClick={() => remove(d)}>Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

/** `/profile` is the signed-in person's own record; `/employees/:id` is anyone they are allowed to open. */
export function EmployeeProfile({ own = false }: { own?: boolean }) {
  const { user } = useAuth();
  const params = useParams();
  const hr = isHR(user!.role);
  const me = useQuery({ queryKey: ['employee-me'], enabled: own, retry: false, queryFn: () => api.get<Employee>('/employees/me') });
  const id = own ? me.data?.id : params.id;
  const emp = useQuery({ queryKey: ['employee', id], enabled: !!id, queryFn: () => api.get<Employee>(`/employees/${id}`) });
  const profile = useQuery({ queryKey: ['profile', id], enabled: !!id, queryFn: () => api.get<Profile>(`/employees/${id}/profile`) });
  const separation = useSeparation(id);
  const [tab, setTab] = useState<'details' | 'documents'>('details');
  const [editing, setEditing] = useState(false);
  const qc = useQueryClient();
  useEffect(() => setTab('details'), [id]);

  if (own && me.error instanceof ApiError && me.error.status === 404) {
    return <><h1>My profile</h1><Empty>Your login is not linked to an employee record yet. Ask HR to link it.</Empty></>;
  }
  if (!id || emp.isLoading || profile.isLoading) return <Loading />;
  if (emp.error || profile.error || !emp.data || !profile.data) {
    return <><h1>Employee</h1><p className="error" role="alert">{((emp.error ?? profile.error) as Error | null)?.message ?? 'Could not load this employee.'}</p><Link to="/employees">Back to employees</Link></>;
  }
  const e = emp.data;
  const p = profile.data;
  const isSelf = e.userId === user!.id;
  const restricted = p.restricted;

  return (
    <>
      {!own && <p style={{ margin: '0 0 8px' }}><Link to="/employees" className="foot-link">← {hr ? 'All employees' : 'My team'}</Link></p>}
      <div className="row between">
        <h1 style={{ marginBottom: 4 }}>{e.firstName} {e.lastName}</h1>
        {hr && <button className="btn" onClick={() => setEditing(true)}>Edit employment details</button>}
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        {e.employeeCode} · {e.designation?.title ?? 'No designation'} · {e.department?.name ?? 'No department'} · <Badge value={e.status} />{e.dateOfLeaving && <> · left {day(e.dateOfLeaving)}</>}
      </p>

      {separation.data && <NoticeBanner sep={separation.data} own={isSelf} />}
      <div className="card">
        <dl className="facts" style={{ margin: 0 }}>
          <div><dt>Work email</dt><dd>{e.workEmail}</dd></div>
          {e.phone && <div><dt>Work phone</dt><dd>{e.phone}</dd></div>}
          <div><dt>Joined</dt><dd>{day(e.dateOfJoining)}</dd></div>
          <div><dt>Type</dt><dd>{label(EMPLOYMENT_TYPES, p.employmentType)}</dd></div>
          {p.workLocation && <div><dt>Location</dt><dd>{p.workLocation}</dd></div>}
        </dl>
      </div>

      {hr && separation.data && <HrExitCard sep={separation.data} name={`${e.firstName} ${e.lastName}`} />}
      <OnboardingCard employeeId={e.id} />
      <AssetsCard employeeId={e.id} />
      <ProbationCard employeeId={e.id} name={`${e.firstName} ${e.lastName}`} level={hr ? 'hr' : isSelf ? 'self' : 'manager'} />
      {isSelf && e.status !== 'TERMINATED' && <ResignationCard employeeId={e.id} />}

      {restricted ? (
        <p className="muted">Personal details and documents are private to the employee and HR.</p>
      ) : (
        <>
          <Tabs tabs={[{ id: 'details', label: 'Personal details' }, { id: 'documents', label: 'Documents' }]} value={tab} onChange={setTab} />
          {tab === 'details'
            ? <Details key={e.id} employeeId={e.id} profile={p} canEdit={isSelf || hr} hr={hr} />
            : <Documents employeeId={e.id} hr={hr} />}
        </>
      )}
      {editing && <EmployeeForm employee={e} onClose={() => { setEditing(false); qc.invalidateQueries({ queryKey: ['employee', e.id] }); }} />}
    </>
  );
}
