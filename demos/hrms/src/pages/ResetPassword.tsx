import { FormEvent, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { ErrorText, Field, useAction } from '../components/ui';

// Handles both "forgot password" links and new-user invitations: the server treats them the same way.
export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const invited = params.get('invite') === '1';
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const [tenant, setTenant] = useState<string | null>(null);
  const { run, pending, error, setError } = useAction();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (password !== again) return setError('The two passwords do not match');
    run(async () => {
      const r = await api.post<{ tenant: string }>('/auth/reset-password', { token, password });
      setTenant(r.tenant);
    });
  };

  if (!token) {
    return (
      <div className="auth">
        <div className="card">
          <h1>Link not valid</h1>
          <p>This page needs the link from your email. Request a new one from the sign-in page.</p>
          <Link className="btn primary" to="/login">Go to sign in</Link>
        </div>
      </div>
    );
  }

  if (tenant) {
    return (
      <div className="auth">
        <div className="card">
          <h1>{invited ? 'Welcome aboard' : 'Password changed'}</h1>
          <p role="status">
            {invited ? 'Your password is set. Sign in to get started.' : 'Your password is changed. You have been signed out everywhere else, so sign in with the new one.'}
          </p>
          <Link className="btn primary" style={{ width: '100%', textAlign: 'center' }} to={`/login?tenant=${encodeURIComponent(tenant)}`}>Sign in</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth">
      <form className="card" onSubmit={submit}>
        <h1>{invited ? 'Choose your password' : 'Choose a new password'}</h1>
        <Field label="New password" hint="At least 8 characters, with a letter and a number">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" autoFocus />
        </Field>
        <Field label="Repeat the password">
          <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} required minLength={8} autoComplete="new-password" />
        </Field>
        <ErrorText>{error}</ErrorText>
        <button className="btn primary" style={{ width: '100%' }} disabled={pending}>{pending ? 'Saving…' : 'Set password'}</button>
        <p style={{ textAlign: 'center', marginBottom: 0 }}><Link to="/login">Back to sign in</Link></p>
      </form>
    </div>
  );
}
