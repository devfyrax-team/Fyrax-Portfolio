"use client";

import { CheckCircle } from "@phosphor-icons/react";
import { useActionState } from "react";
import {
  type ContactState,
  submitContact,
} from "@/app/(site)/contact/actions";

const initialState: ContactState = { status: "idle" };

const inputClass =
  "mt-2 block w-full border border-line-strong bg-ink px-4 py-3 text-paper transition-colors duration-300 ease-snap focus:border-brand-soft focus:outline-none aria-[invalid=true]:border-brand-soft";

function FieldError({ id, errors }: { id: string; errors?: string[] }) {
  if (!errors?.length) return null;
  return (
    <p id={id} className="mt-2 text-sm text-brand-soft">
      {errors[0]}
    </p>
  );
}

export function ContactForm() {
  const [state, action, pending] = useActionState(submitContact, initialState);

  if (state.status === "success") {
    return (
      <div role="status" className="clip-corner bg-surface p-8 sm:p-10">
        <CheckCircle aria-hidden className="size-10 text-brand-soft" />
        <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight">
          Message sent
        </h2>
        <p className="mt-3 text-lg leading-8 text-muted">
          Thank you for getting in touch. We have received your message and
          will reply by email.
        </p>
      </div>
    );
  }

  const { errors, values } = state;

  return (
    <form action={action} noValidate className="clip-corner bg-surface p-6 sm:p-10">
      {state.status === "error" && state.message && (
        <p
          role="alert"
          className="mb-6 border-l-2 border-brand bg-brand/10 px-4 py-3 text-sm"
        >
          {state.message}
        </p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            required
            defaultValue={values?.name}
            aria-invalid={Boolean(errors?.name)}
            aria-describedby={errors?.name ? "name-error" : undefined}
            className={inputClass}
          />
          <FieldError id="name-error" errors={errors?.name} />
        </div>

        <div>
          <label htmlFor="email" className="text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={values?.email}
            aria-invalid={Boolean(errors?.email)}
            aria-describedby={errors?.email ? "email-error" : undefined}
            className={inputClass}
          />
          <FieldError id="email-error" errors={errors?.email} />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="company" className="text-sm font-medium">
            Company <span className="text-muted">(optional)</span>
          </label>
          <input
            id="company"
            name="company"
            type="text"
            autoComplete="organization"
            defaultValue={values?.company}
            aria-invalid={Boolean(errors?.company)}
            aria-describedby={errors?.company ? "company-error" : undefined}
            className={inputClass}
          />
          <FieldError id="company-error" errors={errors?.company} />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="message" className="text-sm font-medium">
            What would you like to build?
          </label>
          <textarea
            id="message"
            name="message"
            rows={6}
            required
            defaultValue={values?.message}
            aria-invalid={Boolean(errors?.message)}
            aria-describedby={errors?.message ? "message-error" : undefined}
            className={inputClass}
          />
          <FieldError id="message-error" errors={errors?.message} />
        </div>

        {/* Honeypot: hidden from people, tempting for bots. */}
        <div aria-hidden className="absolute -left-[9999px] size-px overflow-hidden">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            type="text"
            tabIndex={-1}
            autoComplete="off"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="clip-corner-sm mt-8 bg-brand-strong px-7 py-3.5 text-sm font-semibold text-white transition-[background-color,transform] duration-300 ease-snap hover:bg-brand-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
