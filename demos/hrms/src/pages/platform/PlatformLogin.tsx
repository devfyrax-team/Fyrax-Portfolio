import { FormEvent, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth';
import { ErrorText, Field, useAction } from '../../components/ui';

export function PlatformLogin() {
  const { user, admin, loginPlatform } = useAuth();
  const navigate = useNavigate();
  const { run, pending, error } = useAction();
  const [f, setF] = useState({ email: '', password: '' });

  if (admin) return <Navigate to="/platform" replace />;
  if (user) return <Navigate to="/" replace />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run(() => loginPlatform(f.email, f.password), () => navigate('/platform', { replace: true }));
  };

  return (
    <div className="auth">
      <form className="card" onSubmit={submit}>
        <h1>Platform sign-in</h1>
        <p className="muted" style={{ marginTop: 0 }}>For system administrators who manage companies.</p>
        <Field label="Email">
          <input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required autoComplete="username" />
        </Field>
        <Field label="Password">
          <input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required autoComplete="current-password" />
        </Field>
        <ErrorText>{error}</ErrorText>
        <button className="btn primary" style={{ width: '100%' }} disabled={pending}>{pending ? 'Please wait…' : 'Sign in'}</button>
        <div className="auth-links">
          <Link to="/login" className="btn ghost">Company sign-in</Link>
        </div>
      </form>
    </div>
  );
}
