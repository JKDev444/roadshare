import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, RotateCcw, Route as RouteIcon } from "lucide-react";
import { toast } from "sonner";

import { Planner, type PlannerSnapshot } from "@/components/roadshare/Planner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Home as RoadHome } from "@/lib/roadshare/layout";
import { getMyRoad, resetMyRoad, saveMyRoadState } from "@/lib/roadshare/road.functions";

export const Route = createFileRoute("/_authenticated/my-road")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "My road — RoadShare" },
      { name: "description", content: "Your interactive private road plan." },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    const road = await getMyRoad();
    if (!road) throw redirect({ to: "/welcome" });
    const st = (road.state ?? null) as { homes?: RoadHome[] } | null;
    if (!st || !Array.isArray(st.homes) || st.homes.length === 0) {
      throw redirect({ to: "/welcome" });
    }
    return { road };
  },
  loader: ({ context }) => context.road,
  component: MyRoadPage,
});

function MyRoadPage() {
  const road = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const reset = useServerFn(resetMyRoad);
  const save = useServerFn(saveMyRoadState);
  const [busy, setBusy] = useState(false);

  const state = (road.state ?? {}) as Partial<PlannerSnapshot> & { homes?: RoadHome[]; roadName?: string };
  const homes = state.homes ?? [];
  const roadName = state.roadName ?? road.name ?? "My road";
  const initialSnapshot: Partial<PlannerSnapshot> = {
    step: state.step,
    you: state.you ?? null,
    selected: state.selected ?? [],
    entrances: state.entrances ?? [],
    methodology: state.methodology,
    roadWidth: state.roadWidth,
    fundingPeriod: state.fundingPeriod,
    surfaces: state.surfaces,
  };

  const handleStateChange = useCallback(
    (snapshot: PlannerSnapshot) => {
      const merged = { ...snapshot, homes, roadName } as unknown as import("@/integrations/supabase/types").Json;
      void save({ data: { state: merged } }).catch(() => {
        /* silent — next change retries */
      });
    },
    [save, homes, roadName],
  );

  // Easter egg: typing "roadshare" resets the account and returns to /welcome.
  useEffect(() => {
    let buf = "";
    function onKey(e: KeyboardEvent) {
      if (e.key.length !== 1) return;
      buf = (buf + e.key.toLowerCase()).slice(-9);
      if (buf === "roadshare") {
        buf = "";
        void doReset();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function doReset() {
    setBusy(true);
    try {
      await reset();
      toast.success("Reset. Start fresh below.");
      await router.invalidate();
      navigate({ to: "/welcome" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed.");
      setBusy(false);
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/my-road" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
              <RouteIcon className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-sm font-bold leading-tight">{road.name ?? "My road"}</span>
              <span className="block text-[11px] uppercase tracking-wider text-muted-foreground">RoadShare</span>
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={doReset} disabled={busy}>
              <RotateCcw className="h-4 w-4" /> Start over
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>
      <Planner variant="app" homes={homes} roadName={roadName} initialState={initialSnapshot} onStateChange={handleStateChange} />
    </div>
  );
}