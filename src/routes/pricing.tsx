import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { CTASection, PageHero, Reveal, Section } from "@/components/site/primitives";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — RoadShare" },
      {
        name: "description",
        content:
          "Simple RoadShare pricing: free scenarios, community plans for boards and road groups, and enterprise for management companies.",
      },
      { property: "og:title", content: "Pricing — RoadShare" },
      { property: "og:description", content: "Free scenarios, community plans, and enterprise portfolios." },
    ],
  }),
  component: Pricing,
});

const PLANS = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    blurb: "Explore and share public scenarios.",
    cta: { label: "Build a scenario", to: "/tools/cedar-hollow" },
    features: ["Cedar Hollow demo", "Allocation method comparison", "Shareable scenario link", "Sample data"],
    featured: false,
  },
  {
    name: "Community",
    price: "$49",
    cadence: "per community / mo",
    blurb: "Plan real projects for your road group or board.",
    cta: { label: "Talk to us", to: "/contact" },
    features: [
      "Everything in Free",
      "Your own Community Record",
      "Production project planner",
      "Document Vault + cited Q&A",
      "Community Pulse surveys",
      "Board-ready reports",
    ],
    featured: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "portfolio pricing",
    blurb: "Management companies, title, and lending at scale.",
    cta: { label: "Request a demo", to: "/contact" },
    features: ["Multi-community portfolio", "SSO + audit exports", "White-label reports", "API & integrations", "Priority support"],
    featured: false,
  },
];

function Pricing() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="Pricing"
        title="Start free. Grow with your community."
        subtitle="Every plan is production-ready. Begin with a free scenario and upgrade when you're ready to run your own community."
      />
      <Section>
        <div className="grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan, i) => (
            <Reveal key={plan.name} delay={i * 0.05}>
              <div
                className={cn(
                  "flex h-full flex-col rounded-3xl border p-8 transition-all",
                  plan.featured
                    ? "border-primary bg-card shadow-lg ring-1 ring-primary/20"
                    : "border-border bg-card",
                )}
              >
                {plan.featured && (
                  <span className="mb-3 inline-flex w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    Most popular
                  </span>
                )}
                <h2 className="font-display text-xl font-bold">{plan.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{plan.blurb}</p>
                <div className="mt-5 flex items-baseline gap-1.5">
                  <span className="font-display text-4xl font-bold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.cadence}</span>
                </div>
                <ul className="mt-6 flex-1 space-y-2.5">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-selected" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button className="mt-8" variant={plan.featured ? "default" : "outline"} asChild>
                  <Link to={plan.cta.to}>{plan.cta.label}</Link>
                </Button>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>
      <CTASection />
    </SiteLayout>
  );
}
