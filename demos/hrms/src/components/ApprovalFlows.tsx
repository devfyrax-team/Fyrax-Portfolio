import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { Empty, ErrorText, Loading, useAction } from './ui';

type Step =
  | { kind: 'MANAGER'; label?: string }
  | { kind: 'ROLE'; role: 'HR' | 'ADMIN'; label?: string }
  | { kind: 'USER'; userId: string; label?: string };

interface Flow { type: string; label: string; isDefault: boolean; steps: Step[] }

// The editor exposes one dropdown value per step: MANAGER | HR | ADMIN | USER.
const choiceOf = (s: Step) => (s.kind === 'ROLE' ? s.role : s.kind);

function FlowEditor({ flow, users }: { flow: Flow; users: { id: string; email: string }[] }) {
  const qc = useQueryClient();
  const [steps, setSteps] = useState<Step[]>(flow.steps);
  const { run, pending, error } = useAction();
  const [saved, setSaved] = useState(false);
  useEffect(() => setSteps(flow.steps), [flow]);

  const change = (i: number, choice: string) => {
    const next: Step =
      choice === 'MANAGER' ? { kind: 'MANAGER' }
      : choice === 'USER' ? { kind: 'USER', userId: users[0]?.id ?? '' }
      : { kind: 'ROLE', role: choice as 'HR' | 'ADMIN' };
    setSteps(steps.map((s, j) => (j === i ? next : s)));
    setSaved(false);
  };

  return (
    <div className="card">
      <div className="row between">
        <h2>{flow.label}</h2>
        <span className="muted">{flow.isDefault ? 'Default: manager only' : 'Customised'}</span>
      </div>
      <ol className="flow-steps">
        {steps.map((s, i) => (
          <li key={i} className="row">
            <span className="muted">Step {i + 1}</span>
            <select value={choiceOf(s)} onChange={(e) => change(i, e.target.value)} aria-label={`Approver for step ${i + 1}`}>
              <option value="MANAGER">Requester's manager</option>
              <option value="HR">HR</option>
              <option value="ADMIN">Administrator</option>
              <option value="USER">A specific person…</option>
            </select>
            {s.kind === 'USER' && (
              <select
                value={s.userId}
                onChange={(e) => { setSteps(steps.map((x, j) => (j === i ? { kind: 'USER', userId: e.target.value } : x))); setSaved(false); }}
                aria-label={`Person for step ${i + 1}`}
              >
                {users.map((u) => <option key={u.id} value={u.id}>{u.email}</option>)}
              </select>
            )}
            <button className="btn small ghost" disabled={steps.length === 1} onClick={() => { setSteps(steps.filter((_, j) => j !== i)); setSaved(false); }}>
              Remove
            </button>
          </li>
        ))}
      </ol>
      <ErrorText>{error}</ErrorText>
      <div className="row">
        <button className="btn" disabled={steps.length >= 5} onClick={() => { setSteps([...steps, { kind: 'ROLE', role: 'HR' }]); setSaved(false); }}>Add step</button>
        <button
          className="btn primary"
          disabled={pending}
          onClick={() => run(() => api.put(`/workflows/${flow.type}`, { steps }), () => { setSaved(true); qc.invalidateQueries({ queryKey: ['workflows'] }); qc.invalidateQueries({ queryKey: ['request-types'] }); })}
        >
          {pending ? 'Saving…' : 'Save flow'}
        </button>
        {saved && <span className="muted" role="status">Saved. Requests already submitted keep the flow they started with.</span>}
      </div>
    </div>
  );
}

export function ApprovalFlows() {
  const flows = useQuery({ queryKey: ['workflows'], queryFn: () => api.get<Flow[]>('/workflows') });
  const users = useQuery({ queryKey: ['users'], queryFn: () => api.get<{ id: string; email: string }[]>('/users') });
  if (flows.isLoading) return <Loading />;
  if (flows.error) return <p className="error">{(flows.error as Error).message}</p>;
  if (!flows.data?.length) return <Empty>No request types.</Empty>;
  return (
    <>
      <p className="muted" style={{ marginTop: 0 }}>
        Each request goes through these steps in order. An administrator can act on any step, and nobody can approve their own request.
        If the requester has no manager, HR covers the manager step.
      </p>
      {flows.data.map((f) => <FlowEditor key={f.type} flow={f} users={users.data ?? []} />)}
    </>
  );
}
