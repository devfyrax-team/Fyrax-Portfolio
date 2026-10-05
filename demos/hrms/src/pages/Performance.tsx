import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, downloadFile } from '../api';
import { isHR, useAuth } from '../auth';
import { MyGoals, ProgressBar, TeamGoals } from '../components/Goals';
import { Empty, ErrorText, Field, Loading, Modal, Tabs, useAction } from '../components/ui';

interface Criterion { id: string; name: string; weight: number }
interface Entry { stage: number; label: string; ratings: Record<string, number>; score: number; remark: string | null; by: string | null }
interface Appraisal {
  goals: { id: string; title: string; target: string | null; status: string; progress: number; dueOn: string }[];
  id: string; status: 'SELF' | 'STAGE' | 'ACKNOWLEDGE' | 'APPEALED' | 'CLOSED'; outcome: string | null; waitingFor: string | null;
  cycle: { id: string; name: string; status: string; periodStart: string; periodEnd: string; selfDueOn: string; scale: string[]; criteria: Criterion[] };
  employee: { id: string; employeeCode: string; firstName: string; lastName: string };
  stages: { index: number; label: string; done: boolean; current: boolean }[];
  entries: Entry[];
  result: { score: number | null; grade: string | null } | null;
  appealRemark: string | null; resolutionNote: string | null;
  can: { writeSelf: boolean; review: boolean; respond: boolean; resolve: boolean };
}
interface CycleRow { id: string; name: string; status: 'DRAFT' | 'OPEN' | 'CLOSED'; periodStart: string; periodEnd: string; selfDueOn: string; scale: string[]; criteria: Criterion[]; stages: { kind: string; role?: string }[]; appraisals: number }
interface Overview {
  cycle: CycleRow; counts: Record<string, number>; grades: Record<string, number>;
  appraisals: { id: string; status: string; employee: { employeeCode: string; firstName: string; lastName: string; department: { name: string } | null }; waitingFor: string | null; finalScore: number | null; finalGrade: string | null; outcome: string | null }[];
}

const STATUS_LABEL: Record<string, string> = { SELF: 'Self-assessment', STAGE: 'With reviewers', ACKNOWLEDGE: 'Result ready', APPEALED: 'Appealed', CLOSED: 'Finished' };
const statusTone = (s: string) => (s === 'CLOSED' ? 'ok' : s === 'APPEALED' ? 'bad' : 'warn');
const StatusChip = ({ status }: { status: string }) => <span className={`badge ${statusTone(status)}`}>{STATUS_LABEL[status] ?? status}</span>;

/** Rates every criterion on the cycle's scale, with an optional remark. Shared by the self-assessment, reviews and appeal revisions. */
function RatingForm({ criteria, scale, initial, remarkLabel, button, pending, error, onSubmit }: {
  criteria: Criterion[]; scale: string[]; initial?: Record<string, number>; remarkLabel: string; button: string; pending: boolean; error: string | null;
  onSubmit: (ratings: Record<string, number>, remark: string) => void;
}) {
  const [ratings, setRatings] = useState<Record<string, string>>(Object.fromEntries(criteria.map((c) => [c.id, initial?.[c.id] ? String(initial[c.id]) : ''])));
  const [remark, setRemark] = useState('');
  const [missing, setMissing] = useState<string | null>(null);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const gap = criteria.find((c) => !ratings[c.id]);
    if (gap) return setMissing(`Rate "${gap.name}"`);
    setMissing(null);
    onSubmit(Object.fromEntries(criteria.map((c) => [c.id, Number(ratings[c.id])])), remark);
  };
  return (
    <form onSubmit={submit}>
      {criteria.map((c) => (
        <Field key={c.id} label={c.name} hint={c.weight !== 1 ? `Counts ${c.weight} times as much as a standard item` : undefined}>
          <select value={ratings[c.id]} onChange={(e) => { setRatings({ ...ratings, [c.id]: e.target.value }); setMissing(null); }} aria-label={c.name}>
            <option value="">Choose a rating</option>
            {scale.map((label, i) => <option key={label} value={i + 1}>{i + 1} · {label}</option>)}
          </select>
        </Field>
      ))}
      <Field label={remarkLabel}><textarea rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} maxLength={2000} /></Field>
      {missing && <p className="field-error" role="alert">{missing}</p>}
      <ErrorText>{error}</ErrorText>
      <button className="btn primary" disabled={pending}>{pending ? 'Saving…' : button}</button>
    </form>
  );
}

