import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Map as MapIcon, Sparkles } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { listCommunities } from "@/lib/community/api";
import { CoachMark } from "@/components/onboarding/CoachMark";

export const Route = createFileRoute("/_authenticated/map")({
  head: () => ({ meta: [{ title: "GIS & Roads — RoadShare" }, { name: "robots", content: "noindex" }] }),
  component: MapPage,
});

function MapPage() {
  const { data: communities, isLoading } = useQuery({ queryKey: ["communities"], queryFn: listCommunities });

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">GIS & Road Geometry</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Draw, split, and correct private-road centerlines, then assign maintenance responsibility. Pick a community to open its editor.
          </p>
        </div>
        <CoachMark id="map-index" title="Road geometry powers fair splits">
          Pick a community to open its road editor. The lengths and frontage you draw here feed
          the distance- and frontage-based cost allocations.
        </CoachMark>
        {isLoading ? (
          <div className="h-32 animate-pulse rounded-2xl border border-border bg-card" />
        ) : communities && communities.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {communities.map((c) => (
              <Link
                key={c.id}
                to="/community/$id"
                params={{ id: c.id }}
                search={{ tab: "roads" }}
                className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MapIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{c.name}</p>
                  {c.region && <p className="truncate text-xs text-muted-foreground">{c.region}</p>}
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MapIcon className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm text-muted-foreground">No communities yet. Create one to start mapping roads.</p>
            <Button className="mt-4" asChild>
              <Link to="/community"><Sparkles className="h-4 w-4" /> Go to Community Record</Link>
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}