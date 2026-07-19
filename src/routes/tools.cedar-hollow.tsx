import { createFileRoute } from "@tanstack/react-router";
import { Share2, Sparkles } from "lucide-react";

import { SiteLayout } from "@/components/site/SiteLayout";
import { Planner } from "@/components/roadshare/Planner";
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
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-primary/15 via-background to-gold/10">
        <div className="absolute inset-0 topo-grid opacity-30" aria-hidden />
        <div className="relative mx-auto max-w-7xl px-4 py-10 sm:py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-primary/30 bg-card/70 px-3 py-1 text-xs font-semibold text-primary backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" /> Try it — no sign-up
              </span>
              <h1 className="mt-4 font-display text-3xl font-bold tracking-tight sm:text-5xl">
                See your fair share of a private road.
              </h1>
              <p className="mt-3 text-base text-muted-foreground sm:text-lg">
                Meet Cedar Hollow — a friendly practice neighborhood. Pick your home, add
                your neighbors, and watch each household's yearly share update live.
              </p>
              <div className="mt-5 grid max-w-2xl gap-2 text-sm sm:grid-cols-3">
                <StepCue n={1} label="Pick your home" />
                <StepCue n={2} label="Choose neighbors" />
                <StepCue n={3} label="See your share" />
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                if (typeof navigator !== "undefined" && navigator.clipboard) {
                  navigator.clipboard.writeText(window.location.href);
                  toast.success("Link copied!", {
                    description: "Send it to a neighbor to review this scenario together.",
                  });
                } else {
                  toast.info("Copy the page URL to share this scenario.");
                }
              }}
            >
              <Share2 className="mr-1.5 h-4 w-4" /> Share
            </Button>
          </div>
          <p className="mt-6 max-w-2xl text-xs text-muted-foreground/80">
            Cedar Hollow is a made-up neighborhood we use for practice. The math is the
            real thing — sign up to run it on your own road.
          </p>
        </div>
      </div>
      <Planner />
    </SiteLayout>
  );
}

function StepCue({
  n,
  label,
}: {
  n: number;
  label: string;
}) {
  return (
    <span className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-xl border border-border bg-card/80 px-3 py-2 font-medium text-foreground backdrop-blur">
      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary/15 text-xs font-bold text-primary">
        {n}
      </span>
      <span className="truncate">{label}</span>
    </span>
  );
}