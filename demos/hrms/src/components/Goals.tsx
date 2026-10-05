import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { Empty, ErrorText, Field, Loading, Modal, day, useAction } from './ui';

export interface Goal {
  id: string; title: string; description: string | null; target: string | null; status: 'DRAFT' | 'PROPOSED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  progress: number; startOn: string; dueOn: string; overdue: boolean; assigned: boolean;
  employee: { id: string; employeeCode: string; firstName: string; lastName: string };
  can: { edit: boolean; submit: boolean; decide: boolean; progress: boolean; complete: boolean; cancel: boolean };
}
interface Detail extends Goal { events: { id: string; kind: string; percent: number | null; note: string | null; by: string | null; createdAt: string }[] }

const LABEL: Record<Goal['status'], string> = { DRAFT: 'Draft', PROPOSED: 'Waiting for agreement', ACTIVE: 'In progress', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };
const TONE: Record<Goal['status'], string> = { DRAFT: '', PROPOSED: 'warn', ACTIVE: 'ok', COMPLETED: 'ok', CANCELLED: '' };
const EVENT: Record<string, string> = { SUBMITTED: 'Sent for agreement', AGREED: 'Agreed', RETURNED: 'Sent back', PROGRESS: 'Progress', COMMENT: 'Comment', COMPLETED: 'Completed', CANCELLED: 'Cancelled' };

export const GoalChip = ({ g }: { g: Pick<Goal, 'status' | 'overdue'> }) => (
  <>
    <span className={`badge ${TONE[g.status]}`}>{LABEL[g.status]}</span>{g.overdue && <span className="badge bad" style={{ marginLeft: 4 }}>overdue</span>}
  </>
);
export const ProgressBar = ({ value }: { value: number }) => (
  <div className="seat-bar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={`${value}% done`} style={{ margin: '4px 0', maxWidth: 220 }}>
    <span style={{ width: `${value}%` }} />
  </div>
);

/** A small dialog that asks for one line of text (a reason, a comment) before doing something. */
function AskNote({ title, label, button, danger, onClose, onSubmit, pending, error }: {
  title: string; label: string; button: string; danger?: boolean; onClose: () => void; onSubmit: (note: string) => void; pending: boolean; error: string | null;
}) {
  const [note, setNote] = useState('');
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(note); }}>
        <Field label={label}><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} minLength={3} maxLength={500} required autoFocus /></Field>
        <ErrorText>{error}</ErrorText>
        <div className="row"><button className={`btn ${danger ? 'danger' : 'primary'}`} disabled={pending}>{pending ? 'Saving…' : button}</button><button type="button" className="btn" onClick={onClose}>Cancel</button></div>
      </form>
    </Modal>
  );
}

function GoalForm({ goal, forEmployee, onClose, onDone }: { goal?: Goal; forEmployee?: { id: string; name: string }; onClose: () => void; onDone: () => void }) {
  const { run, pending, error } = useAction();
  const [f, setF] = useState({ title: goal?.title ?? '', description: goal?.description ?? '', target: goal?.target ?? '', dueOn: goal?.dueOn ?? '' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  const save = (draft: boolean) => (e: FormEvent | React.MouseEvent) => {
    e.preventDefault();
    const body = { title: f.title, description: f.description || undefined, target: f.target || undefined, dueOn: f.dueOn };
    run(() => (goal ? api.patch(`/goals/${goal.id}`, body) : api.post('/goals', { ...body, ...(forEmployee ? { employeeId: forEmployee.id } : {}), draft })), onDone);
  };
  const mine = !forEmployee;
  return (
    <Modal title={goal ? 'Edit goal' : forEmployee ? `Set a goal for ${forEmployee.name}` : 'New goal'} onClose={onClose}>
      <form onSubmit={save(false)}>
        <Field label="What do you want to achieve?"><input value={f.title} onChange={set('title')} minLength={3} maxLength={120} required autoFocus /></Field>
        <Field label="Details (optional)"><textarea rows={3} value={f.description} onChange={set('description')} maxLength={1000} /></Field>
        <Field label="How will success be measured? (optional)" hint="A number, a date or a clear outcome"><input value={f.target} onChange={set('target')} maxLength={300} /></Field>
        <Field label="Due date"><input type="date" value={f.dueOn} onChange={set('dueOn')} required /></Field>
        <ErrorText>{error}</ErrorText>
        <div className="row">
          {goal ? <button className="btn primary" disabled={pending}>{pending ? 'Saving…' : 'Save changes'}</button> : (
            <>
              <button className="btn primary" disabled={pending}>{pending ? 'Saving…' : forEmployee ? 'Set goal' : 'Send to my manager'}</button>
              {mine && <button type="button" className="btn" disabled={pending} onClick={save(true)}>Save as draft</button>}
            </>
          )}
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
        </div>
      </form>
    </Modal>
  );
}

function ProgressForm({ goal, onClose, onDone }: { goal: Goal; onClose: () => void; onDone: () => void }) {
  const { run, pending, error } = useAction();
  const [percent, setPercent] = useState(String(goal.progress));
  const [note, setNote] = useState('');
  return (
    <Modal title="Update progress" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); run(() => api.post(`/goals/${goal.id}/progress`, { percent: Number(percent), note: note || undefined }), onDone); }}>
        <p style={{ marginTop: 0 }}>{goal.title}</p>
        <Field label={`How far along are you? ${percent}%`}><input type="range" min={0} max={100} step={5} value={percent} onChange={(e) => setPercent(e.target.value)} aria-label="Percent done" /></Field>
        <Field label="What changed? (optional)"><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></Field>
        <ErrorText>{error}</ErrorText>
        <div className="row"><button className="btn primary" disabled={pending}>{pending ? 'Saving…' : 'Save progress'}</button><button type="button" className="btn" onClick={onClose}>Cancel</button></div>
      </form>
    </Modal>
  );
}

