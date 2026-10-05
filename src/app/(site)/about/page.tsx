import type { Metadata } from "next";
import { CallToAction } from "@/components/CallToAction";
import { Process } from "@/components/Process";
import { Reveal } from "@/components/Reveal";
import { Container, PageHeader, SectionHeading } from "@/components/ui";

export const metadata: Metadata = {
  title: "About",
  description:
    "Fyrax is a software and IT agency that builds dependable digital products for growing businesses.",
};

// Placeholder copy. Replace with the real company story.
const values = [
  {
    title: "Plain communication",
    text: "No jargon, no surprises. You always know what we are working on, what it costs and what comes next.",
  },
  {
    title: "Ship early, improve often",
    text: "Working software beats a perfect plan. We release small, learn from real use and adjust.",
  },
  {
    title: "Built to last",
    text: "Tested, documented code your own team can take over. We do not lock you in.",
  },
  {
    title: "Your goals first",
    text: "Technology is a means. We measure our work by what it changes for your business.",
  },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="About"
        title="A small team that takes software seriously"
        text="Fyrax is a software and IT agency. We partner with businesses that need dependable digital products and a team that stays accountable after launch."
      />

      <section className="py-24 sm:py-36">
        <Container>
          <Reveal>
            <h2 className="max-w-4xl font-display text-3xl font-semibold leading-[1.15] tracking-tight sm:text-5xl sm:leading-[1.1]">
              Too many software projects end with a product nobody is happy
              with: late, over budget and hard to change. We think that is
              avoidable.
            </h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mt-10 max-w-[60ch] text-lg leading-8 text-muted">
              Our approach is simple. Understand the problem before proposing a
              solution, show working software early, and write code that
              someone else can maintain. We keep teams small so the people you
              talk to are the people doing the work.
            </p>
          </Reveal>
        </Container>
      </section>

      <section className="border-y border-line/60 bg-surface/40 py-24 sm:py-36">
        <Container>
          <Reveal>
            <SectionHeading title="What you can expect from us" />
          </Reveal>
          <ul className="mt-16 grid gap-x-16 gap-y-14 sm:grid-cols-2">
            {values.map((value, index) => (
              <li key={value.title}>
                <Reveal delay={(index % 2) * 0.08}>
                  <div className="border-t border-line-strong pt-6">
                    <h3 className="font-display text-2xl font-semibold tracking-tight">
                      {value.title}
                    </h3>
                    <p className="mt-3 max-w-[44ch] leading-7 text-muted">
                      {value.text}
                    </p>
                  </div>
                </Reveal>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <Process />
      <CallToAction />
    </>
  );
}
