import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { ArrowRight, Check } from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { CTASection, PageHero, Reveal, Section } from "@/components/site/primitives";
import { Button } from "@/components/ui/button";
import { SOLUTIONS } from "@/lib/site/content";

export const Route = createFileRoute("/solutions/$audience")({
  loader: ({ params }) => {
    const solution = SOLUTIONS.find((s) => s.slug === params.audience);
    if (!solution) throw notFound();
    return { solution };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Solutions — RoadShare" }, { name: "robots", content: "noindex" }] };
    const { solution } = loaderData;
    return {
      meta: [
        { title: `${solution.audience} — RoadShare Solutions` },
        { name: "description", content: solution.value },
        { property: "og:title", content: `${solution.audience} — RoadShare` },
        { property: "og:description", content: solution.value },
      ],
    };
  },
  component: SolutionDetail,
  notFoundComponent: () => (
    <SiteLayout>
      <Section>
        <h1 className="font-display text-2xl font-bold">Solution not found</h1>
        <Button className="mt-4" asChild>
          <Link to="/">Back home</Link>
        </Button>
      </Section>
    </SiteLayout>
  ),
});

function SolutionDetail() {
  const { solution } = Route.useLoaderData();
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Solutions"
        title={solution.headline}
        subtitle={solution.value}
        primary={{ label: "Build a free scenario", to: "/tools/cedar-hollow" }}
        secondary={{ label: "Talk to us", to: "/contact" }}
      />
      <Section>
        <Reveal className="max-w-2xl">
          <h2 className="font-display text-2xl font-bold tracking-tight">What you get</h2>
        </Reveal>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {solution.outcomes.map((o: string, i: number) => (
            <Reveal key={o} delay={i * 0.05}>
              <div className="flex h-full items-start gap-3 rounded-2xl border border-border bg-card p-6">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-selected/15 text-selected">
                  <Check className="h-4 w-4" />
                </span>
                <p className="font-medium">{o}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-10">
          <div className="flex flex-wrap gap-2">
            {SOLUTIONS.map((s) => (
              <Link
                key={s.slug}
                to="/solutions/$audience"
                params={{ audience: s.slug }}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                activeProps={{ className: "border-primary/50 text-primary" }}
              >
                {s.audience}
              </Link>
            ))}
          </div>
        </Reveal>
      </Section>
      <CTASection />
    </SiteLayout>
  );
}
