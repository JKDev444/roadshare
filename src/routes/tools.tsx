import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Calculator, Map, Scale } from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { CTASection, PageHero, Reveal, Section } from "@/components/site/primitives";

export const Route = createFileRoute("/tools")({
  head: () => ({
    meta: [
      { title: "Free Tools — RoadShare" },
      {
        name: "description",
        content:
          "Free interactive tools for private-road cost sharing, including the Cedar Hollow allocation demo.",
      },
      { property: "og:title", content: "Free Tools — RoadShare" },
      { property: "og:description", content: "Interactive road cost-sharing tools, free to use." },
    ],
  }),
  component: Tools,
});

const TOOLS = [
  {
    to: "/tools/cedar-hollow",
    icon: Map,
    name: "Cedar Hollow Planner",
    body: "Map a project, pin entrances, and see fair per-household allocation update live.",
    live: true,
  },
  {
    to: "/product/allocation-methods",
    icon: Scale,
    name: "Allocation Method Explainer",
    body: "Understand distance, frontage, and equal splits and when each is fair.",
    live: false,
  },
  {
    to: "/product/reports",
    icon: Calculator,
    name: "Reserve & Funding Estimator",
    body: "Estimate annual contributions across a funding horizon. Coming soon.",
    live: false,
  },
];

function Tools() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Free tools"
        title="Try RoadShare before you sign up."
        subtitle="Interactive tools that show fair road cost sharing on real map geometry — no account required."
        primary={{ label: "Open Cedar Hollow", to: "/tools/cedar-hollow" }}
      />
      <Section>
        <div className="grid gap-4 md:grid-cols-3">
          {TOOLS.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.05}>
              <Link
                to={t.to}
                className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <t.icon className="h-5 w-5" />
                  </span>
                  {!t.live && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      Soon
                    </span>
                  )}
                </div>
                <h2 className="mt-4 font-display text-lg font-semibold">{t.name}</h2>
                <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{t.body}</p>
                <span className="mt-4 inline-flex items-center text-sm font-medium text-primary">
                  Open <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>
      <CTASection />
    </SiteLayout>
  );
}
