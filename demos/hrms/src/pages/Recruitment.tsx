import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, downloadFile, uploadFile } from '../api';
import { isHR, useAuth } from '../auth';
import { Badge, Empty, ErrorText, Field, Loading, Modal, day, dateNow, useAction } from '../components/ui';

// Page pattern: List + Detail. Openings, the pipeline of candidates for one opening, and one candidate with the
// interview feedback. HR runs the process; the hiring manager of an opening reads candidates and leaves feedback.

const STAGES = ['APPLIED', 'SCREENING', 'INTERVIEW', 'OFFER'] as const;
const STAGE_LABEL: Record<string, string> = { APPLIED: 'Applied', SCREENING: 'Screening', INTERVIEW: 'Interview', OFFER: 'Offer', HIRED: 'Hired', REJECTED: 'Rejected', WITHDRAWN: 'Withdrawn' };

interface OpeningRow {
  id: string; title: string; status: string; headcount: number; location: string | null; hiringManager: string | null;
  counts: Record<string, number>; inPipeline: number; hired: number;
}
interface Candidate {
  id: string; firstName: string; lastName: string; email: string; source: string | null; stage: string; stageChangedAt: string; feedbackCount: number; averageRating: number | null;
}
interface OpeningDetail {
  id: string; title: string; description: string | null; location: string | null; departmentId: string | null; designationId: string | null; hiringManagerId: string | null;
  headcount: number; status: string; canManage: boolean; candidates: Candidate[];
}
interface CandidateDetail {
  id: string; firstName: string; lastName: string; email: string; phone: string | null; source: string | null; stage: string; rejectionReason: string | null; hiredEmployeeId: string | null;
  opening: { id: string; title: string; status: string }; canManage: boolean; canNote: boolean;
  documents: { id: string; fileName: string; sizeBytes: number }[];
  notes: { id: string; kind: 'NOTE' | 'STAGE'; body: string; rating: number | null; createdAt: string; by: string | null }[];
}
interface Lookup { id: string; name: string }
interface Person { id: string; employeeCode: string; firstName: string; lastName: string }

const refreshAll = (qc: ReturnType<typeof useQueryClient>) => { qc.invalidateQueries({ queryKey: ['openings'] }); qc.invalidateQueries({ queryKey: ['opening'] }); qc.invalidateQueries({ queryKey: ['candidate'] }); };

function OpeningForm({ initial, onClose }: { initial?: OpeningDetail; onClose: () => void }) {
  const qc = useQueryClient();
  const act = useAction();
  const depts = useQuery({ queryKey: ['departments'], queryFn: () => api.get<Lookup[]>('/departments') });
  const desigs = useQuery({ queryKey: ['designations'], queryFn: () => api.get<{ id: string; title: string }[]>('/designations') });
  const people = useQuery({ queryKey: ['employees', 'for-recruitment'], queryFn: () => api.get<{ items: Person[] }>('/employees?pageSize=100') });
  const [f, setF] = useState({
    title: initial?.title ?? '', description: initial?.description ?? '', location: initial?.location ?? '', departmentId: initial?.departmentId ?? '',
    designationId: initial?.designationId ?? '', hiringManagerId: initial?.hiringManagerId ?? '', headcount: String(initial?.headcount ?? 1),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const body = {
      title: f.title, description: f.description || undefined, location: f.location || undefined, headcount: Number(f.headcount),
      departmentId: f.departmentId || null, designationId: f.designationId || null, hiringManagerId: f.hiringManagerId || null,
    };
    act.run(() => (initial ? api.patch(`/recruitment/openings/${initial.id}`, body) : api.post('/recruitment/openings', body)), () => { refreshAll(qc); onClose(); });
  };
  return (
    <Modal title={initial ? 'Edit opening' : 'New opening'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Job title"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} minLength={3} maxLength={120} required /></Field>
          <Field label="Positions to fill"><input type="number" min={1} max={500} value={f.headcount} onChange={(e) => setF({ ...f, headcount: e.target.value })} required /></Field>
          <Field label="Department"><select value={f.departmentId} onChange={(e) => setF({ ...f, departmentId: e.target.value })}><option value="">None</option>{depts.data?.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select></Field>
          <Field label="Designation"><select value={f.designationId} onChange={(e) => setF({ ...f, designationId: e.target.value })}><option value="">None</option>{desigs.data?.map((d) => <option key={d.id} value={d.id}>{d.title}</option>)}</select></Field>
          <Field label="Hiring manager" hint="Sees the candidates and leaves feedback"><select value={f.hiringManagerId} onChange={(e) => setF({ ...f, hiringManagerId: e.target.value })}><option value="">None</option>{people.data?.items.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.employeeCode})</option>)}</select></Field>
          <Field label="Location"><input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} maxLength={100} /></Field>
        </div>
        <Field label="Description"><textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={2000} /></Field>
        <ErrorText>{act.error}</ErrorText>
        <div className="row"><button className="btn primary" disabled={act.pending}>{initial ? 'Save' : 'Create opening'}</button><button type="button" className="btn" onClick={onClose}>Cancel</button></div>
      </form>
    </Modal>
  );
}