function History({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useQuery({ queryKey: ['goal', id], queryFn: () => api.get<Detail>(`/goals/${id}`) });
  const g = q.data;
  return (
    <Modal title={g?.title ?? 'Goal'} onClose={onClose}>
      {!g ? <Loading /> : (
        <>
          <p className="muted" style={{ marginTop: 0 }}>{g.employee.firstName} {g.employee.lastName} · due {g.dueOn} · <GoalChip g={g} /></p>
          {g.description && <p>{g.description}</p>}
          {g.target && <p><b>Success looks like:</b> {g.target}</p>}
          <ProgressBar value={g.progress} />
          <h3 style={{ marginTop: 16 }}>History</h3>
          <ul className="history">
            {g.events.map((e) => (
              <li key={e.id}>
                <b>{EVENT[e.kind] ?? e.kind}{e.percent !== null && e.kind === 'PROGRESS' ? `: ${e.percent}%` : ''}</b> <span className="muted">{e.by} · {e.createdAt.slice(0, 10)}</span>
                {e.note && <div className="muted">{e.note}</div>}
              </li>
            ))}
          </ul>
        </>
      )}
    </Modal>
  );
}

type Dialog = { kind: 'edit' | 'progress' | 'history' | 'return' | 'cancel' | 'comment'; goal: Goal } | { kind: 'new' } | { kind: 'assign'; to: { id: string; name: string } } | null;

function GoalActions({ g, mine, setDialog, act, refresh }: { g: Goal; mine: boolean; setDialog: (d: Dialog) => void; act: ReturnType<typeof useAction>; refresh: () => void }) {
  const post = (path: string) => act.run(() => api.post(`/goals/${g.id}/${path}`), refresh);
  return (
    <div className="row">
      {g.can.edit && <button className="btn small" onClick={() => setDialog({ kind: 'edit', goal: g })}>Edit</button>}
      {g.can.submit && <button className="btn small primary" disabled={act.pending} onClick={() => post('submit')}>Send to my manager</button>}
      {g.can.decide && <button className="btn small primary" disabled={act.pending} onClick={() => post('agree')}>Agree</button>}
      {g.can.decide && <button className="btn small" onClick={() => setDialog({ kind: 'return', goal: g })}>Send back</button>}
      {g.can.progress && <button className="btn small primary" onClick={() => setDialog({ kind: 'progress', goal: g })}>Update progress</button>}
      {g.can.complete && <button className="btn small" disabled={act.pending} onClick={() => { if (window.confirm(`Mark "${g.title}" as complete?`)) post('complete'); }}>Mark complete</button>}
      <button className="btn small" onClick={() => setDialog({ kind: 'comment', goal: g })}>Comment</button>
      <button className="btn small" onClick={() => setDialog({ kind: 'history', goal: g })}>History</button>
      {g.can.cancel && <button className="btn small danger" onClick={() => setDialog({ kind: 'cancel', goal: g })}>{mine ? 'Cancel' : 'Cancel goal'}</button>}
    </div>
  );
}

function useGoals(kind: 'mine' | 'team') {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['goals', kind], queryFn: () => api.get<Goal[]>(`/goals/${kind}`) });
  const act = useAction();
  const [dialog, setDialog] = useState<Dialog>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ['goals'] }); qc.invalidateQueries({ queryKey: ['goal'] }); qc.invalidateQueries({ queryKey: ['perf-count'] }); qc.invalidateQueries({ queryKey: ['appraisal'] }); };
  return { q, act, dialog, setDialog, refresh };
}

