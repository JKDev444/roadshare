import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AppHeader, MapToolbar } from "@/components/roadshare/AppHeader";
import { Planner, type PlannerSnapshot } from "@/components/roadshare/Planner";
import { HomeDetailsDrawer, type HomePatchPreview, type HomeShareEstimate } from "@/components/roadshare/HomeDetailsDrawer";
import { TemplatePicker } from "@/components/roadshare/TemplatePicker";
import { BulkAddDialog } from "@/components/roadshare/BulkAddDialog";
import { AddRoadDialog, type AddRoadSpec } from "@/components/roadshare/AddRoadDialog";
import {
  makeHomeId,
  makeSegmentId,
  snapHomeTileToRoad,
  buildLayout,
  type Home as RoadHome,
  type Segment as RoadSegment,
  type RoadTemplate,
} from "@/lib/roadshare/layout";
import { getMyRoad, resetMyRoad, saveMyRoadState } from "@/lib/roadshare/road.functions";
import { createShare } from "@/lib/roadshare/share.functions";
import { autoArrangeHomes } from "@/lib/roadshare/layout";
import { computeAllocation } from "@/lib/roadshare/engine";
import { SURFACE_TYPES, DEFAULTS } from "@/lib/roadshare/data";

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
  const reset = useServerFn(resetMyRoad);
  const save = useServerFn(saveMyRoadState);
  const share = useServerFn(createShare);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const lastSnapshotRef = useRef<PlannerSnapshot | null>(null);

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
  const [editingHomeId, setEditingHomeId] = useState<string | null>(null);
  // Show the template picker the first time the user lands with no geometry
  // and only the default single auto-segment.
  const initialShowTemplates =
    initialSegments.length === 1 &&
    !initialSegments[0].geometry &&
    !initialHomes.some((h) => h.position);
  const [showTemplates, setShowTemplates] = useState(initialShowTemplates);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [addRoadOpen, setAddRoadOpen] = useState(false);
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
      // New homes land in the tray so they never float loose on the map.
      { id: makeHomeId(), label: `Home ${homes.length + 1}`, address: null, segmentId: segments[0]?.id, position: null },
    ];
    pushHistory(next);
  }
  function handleBulkAdd(drafts: { address: string; owner?: string; frontageFt?: number }[]) {
    if (drafts.length === 0) return;
    const startIdx = homes.length;
    const additions: RoadHome[] = drafts.map((d, i) => ({
      id: makeHomeId(),
      label: d.address || `Home ${startIdx + i + 1}`,
      address: d.address || null,
      ownerLabel: d.owner ?? null,
      frontageFtOverride: d.frontageFt ?? null,
      segmentId: segments[0]?.id,
      position: null,
    }));
    pushHistory([...homes, ...additions]);
  }
  function handleReturnHomeToTray(id: string) {
    const next = homes.map((h) => (h.id === id ? { ...h, position: null } : h));
    pushHistory(next);
  }
  function handleDropHomeAt(homeId: string, x: number, y: number, segmentId: string) {
    const next = homes.map((h) => (h.id === homeId ? { ...h, position: { x, y }, segmentId } : h));
    pushHistory(next);
  }
  function handleDeleteHome(id: string) {
    if (homes.length <= 1) return;
    const next = homes.filter((h) => h.id !== id);
    pushHistory(next);
  }
  function handleRenameHome(id: string) {
    // Open the full details drawer so users can edit both the owner/family
    // name (e.g. "The Smiths") and the address on one screen.
    setEditingHomeId(id);
  }
  function handleRotate() {
    setRotation((r) => (((r + 90) % 360) as 0 | 90 | 180 | 270));
  }

  function handleAddSegment() {
    // Guided modal: user picks how the new road connects (extend / cross /
    // standalone) and we place it for them. Replaces the old free-click flow
    // that produced messy disconnected roads.
    setAddRoadOpen(true);
  }
  function handleAddRoadConfirm(spec: AddRoadSpec) {
    const id = makeSegmentId();
    const newSeg: RoadSegment = {
      id,
      name: spec.name,
      widthFt: spec.widthFt,
      geometry: { ax: spec.ax, ay: spec.ay, bx: spec.bx, by: spec.by },
    };
    setSegments((prev) => [...prev, newSeg]);
    toast.success(`${spec.name} added.`);
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
  function handleSplitSegment(id: string, x: number, y: number) {
    const src = segments.find((s) => s.id === id);
    if (!src?.geometry) return;
    const g = src.geometry;
    const newId = makeSegmentId();
    const newSeg: RoadSegment = {
      id: newId,
      name: `${src.name} (cont.)`,
      widthFt: src.widthFt,
      geometry: { ax: x, ay: y, bx: g.bx, by: g.by },
    };
    setSegments((prev) =>
      prev.flatMap((s) =>
        s.id === id
          ? [{ ...s, geometry: { ax: g.ax, ay: g.ay, bx: x, by: y }, lengthFt: undefined }, newSeg]
          : [s],
      ),
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
  function handleEditHome(id: string) {
    setEditingHomeId(id);
  }
  function handleSaveHome(id: string, patch: Partial<RoadHome>) {
    const next = homes.map((h) => (h.id === id ? { ...h, ...patch } : h));
    pushHistory(next);
  }
  function handlePickTemplate(t: RoadTemplate) {
    setSegments(t.segments.map((s) => ({ ...s })));
    // Reassign every home to the first segment so nothing goes orphaned.
    setHomes((prev) => prev.map((h) => ({ ...h, segmentId: t.segments[0].id, position: null })));
    setShowTemplates(false);
  }

  function handleFlipHomeSide(id: string) {
    const home = homes.find((h) => h.id === id);
    if (!home || !home.position) return;
    const seg = segments.find((s) => s.id === (home.segmentId ?? segments[0]?.id));
    if (!seg?.geometry) {
      toast.info("Flip works once this road has a shape on the map.");
      return;
    }
    const g = seg.geometry;
    const dx = g.bx - g.ax;
    const dy = g.by - g.ay;
    const L2 = dx * dx + dy * dy || 1;
    const cx = home.position.x + 65; // half of LOT_W (130)
    const cy = home.position.y + 41; // half of LOT_H (82)
    let t = ((cx - g.ax) * dx + (cy - g.ay) * dy) / L2;
    t = Math.max(0, Math.min(1, t));
    const landX = g.ax + t * dx;
    const landY = g.ay + t * dy;
    // Figure out current side, flip it.
    const cross = dx * (cy - g.ay) - dy * (cx - g.ax);
    const currentSide: "left" | "right" = cross > 0 ? "right" : "left";
    const newSide: "left" | "right" = currentSide === "left" ? "right" : "left";
    const pos = snapHomeTileToRoad(g.ax, g.ay, g.bx, g.by, landX, landY, newSide);
    const next = homes.map((h) => (h.id === id ? { ...h, position: pos } : h));
    pushHistory(next);
  }

  function handleMoveHomeInOrder(id: string, dir: -1 | 1) {
    const home = homes.find((h) => h.id === id);
    if (!home) return;
    const segId = home.segmentId ?? segments[0]?.id;
    // Reorder within the full homes array by swapping with the previous/next
    // home on the same segment, then re-space all homes evenly.
    const idx = homes.findIndex((h) => h.id === id);
    const searchFrom = dir < 0 ? idx - 1 : idx + 1;
    const step = dir < 0 ? -1 : 1;
    let swapIdx = -1;
    for (let i = searchFrom; i >= 0 && i < homes.length; i += step) {
      if (homes[i].segmentId === segId || (segments.length === 1)) {
        swapIdx = i;
        break;
      }
    }
    if (swapIdx < 0) {
      toast.info(dir < 0 ? "Already first on this road." : "Already last on this road.");
      return;
    }
    const reordered = homes.slice();
    [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx], reordered[idx]];
    const arranged = autoArrangeHomes(reordered, segments);
    pushHistory(arranged);
  }

  /**
   * Move a home to a specific 1..N position among its road peers.
   * We rebuild the full homes array so the target home lands at the right
   * spot in the same-segment ordering, then let autoArrangeHomes re-space
   * everyone so nothing overlaps.
   */
  function handleSetHomeOrderIndex(id: string, targetIndex1Based: number) {
    const home = homes.find((h) => h.id === id);
    if (!home) return;
    const segId = home.segmentId ?? segments[0]?.id;
    // Same-segment peers in current order.
    const peers = homes.filter((h) => (h.segmentId ?? segments[0]?.id) === segId);
    const others = homes.filter((h) => (h.segmentId ?? segments[0]?.id) !== segId);
    const remaining = peers.filter((h) => h.id !== id);
    const targetIdx0 = Math.max(0, Math.min(remaining.length, targetIndex1Based - 1));
    const newPeers = [...remaining.slice(0, targetIdx0), home, ...remaining.slice(targetIdx0)];
    // Splice new peer order back into `homes` in the original slots that
    // belonged to peers, so unrelated ordering is preserved.
    const peerIds = new Set(peers.map((h) => h.id));
    let cursor = 0;
    const rebuilt = homes.map((h) => (peerIds.has(h.id) ? newPeers[cursor++] : h));
    const arranged = autoArrangeHomes(rebuilt, segments);
    pushHistory(arranged);
  }

  function handleDuplicateHome(id: string) {
    const src = homes.find((h) => h.id === id);
    if (!src) return;
    const copy: RoadHome = {
      ...src,
      id: makeHomeId(),
      // Land the duplicate in the tray so users decide where it goes.
      position: null,
      label: src.ownerLabel ? `${src.ownerLabel} (copy)` : `${src.label} (copy)`,
    };
    pushHistory([...homes, copy]);
    toast.success("Copied home to your tray.");
  }

  function handleStraightenSegment(id: string) {
    const seg = segments.find((s) => s.id === id);
    if (!seg?.geometry) return;
    const { ax, ay, bx, by } = seg.geometry;
    const dx = Math.abs(bx - ax);
    const dy = Math.abs(by - ay);
    // Snap to horizontal or vertical, whichever it's closest to.
    if (dx >= dy) {
      const y = Math.round((ay + by) / 2);
      setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, geometry: { ax, ay: y, bx, by: y }, lengthFt: undefined } : s)));
    } else {
      const x = Math.round((ax + bx) / 2);
      setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, geometry: { ax: x, ay, bx: x, by }, lengthFt: undefined } : s)));
    }
    toast.success("Road straightened.");
  }

  function handleExtendSegment(id: string, deltaFt: number) {
    const FT_PER_UNIT = 1.25;
    const seg = segments.find((s) => s.id === id);
    if (!seg?.geometry) return;
    const { ax, ay, bx, by } = seg.geometry;
    const dx = bx - ax;
    const dy = by - ay;
    const L = Math.hypot(dx, dy) || 1;
    const deltaU = deltaFt / FT_PER_UNIT;
    // Extend/shorten by moving the "b" endpoint along the road direction.
    const nbx = Math.round(bx + (dx / L) * deltaU);
    const nby = Math.round(by + (dy / L) * deltaU);
    // Guard against collapsing the road below ~40 ft.
    const newLen = Math.hypot(nbx - ax, nby - ay) * FT_PER_UNIT;
    if (newLen < 40) {
      toast.info("Road is already at its minimum length.");
      return;
    }
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, geometry: { ax, ay, bx: nbx, by: nby }, lengthFt: undefined } : s)));
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
    fixedTotal: state.fixedTotal,
  };

  const handleStateChange = useCallback(
    (snapshot: PlannerSnapshot) => {
      lastSnapshotRef.current = snapshot;
      const merged = { ...snapshot, homes, roadName, rotation, segments } as unknown as import("@/integrations/supabase/types").Json;
      void save({ data: { state: merged } }).catch(() => {
        /* silent — next change retries */
      });
    },
    [save, homes, roadName, rotation, segments],
  );

  // Live "your share" preview for the details drawer. Rebuilds the layout
  // + runs the same allocator the results panel uses, so the number in the
  // drawer is the same one the user sees on the map — updated as they drag
  // the frontage slider or toggle "don't count".
  const livePreview = useCallback(
    (homeId: string, patch: HomePatchPreview): HomeShareEstimate | null => {
      const snap = lastSnapshotRef.current;
      const patchedHomes = homes.map((h) =>
        h.id === homeId
          ? { ...h, frontageFtOverride: patch.frontageFtOverride, skipFromMath: patch.skipFromMath }
          : h,
      );
      const layout = buildLayout(patchedHomes, roadName, segments);
      // Selected set: drop any home flagged "don't count".
      const skipIds = new Set(patchedHomes.filter((h) => h.skipFromMath).map((h) => h.id));
      const selectedFromSnap = snap?.selected && snap.selected.length > 0
        ? snap.selected
        : layout.parcels.map((p) => p.id);
      const selected = selectedFromSnap.filter((id) => !skipIds.has(id));
      const entrances = snap?.entrances && snap.entrances.length > 0
        ? snap.entrances
        : layout.entrances.map((e) => e.id);
      const result = computeAllocation({
        selected,
        entrances,
        methodology: snap?.methodology ?? "frontage",
        surfaces: snap?.surfaces ?? SURFACE_TYPES.map((s) => ({ pct: s.defaultPct, cost: s.defaultCost })),
        surfaceTypes: SURFACE_TYPES,
        roadWidth: snap?.roadWidth ?? DEFAULTS.roadWidth,
        fundingPeriod: snap?.fundingPeriod ?? DEFAULTS.fundingPeriod,
        you: snap?.you ?? null,
        layout,
        fixedTotal: snap?.fixedTotal,
      });
      const row = result.rows.find((r) => r.id === homeId);
      const ready = result.pctValid && result.hasEntrance && !!row;
      if (!row) {
        return { ready: false, share: 0, perYear: 0, deltaVsEqual: 0 };
      }
      return {
        ready,
        share: row.share,
        perYear: row.perYear,
        deltaVsEqual: row.perYear - row.equalPerYear,
      };
    },
    [homes, roadName, segments],
  );

  // Peer info for the drawer's position slider.
  const editingHome = editingHomeId ? homes.find((h) => h.id === editingHomeId) ?? null : null;
  const peerHomes = editingHome
    ? homes.filter((h) => (h.segmentId ?? segments[0]?.id) === (editingHome.segmentId ?? segments[0]?.id))
    : [];
  const peerCount = peerHomes.length;
  const peerIndex = editingHome ? peerHomes.findIndex((h) => h.id === editingHome.id) + 1 : 0;

  function handleAutoArrange() {
    const next = autoArrangeHomes(homes, segments);
    pushHistory(next);
    toast.success("Homes spaced evenly along your roads.");
  }

  async function handleShare() {
    setSharing(true);
    try {
      const snap = lastSnapshotRef.current;
      const merged = { ...(snap ?? {}), homes, roadName, rotation, segments } as unknown as import("@/integrations/supabase/types").Json;
      // Ensure the latest state is persisted before we snapshot the share.
      await save({ data: { state: merged } }).catch(() => {});
      const { slug } = await share({ data: { snapshot: merged } });
      const url = `${window.location.origin}/s/${slug}`;
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Share link copied to clipboard.", { description: url });
      } catch {
        toast.success("Share link ready.", { description: url });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create share link.");
    } finally {
      setSharing(false);
    }
  }

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
      // Hard navigate to avoid race conditions with the autosave effect.
      window.location.href = "/welcome";
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
        onChangeLayout={() => setShowTemplates(true)}
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
            onAutoArrange={handleAutoArrange}
            onShare={handleShare}
            sharing={sharing}
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
        onStraightenSegment={handleStraightenSegment}
        onExtendSegment={handleExtendSegment}
        onRotate={handleRotate}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        onMoveHome={handleMoveHome}
        onMoveSegment={handleMoveSegment}
        onMoveSegmentEndpoint={handleMoveSegmentEndpoint}
        onSplitSegment={handleSplitSegment}
        placingRoadId={placingRoadId}
        onPlaceRoad={handlePlaceRoad}
        onCancelPlaceRoad={handleCancelPlaceRoad}
        onEditHome={handleEditHome}
        onDropHomeAt={handleDropHomeAt}
        onBulkAdd={() => setBulkOpen(true)}
      />
      {showTemplates && (
        <TemplatePicker onPick={handlePickTemplate} onSkip={() => setShowTemplates(false)} />
      )}
      {addRoadOpen && (
        <AddRoadDialog
          segments={segments}
          onClose={() => setAddRoadOpen(false)}
          onConfirm={handleAddRoadConfirm}
        />
      )}
      <BulkAddDialog open={bulkOpen} onClose={() => setBulkOpen(false)} onAdd={handleBulkAdd} />
      <HomeDetailsDrawer
        home={editingHome}
        segments={segments}
        onClose={() => setEditingHomeId(null)}
        onSave={handleSaveHome}
        onDelete={homes.length > 1 ? handleDeleteHome : undefined}
        onReturnToTray={handleReturnHomeToTray}
        onFlipSide={handleFlipHomeSide}
        onMoveInOrder={handleMoveHomeInOrder}
        onSetOrderIndex={handleSetHomeOrderIndex}
        peerCount={peerCount}
        peerIndex={peerIndex}
        onDuplicate={handleDuplicateHome}
        livePreview={livePreview}
      />
    </div>
  );
}