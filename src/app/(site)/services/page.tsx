import { Check } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import { serviceSpans } from "@/components/cards";
import { CallToAction } from "@/components/CallToAction";
import { Reveal } from "@/components/Reveal";
import { Container, PageHeader } from "@/components/ui";
import { services } from "@/content/services";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Web development, mobile apps, UI/UX design, cloud and DevOps, automation and ongoing support.",
};

export default function ServicesPage() {
  return (
    <>
      <PageHeader
        eyebrow="Services"
        title="Everything you need to ship and run software"
        text="Hire us for a single piece of work or for the whole product. Either way you get one accountable team."
      />

      <section className="py-20 sm:py-28">
        <Container>
          <div className="grid gap-4 lg:grid-cols-6">
            {services.map((service, index) => {
              const Icon = service.icon;
              return (
                <Reveal
                  key={service.slug}
                  className={serviceSpans[index]}
                  delay={(index % 2) * 0.08}
                >
                  <article
                    id={service.slug}
                    className="clip-corner h-full scroll-mt-28 bg-surface p-7 sm:p-10"
                  >
                    <Icon aria-hidden className="size-9 text-brand-soft" />
                    <h2 className="mt-8 font-display text-3xl font-semibold tracking-tight">
                      {service.title}
                    </h2>
                    <p className="mt-4 max-w-[52ch] leading-7 text-muted">
                      {service.description}
                    </p>
                    <h3 className="mt-8 text-sm font-medium text-muted">
                      What you get
                    </h3>
                    <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
                      {service.deliverables.map((item) => (
                        <li key={item} className="flex gap-3">
                          <Check
                            aria-hidden
                            weight="bold"
                            className="mt-1 size-4 shrink-0 text-brand-soft"
                          />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                </Reveal>
              );
            })}
          </div>
        </Container>
      </section>

      <CallToAction />
    </>
  );
}
