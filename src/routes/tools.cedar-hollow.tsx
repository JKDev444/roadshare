import { createFileRoute } from "@tanstack/react-router";
import { Share2, Info } from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Planner } from "@/components/roadshare/Planner";
import { Eyebrow } from "@/components/site/primitives";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/tools/cedar-hollow")({
  head: () => ({
    meta: [
      { title: "Cedar Hollow Planner — RoadShare" },
      {
        name: "description",
        content:
          "Interactive private-road cost-sharing demo. Map a project on Cedar Hollow, compare allocation methods, and see each household's fair share.",
      },
      { property: "og:title", content: "Cedar Hollow Planner — RoadShare" },
      { property: "og:description", content: "Live private-road allocation demo on the Cedar Hollow neighborhood." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CedarHollow,
});

function CedarHollow() {
  return (
    <SiteLayout>
      <div className="relative overflow-hidden border-b border-border surface-glow">
        <div className="absolute inset-0 topo-grid opacity-40" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 py-12">
          <Eyebrow>Interactive demo</Eyebrow>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
                Cedar Hollow Planner
              </h1>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Find your property, build the neighborhood group, pin the entrances, and set the
                surface. Allocation uses true along-road distance responsibility.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success("Scenario link copied", {
                    description: "Share it with neighbors to review the plan.",
                  });
                } else {
                  toast.info("Copy the page URL to share this scenario.");
                }
              }}
            >
              <Share2 className="mr-1.5 h-4 w-4" /> Share scenario
            </Button>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-card/60 px-4 py-3 text-sm text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>
              Map, parcels, addresses, and unit costs are fictional placeholders; the allocation
              engine is production logic. Sign up to run this on your own community.
            </p>
          </div>
        </div>
      </div>
      <Planner />
    </SiteLayout>
  );
}