function EntryCard({ e, a }: { e: Entry; a: Appraisal }) {
  return (
    <div className="card" style={{ background: 'var(--bg)', boxShadow: 'none' }}>
      <div className="row between"><b>{e.label}</b><span className="muted">{e.by}</span></div>
      <table style={{ marginTop: 8 }}>
        <tbody>
          {a.cycle.criteria.map((c) => (
            <tr key={c.id}><td>{c.name}</td><td className="num">{e.ratings[c.id]} · {a.cycle.scale[(e.ratings[c.id] ?? 1) - 1]}</td></tr>
          ))}
        </tbody>
      </table>
      <p style={{ marginBottom: 0 }}>Score <b>{e.score}</b>{e.remark && <><br /><span className="muted">{e.remark}</span></>}</p>
    </div>
  );
}

function Detail({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['appraisal', id], queryFn: () => api.get<Appraisal>(`/performance/appraisals/${id}`) });
  const act = useAction();
  const [mode, setMode] = useState<null | 'appeal' | 'resolve'>(null);
  const [note, setNote] = useState('');
  const [outcome, setOutcome] = useState<'UPHELD' | 'REVISED'>('UPHELD');
  const refresh = () => { qc.invalidateQueries({ queryKey: ['appraisal', id] }); qc.invalidateQueries({ queryKey: ['performance'] }); qc.invalidateQueries({ queryKey: ['perf-count'] }); };
  const a = q.data;

  return (
    <Modal title={a ? `${a.employee.firstName} ${a.employee.lastName} · ${a.cycle.name}` : 'Appraisal'} onClose={onClose}>
      {!a ? <Loading /> : (
        <>
          <p className="muted" style={{ marginTop: 0 }}>
            {a.cycle.periodStart} to {a.cycle.periodEnd} · <StatusChip status={a.status} />{a.waitingFor && a.status !== 'CLOSED' ? ` · waiting for ${a.waitingFor}` : ''}
          </p>
          <ol className="history" style={{ listStyle: 'none', display: 'flex', gap: 8, flexWrap: 'wrap', padding: 0, margin: '0 0 12px' }}>
            <li><span className="badge ok">Self-assessment</span></li>
            {a.stages.map((s) => <li key={s.index}><span className={s.done ? 'badge ok' : s.current ? 'badge warn' : 'badge'}>{s.label}</span></li>)}
          </ol>

          {a.result && (
            <div className="notice" role="status">
              Result: <b>{a.result.grade}</b>{a.result.score !== null && <> (score {a.result.score})</>}{a.outcome && <> · {a.outcome === 'ACCEPTED' ? 'accepted by the employee' : a.outcome === 'UPHELD' ? 'appeal turned down' : 'revised after appeal'}</>}
            </div>
          )}
          {a.appealRemark && <p><b>Appeal:</b> {a.appealRemark}</p>}
          {a.resolutionNote && <p><b>Decision:</b> {a.resolutionNote}</p>}

          {a.goals.length > 0 && (
            <div className="card" style={{ background: 'var(--bg)', boxShadow: 'none' }}>
              <b>Goals this period</b>
              <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
                {a.goals.map((g) => (
                  <li key={g.id} style={{ marginBottom: 8 }}>
                    {g.title} <span className="muted">· due {g.dueOn} · {g.status === 'COMPLETED' ? 'completed' : `${g.progress}% done`}</span>
                    {g.target && <div className="muted">Success looks like: {g.target}</div>}
                    <ProgressBar value={g.progress} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {a.entries.map((e) => <EntryCard key={`${e.stage}`} e={e} a={a} />)}
          <ErrorText>{act.error}</ErrorText>

          {a.can.writeSelf && (
            <>
              <h3>Your self-assessment</h3>
              <p className="muted" style={{ marginTop: 0 }}>Due by {a.cycle.selfDueOn}. Rate yourself honestly: your reviewers see this.</p>
              <RatingForm criteria={a.cycle.criteria} scale={a.cycle.scale} remarkLabel="What did you achieve this period?" button="Submit self-assessment" pending={act.pending} error={null}
                onSubmit={(ratings, remark) => act.run(() => api.post(`/performance/appraisals/${id}/self`, { ratings, remark: remark || undefined }), refresh)} />
            </>
          )}
          {a.can.review && (
            <>
              <h3>Your review</h3>
              <RatingForm criteria={a.cycle.criteria} scale={a.cycle.scale} remarkLabel="Your remarks" button="Submit review" pending={act.pending} error={null}
                onSubmit={(ratings, remark) => act.run(() => api.post(`/performance/appraisals/${id}/review`, { ratings, remark: remark || undefined }), refresh)} />
            </>
          )}
          {a.can.respond && mode !== 'appeal' && (
            <div className="row">
              <button className="btn primary" disabled={act.pending} onClick={() => act.run(() => api.post(`/performance/appraisals/${id}/acknowledge`), refresh)}>Accept result</button>
              <button className="btn" onClick={() => setMode('appeal')}>Appeal</button>
            </div>
          )}
          {a.can.respond && mode === 'appeal' && (
            <form onSubmit={(e) => { e.preventDefault(); act.run(() => api.post(`/performance/appraisals/${id}/appeal`, { remark: note }), () => { setMode(null); refresh(); }); }}>
              <Field label="Why do you disagree?" hint="HR reads this and decides"><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} minLength={5} maxLength={1000} required /></Field>
              <div className="row"><button className="btn danger" disabled={act.pending}>Send appeal</button><button type="button" className="btn" onClick={() => setMode(null)}>Cancel</button></div>
            </form>
          )}
          {a.can.resolve && (
            <>
              <h3>Decide the appeal</h3>
              <Field label="Decision">
                <select value={outcome} onChange={(e) => setOutcome(e.target.value as 'UPHELD' | 'REVISED')}>
                  <option value="UPHELD">Keep the result</option><option value="REVISED">Change the ratings</option>
                </select>
              </Field>
              {outcome === 'UPHELD' ? (
                <form onSubmit={(e) => { e.preventDefault(); act.run(() => api.post(`/performance/appraisals/${id}/resolve`, { outcome, note }), refresh); }}>
                  <Field label="Explain the decision"><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} minLength={3} maxLength={1000} required /></Field>
                  <button className="btn primary" disabled={act.pending}>Keep the result</button>
                </form>
              ) : (
                <RatingForm criteria={a.cycle.criteria} scale={a.cycle.scale} remarkLabel="Explain the new ratings" button="Save revised ratings" pending={act.pending} error={null}
                  onSubmit={(ratings, remark) => act.run(() => api.post(`/performance/appraisals/${id}/resolve`, { outcome, note: remark || 'Ratings revised', ratings }), refresh)} />
              )}
            </>
          )}
        </>
      )}
    </Modal>
  );
}

function AppraisalList({ items, empty, onOpen, actionLabel }: { items: Appraisal[]; empty: string; onOpen: (id: string) => void; actionLabel: (a: Appraisal) => string }) {
  if (!items.length) return <Empty>{empty}</Empty>;
  return (
    <div className="card table-wrap">
      <table>
        <thead><tr><th>Round</th><th>Employee</th><th>Status</th><th>Waiting for</th><th className="actions" /></tr></thead>
        <tbody>
          {items.map((a) => (
            <tr key={a.id} className="clickable" onClick={() => onOpen(a.id)}>
              <td>{a.cycle.name}<div className="muted">{a.cycle.periodStart} to {a.cycle.periodEnd}</div></td>
              <td>{a.employee.firstName} {a.employee.lastName} <span className="muted">{a.employee.employeeCode}</span></td>
              <td><StatusChip status={a.status} />{a.result?.grade && <span className="muted"> · {a.result.grade}</span>}</td>
              <td>{a.status === 'CLOSED' ? <span className="muted">—</span> : a.waitingFor}</td>
              <td className="actions"><button className="btn small" onClick={(e) => { e.stopPropagation(); onOpen(a.id); }}>{actionLabel(a)}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PRESETS: Record<string, string[]> = {
  FIVE: ['Poor', 'Fair', 'Good', 'Very Good', 'Outstanding'],
  FOUR: ['Poor', 'Fair', 'Good', 'Very Good'],
  THREE: ['Needs improvement', 'Meets expectations', 'Exceeds expectations'],
};
const today = () => new Date().toISOString().slice(0, 10);

function NewCycle({ onDone }: { onDone: () => void }) {
  const year = new Date().getFullYear();
  const { run, pending, error } = useAction();
  const [f, setF] = useState({ name: `Annual review ${year}`, periodStart: `${year}-01-01`, periodEnd: `${year}-12-31`, selfDueOn: `${year}-12-15`, preset: 'FIVE', custom: '', manager: true, manager2: false, role: 'HR' });
  const [criteria, setCriteria] = useState([{ name: 'Quality of work', weight: '2' }, { name: 'Teamwork', weight: '1' }, { name: 'Ownership', weight: '1' }]);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const scale = f.preset === 'CUSTOM' ? f.custom.split(',').map((s) => s.trim()).filter(Boolean) : PRESETS[f.preset];
    const stages = [...(f.manager ? [{ kind: 'MANAGER' }] : []), ...(f.manager2 ? [{ kind: 'MANAGER2' }] : []), { kind: 'ROLE', role: f.role }];
    run(() => api.post('/performance/cycles', {
      name: f.name, periodStart: f.periodStart, periodEnd: f.periodEnd, selfDueOn: f.selfDueOn, scale, stages,
      criteria: criteria.filter((c) => c.name.trim()).map((c) => ({ name: c.name, weight: Number(c.weight) || 1 })),
    }), onDone);
  };
  return (
    <form className="card" onSubmit={submit}>
      <h2 style={{ marginBottom: 12 }}>New review round</h2>
      <div className="form-grid">
        <Field label="Name"><input value={f.name} onChange={set('name')} minLength={2} maxLength={100} required /></Field>
        <Field label="Period starts"><input type="date" value={f.periodStart} onChange={set('periodStart')} required /></Field>
        <Field label="Period ends"><input type="date" value={f.periodEnd} onChange={set('periodEnd')} required /></Field>
        <Field label="Self-assessment due" hint="Employees are reminded before this date"><input type="date" value={f.selfDueOn} onChange={set('selfDueOn')} required /></Field>
        <Field label="Rating scale">
          <select value={f.preset} onChange={set('preset')}>
            <option value="FIVE">5 points: Poor to Outstanding</option><option value="FOUR">4 points: Poor to Very Good</option><option value="THREE">3 points</option><option value="CUSTOM">Custom…</option>
          </select>
        </Field>
        {f.preset === 'CUSTOM' && <Field label="Ratings, lowest first" hint="Comma separated, 3 to 7"><input value={f.custom} onChange={set('custom')} required /></Field>}
      </div>

      <h3>What is rated</h3>
      {criteria.map((c, i) => (
        <div className="row" key={i} style={{ alignItems: 'flex-end' }}>
          <div style={{ flex: 1, minWidth: 180 }}><Field label={i === 0 ? 'Name' : `Item ${i + 1}`}><input value={c.name} onChange={(e) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} maxLength={80} /></Field></div>
          <div style={{ width: 110 }}><Field label="Weight"><input type="number" min="0.1" step="0.1" value={c.weight} onChange={(e) => setCriteria(criteria.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))} /></Field></div>
          <div style={{ marginBottom: 12 }}>{criteria.length > 1 && <button type="button" className="btn small danger" onClick={() => setCriteria(criteria.filter((_, j) => j !== i))}>Remove</button>}</div>
        </div>
      ))}
      {criteria.length < 12 && <button type="button" className="btn small" onClick={() => setCriteria([...criteria, { name: '', weight: '1' }])}>Add an item</button>}

      <h3 style={{ marginTop: 16 }}>Who reviews, in order</h3>
      <label className="check"><input type="checkbox" checked={f.manager} onChange={(e) => setF({ ...f, manager: e.target.checked })} /> The employee's manager</label>
      <label className="check"><input type="checkbox" checked={f.manager2} onChange={(e) => setF({ ...f, manager2: e.target.checked })} /> The manager's manager</label>
      <Field label="Final review by" hint="Their rating becomes the result. A manager step is skipped when nobody holds that role.">
        <select value={f.role} onChange={set('role')}><option value="HR">HR</option><option value="ADMIN">An administrator</option></select>
      </Field>
      <ErrorText>{error}</ErrorText>
      <button className="btn primary" disabled={pending}>{pending ? 'Creating…' : 'Create draft round'}</button>
      <span className="muted"> It starts only when you open it.</span>
    </form>
  );
}

function CycleOverview({ id, onOpenAppraisal }: { id: string; onOpenAppraisal: (id: string) => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['performance', 'cycle', id], queryFn: () => api.get<Overview>(`/performance/cycles/${id}`) });
  const act = useAction();
  if (!q.data) return <Loading />;
  const { cycle, counts, grades, appraisals } = q.data;
  const refresh = () => qc.invalidateQueries({ queryKey: ['performance'] });
  return (
    <div className="card table-wrap">
      <div className="row between">
        <h2>{cycle.name} <span className={`badge ${cycle.status === 'OPEN' ? 'ok' : cycle.status === 'DRAFT' ? 'warn' : ''}`}>{cycle.status.toLowerCase()}</span></h2>
        <div className="row">
          {cycle.status !== 'DRAFT' && <button className="btn small" onClick={() => act.run(() => downloadFile(`/performance/cycles/${id}/export.csv`, `appraisals-${cycle.name}.csv`))}>Download CSV</button>}
          {cycle.status === 'DRAFT' && <button className="btn small primary" disabled={act.pending} onClick={() => { if (window.confirm(`Open "${cycle.name}"? Everyone gets an appraisal and is asked to write their self-assessment. The setup can no longer change.`)) act.run(() => api.post(`/performance/cycles/${id}/open`), refresh); }}>Open round</button>}
          {cycle.status === 'DRAFT' && <button className="btn small danger" disabled={act.pending} onClick={() => { if (window.confirm(`Delete the draft "${cycle.name}"?`)) act.run(() => api.del(`/performance/cycles/${id}`), refresh); }}>Delete</button>}
          {cycle.status === 'OPEN' && <button className="btn small danger" disabled={act.pending} onClick={() => { if (window.confirm(`Close "${cycle.name}"? Nothing can be changed afterwards, including appraisals still in progress.`)) act.run(() => api.post(`/performance/cycles/${id}/close`), refresh); }}>Close round</button>}
        </div>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>{cycle.periodStart} to {cycle.periodEnd} · self-assessment due {cycle.selfDueOn} · rated: {cycle.criteria.map((c) => c.name).join(', ')}</p>
      <ErrorText>{act.error}</ErrorText>
      {cycle.status === 'DRAFT' ? <Empty>This round has not started. Open it to create everyone's appraisal.</Empty> : (
        <>
          <div className="stats" style={{ marginBottom: 12 }}>
            {Object.entries(STATUS_LABEL).map(([k, label]) => <div className="stat" key={k}><b>{counts[k] ?? 0}</b><span>{label}</span></div>)}
          </div>
          <p className="muted">Grades so far: {Object.entries(grades).map(([g, n]) => `${g} ${n}`).join(' · ')}</p>
          <table>
            <thead><tr><th>Employee</th><th>Department</th><th>Status</th><th>Waiting for</th><th>Result</th></tr></thead>
            <tbody>
              {appraisals.map((a) => (
                <tr key={a.id} className="clickable" onClick={() => onOpenAppraisal(a.id)}>
                  <td>{a.employee.firstName} {a.employee.lastName} <span className="muted">{a.employee.employeeCode}</span></td>
                  <td>{a.employee.department?.name ?? '—'}</td>
                  <td><StatusChip status={a.status} /></td>
                  <td>{a.waitingFor ?? <span className="muted">—</span>}</td>
                  <td>{a.finalGrade ? `${a.finalGrade} (${a.finalScore})` : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function Cycles({ onOpenAppraisal }: { onOpenAppraisal: (id: string) => void }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['performance', 'cycles'], queryFn: () => api.get<CycleRow[]>('/performance/cycles') });
  const [creating, setCreating] = useState(false);
  return (
    <>
      <div className="row between" style={{ marginBottom: 12 }}>
        <p className="muted" style={{ margin: 0 }}>A round is one review period. Open it to create everyone's appraisal.</p>
        {!creating && <button className="btn primary" onClick={() => setCreating(true)}>New review round</button>}
      </div>
      {creating && <NewCycle onDone={() => { setCreating(false); qc.invalidateQueries({ queryKey: ['performance'] }); }} />}
      {q.isLoading ? <Loading /> : !q.data?.length ? <Empty>No review rounds yet. Create the first one.</Empty> : q.data.map((c) => <CycleOverview key={c.id} id={c.id} onOpenAppraisal={onOpenAppraisal} />)}
    </>
  );
}

export function Performance() {
  const { user } = useAuth();
  const hr = isHR(user!.role);
  const [tab, setTab] = useState<'mine' | 'goals' | 'team' | 'review' | 'cycles'>('mine');
  const counts = useQuery({ queryKey: ['perf-count'], queryFn: () => api.get<{ total: number; goals: number }>('/performance/pending-count') });
  const [open, setOpen] = useState<string | null>(null);
  const mine = useQuery({ queryKey: ['performance', 'mine'], queryFn: () => api.get<Appraisal[]>('/performance/mine') });
  const review = useQuery({ queryKey: ['performance', 'review'], queryFn: () => api.get<Appraisal[]>('/performance/to-review') });
  const tabs = [
    { id: 'mine' as const, label: 'My appraisal' },
    { id: 'goals' as const, label: 'My goals' },
    ...(user!.role !== 'EMPLOYEE' ? [{ id: 'team' as const, label: counts.data?.goals ? `Team goals (${counts.data.goals})` : 'Team goals' }] : []),
    { id: 'review' as const, label: review.data?.length ? `To review (${review.data.length})` : 'To review' },
    ...(hr ? [{ id: 'cycles' as const, label: 'Review rounds' }] : []),
  ];
  return (
    <>
      <h1>Performance</h1>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      {tab === 'mine' && (mine.isLoading ? <Loading /> : <AppraisalList items={mine.data ?? []} empty="You have no appraisals yet. They appear here when a review round opens." onOpen={setOpen}
        actionLabel={(a) => (a.can.writeSelf ? 'Write yours' : a.can.respond ? 'Read result' : 'Open')} />)}
      {tab === 'goals' && <MyGoals />}
      {tab === 'team' && user!.role !== 'EMPLOYEE' && <TeamGoals />}
      {tab === 'review' && (review.isLoading ? <Loading /> : <AppraisalList items={review.data ?? []} empty="Nothing is waiting for your review." onOpen={setOpen} actionLabel={() => 'Review'} />)}
      {tab === 'cycles' && hr && <Cycles onOpenAppraisal={setOpen} />}
      {open && <Detail id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
