import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Printer, Route as RouteIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Planner, type PlannerSnapshot } from "@/components/roadshare/Planner";
import { supabase } from "@/integrations/supabase/client";
import type { Home as RoadHome, Segment as RoadSegment } from "@/lib/roadshare/layout";

type Snapshot = Partial<PlannerSnapshot> & {
  homes?: RoadHome[];
  segments?: RoadSegment[];
  roadName?: string;
  rotation?: 0 | 90 | 180 | 270;
};

export const Route = createFileRoute("/s/$slug")({
  ssr: false,
  head: ({ params }) => ({
    meta: [
      { title: `Shared road plan — RoadShare` },
      { name: "description", content: "A read-only look at a neighborhood's road cost plan." },
      { property: "og:title", content: "Shared road plan — RoadShare" },
      { property: "og:description", content: "A read-only look at a neighborhood's road cost plan." },
      { name: "robots", content: "noindex" },
      { property: "og:url", content: `/s/${params.slug}` },
    ],
  }),
  loader: async ({ params }) => {
    const { data, error } = await supabase
      .from("road_shares")
      .select("slug, snapshot, created_at")
      .eq("slug", params.slug)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw notFound();
    return data as { slug: string; snapshot: Snapshot; created_at: string };
  },
  component: SharedRoadPage,
  notFoundComponent: () => (
    <div className="mx-auto max-w-lg p-10 text-center">
      <h1 className="font-display text-2xl font-bold">Share link not found</h1>
      <p className="mt-2 text-muted-foreground">
        This link may have been removed or mistyped.
      </p>
      <Link to="/" className="mt-4 inline-block text-sm font-semibold text-primary underline">
        Back to RoadShare
      </Link>
    </div>
  ),
});

function SharedRoadPage() {
  const { snapshot } = Route.useLoaderData();
  const homes = snapshot.homes ?? [];
  const segments: RoadSegment[] =
    snapshot.segments && snapshot.segments.length > 0
      ? snapshot.segments
      : [{ id: "s1", name: snapshot.roadName ?? "Road", widthFt: 20 }];
  const roadName = snapshot.roadName ?? "Shared road";
  const initial: Partial<PlannerSnapshot> = {
    step: "review",
    you: snapshot.you ?? null,
    selected: snapshot.selected ?? [],
    entrances: snapshot.entrances ?? [],
    methodology: snapshot.methodology,
    roadWidth: snapshot.roadWidth,
    fundingPeriod: snapshot.fundingPeriod,
    surfaces: snapshot.surfaces,
    fixedTotal: (snapshot as { fixedTotal?: number }).fixedTotal,
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
              <RouteIcon className="h-4 w-4" />
            </span>
            <span>
              <span className="block font-display text-sm font-bold leading-tight">{roadName}</span>
              <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">
                Shared with you · read-only
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-4 w-4" /> Save as PDF
            </Button>
          </div>
        </div>
      </header>
      <Planner
        variant="demo"
        homes={homes}
        roadName={roadName}
        segments={segments}
        rotation={snapshot.rotation ?? 0}
        initialState={initial}
      />
    </div>
  );
}