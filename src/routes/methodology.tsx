import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/site/SiteLayout";
import { CTASection, ContentPage, PageHero } from "@/components/site/primitives";

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
        title="Transparent math, along the road that's actually driven."
        subtitle="RoadShare's Road Network Responsibility Engine calculates responsibility along the road network — not straight-line distance."
      />
      <ContentPage
        blocks={[
          {
            heading: "Responsibility by along-road distance",
            body: [
              "Each property's responsibility is the along-road network distance from an entrance to the far edge of its frontage, routed through junctions rather than as the crow flies.",
              "With two entrances pinned, RoadShare computes each and averages them, so homes are credited for the access they actually use.",
            ],
          },
          {
            heading: "Multiple methodologies",
            body: ["Communities can compare fair methods side by side:"],
            bullets: [
              "Distance — along-road far-edge responsibility (default)",
              "Frontage — each lot's own frontage length",
              "Equal per lot — a uniform share",
              "Base-plus-use, custom schedules, and document-defined methods (roadmap)",
            ],
          },
          {
            heading: "Cost flow",
            body: [
              "Pavement area = centerline length × width. The blended rate is a percentage-weighted average of the surface unit costs. Total project cost = area × blended rate.",
              "Each household's share = its responsibility ÷ the sum of responsibilities, and every figure divides by the funding period for a flat annual number. An equal-split comparison is always shown.",
            ],
          },
        ]}
      />
      <CTASection />
    </SiteLayout>
  ),
});
