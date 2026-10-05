import { FormEvent, useState } from 'react';
import { api, Scope, setTokens } from '../api';
import { useAuth } from '../auth';
import { ErrorText, Field, useAction } from '../components/ui';

/** Used for company users and for super admins: only the endpoint and session kind differ. */
export function ChangePasswordForm({ scope }: { scope: Scope }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [done, setDone] = useState(false);
  const { run, pending, error, setError } = useAction();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setDone(false);
    if (next !== again) return setError('The two new passwords do not match');
    run(async () => {
      // The server signs out every other device and hands this one a fresh session.
      const path = scope === 'platform' ? '/platform/auth/change-password' : '/auth/change-password';
      setTokens(await api.post<{ accessToken: string }>(path, { currentPassword: current, newPassword: next }), scope);
      setCurrent(''); setNext(''); setAgain('');
      setDone(true);
    });
  };

  return (
    <form className="card" onSubmit={submit} style={{ maxWidth: 480 }}>
      <h2 style={{ marginBottom: 12 }}>Change password</h2>
      <Field label="Current password">
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required autoComplete="current-password" />
      </Field>
      <Field label="New password" hint="At least 8 characters, with a letter and a number">
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} required minLength={8} autoComplete="new-password" />
      </Field>
      <Field label="Repeat the new password">
        <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} required minLength={8} autoComplete="new-password" />
      </Field>
      <ErrorText>{error}</ErrorText>
      {done && <p className="notice" role="status">Password changed. You were signed out on all your other devices.</p>}
      <button className="btn primary" disabled={pending}>{pending ? 'Saving…' : 'Change password'}</button>
    </form>
  );
}

export function Account() {
  const { user } = useAuth();
  return (
    <>
      <h1>My account</h1>
      <div className="card">
        <p style={{ margin: 0 }}><b>{user!.email}</b> <span className="muted">· {user!.role.toLowerCase()}</span></p>
      </div>
      <ChangePasswordForm scope="tenant" />
    </>
  );
}
