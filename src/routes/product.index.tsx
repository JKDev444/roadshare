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
  const live = PRODUCTS.filter((p) => p.status === "live");
  const rest = PRODUCTS.filter((p) => p.status !== "live");
  return (
    <SiteLayout>
      <PageHero
        eyebrow="The platform"
        title="One platform, from the map to the decision."
        subtitle="RoadShare connects properties, roads, documents, numbers, and people into a single defensible record."
        primary={{ label: "Build a free scenario", to: "/tools/cedar-hollow" }}
        secondary={{ label: "See pricing", to: "/pricing" }}
      />
      {/* Available today — zigzag editorial rows, no cards */}
      <Section>
        <div className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-selected/15 px-3 py-1 text-xs font-semibold text-selected">
            <span className="h-1.5 w-1.5 rounded-full bg-selected" /> Available today
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            The parts you can use right now.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Two live tools do the heavy lifting: map your road, then split the cost fairly.
          </p>
        </div>
        <div className="mt-14 space-y-20">
          {live.map((p, idx) => (
            <Reveal key={p.slug}>
              <div
                className={`grid items-center gap-10 lg:grid-cols-2 ${
                  idx % 2 === 1 ? "lg:[&>*:first-child]:order-2" : ""
                }`}
              >
                <div>
                  <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                    Chapter {String(idx + 1).padStart(2, "0")} · {p.eyebrow}
                  </span>
                  <h3 className="mt-3 font-display text-3xl font-bold tracking-tight">{p.name}</h3>
                  <p className="mt-3 text-lg text-muted-foreground">{p.tagline}</p>
                  <p className="mt-3 text-muted-foreground">{p.summary}</p>
                  <ul className="mt-5 space-y-2.5">
                    {p.features.map((f) => (
                      <li key={f.title} className="flex gap-3">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gold" />
                        <span className="text-sm">
                          <span className="font-semibold">{f.title}.</span>{" "}
                          <span className="text-muted-foreground">{f.body}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    to="/product/$slug"
                    params={{ slug: p.slug }}
                    className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:gap-2 transition-all"
                  >
                    Take the tour <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
                <div className="relative aspect-[5/4] overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-primary/10 via-card to-selected/10 p-6">
                  <div className="absolute inset-0 topo-grid opacity-30" aria-hidden />
                  <div className="relative flex h-full items-center justify-center">
                    <span className="font-display text-[7rem] font-bold leading-none text-primary/20">
                      {idx + 1}
                    </span>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* What's next — plain list, not cards */}
      <Section muted>
        <div className="mx-auto max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold text-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" /> On the roadmap
          </span>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            What we're building next.
          </h2>
          <p className="mt-3 text-muted-foreground">
            The rest of the platform is on the way — documents, resident input, votes, and reports.
          </p>
          <ol className="mt-10 divide-y divide-border border-y border-border">
            {rest.map((p, i) => (
              <li key={p.slug}>
                <Link
                  to="/product/$slug"
                  params={{ slug: p.slug }}
                  className="group flex items-start gap-5 py-6 transition-colors hover:bg-card/60"
                >
                  <span className="mt-1 font-mono text-sm text-muted-foreground">
                    {String(i + 3).padStart(2, "0")}
                  </span>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h3 className="font-display text-xl font-semibold">{p.name}</h3>
                      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                        {p.eyebrow}
                      </span>
                    </div>
                    <p className="mt-1 text-muted-foreground">{p.tagline}</p>
                  </div>
                  <ArrowRight className="mt-2 h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" />
                </Link>
              </li>
            ))}
          </ol>
        </div>
      </Section>
      <CTASection />
    </SiteLayout>
  );
}