function AddCandidate({ openingId, onClose }: { openingId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const act = useAction();
  const [f, setF] = useState({ firstName: '', lastName: '', email: '', phone: '', source: '' });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(() => api.post(`/recruitment/openings/${openingId}/candidates`, { firstName: f.firstName, lastName: f.lastName, email: f.email, phone: f.phone || undefined, source: f.source || undefined }), () => { refreshAll(qc); onClose(); });
  };
  return (
    <Modal title="Add a candidate" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="First name"><input value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} required maxLength={60} /></Field>
          <Field label="Last name"><input value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} required maxLength={60} /></Field>
          <Field label="Email"><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
          <Field label="Phone"><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} maxLength={30} /></Field>
          <Field label="Source" hint="Referral, job board, agency..."><input value={f.source} onChange={(e) => setF({ ...f, source: e.target.value })} maxLength={60} /></Field>
        </div>
        <ErrorText>{act.error}</ErrorText>
        <div className="row"><button className="btn primary" disabled={act.pending}>Add candidate</button><button type="button" className="btn" onClick={onClose}>Cancel</button></div>
      </form>
    </Modal>
  );
}

function HireDialog({ c, opening, onClose }: { c: CandidateDetail; opening: OpeningDetail | undefined; onClose: () => void }) {
  const qc = useQueryClient();
  const act = useAction();
  const people = useQuery({ queryKey: ['employees', 'for-recruitment'], queryFn: () => api.get<{ items: Person[] }>('/employees?pageSize=100') });
  const [f, setF] = useState({ employeeCode: '', dateOfJoining: dateNow(), workEmail: c.email, managerId: opening?.hiringManagerId ?? '' });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(() => api.post(`/recruitment/candidates/${c.id}/hire`, { employeeCode: f.employeeCode, dateOfJoining: f.dateOfJoining, workEmail: f.workEmail, managerId: f.managerId || null }), () => { refreshAll(qc); qc.invalidateQueries({ queryKey: ['employees'] }); onClose(); });
  };
  return (
    <Modal title={`Hire ${c.firstName} ${c.lastName}`} onClose={onClose}>
      <p className="muted" style={{ marginTop: 0 }}>This creates the employee, uses a seat, starts probation from the joining date and starts the onboarding checklist.</p>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Employee code"><input value={f.employeeCode} onChange={(e) => setF({ ...f, employeeCode: e.target.value })} required maxLength={30} /></Field>
          <Field label="Joining date"><input type="date" value={f.dateOfJoining} onChange={(e) => setF({ ...f, dateOfJoining: e.target.value })} required /></Field>
          <Field label="Work email"><input type="email" value={f.workEmail} onChange={(e) => setF({ ...f, workEmail: e.target.value })} required /></Field>
          <Field label="Manager"><select value={f.managerId} onChange={(e) => setF({ ...f, managerId: e.target.value })}><option value="">None</option>{people.data?.items.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} ({p.employeeCode})</option>)}</select></Field>
        </div>
        <ErrorText>{act.error}</ErrorText>
        <div className="row"><button className="btn primary" disabled={act.pending}>Hire</button><button type="button" className="btn" onClick={onClose}>Cancel</button></div>
      </form>
    </Modal>
  );
}

const FILE_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];

