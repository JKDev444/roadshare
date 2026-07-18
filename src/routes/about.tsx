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
        title="Made for the neighbors who share a road."
        subtitle="RoadShare helps small road communities figure out who pays what, keep the paperwork in one place, and make decisions that stick — without spreadsheets or shouting matches."
      />
      <ContentPage
        blocks={[
          {
            heading: "Why we exist",
            body: [
              "Shared roads are hard. The math is confusing, the paperwork is scattered, and every driveway has an opinion. So decisions get delayed, or made by whoever yells loudest.",
              "RoadShare puts the map, the homes, the rules, the numbers, and the neighbors in one place — so your community can decide together, and show its work.",
            ],
          },
          {
            heading: "What we're not",
            body: ["We stay in our lane on purpose. RoadShare is not:"],
            bullets: [
              "An HOA accounting or dues-collection tool",
              "A rule-enforcement app or neighborhood social feed",
              "A law firm, appraisal, or engineering opinion",
              "A generic chatbot bolted onto your PDFs",
            ],
          },
          {
            heading: "How we build",
            body: [
              "We start with a sample community (say hi to Cedar Hollow), then swap in your real data. Every number we show comes with a source, so your board can trust it and your neighbors can double-check it.",
            ],
          },
        ]}
      />
      <CTASection />
    </SiteLayout>
  ),
});
