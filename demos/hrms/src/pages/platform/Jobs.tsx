import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { Badge, Empty, ErrorText, Loading, useAction } from '../../components/ui';

const LABELS: Record<string, string> = {
  'probation-reminders': 'Probation reminders',
  'document-expiry-reminders': 'Document expiry reminders',
  'exit-reminders': 'Exit reminders',
  'leave-year-balances': 'Leave balances for a new year',
};

interface Run {
  id: string; company: string; slug: string; job: string; runDate: string; status: 'RUNNING' | 'DONE' | 'FAILED';
  attempts: number; startedAt: string; finishedAt: string | null; result: Record<string, number> | null; error: string | null;
}

const summary = (r: Run) => {
  if (r.error) return r.error;
  if (!r.result) return '';
  return Object.entries(r.result).map(([k, v]) => `${k}: ${v}`).join(', ');
};

// Page pattern: List. What the background jobs did, one row per company, job and day.
export function Jobs() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['platform-jobs'], refetchInterval: 30_000, queryFn: () => api.get<{ failedLastWeek: number; running: number; items: Run[] }>('/platform/jobs') });
  const run = useAction();

  return (
    <>
      <div className="row between">
        <h1>Background jobs</h1>
        <button className="btn primary" disabled={run.pending} onClick={() => run.run(() => api.post('/platform/jobs/run', {}), () => qc.invalidateQueries({ queryKey: ['platform-jobs'] }))}>
          {run.pending ? 'Running…' : 'Run due jobs now'}
        </button>
      </div>
      <p className="muted" style={{ marginTop: 0 }}>
        Each job runs once a day per company, after 07:00 company time, to send reminders and create leave balances. A failed job is tried again up to 3 times.
      </p>
      <ErrorText>{run.error}</ErrorText>
      {q.data && q.data.failedLastWeek > 0 && <p className="error" role="alert">{q.data.failedLastWeek} job run{q.data.failedLastWeek === 1 ? '' : 's'} failed in the last 7 days.</p>}
      <div className="card table-wrap">
        {q.isLoading ? <Loading /> : !q.data?.items.length ? <Empty>No jobs have run yet. They start the first time a company's morning passes while the server is running.</Empty> : (
          <table>
            <thead><tr><th>Day</th><th>Company</th><th>Job</th><th>Status</th><th>Result</th><th>Finished</th></tr></thead>
            <tbody>
              {q.data.items.map((r) => (
                <tr key={r.id}>
                  <td>{r.runDate}</td>
                  <td>{r.company} <span className="muted">{r.slug}</span></td>
                  <td>{LABELS[r.job] ?? r.job}</td>
                  <td><Badge value={r.status === 'DONE' ? 'ACTIVE' : r.status === 'FAILED' ? 'REJECTED' : 'PENDING'} />{r.attempts > 1 && <span className="muted"> · attempt {r.attempts}</span>}</td>
                  <td className="wrap">{summary(r) || <span className="muted">—</span>}</td>
                  <td className="muted">{r.finishedAt ? new Date(r.finishedAt).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