/** The files kept with a candidate (resume, portfolio): HR adds and removes, HR and the hiring manager download. */
function CandidateFiles({ c }: { c: CandidateDetail }) {
  const qc = useQueryClient();
  const act = useAction();
  const [fileError, setFileError] = useState<string | null>(null);
  const editable = c.canManage && c.stage !== 'HIRED';
  const add = (file: File | undefined) => {
    setFileError(null);
    if (!file) return;
    if (!FILE_TYPES.includes(file.type)) return setFileError('Use a PDF, PNG or JPEG file');
    if (file.size > 5 * 1024 * 1024) return setFileError('The file is larger than 5 MB');
    act.run(() => uploadFile(`/recruitment/candidates/${c.id}/documents?filename=${encodeURIComponent(file.name)}`, file), () => refreshAll(qc));
  };
  if (!c.documents.length && !editable) return null;
  return (
    <div style={{ margin: '8px 0' }}>
      <h3 style={{ marginBottom: 4 }}>Resume and files</h3>
      {c.documents.length === 0 && <p className="muted" style={{ margin: 0 }}>No files yet.</p>}
      {c.documents.map((d) => (
        <div key={d.id} className="row" style={{ gap: 6 }}>
          <button type="button" className="btn small" onClick={() => act.run(() => downloadFile(`/recruitment/candidates/${c.id}/documents/${d.id}/file`, d.fileName))} aria-label={`Download ${d.fileName}`}>{d.fileName}</button>
          {editable && <button type="button" className="btn small danger" disabled={act.pending} aria-label={`Remove ${d.fileName}`} onClick={() => window.confirm(`Remove ${d.fileName}? The file is deleted.`) && act.run(() => api.del(`/recruitment/candidates/${c.id}/documents/${d.id}`), () => refreshAll(qc))}>Remove</button>}
        </div>
      ))}
      {editable && c.documents.length < 5 && (
        <label className="btn small" style={{ cursor: 'pointer', display: 'inline-block', marginTop: 4 }}>
          Attach a file
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" hidden onChange={(e) => { add(e.target.files?.[0]); e.target.value = ''; }} />
        </label>
      )}
      <ErrorText>{fileError ?? act.error}</ErrorText>
    </div>
  );
}

function CandidateModal({ id, opening, onClose }: { id: string; opening: OpeningDetail | undefined; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['candidate', id], queryFn: () => api.get<CandidateDetail>(`/recruitment/candidates/${id}`) });
  const move = useAction();
  const note = useAction();
  const [rating, setRating] = useState('');
  const [body, setBody] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [hiring, setHiring] = useState(false);
  const c = q.data;

  const goTo = (stage: string, extra: object = {}) => move.run(() => api.post(`/recruitment/candidates/${id}/move`, { stage, ...extra }), () => { setRejecting(false); setReason(''); refreshAll(qc); });
  const addNote = (e: FormEvent) => {
    e.preventDefault();
    note.run(() => api.post(`/recruitment/candidates/${id}/notes`, { body, rating: rating ? Number(rating) : undefined }), () => { setBody(''); setRating(''); refreshAll(qc); });
  };
  const idx = c ? STAGES.indexOf(c.stage as (typeof STAGES)[number]) : -1;

  return (
    <Modal title={c ? `${c.firstName} ${c.lastName}` : 'Candidate'} onClose={onClose}>
      {q.isLoading && <Loading />}
      {c && (
        <>
          <p style={{ marginTop: 0 }}>
            <Badge value={c.stage === 'HIRED' ? 'ACTIVE' : c.stage === 'REJECTED' || c.stage === 'WITHDRAWN' ? 'REJECTED' : 'PENDING'} /> <b>{STAGE_LABEL[c.stage]}</b>
            <span className="muted"> · {c.opening.title}</span>
          </p>
          <dl className="facts">
            <div><dt>Email</dt><dd>{c.email}</dd></div>
            {c.phone && <div><dt>Phone</dt><dd>{c.phone}</dd></div>}
            {c.source && <div><dt>Source</dt><dd>{c.source}</dd></div>}
            {c.rejectionReason && <div><dt>Rejected because</dt><dd>{c.rejectionReason}</dd></div>}
            {c.hiredEmployeeId && <div><dt>Employee</dt><dd><Link to={`/employees/${c.hiredEmployeeId}`}>Open their profile</Link></dd></div>}
          </dl>

          <CandidateFiles c={c} />

          {c.canManage && c.stage !== 'HIRED' && (
            <div className="row" style={{ margin: '8px 0' }}>
              {idx >= 0 && idx < STAGES.length - 1 && <button className="btn primary" disabled={move.pending} onClick={() => goTo(STAGES[idx + 1])}>Move to {STAGE_LABEL[STAGES[idx + 1]].toLowerCase()}</button>}
              {c.stage === 'OFFER' && <button className="btn primary" onClick={() => setHiring(true)}>Hire</button>}
              {idx > 0 && <button className="btn" disabled={move.pending} onClick={() => goTo(STAGES[idx - 1])}>Back to {STAGE_LABEL[STAGES[idx - 1]].toLowerCase()}</button>}
              {idx >= 0 && <button className="btn" disabled={move.pending} onClick={() => goTo('WITHDRAWN')}>Withdrawn</button>}
              {idx >= 0 && <button className="btn danger" onClick={() => setRejecting(true)}>Reject</button>}
              {idx < 0 && <button className="btn" disabled={move.pending} onClick={() => goTo('APPLIED')}>Reopen</button>}
            </div>
          )}
          {rejecting && (
            <form className="row" onSubmit={(e) => { e.preventDefault(); goTo('REJECTED', { reason }); }}>
              <Field label="Reason for rejecting"><input value={reason} onChange={(e) => setReason(e.target.value)} minLength={3} maxLength={300} required autoFocus /></Field>
              <button className="btn danger" disabled={move.pending}>Reject candidate</button>
              <button type="button" className="btn" onClick={() => setRejecting(false)}>Cancel</button>
            </form>
          )}
          <ErrorText>{move.error}</ErrorText>

          {c.canNote && (
            <form onSubmit={addNote} style={{ marginTop: 12 }}>
              <h3 style={{ marginBottom: 4 }}>Feedback and notes</h3>
              <div className="form-grid">
                <Field label="Rating (optional)"><select value={rating} onChange={(e) => setRating(e.target.value)}><option value="">No rating</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n} of 5</option>)}</select></Field>
              </div>
              <Field label="Your feedback"><textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} minLength={3} maxLength={2000} required /></Field>
              <ErrorText>{note.error}</ErrorText>
              <button className="btn" disabled={note.pending}>Add feedback</button>
            </form>
          )}

          <h3 style={{ marginTop: 16 }}>History</h3>
          <ul className="history">
            {c.notes.map((n) => (
              <li key={n.id}>
                <b>{n.kind === 'STAGE' ? n.body : `${n.by ?? 'Someone'}${n.rating ? ` rated ${n.rating}/5` : ''}`}</b> <span className="muted">{n.kind === 'STAGE' ? `${n.by ?? ''} · ` : ''}{day(n.createdAt)}</span>
                {n.kind === 'NOTE' && <div>{n.body}</div>}
              </li>
            ))}
          </ul>
          {hiring && <HireDialog c={c} opening={opening} onClose={() => setHiring(false)} />}
        </>
      )}
    </Modal>
  );
}

