import { ArrowLeft, ArrowRight, ArrowSquareOut, Check } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CallToAction } from "@/components/CallToAction";
import { ProjectCover } from "@/components/cards";
import { Reveal } from "@/components/Reveal";
import { Container, Eyebrow } from "@/components/ui";
import { getProject, projects } from "@/content/projects";

export const dynamicParams = false;

export function generateStaticParams() {
  return projects.map((project) => ({ slug: project.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/projects/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) return {};
  return { title: project.title, description: project.summary };
}

export default async function ProjectPage({
  params,
}: PageProps<"/projects/[slug]">) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const index = projects.indexOf(project);
  const next = projects[(index + 1) % projects.length];

  const facts = [
    { label: "Client", value: project.client },
    { label: "Year", value: project.year },
    { label: "Type", value: project.category },
  ];

  return (
    <>
      <section className="relative overflow-hidden border-b border-line/60">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(ellipse_70%_90%_at_85%_0%,var(--color-brand-tint),transparent_70%)]"
        />
        <Container className="relative pb-20 pt-24 sm:pb-28 sm:pt-32">
          <Link
            href="/projects"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors duration-300 ease-snap hover:text-paper"
          >
            <ArrowLeft aria-hidden className="size-4" />
            All projects
          </Link>
          <Reveal>
            <div className="mt-8">
              <Eyebrow>{project.category}</Eyebrow>
            </div>
            <h1 className="mt-6 max-w-4xl font-display text-4xl font-semibold leading-[1.02] tracking-tighter sm:text-6xl lg:text-7xl">
              {project.title}
            </h1>
            <p className="mt-7 max-w-[56ch] text-lg leading-8 text-muted">
              {project.summary}
            </p>
          </Reveal>
          {project.demoUrl && (
            <a
              href={project.demoUrl}
              target="_blank"
              rel="noopener"
              className="clip-corner-sm group mt-10 inline-flex items-center gap-3 whitespace-nowrap bg-brand-strong px-6 py-3.5 text-sm font-semibold text-white transition-[background-color,transform] duration-300 ease-snap hover:bg-brand-deep active:scale-[0.98]"
            >
              Launch live demo
              <ArrowSquareOut aria-hidden weight="bold" className="size-4" />
            </a>
          )}
          <dl className="mt-12 grid max-w-2xl gap-6 border-t border-line pt-8 sm:grid-cols-3">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="text-sm text-muted">{fact.label}</dt>
                <dd className="mt-1 font-medium">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <section className="py-20 sm:py-28">
        <Container>
          <Reveal>
            {project.demoUrl ? (
              <div className="clip-corner overflow-hidden border border-line bg-surface">
                <iframe
                  src={project.demoUrl}
                  title={`${project.title} live demo`}
                  loading="lazy"
                  className="block h-[70vh] min-h-[480px] w-full bg-white"
                />
                <p className="px-5 py-3 text-sm text-muted">
                  Interactive demo with sample data. Changes are not saved.
                </p>
              </div>
            ) : (
              <ProjectCover
                index={index}
                className="clip-corner aspect-[16/8] w-full"
              />
            )}
          </Reveal>

          <div className="mt-20 grid gap-16 lg:grid-cols-[1.6fr_1fr] lg:gap-24">
            <div className="space-y-14">
              <Reveal>
                <h2 className="font-display text-3xl font-semibold tracking-tight">
                  The challenge
                </h2>
                <p className="mt-4 max-w-[60ch] text-lg leading-8 text-muted">
                  {project.challenge}
                </p>
              </Reveal>
              <Reveal>
                <h2 className="font-display text-3xl font-semibold tracking-tight">
                  What we built
                </h2>
                <p className="mt-4 max-w-[60ch] text-lg leading-8 text-muted">
                  {project.solution}
                </p>
              </Reveal>
            </div>

            <Reveal className="space-y-10">
              <div className="clip-corner bg-surface p-7 sm:p-9">
                <h2 className="font-display text-xl font-semibold tracking-tight">
                  Outcomes
                </h2>
                <ul className="mt-5 space-y-4">
                  {project.outcomes.map((outcome) => (
                    <li key={outcome} className="flex gap-3">
                      <Check
                        aria-hidden
                        weight="bold"
                        className="mt-1 size-4 shrink-0 text-brand-soft"
                      />
                      <span>{outcome}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight">
                  Technology
                </h2>
                <ul className="mt-4 flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <li
                      key={tag}
                      className="bg-surface px-3 py-1.5 font-mono text-sm"
                    >
                      {tag}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          </div>

          <Link
            href={`/projects/${next.slug}`}
            className="group mt-24 flex items-center justify-between gap-6 border-t border-line pt-10"
          >
            <span>
              <span className="text-sm text-muted">Next project</span>
              <span className="mt-2 block font-display text-3xl font-semibold tracking-tight transition-colors duration-300 ease-snap group-hover:text-brand-soft sm:text-5xl">
                {next.title}
              </span>
            </span>
            <ArrowRight
              aria-hidden
              className="size-8 shrink-0 text-muted transition-all duration-500 ease-snap group-hover:translate-x-2 group-hover:text-brand-soft"
            />
          </Link>
        </Container>
      </section>

      <CallToAction />
    </>
  );
}
