import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  ArrowRight,
  FileText,
  GitBranch,
  MapPin,
  MessageSquareQuote,
  Route as RouteIcon,
  Scale,
  Users,
} from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { CTASection, Eyebrow, Reveal, Section } from "@/components/site/primitives";
import { Button } from "@/components/ui/button";
import { PRODUCTS, SOLUTIONS, SITE } from "@/lib/site/content";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "RoadShare — Community Governance Intelligence" },
      {
        name: "description",
        content:
          "Plan private-road projects, allocate costs fairly, organize documents, gather resident input, and document defensible community decisions.",
      },
      { property: "og:title", content: "RoadShare — Community Governance Intelligence" },
      { property: "og:description", content: SITE.description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const STORY = [
  { icon: MapPin, title: "Map the project", body: "Select scope directly on the parcel and road-network map." },
  { icon: Scale, title: "Allocate fairly", body: "Compare distance, frontage, and equal methods with live numbers." },
  { icon: FileText, title: "Ground it in documents", body: "Clause timelines, effective dates, and missing-document flags." },
  { icon: Users, title: "Gather the community", body: "Scenario-specific feedback with strict resident privacy." },
  { icon: GitBranch, title: "Decide in the open", body: "Assemble evidence, track votes, publish a versioned record." },
  { icon: MessageSquareQuote, title: "Deliver a report", body: "Board-ready, cited reports for owners and professionals." },
];

function Home() {
  return (
    <SiteLayout>
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border surface-glow">
        <div className="absolute inset-0 topo-grid opacity-40" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-20 sm:py-28 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Reveal>
              <Eyebrow>Community governance intelligence</Eyebrow>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="mt-5 max-w-2xl font-display text-4xl font-bold leading-[1.03] tracking-tight sm:text-6xl">
                Split shared road costs <span className="text-primary">fairly</span>, by how far each home drives.
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mt-5 max-w-xl text-lg text-muted-foreground">
                RoadShare connects the map, the properties, the documents, the law, the numbers,
                and the people — so community decisions are easier to understand and harder to dispute.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link to="/tools/cedar-hollow">
                    Build a free scenario <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/product">Explore the platform</Link>
                </Button>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.2}>
            <HeroMap />
          </Reveal>
        </div>
      </div>

      {/* Story sequence */}
      <Section>
        <Reveal className="max-w-2xl">
          <Eyebrow>From problem to decision</Eyebrow>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            One connected workflow, not a pile of spreadsheets.
          </h2>
          <p className="mt-3 text-muted-foreground">
            RoadShare turns a raw problem into scope, costs, methodology, feedback, and a permanent,
            defensible record.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {STORY.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.05}>
              <div className="group h-full rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Products */}
      <Section muted>
        <Reveal className="max-w-2xl">
          <Eyebrow>The platform</Eyebrow>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Everything a community needs to understand shared obligations.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {PRODUCTS.map((p, i) => (
            <Reveal key={p.slug} delay={(i % 3) * 0.05}>
              <Link
                to="/product/$slug"
                params={{ slug: p.slug }}
                className="group flex h-full flex-col rounded-2xl border border-border bg-background p-6 transition-all hover:-translate-y-1 hover:border-primary/40 hover:shadow-md"
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
                <h3 className="mt-3 font-display text-lg font-semibold">{p.name}</h3>
                <p className="mt-1.5 flex-1 text-sm text-muted-foreground">{p.tagline}</p>
                <span className="mt-4 inline-flex items-center text-sm font-medium text-primary">
                  Learn more <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>

      {/* Audiences */}
      <Section>
        <Reveal className="max-w-2xl">
          <Eyebrow>Built for everyone at the table</Eyebrow>
          <h2 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            From neighbors to boards, agents, title, lenders, and counsel.
          </h2>
        </Reveal>
        <div className="mt-10 flex flex-wrap gap-2.5">
          {SOLUTIONS.map((s, i) => (
            <Reveal key={s.slug} delay={i * 0.03}>
              <Link
                to="/solutions/$audience"
                params={{ audience: s.slug }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium transition-colors hover:border-primary/40 hover:text-primary"
              >
                {s.audience}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Reveal>
          ))}
        </div>
      </Section>

      <CTASection />
    </SiteLayout>
  );
}

function HeroMap() {
  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border bg-card shadow-lg">
      <div className="absolute inset-0 topo-grid opacity-50" aria-hidden />
      <svg viewBox="0 0 400 300" className="relative h-full w-full">
        <g fill="none" stroke="var(--color-map-asphalt)" strokeWidth="14" strokeLinecap="round">
          <path d="M20 210 H250" />
          <path d="M250 210 V70" />
          <path d="M250 210 H360" />
        </g>
        <g fill="none" stroke="var(--color-map-lane)" strokeWidth="2" strokeDasharray="10 10" strokeLinecap="round">
          <motion.path
            d="M20 210 H250 V70 M250 210 H360"
            animate={{ strokeDashoffset: [0, -40] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          />
        </g>
        {[
          [60, 235], [130, 235], [200, 235], [300, 235],
          [60, 175], [130, 175],
          [285, 150], [285, 100],
        ].map(([x, y], i) => (
          <motion.rect
            key={i}
            x={x - 22}
            y={y - 14}
            width={44}
            height={28}
            rx={5}
            fill={i === 3 ? "var(--color-gold)" : "var(--color-selected)"}
            opacity={i === 3 ? 0.9 : 0.55}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: i === 3 ? 0.9 : 0.55, scale: 1 }}
            transition={{ delay: 0.3 + i * 0.06, duration: 0.4 }}
          />
        ))}
        {[[20, 210], [250, 70]].map(([x, y], i) => (
          <g key={i}>
            <circle cx={x} cy={y} r="7" fill="var(--color-primary)" />
            <circle cx={x} cy={y} r="7" fill="none" stroke="var(--color-primary)" strokeWidth="2">
              <animate attributeName="r" values="7;16" dur="1.8s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.7;0" dur="1.8s" repeatCount="indefinite" />
            </circle>
          </g>
        ))}
      </svg>
      <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-lg bg-background/80 px-3 py-1.5 text-xs font-medium backdrop-blur">
        <RouteIcon className="h-3.5 w-3.5 text-primary" /> Cedar Hollow · live demo
      </div>
    </div>
  );
}
