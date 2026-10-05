import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-start justify-center px-4 py-24 sm:mx-auto sm:max-w-2xl sm:px-6">
      <p className="font-display text-sm font-bold text-brand-soft">404</p>
      <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight sm:text-6xl">
        Page not found
      </h1>
      <p className="mt-5 text-lg leading-8 text-muted">
        The page you are looking for does not exist or has been moved.
      </p>
      <div className="mt-9">
        <ButtonLink href="/">
          Back to home
        </ButtonLink>
      </div>
    </main>
  );
}
