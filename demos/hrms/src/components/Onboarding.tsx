import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { Empty, ErrorText, Field, Loading, Modal, useAction } from './ui';
import { ProgressBar } from './Goals';

type Owner = 'HR' | 'MANAGER' | 'EMPLOYEE';
const OWNERS: { value: Owner; label: string }[] = [{ value: 'HR', label: 'HR' }, { value: 'MANAGER', label: 'Manager' }, { value: 'EMPLOYEE', label: 'New joiner' }];
const ownerLabel = (o: string) => OWNERS.find((x) => x.value === o)?.label ?? o;

interface Task {
  id: string; title: string; description: string | null; owner: Owner; dueOn: string; status: 'OPEN' | 'DONE' | 'SKIPPED'; note: string | null; overdue: boolean;
  can: { complete: boolean; reopen: boolean; skip: boolean; remove: boolean };
}
interface Checklist { summary: { total: number; done: number; skipped: number; open: number; overdue: number }; tasks: Task[]; canStart: boolean }
interface MineTask extends Task { employee: { id: string; firstName: string; lastName: string; employeeCode: string } }

const refreshKeys = ['onboarding', 'onboarding-mine'];

function useRefresh() {
  const qc = useQueryClient();
  return () => refreshKeys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

/** One step with the buttons the viewer is allowed to use. */
function TaskRow({ t, who }: { t: Task; who?: string }) {
  const act = useAction();
  const refresh = useRefresh();
  const done = t.status !== 'OPEN';
  return (
    <li style={{ padding: '10px 0', borderTop: '1px solid var(--border)' }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <b style={done ? { textDecoration: t.status === 'SKIPPED' ? 'line-through' : undefined, color: 'var(--muted)' } : undefined}>{t.title}</b>{' '}
          <span className="badge">{ownerLabel(t.owner)}</span>{' '}
          {t.status === 'DONE' && <span className="badge ok">Done</span>}
          {t.status === 'SKIPPED' && <span className="badge">Skipped</span>}
          {t.overdue && <span className="badge bad">Overdue</span>}
          <div className="muted">{who ? <>{who} · </> : null}{t.status === 'OPEN' ? `due ${t.dueOn}` : `was due ${t.dueOn}`}{t.description ? ` · ${t.description}` : ''}</div>
          {t.note && <div className="muted">Note: {t.note}</div>}
        </div>
        <div className="row">
          {t.can.complete && <button className="btn primary" disabled={act.pending} onClick={() => act.run(() => api.post(`/onboarding/tasks/${t.id}/complete`, {}), refresh)}>Mark done</button>}
          {t.can.skip && <button className="btn" disabled={act.pending} onClick={() => act.run(() => api.post(`/onboarding/tasks/${t.id}/skip`, {}), refresh)}>Skip</button>}
          {t.can.reopen && <button className="btn" disabled={act.pending} onClick={() => act.run(() => api.post(`/onboarding/tasks/${t.id}/reopen`, {}), refresh)}>Reopen</button>}
          {t.can.remove && <button className="btn" disabled={act.pending} aria-label={`Remove ${t.title}`} onClick={() => window.confirm(`Remove "${t.title}" from this checklist?`) && act.run(() => api.del(`/onboarding/tasks/${t.id}`), refresh)}>Remove</button>}
        </div>
      </div>
      <ErrorText>{act.error}</ErrorText>
    </li>
  );
}

function AddStep({ employeeId, onClose }: { employeeId: string; onClose: () => void }) {
  const act = useAction();
  const refresh = useRefresh();
  const [f, setF] = useState<{ title: string; description: string; owner: Owner; dueOn: string }>({ title: '', description: '', owner: 'HR', dueOn: new Date().toISOString().slice(0, 10) });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    act.run(() => api.post(`/onboarding/employee/${employeeId}/tasks`, { title: f.title, description: f.description || undefined, owner: f.owner, dueOn: f.dueOn }), () => { refresh(); onClose(); });
  };
  return (
    <Modal title="Add a step" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="form-grid">
          <Field label="Step"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} minLength={3} maxLength={120} required /></Field>
          <Field label="Who does it"><select value={f.owner} onChange={(e) => setF({ ...f, owner: e.target.value as Owner })}>{OWNERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
          <Field label="Due on"><input type="date" value={f.dueOn} onChange={(e) => setF({ ...f, dueOn: e.target.value })} required /></Field>
          <Field label="Details (optional)"><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={500} /></Field>
        </div>
        <ErrorText>{act.error}</ErrorText>
        <div className="row"><button className="btn primary" disabled={act.pending}>Add step</button><button type="button" className="btn" onClick={onClose}>Cancel</button></div>
      </form>
    </Modal>
  );
}

/** One person's onboarding on their profile. Shows nothing when there is no checklist and the viewer cannot start one. */
export function OnboardingCard({ employeeId }: { employeeId: string }) {
  const q = useQuery({ queryKey: ['onboarding', employeeId], queryFn: () => api.get<Checklist>(`/onboarding/employee/${employeeId}`) });
  const start = useAction();
  const refresh = useRefresh();
  const [adding, setAdding] = useState(false);
  if (q.isLoading) return <Loading />;
  const c = q.data;
  if (!c || (!c.tasks.length && !c.canStart)) return null;
  const hr = c.tasks.some((t) => t.can.remove) || c.canStart;
  const pct = c.summary.total ? Math.round(((c.summary.done + c.summary.skipped) / c.summary.total) * 100) : 0;
  return (
    <div className="card">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ marginBottom: 4 }}>Onboarding</h2>
        {hr && c.tasks.length > 0 && <button className="btn" onClick={() => setAdding(true)}>Add a step</button>}
      </div>
      {c.canStart ? (
        <>
          <p className="muted">No checklist yet. Start the company's onboarding steps for this person.</p>
          <button className="btn primary" disabled={start.pending} onClick={() => start.run(() => api.post(`/onboarding/employee/${employeeId}/start`, {}), refresh)}>Start onboarding</button>
          <ErrorText>{start.error}</ErrorText>
        </>
      ) : (
        <>
          <p style={{ marginTop: 0 }}>
            {c.summary.open === 0 ? <span className="badge ok">Complete</span> : <>{c.summary.done + c.summary.skipped} of {c.summary.total} steps done</>}{' '}
            {c.summary.overdue > 0 && <span className="badge bad">{c.summary.overdue} overdue</span>}
          </p>
          <ProgressBar value={pct} />
          <ul className="plain" style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>{c.tasks.map((t) => <TaskRow key={t.id} t={t} />)}</ul>
        </>
      )}
      {adding && <AddStep employeeId={employeeId} onClose={() => setAdding(false)} />}
    </div>
  );
}

