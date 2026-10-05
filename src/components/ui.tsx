import { ArrowRight } from "@phosphor-icons/react/ssr";
import Link from "next/link";
import type { ReactNode } from "react";
import { Reveal } from "@/components/Reveal";

const press =
  "transition-[background-color,transform] duration-300 ease-snap active:scale-[0.98]";

export function ButtonLink({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
}) {
  const styles =
    variant === "primary"
      ? "bg-brand-strong text-white hover:bg-brand-deep"
      : "bg-surface-2 text-paper hover:bg-line";

  return (
    <Link
      href={href}
      className={`clip-corner-sm group inline-flex items-center gap-3 whitespace-nowrap px-6 py-3.5 text-sm font-semibold ${press} ${styles}`}
    >
      {children}
      <ArrowRight
        aria-hidden
        weight="bold"
        className="size-4 transition-transform duration-300 ease-snap group-hover:translate-x-1"
      />
    </Link>
  );
}

export function TextLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group inline-flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-paper underline decoration-line-strong decoration-1 underline-offset-[6px] transition-colors duration-300 ease-snap hover:decoration-brand-soft"
    >
      {children}
      <ArrowRight
        aria-hidden
        weight="bold"
        className="size-4 text-brand-soft transition-transform duration-300 ease-snap group-hover:translate-x-1"
      />
    </Link>
  );
}

export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-6xl px-4 sm:px-6 ${className}`}>
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-3 text-sm font-medium text-brand-soft">
      <span aria-hidden className="h-px w-8 bg-brand" />
      {children}
    </p>
  );
}

// Headline with the explanation stacked underneath, not split into columns.
export function SectionHeading({
  title,
  text,
}: {
  title: string;
  text?: string;
}) {
  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl sm:leading-[1.05]">
        {title}
      </h2>
      {text && (
        <p className="mt-5 max-w-[56ch] text-lg leading-8 text-muted">{text}</p>
      )}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  text,
}: {
  eyebrow: string;
  title: string;
  text: string;
}) {
  return (
    <section className="relative overflow-hidden border-b border-line/60">
      <div
        aria-hidden
        className="absolute inset-0 bg-[radial-gradient(ellipse_70%_90%_at_85%_0%,var(--color-brand-tint),transparent_70%)]"
      />
      <Container className="relative pb-20 pt-24 sm:pb-28 sm:pt-32">
        <Reveal>
          <Eyebrow>{eyebrow}</Eyebrow>
        </Reveal>
        <Reveal delay={0.08}>
          <h1 className="mt-6 max-w-4xl font-display text-4xl font-semibold leading-[1.02] tracking-tighter sm:text-6xl lg:text-7xl">
            {title}
          </h1>
        </Reveal>
        <Reveal delay={0.16}>
          <p className="mt-7 max-w-[56ch] text-lg leading-8 text-muted">
            {text}
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
