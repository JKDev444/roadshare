import { createFileRoute, notFound, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Users, Home, Building2, Briefcase, KeyRound, ShieldCheck, Banknote, Scale, Handshake, HardHat } from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { CTASection, PageHero, Reveal, Section } from "@/components/site/primitives";
import { Button } from "@/components/ui/button";
import { SOLUTIONS } from "@/lib/site/content";

const AUDIENCE_ICON: Record<string, { icon: typeof Users; tint: string }> = {
  "private-road-communities": { icon: Users, tint: "from-teal-400 to-emerald-500" },
  "self-managed-hoa-boards": { icon: Building2, tint: "from-indigo-400 to-blue-500" },
  "homeowners": { icon: Home, tint: "from-amber-400 to-orange-500" },
  "management-companies": { icon: Briefcase, tint: "from-violet-400 to-purple-500" },
  "real-estate": { icon: KeyRound, tint: "from-rose-400 to-pink-500" },
  "title-companies": { icon: ShieldCheck, tint: "from-sky-400 to-cyan-500" },
  "lenders": { icon: Banknote, tint: "from-emerald-400 to-green-500" },
  "attorneys": { icon: Scale, tint: "from-slate-400 to-slate-600" },
  "mediators": { icon: Handshake, tint: "from-fuchsia-400 to-pink-500" },
  "engineers-contractors": { icon: HardHat, tint: "from-yellow-400 to-amber-500" },
};

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
  const meta = AUDIENCE_ICON[solution.slug] ?? AUDIENCE_ICON["private-road-communities"];
  const HeroIcon = meta.icon;
  const others = SOLUTIONS.filter((s) => s.slug !== solution.slug).slice(0, 4);
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
        <div className="grid items-start gap-12 lg:grid-cols-5">
          <Reveal className="lg:col-span-2">
            <div className={`relative aspect-square overflow-hidden rounded-3xl bg-gradient-to-br ${meta.tint} p-8 shadow-lg`}>
              <div className="absolute inset-0 topo-grid opacity-20" aria-hidden />
              <div className="relative flex h-full flex-col justify-between">
                <span className="inline-flex w-fit items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                  Built for
                </span>
                <div>
                  <HeroIcon className="h-14 w-14 text-white/90" strokeWidth={1.5} />
                  <p className="mt-4 font-display text-3xl font-bold text-white">{solution.audience}</p>
                </div>
              </div>
            </div>
          </Reveal>
          <div className="lg:col-span-3">
            <Reveal>
              <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">What you get</span>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-tight">Three outcomes, from day one.</h2>
            </Reveal>
            <ul className="mt-8 space-y-5">
              {solution.outcomes.map((o: string, i: number) => (
                <Reveal key={o} delay={i * 0.05}>
                  <li className="flex items-start gap-4 border-b border-border pb-5 last:border-b-0">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-selected/15 text-selected">
                      <Check className="h-5 w-5" />
                    </span>
                    <p className="text-lg font-medium">{o}</p>
                  </li>
                </Reveal>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      <Section muted>
        <div className="mx-auto max-w-3xl">
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">Also for</span>
          <h2 className="mt-3 font-display text-2xl font-bold tracking-tight">Other people RoadShare helps.</h2>
        </div>
        <ol className="mx-auto mt-8 max-w-3xl divide-y divide-border border-y border-border">
          {others.map((s) => {
            const oMeta = AUDIENCE_ICON[s.slug] ?? AUDIENCE_ICON["private-road-communities"];
            const OIcon = oMeta.icon;
            return (
              <li key={s.slug}>
                <Link
                  to="/solutions/$audience"
                  params={{ audience: s.slug }}
                  className="group flex items-center gap-4 py-5 transition-colors hover:bg-card/60"
                >
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${oMeta.tint} text-white shadow-sm`}>
                    <OIcon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <div className="flex-1">
                    <p className="font-display text-base font-semibold">{s.audience}</p>
                    <p className="text-sm text-muted-foreground">{s.headline}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-all group-hover:translate-x-1 group-hover:text-primary" />
                </Link>
              </li>
            );
          })}
        </ol>
      </Section>
      <CTASection />
    </SiteLayout>
  );
}