/** The onboarding steps waiting on the signed-in person, across everyone they are responsible for. */
export function MyOnboardingSteps() {
  const q = useQuery({ queryKey: ['onboarding-mine'], queryFn: () => api.get<MineTask[]>('/onboarding/mine') });
  if (!q.data?.length) return null;
  return (
    <div className="card">
      <h2 style={{ marginBottom: 4 }}>Onboarding steps for you</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {q.data.slice(0, 10).map((t) => <TaskRow key={t.id} t={t} who={`${t.employee.firstName} ${t.employee.lastName}`} />)}
      </ul>
      {q.data.length > 10 && <p className="muted">And {q.data.length - 10} more. Open a person's profile to see all of their steps.</p>}
      {q.data.length <= 10 && q.data[0] && <p className="muted" style={{ marginBottom: 0 }}><Link to={`/employees/${q.data[0].employee.id}`}>Open {q.data[0].employee.firstName}'s profile</Link></p>}
    </div>
  );
}

interface Step { title: string; description: string; owner: Owner; dueAfterDays: number }

/** Settings → Onboarding: the standard checklist every new joiner gets. */
export function OnboardingTemplate() {
  const q = useQuery({ queryKey: ['onboarding-template'], queryFn: () => api.get<{ title: string; description: string | null; owner: Owner; dueAfterDays: number }[]>('/onboarding/template') });
  const qc = useQueryClient();
  const act = useAction();
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [saved, setSaved] = useState(false);
  if (q.isLoading) return <Loading />;
  const list: Step[] = steps ?? (q.data ?? []).map((t) => ({ ...t, description: t.description ?? '' }));
  const change = (next: Step[]) => { setSteps(next); setSaved(false); };
  const set = (i: number, patch: Partial<Step>) => change(list.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i: number, d: number) => {
    const next = [...list];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    change(next);
  };
  const save = (e: FormEvent) => {
    e.preventDefault();
    act.run(() => api.put('/onboarding/template', { tasks: list.map((s) => ({ title: s.title, description: s.description || undefined, owner: s.owner, dueAfterDays: Number(s.dueAfterDays) })) }), () => {
      setSteps(null); setSaved(true); qc.invalidateQueries({ queryKey: ['onboarding-template'] });
    });
  };
  return (
    <form onSubmit={save} className="card">
      <h2 style={{ marginTop: 0 }}>Onboarding checklist</h2>
      <p className="muted">Every new employee gets these steps automatically. Each step is due a number of days after their joining date. Checklists already started are not changed.</p>
      {list.length === 0 && <Empty>No steps yet. Add the first one.</Empty>}
      {list.map((s, i) => (
        <div key={i} className="form-grid" style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <Field label={`Step ${i + 1}`}><input value={s.title} onChange={(e) => set(i, { title: e.target.value })} minLength={3} maxLength={120} required /></Field>
          <Field label="Who does it"><select value={s.owner} onChange={(e) => set(i, { owner: e.target.value as Owner })}>{OWNERS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></Field>
          <Field label="Days after joining"><input type="number" min={0} max={365} step={1} value={s.dueAfterDays} onChange={(e) => set(i, { dueAfterDays: Number(e.target.value) })} required /></Field>
          <Field label="Details (optional)"><input value={s.description} onChange={(e) => set(i, { description: e.target.value })} maxLength={500} /></Field>
          <div className="row">
            <button type="button" className="btn" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move step ${i + 1} up`}>Up</button>
            <button type="button" className="btn" disabled={i === list.length - 1} onClick={() => move(i, 1)} aria-label={`Move step ${i + 1} down`}>Down</button>
            <button type="button" className="btn" onClick={() => change(list.filter((_, j) => j !== i))} aria-label={`Remove step ${i + 1}`}>Remove</button>
          </div>
        </div>
      ))}
      <ErrorText>{act.error}</ErrorText>
      <div className="row" style={{ marginTop: 12 }}>
        <button type="button" className="btn" disabled={list.length >= 40} onClick={() => change([...list, { title: '', description: '', owner: 'HR', dueAfterDays: 0 }])}>Add a step</button>
        <button className="btn primary" disabled={act.pending || steps === null}>Save checklist</button>
        {saved && <span className="badge ok" role="status">Saved</span>}
      </div>
    </form>
  );
}
