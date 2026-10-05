import { Reveal } from "@/components/Reveal";
import { ButtonLink, Container } from "@/components/ui";
import { site } from "@/content/site";

export function CallToAction() {
  return (
    <section className="pb-24 pt-8 sm:pb-36">
      <Container>
        <Reveal>
          <div className="clip-corner relative overflow-hidden bg-gradient-to-br from-brand-tint via-surface to-surface px-7 py-16 sm:px-14 sm:py-24">
            <div
              aria-hidden
              className="absolute inset-0 bg-[radial-gradient(ellipse_50%_90%_at_100%_100%,rgb(242_33_37/0.16),transparent_70%)]"
            />
            <div className="relative max-w-2xl">
              <h2 className="font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
                Have a project in mind?
              </h2>
              <p className="mt-6 max-w-[48ch] text-lg leading-8 text-muted">
                Tell us what you are trying to build and we will get back to
                you with next steps.
              </p>
              <div className="mt-10">
                <ButtonLink href={site.cta.href}>{site.cta.label}</ButtonLink>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
