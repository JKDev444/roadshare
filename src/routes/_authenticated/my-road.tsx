import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, useRouter, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AppHeader, MapToolbar } from "@/components/roadshare/AppHeader";
import { Planner, type PlannerSnapshot } from "@/components/roadshare/Planner";
import { makeHomeId, makeSegmentId, type Home as RoadHome, type Segment as RoadSegment } from "@/lib/roadshare/layout";
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

  const state = (road.state ?? {}) as Partial<PlannerSnapshot> & {
    homes?: RoadHome[];
    roadName?: string;
    rotation?: 0 | 90 | 180 | 270;
    segments?: RoadSegment[];
  };
  const initialHomes = state.homes ?? [];
  const roadName = state.roadName ?? road.name ?? "My road";
  const initialRotation = (state.rotation ?? 0) as 0 | 90 | 180 | 270;
  const initialSegments: RoadSegment[] =
    state.segments && state.segments.length > 0
      ? state.segments
      : [{ id: "s1", name: roadName, widthFt: 20 }];

  const [homes, setHomes] = useState<RoadHome[]>(initialHomes);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(initialRotation);
  const [segments, setSegments] = useState<RoadSegment[]>(initialSegments);
  const [placingRoadId, setPlacingRoadId] = useState<string | null>(null);
  const historyRef = useRef<RoadHome[][]>([initialHomes]);
  const futureRef = useRef<RoadHome[][]>([]);
  const [historyTick, setHistoryTick] = useState(0);
  const canUndo = useMemo(() => historyRef.current.length > 1, [historyTick]);
  const canRedo = useMemo(() => futureRef.current.length > 0, [historyTick]);

  function pushHistory(next: RoadHome[]) {
    historyRef.current.push(next);
    if (historyRef.current.length > 50) historyRef.current.shift();
    futureRef.current = [];
    setHomes(next);
    setHistoryTick((t) => t + 1);
  }

  function handleAddHome() {
    const next = [
      ...homes,
      { id: makeHomeId(), label: `Home ${homes.length + 1}`, address: null, segmentId: segments[0]?.id },
    ];
    pushHistory(next);
  }
  function handleDeleteHome(id: string) {
    if (homes.length <= 1) return;
    const next = homes.filter((h) => h.id !== id);
    pushHistory(next);
  }
  function handleRenameHome(id: string) {
    const cur = homes.find((h) => h.id === id);
    if (!cur) return;
    const initial = cur.address ?? cur.label;
    const val = typeof window !== "undefined" ? window.prompt("Rename this home", initial) : null;
    if (val == null) return;
    const trimmed = val.trim().slice(0, 80);
    if (!trimmed) return;
    const next = homes.map((h) => (h.id === id ? { ...h, label: trimmed, address: trimmed } : h));
    pushHistory(next);
  }
  function handleRotate() {
    setRotation((r) => (((r + 90) % 360) as 0 | 90 | 180 | 270));
  }

  function handleAddSegment() {
    const id = makeSegmentId();
    const next: RoadSegment = { id, name: `Road ${segments.length + 1}`, widthFt: 20 };
    setSegments((prev) => [...prev, next]);
    setPlacingRoadId(id);
  }
  function handlePlaceRoad(id: string, ax: number, ay: number, bx: number, by: number) {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, geometry: { ax, ay, bx, by } } : s)));
    setPlacingRoadId(null);
  }
  function handleCancelPlaceRoad() {
    if (!placingRoadId) return;
    setSegments((prev) => prev.filter((s) => s.id !== placingRoadId));
    setPlacingRoadId(null);
  }
  function handleMoveHome(id: string, x: number, y: number) {
    const next = homes.map((h) => (h.id === id ? { ...h, position: { x, y } } : h));
    pushHistory(next);
  }
  function handleMoveSegment(id: string, ax: number, ay: number, bx: number, by: number) {
    // Clear any manually-typed length so the displayed / used length reflects
    // the new geometry. Users can retype a length if they want to override.
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, geometry: { ax, ay, bx, by }, lengthFt: undefined } : s)),
    );
  }
  function handleMoveSegmentEndpoint(id: string, endpoint: "a" | "b", x: number, y: number) {
    setSegments((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const g = s.geometry ?? { ax: 0, ay: 0, bx: 0, by: 0 };
        const next = endpoint === "a" ? { ...g, ax: x, ay: y } : { ...g, bx: x, by: y };
        return { ...s, geometry: next, lengthFt: undefined };
      }),
    );
  }
  function handleRenameSegment(id: string) {
    const cur = segments.find((s) => s.id === id);
    if (!cur) return;
    const val = typeof window !== "undefined" ? window.prompt("Rename this road", cur.name) : null;
    if (val == null) return;
    const trimmed = val.trim().slice(0, 60);
    if (!trimmed) return;
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, name: trimmed } : s)));
  }
  function handleDeleteSegment(id: string) {
    if (segments.length <= 1) return;
    const fallback = segments.find((s) => s.id !== id)!.id;
    setSegments((prev) => prev.filter((s) => s.id !== id));
    // Reassign any homes on the removed segment.
    setHomes((prev) => prev.map((h) => (h.segmentId === id ? { ...h, segmentId: fallback } : h)));
  }
  function handleSetSegmentLength(id: string, lengthFt: number | undefined) {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, lengthFt } : s)));
  }
  function handleSetSegmentWidth(id: string, widthFt: number) {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, widthFt } : s)));
  }
  function handleAssignHomeSegment(homeId: string, segmentId: string) {
    const next = homes.map((h) => (h.id === homeId ? { ...h, segmentId } : h));
    pushHistory(next);
  }

  function handleUndo() {
    if (historyRef.current.length <= 1) return;
    const cur = historyRef.current.pop()!;
    futureRef.current.push(cur);
    setHomes(historyRef.current[historyRef.current.length - 1]);
    setHistoryTick((t) => t + 1);
  }
  function handleRedo() {
    const next = futureRef.current.pop();
    if (!next) return;
    historyRef.current.push(next);
    setHomes(next);
    setHistoryTick((t) => t + 1);
  }

  // Keyboard shortcuts: Ctrl/Cmd+Z / Shift+Ctrl+Z
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta || e.key.toLowerCase() !== "z") return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA"].includes(target.tagName)) return;
      e.preventDefault();
      if (e.shiftKey) handleRedo();
      else handleUndo();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [homes]);

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
      const merged = { ...snapshot, homes, roadName, rotation, segments } as unknown as import("@/integrations/supabase/types").Json;
      void save({ data: { state: merged } }).catch(() => {
        /* silent — next change retries */
      });
    },
    [save, homes, roadName, rotation, segments],
  );

  // Persist homes/rotation changes even without planner snapshot changes.
  useEffect(() => {
    const t = setTimeout(() => {
      const merged = { homes, roadName, rotation, segments } as unknown as import("@/integrations/supabase/types").Json;
      void save({ data: { state: merged } }).catch(() => {});
    }, 700);
    return () => clearTimeout(t);
  }, [homes, rotation, roadName, segments, save]);

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

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        roadName={road.name ?? "My road"}
        active="map"
        onReset={doReset}
        busy={busy}
        toolbar={
          <MapToolbar
            onAddHome={handleAddHome}
            onAddSegment={handleAddSegment}
            onRotate={handleRotate}
            onUndo={handleUndo}
            onRedo={handleRedo}
            canUndo={canUndo}
            canRedo={canRedo}
            placingRoadId={placingRoadId}
            onCancelPlaceRoad={handleCancelPlaceRoad}
          />
        }
      />
      <Planner
        variant="app"
        homes={homes}
        roadName={roadName}
        segments={segments}
        initialState={initialSnapshot}
        onStateChange={handleStateChange}
        rotation={rotation}
        onAddHome={handleAddHome}
        onRenameHome={handleRenameHome}
        onDeleteHome={handleDeleteHome}
        onAssignHomeSegment={handleAssignHomeSegment}
        onAddSegment={handleAddSegment}
        onRenameSegment={handleRenameSegment}
        onDeleteSegment={handleDeleteSegment}
        onSetSegmentLength={handleSetSegmentLength}
        onSetSegmentWidth={handleSetSegmentWidth}
        onRotate={handleRotate}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onMoveHome={handleMoveHome}
        onMoveSegment={handleMoveSegment}
        placingRoadId={placingRoadId}
        onPlaceRoad={handlePlaceRoad}
        onCancelPlaceRoad={handleCancelPlaceRoad}
      />
    </div>
  );
}