import {
  EnvelopeSimple,
  FacebookLogo,
  MapPin,
} from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import { ContactForm } from "@/components/ContactForm";
import { Reveal } from "@/components/Reveal";
import { Container, PageHeader } from "@/components/ui";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Tell us about your project and we will get back to you.",
};

const linkClass =
  "mt-1 block font-medium transition-colors duration-300 ease-snap hover:text-brand-soft";

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="Contact"
        title="Let's talk about your project"
        text="Share a few details about what you need. The more context you give us, the more useful our first reply will be."
      />

      <section className="py-20 sm:py-28">
        <Container className="grid gap-14 lg:grid-cols-[1.7fr_1fr] lg:gap-24">
          <Reveal>
            <ContactForm />
          </Reveal>

          <Reveal delay={0.1}>
            <aside className="space-y-9">
              <div className="flex gap-4">
                <EnvelopeSimple
                  aria-hidden
                  className="mt-0.5 size-6 shrink-0 text-brand-soft"
                />
                <div>
                  <h2 className="text-sm text-muted">Email</h2>
                  <a href={`mailto:${site.email}`} className={linkClass}>
                    {site.email}
                  </a>
                </div>
              </div>
              <div className="flex gap-4">
                <FacebookLogo
                  aria-hidden
                  className="mt-0.5 size-6 shrink-0 text-brand-soft"
                />
                <div>
                  <h2 className="text-sm text-muted">Facebook</h2>
                  <a
                    href={site.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClass}
                  >
                    Follow us on Facebook
                  </a>
                </div>
              </div>
              <div className="flex gap-4">
                <MapPin
                  aria-hidden
                  className="mt-0.5 size-6 shrink-0 text-brand-soft"
                />
                <div>
                  <h2 className="text-sm text-muted">Location</h2>
                  <p className="mt-1 font-medium">{site.location}</p>
                </div>
              </div>
            </aside>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
