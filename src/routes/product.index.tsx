import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { CTASection, PageHero, Reveal, Section } from "@/components/site/primitives";
import { PRODUCTS } from "@/lib/site/content";

export const Route = createFileRoute("/product/")({
  head: () => ({
    meta: [
      { title: "Product — RoadShare Platform Overview" },
      {
        name: "description",
        content:
          "The RoadShare platform: road project planning, allocation methods, Community Record, document intelligence, cited Q&A, Community Pulse, Decision Rooms, and reports.",
      },
      { property: "og:title", content: "Product — RoadShare Platform Overview" },
      { property: "og:description", content: "One connected platform for community governance intelligence." },
    ],
  }),
  component: ProductOverview,
});

function ProductOverview() {
  return (
    <SiteLayout>
      <PageHero
        eyebrow="The platform"
        title="One platform, from the map to the decision."
        subtitle="RoadShare connects properties, roads, documents, numbers, and people into a single defensible record."
        primary={{ label: "Build a free scenario", to: "/tools/cedar-hollow" }}
        secondary={{ label: "See pricing", to: "/pricing" }}
      />
      <Section>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((p, i) => (
            <Reveal key={p.slug} delay={(i % 3) * 0.05}>
              <Link
                to="/product/$slug"
                params={{ slug: p.slug }}
                className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                    {p.eyebrow}
                  </span>
                  {p.status !== "live" && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-muted-foreground">
                      {p.status === "preview" ? "Preview" : "Roadmap"}
                    </span>
                  )}
                </div>
                <h2 className="mt-3 font-display text-lg font-semibold">{p.name}</h2>
                <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{p.tagline}</p>
                <span className="mt-4 inline-flex items-center text-sm font-medium text-primary">
                  Learn more <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
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
