import { FormEvent, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api';
import { useAuth } from '../../auth';
import { Badge, ErrorText, Field, Loading, day, useAction } from '../../components/ui';
import { ChangePasswordForm } from '../Account';

interface Admin { id: string; email: string; name: string; active: boolean; lastLoginAt: string | null; createdAt: string }

export function SuperAdmins() {
  const { admin } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ['platform-admins'], queryFn: () => api.get<Admin[]>('/platform/admins') });
  const [f, setF] = useState({ name: '', email: '', password: '' });
  const create = useAction();
  const act = useAction();
  const refresh = () => qc.invalidateQueries({ queryKey: ['platform-admins'] });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.run(() => api.post('/platform/admins', f), () => { setF({ name: '', email: '', password: '' }); refresh(); });
  };

  return (
    <>
      <h1>Super admins</h1>
      <p className="muted" style={{ marginTop: 0 }}>People who can manage every company. Keep this list short.</p>

      <form className="card" onSubmit={submit}>
        <h2 style={{ marginBottom: 12 }}>Add a super admin</h2>
        <div className="form-grid">
          <Field label="Name"><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required minLength={2} /></Field>
          <Field label="Email"><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></Field>
          <Field label="Password" hint="At least 8 characters, with a letter and a number. Share it securely.">
            <input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required minLength={8} autoComplete="new-password" />
          </Field>
        </div>
        <ErrorText>{create.error}</ErrorText>
        <button className="btn primary" disabled={create.pending}>{create.pending ? 'Adding…' : 'Add super admin'}</button>
      </form>

      <div className="card table-wrap">
        <ErrorText>{act.error}</ErrorText>
        {q.isLoading ? <Loading /> : (
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Last sign-in</th><th /></tr></thead>
            <tbody>
              {q.data?.map((a) => (
                <tr key={a.id}>
                  <td>{a.name}{a.id === admin?.id && <span className="muted"> (you)</span>}</td>
                  <td>{a.email}</td>
                  <td><Badge value={a.active ? 'ACTIVE' : 'CANCELLED'} /></td>
                  <td>{a.lastLoginAt ? day(a.lastLoginAt) : <span className="muted">Never</span>}</td>
                  <td>
                    {a.id !== admin?.id && (a.active ? (
                      <button
                        className="btn small danger"
                        disabled={act.pending}
                        onClick={() => window.confirm(`Deactivate ${a.name}? They are signed out immediately.`) && act.run(() => api.post(`/platform/admins/${a.id}/deactivate`), refresh)}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button className="btn small" disabled={act.pending} onClick={() => act.run(() => api.post(`/platform/admins/${a.id}/activate`), refresh)}>Reactivate</button>
                    ))}
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

export function PlatformAccount() {
  const { admin } = useAuth();
  return (
    <>
      <h1>My account</h1>
      <div className="card"><p style={{ margin: 0 }}><b>{admin!.name}</b> <span className="muted">· {admin!.email}</span></p></div>
      <ChangePasswordForm scope="platform" />
    </>
  );
}
