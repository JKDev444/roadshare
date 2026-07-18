import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/site/SiteLayout";
import { CTASection, ContentPage, PageHero, Reveal, Section } from "@/components/site/primitives";

export const Route = createFileRoute("/methodology")({
  head: () => ({
    meta: [
      { title: "Methodology — RoadShare" },
      {
        name: "description",
        content:
          "How RoadShare calculates along-road responsibility, blends surface costs, and compares allocation methods fairly.",
      },
      { property: "og:title", content: "Methodology — RoadShare" },
      { property: "og:description", content: "The transparent math behind fair road cost sharing." },
    ],
  }),
  component: () => (
    <SiteLayout>
      <PageHero
        eyebrow="Methodology"
        title="The math, in plain English."
        subtitle="You pay for the road you actually drive on. Not straight-line distance. Not a flat split. The exact stretch of pavement between the entrance and your driveway."
      />
      <Section muted>
        <Reveal>
          <div className="mx-auto max-w-4xl rounded-3xl border border-border bg-card p-8 sm:p-10">
            <span className="inline-flex items-center gap-2 rounded-full bg-gold/20 px-3 py-1 text-xs font-semibold text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" /> The secret sauce
            </span>
            <h2 className="mt-4 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              Distance along the road, not through the woods.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Most cost splits treat every home the same. Ours doesn't. We route from the entrance
              to the far edge of your driveway through actual road junctions — the same path your
              car takes home.
            </p>
            <svg
              viewBox="0 0 640 180"
              className="mt-6 w-full"
              role="img"
              aria-label="Homes along a road, each with a distance from the entrance"
            >
              <defs>
                <pattern id="dash" width="18" height="4" patternUnits="userSpaceOnUse">
                  <rect width="10" height="3" y="0.5" style={{ fill: "var(--gold)" }} />
                </pattern>
              </defs>
              {/* road */}
              <rect x="40" y="90" width="560" height="18" rx="9" style={{ fill: "var(--foreground)" }} />
              <rect x="40" y="97" width="560" height="4" fill="url(#dash)" />
              {/* entrance pin */}
              <circle cx="52" cy="99" r="11" style={{ fill: "var(--primary)" }} />
              <circle cx="52" cy="99" r="4" style={{ fill: "var(--background)" }} />
              <text x="52" y="140" textAnchor="middle" style={{ fill: "var(--muted-foreground)" }} fontSize="11">
                Entrance
              </text>
              {/* houses */}
              {[
                { x: 150, name: "Ana", share: "$2,390", color: "var(--selected)" },
                { x: 290, name: "Ben", share: "$6,056", color: "var(--primary)" },
                { x: 430, name: "Cora", share: "$9,880", color: "var(--primary)" },
                { x: 560, name: "Devon", share: "$13,705", color: "var(--gold)" },
              ].map((h) => (
                <g key={h.name}>
                  <polygon
                    points={`${h.x - 16},74 ${h.x},54 ${h.x + 16},74 ${h.x + 16},88 ${h.x - 16},88`}
                    style={{ fill: h.color }}
                  />
                  <text x={h.x} y="46" textAnchor="middle" style={{ fill: "var(--foreground)" }} fontSize="12" fontWeight="700">
                    {h.share}
                  </text>
                  <text
                    x={h.x}
                    y="82"
                    textAnchor="middle"
                    fontSize="10"
                    fontWeight="600"
                    fill="white"
                  >
                    {h.name}
                  </text>
                </g>
              ))}
            </svg>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              Ana lives near the entrance. Devon lives at the far end. Devon pays for more road —
              because Devon drives on more road.
            </p>
          </div>
        </Reveal>
      </Section>
      <ContentPage
        blocks={[
          {
            heading: "How we measure your share",
            body: [
              "Your share = the distance from the road entrance to the far edge of your driveway, measured along the road itself — through real junctions and turns.",
              "Got two entrances? We measure from each and average them, so homes get credit for the access they actually use.",
            ],
          },
          {
            heading: "Not sure distance is fair? Compare it.",
            body: ["Every community is different. Compare fair methods side by side and pick the one that fits:"],
            bullets: [
              "Distance — along the road you actually drive (our default)",
              "Frontage — the width of road in front of your lot",
              "Equal — everyone pays the same, no matter where they live",
              "Base-plus-use, custom, or document-defined (coming soon)",
            ],
          },
          {
            heading: "Where the total comes from",
            body: [
              "Total pavement = road length × road width. The rate is a weighted blend of the surfaces you chose. Total project cost = area × rate.",
              "Your share = your distance ÷ everyone's distance, spread across the funding period as a flat yearly number. We always show the equal-split number next to it, so you can see the difference.",
            ],
          },
        ]}
      />
      <CTASection />
    </SiteLayout>
  ),
});
