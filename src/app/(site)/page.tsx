import Image from "next/image";
import { CallToAction } from "@/components/CallToAction";
import { ProjectCard, ServiceTile } from "@/components/cards";
import { Process } from "@/components/Process";
import { Reveal } from "@/components/Reveal";
import {
  ButtonLink,
  Container,
  Eyebrow,
  SectionHeading,
  TextLink,
} from "@/components/ui";
import { featuredProjects } from "@/content/projects";
import { services } from "@/content/services";
import { site } from "@/content/site";

export default function HomePage() {
  const [lead, ...rest] = featuredProjects;

  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_85%_30%,var(--color-brand-tint),transparent_70%)]"
        />
        <Container className="relative grid min-h-[calc(100dvh-5rem)] items-center gap-10 pb-20 pt-16 lg:grid-cols-[2.2fr_1fr]">
          <div>
            <Reveal>
              <Eyebrow>Software and IT agency</Eyebrow>
            </Reveal>
            <Reveal delay={0.08}>
              <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.02] tracking-tighter sm:text-6xl">
                Software that moves your business{" "}
                <span className="text-brand">forward.</span>
              </h1>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="mt-7 max-w-[48ch] text-lg leading-8 text-muted sm:text-xl">
                Fyrax designs, builds and runs web apps, mobile apps and cloud
                systems for growing businesses.
              </p>
            </Reveal>
            <Reveal delay={0.24}>
              <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-5">
                <ButtonLink href={site.cta.href}>{site.cta.label}</ButtonLink>
                <TextLink href="/projects">See our work</TextLink>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.2} y={40} className="hidden lg:block">
            <Image
              src="/logo-mark.png"
              alt=""
              aria-hidden
              width={207}
              height={332}
              priority
              className="ml-auto h-[26rem] w-auto"
            />
          </Reveal>
        </Container>
      </section>

      <section className="py-24 sm:py-36">
        <Container>
          <Reveal>
            <SectionHeading
              title="Everything from first sketch to production."
              text="Strategy, design, engineering and operations in one team, so nothing gets lost between hand-offs."
            />
          </Reveal>
          <div className="mt-16 grid gap-4 lg:grid-cols-6">
            {services.map((service, index) => (
              <ServiceTile key={service.slug} service={service} index={index} />
            ))}
          </div>
          <div className="mt-10">
            <TextLink href="/services">All services</TextLink>
          </div>
        </Container>
      </section>

      <section className="border-y border-line/60 bg-surface/40 py-24 sm:py-36">
        <Container>
          <Reveal>
            <SectionHeading
              title="Selected work"
              text="A few of the problems we have solved for clients, and what changed afterwards."
            />
          </Reveal>
          <div className="mt-16 grid gap-4 lg:grid-cols-5 lg:grid-rows-2">
            <ProjectCard
              project={lead}
              index={0}
              large
              className="lg:col-span-3 lg:row-span-2"
            />
            {rest.map((project, i) => (
              <ProjectCard
                key={project.slug}
                project={project}
                index={i + 1}
                className="lg:col-span-2"
              />
            ))}
          </div>
          <div className="mt-10">
            <TextLink href="/projects">See our work</TextLink>
          </div>
        </Container>
      </section>

      <Process />
      <CallToAction />
    </>
  );
}
