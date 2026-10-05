import { FormEvent, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { ErrorText, Field, useAction } from '../components/ui';

// Companies are created by super administrators, so there is no "register" option here.
export function Login() {
  const { user, admin, login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [forgot, setForgot] = useState(false);
  const { run, pending, error } = useAction();
  const [sent, setSent] = useState(false);
  const [f, setF] = useState({ tenant: params.get('tenant') ?? '', email: '', password: '' });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  if (user) return <Navigate to="/" replace />;
  if (admin) return <Navigate to="/platform" replace />;

  const toggle = (v: boolean) => { setForgot(v); setSent(false); };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (forgot) {
      run(async () => { await api.post('/auth/forgot-password', { tenant: f.tenant, email: f.email }); setSent(true); });
      return;
    }
    run(() => login(f.tenant, f.email, f.password), () => navigate('/', { replace: true }));
  };

  return (
    <div className="auth">
      <form className="card" onSubmit={submit}>
        <h1>{forgot ? 'Reset your password' : 'Sign in'}</h1>
        {forgot && sent ? (
          <>
            <p role="status">If an account exists for that email, we have sent a link to reset the password. It works once and expires in an hour.</p>
            <button type="button" className="btn primary" style={{ width: '100%' }} onClick={() => toggle(false)}>Back to sign in</button>
          </>
        ) : (
          <>
            <p className="muted" style={{ marginTop: 0 }}>
              {forgot ? 'Enter your company code and email and we will send you a link.' : 'Use your company code, email and password.'}
            </p>
            <Field label="Company code">
              <input value={f.tenant} onChange={set('tenant')} required minLength={2} pattern="[a-z0-9\-]+" autoCapitalize="none" />
            </Field>
            <Field label="Email">
              <input type="email" value={f.email} onChange={set('email')} required autoComplete="username" />
            </Field>
            {!forgot && (
              <Field label="Password">
                <input type="password" value={f.password} onChange={set('password')} required autoComplete="current-password" />
              </Field>
            )}
            <ErrorText>{error}</ErrorText>
            <button className="btn primary" style={{ width: '100%' }} disabled={pending}>
              {pending ? 'Please wait…' : forgot ? 'Send reset link' : 'Sign in'}
            </button>
            <div className="auth-links">
              <button type="button" className="btn ghost" onClick={() => toggle(!forgot)}>{forgot ? 'Back to sign in' : 'Forgot password?'}</button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
