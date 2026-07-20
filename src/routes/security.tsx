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
        { property: "og:description", content: "How your community's records stay private, honest, and easy to trust." },
    ],
  }),
  component: () => (
    <SiteLayout>
      <PageHero
        eyebrow="Trust"
        title="Your community's records, kept private and honest."
        subtitle="Each community's records are walled off from every other. Every change keeps a plain-English history, and anything the AI reads is clearly labeled — never mixed with what a human confirmed."
      />
      <ContentPage
        blocks={[
          {
            heading: "One community can't see another",
            body: ["Your community's records are only visible to your community. We set that boundary at the database itself, before a single record is ever saved."],
          },
          {
            heading: "A history you can trust",
            body: ["Every fact we store carries where it came from and when it took effect. Nothing gets quietly overwritten — you can always see what changed and who changed it."],
          },
          {
            heading: "AI is clearly labeled",
            body: ["When the AI reads a document for you, we keep that separate from the things a person on your board has actually confirmed. If the AI isn't sure, it says so instead of guessing."],
          },
        ]}
      />
      <CTASection />
    </SiteLayout>
  ),
});
