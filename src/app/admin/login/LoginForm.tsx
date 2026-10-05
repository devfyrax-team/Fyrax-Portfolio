"use client";

import { useActionState } from "react";
import { type LoginState, login } from "../actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <form action={action} className="mt-8">
      <label htmlFor="password" className="text-sm font-medium">
        Password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        aria-invalid={Boolean(state.error)}
        aria-describedby={state.error ? "password-error" : undefined}
        className="mt-2 block w-full border border-line bg-ink px-4 py-3 text-paper focus:border-brand-soft focus:outline-none"
      />
      {state.error && (
        <p id="password-error" role="alert" className="mt-2 text-sm text-brand-soft">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="clip-corner-sm mt-6 w-full bg-brand-strong px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-brand disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
