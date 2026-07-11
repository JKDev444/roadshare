import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/site/SiteLayout";
import { CTASection, ContentPage, PageHero } from "@/components/site/primitives";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy — RoadShare" },
      {
        name: "description",
        content:
          "RoadShare's resident-privacy commitments: no individual scoring, no profiling, and no sub-threshold subgroup analysis.",
      },
      { property: "og:title", content: "Privacy — RoadShare" },
      { property: "og:description", content: "Resident privacy protections built into Community Pulse." },
    ],
  }),
  component: () => (
    <SiteLayout>
      <PageHero
        eyebrow="Trust"
        title="Resident privacy is not optional."
        subtitle="Community Pulse is built to surface themes and consensus without ever profiling individuals."
      />
      <ContentPage
        blocks={[
          {
            heading: "What we never do",
            body: ["RoadShare's feedback tools are bound by strict prohibitions:"],
            bullets: [
              "No individual sentiment score",
              "No troublemaker or hostility label",
              "No enforcement recommendations",
              "No protected-characteristic inference",
              "No political or personality profile",
              "No public resident-level response history",
              "No subgroup analysis below privacy thresholds",
            ],
          },
          {
            heading: "What we do",
            body: ["We report support and opposition, participation, top concerns, areas of consensus, and human-edited themes — always in aggregate."],
          },
        ]}
      />
      <CTASection />
    </SiteLayout>
  ),
});