function Dialogs({ dialog, setDialog, act, refresh }: { dialog: Dialog; setDialog: (d: Dialog) => void; act: ReturnType<typeof useAction>; refresh: () => void }) {
  const done = () => { setDialog(null); refresh(); };
  if (!dialog) return null;
  if (dialog.kind === 'new') return <GoalForm onClose={() => setDialog(null)} onDone={done} />;
  if (dialog.kind === 'assign') return <GoalForm forEmployee={dialog.to} onClose={() => setDialog(null)} onDone={done} />;
  if (dialog.kind === 'edit') return <GoalForm goal={dialog.goal} onClose={() => setDialog(null)} onDone={done} />;
  if (dialog.kind === 'progress') return <ProgressForm goal={dialog.goal} onClose={() => setDialog(null)} onDone={done} />;
  if (dialog.kind === 'history') return <History id={dialog.goal.id} onClose={() => setDialog(null)} />;
  const g = dialog.goal;
  const ask = { return: ['Send back for changes', 'What should change?', 'Send back', false], cancel: ['Cancel this goal?', 'Why is it being cancelled?', 'Cancel goal', true], comment: ['Add a comment', 'Your comment', 'Post comment', false] } as const;
  const [title, label, button, danger] = ask[dialog.kind];
  return <AskNote title={`${title}: ${g.title}`} label={label} button={button} danger={danger} pending={act.pending} error={act.error} onClose={() => setDialog(null)}
    onSubmit={(note) => act.run(() => api.post(`/goals/${g.id}/${dialog.kind}`, { note }), done)} />;
}

function Card({ g, who, mine, setDialog, act, refresh }: { g: Goal; who?: boolean; mine: boolean; setDialog: (d: Dialog) => void; act: ReturnType<typeof useAction>; refresh: () => void }) {
  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="row between">
        <h3 style={{ margin: 0 }}>{g.title}</h3>
        <span><GoalChip g={g} /></span>
      </div>
      <p className="muted" style={{ margin: '4px 0' }}>
        {who && <>{g.employee.firstName} {g.employee.lastName} · </>}Due {day(g.dueOn)}{g.assigned && ' · set for them by their manager'}
      </p>
      {g.target && <p style={{ margin: '4px 0' }}><b>Success looks like:</b> {g.target}</p>}
      {(g.status === 'ACTIVE' || g.status === 'COMPLETED') && <><ProgressBar value={g.progress} /><span className="muted">{g.progress}% done</span></>}
      <div style={{ marginTop: 8 }}><GoalActions g={g} mine={mine} setDialog={setDialog} act={act} refresh={refresh} /></div>
    </div>
  );
}

export function MyGoals() {
  const { q, act, dialog, setDialog, refresh } = useGoals('mine');
  return (
    <>
      <div className="row between" style={{ marginBottom: 12 }}>
        <p className="muted" style={{ margin: 0 }}>Set what you want to achieve. Your manager agrees it, you report progress, and your reviewers see it in your appraisal.</p>
        <button className="btn primary" onClick={() => setDialog({ kind: 'new' })}>New goal</button>
      </div>
      <ErrorText>{dialog ? null : act.error}</ErrorText>
      {q.isLoading ? <Loading /> : !q.data?.length ? <Empty>You have no goals yet. Add your first one.</Empty> : q.data.map((g) => <Card key={g.id} g={g} mine setDialog={setDialog} act={act} refresh={refresh} />)}
      <Dialogs dialog={dialog} setDialog={setDialog} act={act} refresh={refresh} />
    </>
  );
}

export function TeamGoals() {
  const { q, act, dialog, setDialog, refresh } = useGoals('team');
  const people = useQuery({ queryKey: ['employees', 'for-goals'], queryFn: () => api.get<{ items: { id: string; firstName: string; lastName: string; employeeCode: string; status: string }[] }>('/employees?pageSize=100&status=ACTIVE') });
  const [who, setWho] = useState('');
  const [filter, setFilter] = useState('');
  const target = people.data?.items.find((p) => p.id === who) ?? people.data?.items[0];
  const rows = (q.data ?? []).filter((g) => !filter || g.status === filter);
  return (
    <>
      <div className="row" style={{ marginBottom: 12, alignItems: 'flex-end' }}>
        <Field label="Show"><select value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">All goals</option><option value="PROPOSED">Waiting for agreement</option><option value="ACTIVE">In progress</option><option value="COMPLETED">Completed</option></select></Field>
        <div className="spacer" />
        {target && (
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <Field label="Set a goal for"><select value={target.id} onChange={(e) => setWho(e.target.value)}>{people.data!.items.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}</select></Field>
            <div style={{ marginBottom: 12 }}><button className="btn primary" onClick={() => setDialog({ kind: 'assign', to: { id: target.id, name: `${target.firstName} ${target.lastName}` } })}>Set goal</button></div>
          </div>
        )}
      </div>
      <ErrorText>{dialog ? null : act.error}</ErrorText>
      {q.isLoading ? <Loading /> : !rows.length ? <Empty>No goals here yet.</Empty> : rows.map((g) => <Card key={g.id} g={g} who mine={false} setDialog={setDialog} act={act} refresh={refresh} />)}
      <Dialogs dialog={dialog} setDialog={setDialog} act={act} refresh={refresh} />
    </>
  );
}
