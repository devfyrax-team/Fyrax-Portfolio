import { Reveal } from "@/components/Reveal";
import { Container, SectionHeading } from "@/components/ui";
import { processSteps } from "@/content/site";

// Heading stays pinned on the left while the steps scroll past on the right.
export function Process() {
  return (
    <section className="py-24 sm:py-36">
      <Container className="grid gap-14 lg:grid-cols-[1fr_1.3fr] lg:gap-24">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <SectionHeading
            title="How we work"
            text="A clear process from the first conversation to a product in production."
          />
        </div>
        <ol>
          {processSteps.map((step, index) => (
            <li
              key={step.title}
              className={`py-10 ${index > 0 ? "border-t border-line" : "pt-0"}`}
            >
              <Reveal>
                <h3 className="font-display text-3xl font-semibold tracking-tight sm:text-4xl">
                  {step.title}
                </h3>
                <p className="mt-4 max-w-[52ch] text-lg leading-8 text-muted">
                  {step.text}
                </p>
              </Reveal>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
