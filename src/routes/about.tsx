import { createFileRoute } from "@tanstack/react-router";

import { SiteLayout } from "@/components/site/SiteLayout";
import { CTASection, ContentPage, PageHero } from "@/components/site/primitives";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — RoadShare" },
      {
        name: "description",
        content:
          "RoadShare is the trusted digital operating layer for communities that need to understand shared obligations and document defensible decisions.",
      },
      { property: "og:title", content: "About — RoadShare" },
      { property: "og:description", content: "The digital operating layer for community decisions." },
    ],
  }),
  component: () => (
    <SiteLayout>
      <PageHero
        eyebrow="Company"
        title="The operating layer for community decisions."
        subtitle="RoadShare helps communities understand shared obligations, organize governing evidence, compare scenarios, gather input, and document decisions that hold up over time."
      />
      <ContentPage
        blocks={[
          {
            heading: "Why we exist",
            body: [
              "Private roads and shared assets create obligations that are hard to understand and easy to dispute. Documents are scattered, math is opaque, and decisions lack a defensible record.",
              "RoadShare connects the map, the properties, the documents, the law, the numbers, and the people so communities can decide together — and prove how they decided.",
            ],
          },
          {
            heading: "What we are not",
            body: ["RoadShare is deliberately focused. It is not:"],
            bullets: [
              "A generic HOA accounting or dues-collection platform",
              "A violation-enforcement engine or neighborhood social network",
              "A law firm, appraisal, engineering opinion, or lender approval",
              "A generic chatbot layered over uploaded PDFs",
            ],
          },
          {
            heading: "How we build",
            body: [
              "We ship in phases with sample Cedar Hollow data first, then replace it with production data without rebuilding the platform. Every fact carries a source, confidence, and effective date, and history is never overwritten.",
            ],
          },
        ]}
      />
      <CTASection />
    </SiteLayout>
  ),
});
