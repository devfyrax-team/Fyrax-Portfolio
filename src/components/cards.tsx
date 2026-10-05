import { ArrowUpRight } from "@phosphor-icons/react/ssr";
import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/Reveal";
import type { Project } from "@/content/projects";
import type { Service } from "@/content/services";

// Column spans on a 6-column grid. Each row adds up to 6, so there are no
// empty cells: rows of 4+2, 2+4, 3+3 for six items.
export const serviceSpans = [
  "lg:col-span-4",
  "lg:col-span-2",
  "lg:col-span-2",
  "lg:col-span-4",
  "lg:col-span-3",
  "lg:col-span-3",
] as const;

// Surface variation so the grid is not six identical panels.
const serviceTone = [
  "bg-gradient-to-br from-brand-tint via-surface to-surface hover:from-[#33191d]",
  "bg-surface hover:bg-surface-2",
  "bg-surface hover:bg-surface-2",
  "bg-gradient-to-tr from-surface-2 via-surface to-surface hover:from-line",
  "bg-surface hover:bg-surface-2",
  "bg-surface hover:bg-surface-2",
] as const;

export function ServiceTile({
  service,
  index,
}: {
  service: Service;
  index: number;
}) {
  const Icon = service.icon;
  return (
    <Reveal delay={(index % 2) * 0.08} className={serviceSpans[index]}>
      <Link
        href={`/services#${service.slug}`}
        className={`clip-corner group flex h-full min-h-56 flex-col justify-between gap-12 p-7 transition-colors duration-500 ease-snap sm:p-9 ${serviceTone[index]}`}
      >
        <Icon
          aria-hidden
          className="size-9 text-brand-soft transition-transform duration-500 ease-snap group-hover:-translate-y-1"
        />
        <div>
          <h3 className="font-display text-2xl font-semibold tracking-tight">
            {service.title}
          </h3>
          <p className="mt-2 max-w-[44ch] leading-7 text-muted">
            {service.summary}
          </p>
        </div>
      </Link>
    </Reveal>
  );
}

// Placeholder artwork until real screenshots are added. It uses the actual
// logo mark, shifted per project so the covers are not identical.
const coverPlacement = [
  "-right-10 -bottom-16 h-[130%]",
  "-left-6 -bottom-20 h-[140%] -scale-x-100",
  "-right-4 -top-16 h-[125%] -scale-y-100",
  "-left-10 -top-12 h-[120%] -scale-100",
  "right-1/3 -bottom-24 h-[150%]",
] as const;

export function ProjectCover({
  index,
  className = "",
}: {
  index: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`relative overflow-hidden bg-gradient-to-br from-surface-2 via-surface to-ink ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_70%_100%,var(--color-brand-tint),transparent_70%)]" />
      <Image
        src="/logo-mark.png"
        alt=""
        width={207}
        height={332}
        className={`absolute w-auto opacity-[0.14] transition-transform duration-700 ease-snap group-hover:scale-105 ${coverPlacement[index % coverPlacement.length]}`}
      />
    </div>
  );
}

export function ProjectCard({
  project,
  index,
  className = "",
  large = false,
}: {
  project: Project;
  index: number;
  className?: string;
  large?: boolean;
}) {
  return (
    <Reveal delay={(index % 3) * 0.08} className={className}>
      <Link
        href={`/projects/${project.slug}`}
        className="clip-corner group flex h-full flex-col bg-surface transition-colors duration-500 ease-snap hover:bg-surface-2"
      >
        <ProjectCover
          index={index}
          className={large ? "min-h-64 flex-1" : "aspect-[16/9]"}
        />
        <div className="p-7 sm:p-9">
          <p className="text-sm text-muted">{project.category}</p>
          <div className="mt-2 flex items-start justify-between gap-4">
            <h3
              className={`font-display font-semibold tracking-tight ${large ? "text-3xl" : "text-2xl"}`}
            >
              {project.title}
            </h3>
            <ArrowUpRight
              aria-hidden
              className="mt-1 size-6 shrink-0 text-muted transition-all duration-500 ease-snap group-hover:-translate-y-1 group-hover:translate-x-1 group-hover:text-brand-soft"
            />
          </div>
          <p className="mt-3 max-w-[48ch] leading-7 text-muted">
            {project.summary}
          </p>
        </div>
      </Link>
    </Reveal>
  );
}
