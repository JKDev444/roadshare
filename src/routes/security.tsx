import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/site/SiteLayout";
import { CTASection, ContentPage, PageHero } from "@/components/site/primitives";

export const Route = createFileRoute("/security")({
  head: () => ({
    meta: [
      { title: "Security — RoadShare" },
      {
        name: "description",
        content:
          "How RoadShare protects community data: row-level isolation, explicit visibility, verified-fact separation, and immutable history.",
      },
      { property: "og:title", content: "Security — RoadShare" },
      { property: "og:description", content: "Data isolation, provenance, and privacy by design." },
    ],
  }),
  component: () => (
    <SiteLayout>
      <PageHero
        eyebrow="Trust"
        title="Security and data isolation by design."
        subtitle="Community data is walled off, provenance is tracked, and AI output never masquerades as verified fact."
      />
      <ContentPage
        blocks={[
          {
            heading: "Isolation",
            body: ["Every community's records are isolated. Access is governed by row-level security defined before any production data is stored."],
          },
          {
            heading: "Provenance and history",
            body: ["Each fact carries a source, confidence, verification status, and effective date. History is versioned and never silently overwritten."],
          },
          {
            heading: "AI safeguards",
            body: ["AI-extracted output is stored separately from human-verified facts. The Q&A engine cites sources, shows confidence, and abstains when the record is incomplete."],
          },
        ]}
      />
      <CTASection />
    </SiteLayout>
  ),
});