function OpeningView({ id, onBack }: { id: string; onBack: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['opening', id], queryFn: () => api.get<OpeningDetail>(`/recruitment/openings/${id}`) });
  const act = useAction();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const o = q.data;
  if (q.isLoading) return <Loading />;
  if (!o) return <ErrorText>{(q.error as Error | null)?.message ?? 'Not found'}</ErrorText>;
  const setStatus = (status: string) => act.run(() => api.patch(`/recruitment/openings/${id}`, { status }), () => refreshAll(qc));
  const by = (stage: string) => o.candidates.filter((c) => c.stage === stage);
  const done = o.candidates.filter((c) => ['HIRED', 'REJECTED', 'WITHDRAWN'].includes(c.stage));

  const row = (c: Candidate) => (
    <tr key={c.id} className="clickable" onClick={() => setOpen(c.id)}>
      <td>{c.firstName} {c.lastName}</td><td className="muted">{c.source ?? ''}</td>
      <td>{c.averageRating !== null ? `${c.averageRating} / 5 (${c.feedbackCount})` : <span className="muted">no feedback</span>}</td>
      <td className="muted">{day(c.stageChangedAt)}</td>
    </tr>
  );
  return (
    <>
      <p><button className="btn small" onClick={onBack}>All openings</button></p>
      <div className="row between">
        <h1 style={{ marginBottom: 0 }}>{o.title} <Badge value={o.status === 'OPEN' ? 'ACTIVE' : o.status === 'ON_HOLD' ? 'PENDING' : 'REJECTED'} /></h1>
        {o.canManage && (
          <div className="row">
            <button className="btn" onClick={() => setAdding(true)} disabled={o.status !== 'OPEN'}>Add candidate</button>
            <button className="btn" onClick={() => setEditing(true)}>Edit</button>
            {o.status === 'OPEN' && <button className="btn" disabled={act.pending} onClick={() => setStatus('ON_HOLD')}>Put on hold</button>}
            {o.status !== 'OPEN' && <button className="btn" disabled={act.pending} onClick={() => setStatus('OPEN')}>Reopen</button>}
            {o.status !== 'CLOSED' && <button className="btn danger" disabled={act.pending} onClick={() => setStatus('CLOSED')}>Close opening</button>}
          </div>
        )}
      </div>
      <p className="muted">{o.headcount} position{o.headcount === 1 ? '' : 's'}{o.location ? ` · ${o.location}` : ''}{o.description ? ` · ${o.description}` : ''}</p>
      <ErrorText>{act.error}</ErrorText>

      {STAGES.map((s) => (
        <div className="card table-wrap" key={s}>
          <h2 style={{ marginBottom: 8 }}>{STAGE_LABEL[s]} <span className="muted">({by(s).length})</span></h2>
          {by(s).length === 0 ? <p className="muted" style={{ margin: 0 }}>Nobody at this stage.</p> : (
            <table><thead><tr><th>Candidate</th><th>Source</th><th>Feedback</th><th>Since</th></tr></thead><tbody>{by(s).map(row)}</tbody></table>
          )}
        </div>
      ))}
      {done.length > 0 && (
        <div className="card table-wrap">
          <h2 style={{ marginBottom: 8 }}>Finished <span className="muted">({done.length})</span></h2>
          <table>
            <thead><tr><th>Candidate</th><th>Outcome</th><th>Feedback</th><th>Since</th></tr></thead>
            <tbody>{done.map((c) => (
              <tr key={c.id} className="clickable" onClick={() => setOpen(c.id)}>
                <td>{c.firstName} {c.lastName}</td><td>{STAGE_LABEL[c.stage]}</td>
                <td>{c.averageRating !== null ? `${c.averageRating} / 5 (${c.feedbackCount})` : ''}</td><td className="muted">{day(c.stageChangedAt)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      {adding && <AddCandidate openingId={id} onClose={() => setAdding(false)} />}
      {editing && <OpeningForm initial={o} onClose={() => setEditing(false)} />}
      {open && <CandidateModal id={open} opening={o} onClose={() => setOpen(null)} />}
    </>
  );
}

export function Recruitment() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const [creating, setCreating] = useState(false);
  const [status, setStatus] = useState('OPEN');
  const q = useQuery({ queryKey: ['openings', status], queryFn: () => api.get<OpeningRow[]>(`/recruitment/openings${status ? `?status=${status}` : ''}`) });
  const selected = params.get('opening');
  if (selected) return <OpeningView id={selected} onBack={() => setParams({})} />;
  return (
    <>
      <div className="row between">
        <h1>Recruitment</h1>
        {isHR(user!.role) && <button className="btn primary" onClick={() => setCreating(true)}>New opening</button>}
      </div>
      <div className="row" style={{ marginBottom: 12 }}>
        <Field label="Show">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="OPEN">Open</option><option value="ON_HOLD">On hold</option><option value="CLOSED">Closed</option><option value="">All</option>
          </select>
        </Field>
      </div>
      <div className="card table-wrap">
        {q.isLoading ? <Loading /> : !q.data?.length ? <Empty>{isHR(user!.role) ? 'No openings here yet.' : 'You are not the hiring manager of any opening.'}</Empty> : (
          <table>
            <thead><tr><th>Opening</th><th>Hiring manager</th><th className="num">In pipeline</th><th className="num">Hired</th><th>Status</th></tr></thead>
            <tbody>
              {q.data.map((o) => (
                <tr key={o.id} className="clickable" onClick={() => setParams({ opening: o.id })}>
                  <td><Link to={`/recruitment?opening=${o.id}`} onClick={(e) => e.stopPropagation()}>{o.title}</Link>{o.location && <span className="muted"> · {o.location}</span>}</td>
                  <td>{o.hiringManager ?? <span className="muted">none</span>}</td>
                  <td className="num">{o.inPipeline}</td>
                  <td className="num">{o.hired} / {o.headcount}</td>
                  <td><Badge value={o.status === 'OPEN' ? 'ACTIVE' : o.status === 'ON_HOLD' ? 'PENDING' : 'REJECTED'} /> <span className="muted">{o.status === 'ON_HOLD' ? 'On hold' : o.status.charAt(0) + o.status.slice(1).toLowerCase()}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {creating && <OpeningForm onClose={() => setCreating(false)} />}
    </>
  );
}
