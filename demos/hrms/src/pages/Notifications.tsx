import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api';
import { Empty, ErrorText, Loading, Pager, useAction } from '../components/ui';

interface Notif {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}
interface Page { total: number; page: number; pageSize: number; unread: number; items: Notif[] }

/** "5 minutes ago", "2 days ago", or the date for anything older than a week. */
function ago(iso: string) {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)} d ago`;
  return new Date(iso).toLocaleDateString();
}

export function Notifications() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const act = useAction();

  const list = useQuery({
    queryKey: ['notifications', page, unreadOnly],
    queryFn: () => api.get<Page>(`/notifications?page=${page}${unreadOnly ? '&unread=1' : ''}`),
  });
  const prefs = useQuery({ queryKey: ['notif-prefs'], queryFn: () => api.get<{ email: boolean }>('/notifications/preferences') });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['notifications'] });
    qc.invalidateQueries({ queryKey: ['notif-count'] });
  };

  const open = (n: Notif) =>
    act.run(async () => {
      if (!n.readAt) await api.post(`/notifications/${n.id}/read`);
      refresh();
      if (n.link) navigate(n.link);
    });

  return (
    <>
      <div className="row between">
        <h1>Notifications</h1>
        <button className="btn" disabled={act.pending || !list.data?.unread} onClick={() => act.run(() => api.post('/notifications/read-all'), refresh)}>
          Mark all as read
        </button>
      </div>

      <div className="row" style={{ marginBottom: 12, gap: 24 }}>
        <label className="check" style={{ margin: 0 }}>
          <input
            type="checkbox"
            checked={prefs.data?.email ?? true}
            disabled={!prefs.data || act.pending}
            onChange={(e) => act.run(() => api.put('/notifications/preferences', { email: e.target.checked }), () => qc.invalidateQueries({ queryKey: ['notif-prefs'] }))}
          />
          Email me when something needs my attention
        </label>
        <label className="check" style={{ margin: 0 }}>
          <input type="checkbox" checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }} />
          Show unread only
        </label>
      </div>
      <ErrorText>{act.error}</ErrorText>

      <div className="card" style={{ padding: 0 }}>
        {list.isLoading ? <div style={{ padding: 16 }}><Loading /></div> : list.error ? <p className="error">{(list.error as Error).message}</p> : !list.data?.items.length ? (
          <div style={{ padding: '0 16px' }}><Empty>{unreadOnly ? 'Nothing unread.' : 'No notifications yet. You will be told here when something needs your attention.'}</Empty></div>
        ) : (
          <ul className="notif-list">
            {list.data.items.map((n) => (
              <li key={n.id} className={n.readAt ? 'notif' : 'notif unread'}>
                <button className="notif-body" onClick={() => open(n)}>
                  <span className="notif-title">{!n.readAt && <span className="dot" aria-label="unread" />}{n.title}</span>
                  {n.body && <span className="notif-text">{n.body}</span>}
                  <span className="muted notif-time">{ago(n.createdAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {list.data && <div style={{ padding: '0 16px 12px' }}><Pager page={list.data.page} pageSize={list.data.pageSize} total={list.data.total} onChange={setPage} /></div>}
      </div>
    </>
  );
}
