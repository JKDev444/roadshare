import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Map as MapIcon,
  Scale,
  Users,
  FileText,
  MessageSquareQuote,
  PieChart,
  Vote,
  FileBarChart,
  Search,
  type LucideIcon,
} from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { CTASection, PageHero, Reveal, Section } from "@/components/site/primitives";
import { PRODUCTS } from "@/lib/site/content";

const PRODUCT_ICON: Record<string, { icon: LucideIcon; tint: string }> = {
  "road-project-planning": { icon: MapIcon, tint: "from-teal-400/30 to-teal-500/10" },
  "allocation-methods": { icon: Scale, tint: "from-amber-400/30 to-amber-500/10" },
  "community-record": { icon: Users, tint: "from-indigo-400/30 to-indigo-500/10" },
  "document-intelligence": { icon: FileText, tint: "from-violet-400/30 to-violet-500/10" },
  "ask-my-community": { icon: MessageSquareQuote, tint: "from-rose-400/30 to-rose-500/10" },
  "community-pulse": { icon: PieChart, tint: "from-emerald-400/30 to-emerald-500/10" },
  "decision-rooms": { icon: Vote, tint: "from-sky-400/30 to-sky-500/10" },
  "reports": { icon: FileBarChart, tint: "from-fuchsia-400/30 to-fuchsia-500/10" },
  "community-lookup": { icon: Search, tint: "from-slate-400/30 to-slate-500/10" },
};

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
            Everything you can use right now.
          </h2>
          <p className="mt-3 text-muted-foreground">
            Map your road, split the cost, keep the record, and reach a decision — all in one place.
          </p>
        </div>
        <div className="mt-14 space-y-20">
          {live.map((p, idx) => {
            const meta = PRODUCT_ICON[p.slug] ?? PRODUCT_ICON["community-record"];
            const Icon = meta.icon;
            return (
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
                <div className={`relative aspect-[5/4] overflow-hidden rounded-3xl border border-border bg-gradient-to-br ${meta.tint} via-card p-6`}>
                  <div className="absolute inset-0 topo-grid opacity-30" aria-hidden />
                  <div className="relative flex h-full items-center justify-center">
                    <span className="flex h-28 w-28 items-center justify-center rounded-3xl bg-background/70 backdrop-blur shadow-xl ring-1 ring-border">
                      <Icon className="h-12 w-12 text-primary" strokeWidth={1.5} />
                    </span>
                  </div>
                  <span className="absolute bottom-4 left-6 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    {p.eyebrow}
                  </span>
                </div>
              </div>
            </Reveal>
            );
          })}
        </div>
      </Section>

      {rest.length > 0 && (
        <Section muted>
          <div className="mx-auto max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" /> On the roadmap
            </span>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              What we're building next.
            </h2>
            <ol className="mt-10 divide-y divide-border border-y border-border">
              {rest.map((p) => (
                <li key={p.slug}>
                  <Link
                    to="/product/$slug"
                    params={{ slug: p.slug }}
                    className="group flex items-start gap-5 py-6 transition-colors hover:bg-card/60"
                  >
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
      )}
      <CTASection />
    </SiteLayout>
  );
}
