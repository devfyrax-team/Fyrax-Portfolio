import type { Metadata } from "next";
import { CallToAction } from "@/components/CallToAction";
import { ProjectCard } from "@/components/cards";
import { Container, PageHeader } from "@/components/ui";
import { projects } from "@/content/projects";

export const metadata: Metadata = {
  title: "Projects",
  description: "Case studies of web, mobile, automation and cloud projects.",
};

// Six columns: the first row is 4+2, the second is 2+2+2. Five projects, no gaps.
const spans = [
  "lg:col-span-4",
  "lg:col-span-2",
  "lg:col-span-2",
  "lg:col-span-2",
  "lg:col-span-2",
];

export default function ProjectsPage() {
  return (
    <>
      <PageHeader
        eyebrow="Projects"
        title="Work that solved real problems"
        text="Each project started with a business problem. Here is how we approached it and what changed."
      />

      <section className="py-20 sm:py-28">
        <Container>
          <div className="grid gap-4 lg:grid-cols-6">
            {projects.map((project, index) => (
              <ProjectCard
                key={project.slug}
                project={project}
                index={index}
                large={index === 0}
                className={spans[index] ?? "lg:col-span-2"}
              />
            ))}
          </div>
        </Container>
      </section>

      <CallToAction />
    </>
  );
}
