import { useEffect, useMemo, useRef, useState, type ComponentType } from "react";
import {
  ArrowRight,
  Check,
  Home,
  MapPin,
  Route as RouteIcon,
  Search,
  Sparkles,
  Plus,
  RotateCw,
  Undo2,
  Redo2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";

import { PlatMap } from "@/components/roadshare/PlatMap";
import { ResultsPanel } from "@/components/roadshare/ResultsPanel";
import { HomesTray } from "@/components/roadshare/HomesTray";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { DEFAULTS, SURFACE_TYPES } from "@/lib/roadshare/data";
import { buildLayout, cedarHollowLayout, segmentLengthFt, type Home as RoadHome, type Layout, type LayoutEntrance, type LayoutParcel, type Segment } from "@/lib/roadshare/layout";
import { computeAllocation, type Methodology } from "@/lib/roadshare/engine";
import { cn } from "@/lib/utils";

type WalkStep = "home" | "road" | "neighbors" | "entrances" | "review";

export type PlannerSnapshot = {
  step: WalkStep;
  you: string | null;
  selected: string[];
  entrances: string[];
  methodology: Methodology;
  roadWidth: number;
  fundingPeriod: number;
  surfaces: { pct: number; cost: number }[];
  /** Contractor quote (total $). When > 0 it overrides the material math. */
  fixedTotal?: number;
};

const METHODS: { id: Methodology; label: string; helper: string }[] = [
  { id: "distance", label: "Road used", helper: "Homes farther down the road pay more." },
  { id: "frontage", label: "Road frontage", helper: "Homes with more frontage pay more." },
  { id: "equal", label: "Equal split", helper: "Every selected home pays the same." },
];

const STEP_META: Record<WalkStep, { n: number; title: string; short: string; icon: ComponentType<{ className?: string }> }> = {
  home: { n: 1, title: "Pick your home", short: "Start here", icon: Home },
  road: { n: 2, title: "Confirm your road", short: "Your road", icon: RouteIcon },
  neighbors: { n: 3, title: "Choose who shares", short: "Neighbors", icon: Sparkles },
  entrances: { n: 4, title: "Confirm entrances", short: "Entrances", icon: MapPin },
  review: { n: 5, title: "See your share", short: "Result", icon: RouteIcon },
};

function homeGroupFor(id: string | null, parcels: LayoutParcel[]) {
  if (!id) return parcels.map((p) => p.id);
  const home = parcels.find((p) => p.id === id);
  if (!home) return parcels.map((p) => p.id);
  const street = home.address.replace(/^\d+\s+/, "");
  const sameStreet = parcels.filter((p) => p.address.includes(street)).map((p) => p.id);
  return sameStreet.length >= 3 ? sameStreet : parcels.map((p) => p.id);
}

function addressNumber(address: string) {
  return address.split(" ")[0] || address;
}

export function Planner({
  homes,
  roadName,
  segments,
  initialState,
  onStateChange,
  variant = "demo",
  rotation = 0,
  onAddHome,
  onRenameHome,
  onDeleteHome,
  onAssignHomeSegment,
  onEditHome,
  onAddSegment,
  onRenameSegment,
  onDeleteSegment,
  onSetSegmentLength,
  onSetSegmentWidth,
  onStraightenSegment,
  onExtendSegment,
  onRotate,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  onMoveHome,
  onMoveSegment,
  onMoveSegmentEndpoint,
  onSplitSegment,
  placingRoadId = null,
  onPlaceRoad,
  onCancelPlaceRoad,
  onDropHomeAt,
  onBulkAdd,
}: {
  homes?: RoadHome[];
  roadName?: string;
  segments?: Segment[];
  initialState?: Partial<PlannerSnapshot> | null;
  onStateChange?: (snapshot: PlannerSnapshot) => void;
  variant?: "demo" | "app";
  rotation?: 0 | 90 | 180 | 270;
  onAddHome?: () => void;
  onRenameHome?: (id: string) => void;
  onDeleteHome?: (id: string) => void;
  onAssignHomeSegment?: (homeId: string, segmentId: string) => void;
  onEditHome?: (id: string) => void;
  onAddSegment?: () => void;
  onRenameSegment?: (id: string) => void;
  onDeleteSegment?: (id: string) => void;
  onSetSegmentLength?: (id: string, lengthFt: number | undefined) => void;
  onSetSegmentWidth?: (id: string, widthFt: number) => void;
  onStraightenSegment?: (id: string) => void;
  onExtendSegment?: (id: string, deltaFt: number) => void;
  onRotate?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onMoveHome?: (id: string, x: number, y: number) => void;
  onMoveSegment?: (id: string, ax: number, ay: number, bx: number, by: number) => void;
  onMoveSegmentEndpoint?: (id: string, endpoint: "a" | "b", x: number, y: number) => void;
  onSplitSegment?: (id: string, x: number, y: number) => void;
  placingRoadId?: string | null;
  onPlaceRoad?: (segmentId: string, ax: number, ay: number, bx: number, by: number) => void;
  onCancelPlaceRoad?: () => void;
  onDropHomeAt?: (homeId: string, x: number, y: number, segmentId: string) => void;
  onBulkAdd?: () => void;
} = {}) {
  const layout = useMemo<Layout>(() => {
    if (homes && homes.length > 0) return buildLayout(homes, roadName || "My road", segments);
    return cedarHollowLayout();
  }, [homes, roadName, segments]);
  const PARCELS = layout.parcels;
  const ENTRANCES = layout.entrances;
  const hasRoadStep = !!(segments && segments.length > 0);
  const visibleSteps: WalkStep[] = hasRoadStep
    ? ["home", "road", "neighbors", "entrances", "review"]
    : ["home", "neighbors", "entrances", "review"];
  const stepIndex = (s: WalkStep) => visibleSteps.indexOf(s);

  const [step, setStep] = useState<WalkStep>(initialState?.step ?? "home");
  const [you, setYou] = useState<string | null>(initialState?.you ?? null);
  const [query, setQuery] = useState(() => {
    const home = PARCELS.find((p) => p.id === initialState?.you);
    return home?.address ?? "";
  });
  const [selected, setSelected] = useState<string[]>(initialState?.selected ?? []);
  const [entrances, setEntrances] = useState<string[]>(
    initialState?.entrances ?? (homes && homes.length ? layout.entrances.map((e) => e.id) : []),
  );
  const [hovered, setHovered] = useState<string | null>(null);
  const [methodology, setMethodology] = useState<Methodology>(initialState?.methodology ?? "distance");
  const [roadWidth, setRoadWidth] = useState(initialState?.roadWidth ?? DEFAULTS.roadWidth);
  const [fundingPeriod, setFundingPeriod] = useState(initialState?.fundingPeriod ?? DEFAULTS.fundingPeriod);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [surfaces, setSurfaces] = useState(
    initialState?.surfaces ?? SURFACE_TYPES.map((s) => ({ pct: s.defaultPct, cost: s.defaultCost })),
  );
  const [fixedTotal, setFixedTotal] = useState<number | undefined>(initialState?.fixedTotal);
  const hasQuote = typeof fixedTotal === "number" && fixedTotal > 0;
  // Silence unused-var warning until we bring assumptions back.
  void assumptionsOpen; void setAssumptionsOpen; void hasQuote;
  const [pendingTrayHomeId, setPendingTrayHomeId] = useState<string | null>(null);

  // Auto-cancel pending home if it becomes placed (via drag) or removed.
  useEffect(() => {
    if (!pendingTrayHomeId) return;
    const still = homes?.find((h) => h.id === pendingTrayHomeId);
    if (!still || still.position) setPendingTrayHomeId(null);
  }, [homes, pendingTrayHomeId]);

  // Debounced snapshot emit
  const firstRun = useRef(true);
  useEffect(() => {
    if (!onStateChange) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(() => {
      onStateChange({ step, you, selected, entrances, methodology, roadWidth, fundingPeriod, surfaces, fixedTotal });
    }, 700);
    return () => clearTimeout(t);
  }, [step, you, selected, entrances, methodology, roadWidth, fundingPeriod, surfaces, fixedTotal, onStateChange]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return PARCELS.filter((p) => p.address.toLowerCase().includes(q)).slice(0, 6);
  }, [query]);

  const suggested = useMemo(() => homeGroupFor(you, PARCELS), [you, PARCELS]);

  const result = useMemo(
    () =>
      computeAllocation({
        selected,
        entrances,
        methodology,
        surfaces,
        surfaceTypes: SURFACE_TYPES,
        roadWidth,
        fundingPeriod,
        you,
        layout,
        fixedTotal,
      }),
    [selected, entrances, methodology, surfaces, roadWidth, fundingPeriod, you, layout, fixedTotal],
  );

  const pickedHome = PARCELS.find((p) => p.id === you);
  const pctTotal = surfaces.reduce((s, x) => s + (Number(x.pct) || 0), 0);
  const pctValid = Math.abs(pctTotal - 100) < 0.001;
  const canReview = !!you && selected.length > 0 && entrances.length > 0 && pctValid;

  function pickYou(id: string) {
    const home = PARCELS.find((p) => p.id === id);
    if (!home) return;
    setYou(id);
    setQuery(home.address);
    setSelected((current) => (current.includes(id) ? current : [id, ...current]));
    setStep(hasRoadStep ? "road" : "neighbors");
  }

  function toggleParcel(id: string) {
    if (!you || step === "home") {
      pickYou(id);
      return;
    }
    setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  function useSuggestions() {
    const withHome = you && !suggested.includes(you) ? [you, ...suggested] : suggested;
    setSelected(withHome);
    setStep("entrances");
  }

  function toggleEntrance(id: string) {
    setEntrances((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
  }

  function useBothEntrances() {
    setEntrances(layout.entrances.map((e) => e.id));
    setStep("review");
  }

  function resetDemo() {
    setStep("home");
    setYou(null);
    setQuery("");
    setSelected([]);
    setEntrances(homes && homes.length ? layout.entrances.map((e) => e.id) : []);
    setHovered(null);
    setMethodology("distance");
    setRoadWidth(DEFAULTS.roadWidth);
    setFundingPeriod(DEFAULTS.fundingPeriod);
    setAssumptionsOpen(false);
    setSurfaces(SURFACE_TYPES.map((s) => ({ pct: s.defaultPct, cost: s.defaultCost })));
  }

  const isApp = variant === "app";

  const platBlock = (
    <PlatMap
      layout={layout}
      selected={selected}
      you={you}
      entrances={entrances}
      hovered={hovered}
      activeStep={step}
      rotation={rotation}
      onToggleParcel={toggleParcel}
      onHoverParcel={setHovered}
      onToggleEntrance={toggleEntrance}
      onRenameParcel={onRenameHome}
      onDeleteParcel={onDeleteHome}
      onDeleteSegment={onDeleteSegment}
      onMoveHome={onMoveHome}
      onEditHome={onEditHome}
      onAssignHomeSegment={onAssignHomeSegment}
      onMoveSegment={onMoveSegment}
      onMoveSegmentEndpoint={onMoveSegmentEndpoint}
      onSplitSegment={onSplitSegment}
      pendingTrayHomeId={pendingTrayHomeId}
      onCancelPendingHome={() => setPendingTrayHomeId(null)}
      placingRoadId={placingRoadId}
      onPlaceRoad={onPlaceRoad}
      onCancelPlaceRoad={onCancelPlaceRoad}
      onDropHomeAt={(homeId, x, y, segmentId) => {
        onDropHomeAt?.(homeId, x, y, segmentId);
        setPendingTrayHomeId(null);
      }}
    />
  );

  const stepStrip = (
    <div
      className={cn(
        "grid gap-2 rounded-2xl border border-border bg-card/90 p-3 text-xs shadow-sm",
        hasRoadStep ? "sm:grid-cols-5" : "sm:grid-cols-4",
      )}
    >
      {visibleSteps.map((key, idx) => {
        const meta = STEP_META[key];
        const displayN = idx + 1;
        const curIdx = stepIndex(step);
        const done =
          (key === "home" && !!you) ||
          (key === "road" && curIdx > idx) ||
          (key === "neighbors" && selected.length > 1) ||
          (key === "entrances" && entrances.length > 0) ||
          (key === "review" && canReview);
        const active = step === key;
        const Icon = meta.icon;
        return (
          <button
            key={key}
            type="button"
            onClick={() => setStep(key)}
            className={cn(
              "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-xl border p-2 text-left transition-colors",
              active ? "border-primary bg-primary/10" : "border-border bg-background/60 hover:bg-accent",
            )}
          >
            <span
              className={cn(
                "grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                done ? "bg-selected text-selected-foreground" : active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{meta.short}</span>
              <span className="block truncate text-muted-foreground">Step {displayN}</span>
            </span>
          </button>
        );
      })}
    </div>
  );

  const rightRail = (
    <>
      {/* Pinned "your estimated share" hero — stays visible as the user tweaks
          anything below so they can watch the number change in real time. */}
      {step !== "home" && step !== "road" && (
        <div
          className={cn(
            "z-10",
            isApp
              ? "sticky top-0 -mx-4 -mt-4 mb-1 bg-background/95 px-4 pb-4 pt-4 shadow-sm ring-1 ring-border backdrop-blur"
              : "sticky top-20",
          )}
        >
          <ResultsPanel result={result} methodology={methodology} compact />
        </div>
      )}
      <div className="rounded-2xl border border-border bg-card p-4 shadow-md">
        <StepPanel
          parcels={PARCELS}
          entrancesList={ENTRANCES}
          segments={segments}
          totalSteps={visibleSteps.length}
          displayStepN={stepIndex(step) + 1}
          onSetSegmentLength={onSetSegmentLength}
          onSetSegmentWidth={onSetSegmentWidth}
          onRenameSegment={onRenameSegment}
          onGoToNeighbors={() => setStep("neighbors")}
          step={step}
          query={query}
          setQuery={setQuery}
          matches={matches}
          pickedHome={pickedHome}
          selected={selected}
          suggested={suggested}
          entrances={entrances}
          methodology={methodology}
          setMethodology={setMethodology}
          onPickHome={pickYou}
          onUseSuggestions={useSuggestions}
          onClearNeighbors={() => setSelected(you ? [you] : [])}
          onToggleEntrance={toggleEntrance}
          onUseBothEntrances={useBothEntrances}
          onGoToReview={() => setStep("review")}
          canReview={canReview}
        />
      </div>

      {/* Breakdown table on the review step (hero is pinned above the rail). */}
      {step === "review" && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-md">
          <ResultsPanel result={result} methodology={methodology} hideHero />
        </div>
      )}

      {/* Simple adjustments: total cost + width + years. Shown once the user
          is past picking a home / drawing the road. */}
      {step !== "home" && step !== "road" && (
        <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <TotalCostControl
            fixedTotal={fixedTotal}
            estimatedTotal={result.totalCost}
            setFixedTotal={setFixedTotal}
          />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 border-t border-border pt-3">
            <SliderControl label="How wide is the road?" value={roadWidth} suffix="ft" min={8} max={40} onChange={setRoadWidth} />
            <SliderControl label="Plan over how many years?" value={fundingPeriod} suffix="yr" min={1} max={40} onChange={setFundingPeriod} />
          </div>
        </div>
      )}
    </>
  );

  if (isApp) {
    const unplacedCount = (homes ?? []).filter((h) => !h.position).length;
    const placedCount = (homes ?? []).length - unplacedCount;
    const roadsNeedingWork = (segments ?? []).filter((s) => !s.geometry).length;
    const showProgressChip = unplacedCount > 0 || roadsNeedingWork > 0;
    const showTray = step === "home" && unplacedCount > 0;
    // Full-bleed: plat fills the viewport, right rail is a fixed 380px column.
    return (
      <main className="grid h-[calc(100dvh-var(--rs-header-h,113px))] grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="relative flex min-w-0 flex-col overflow-hidden bg-muted/20">
          {showProgressChip && (
            <div className="flex shrink-0 items-center justify-center gap-2 border-b border-border/60 bg-background/95 px-4 py-2 text-[11px] font-medium">
              {unplacedCount > 0 && (
                <button
                  type="button"
                  onClick={() => setStep("home")}
                  className="rounded-full bg-primary/10 px-2.5 py-1 text-primary hover:bg-primary/20"
                >
                  {unplacedCount} home{unplacedCount === 1 ? "" : "s"} still need a spot
                </button>
              )}
              {unplacedCount > 0 && roadsNeedingWork > 0 && <span className="text-muted-foreground">·</span>}
              {roadsNeedingWork > 0 && (
                <button
                  type="button"
                  onClick={() => setStep("road")}
                  className="rounded-full bg-gold/20 px-2.5 py-1 text-foreground hover:bg-gold/30"
                >
                  {roadsNeedingWork} road{roadsNeedingWork === 1 ? "" : "s"} to draw
                </button>
              )}
              {unplacedCount === 0 && roadsNeedingWork === 0 && (
                <span className="text-muted-foreground">
                  {placedCount} home{placedCount === 1 ? "" : "s"} on the map
                </span>
              )}
            </div>
          )}
          <div className="relative flex flex-1 min-h-0 items-stretch justify-center p-3 sm:p-4">
            <div className="relative flex w-full flex-1 min-h-0 items-stretch">
              <div className="flex w-full min-w-0 flex-1 flex-col">{platBlock}</div>
            </div>
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-background/90 px-3 py-1 text-[11px] text-muted-foreground shadow-sm ring-1 ring-border">
              {placingRoadId
                ? "Click twice on the map to place the road · Esc to cancel"
                : pendingTrayHomeId
                ? "Tap the road where this home should sit · Esc to cancel"
                : "Drag to move · Double-click to rename · Hover then click × (or press Delete) to remove"}
            </div>
          </div>
          {showTray && (
            <div className="px-3 pb-3 sm:px-4">
              <HomesTray
                homes={homes ?? []}
                onAddHome={onAddHome}
                onBulkAdd={onBulkAdd}
                onOpenHome={onEditHome}
                pendingHomeId={pendingTrayHomeId}
                onSelectHome={setPendingTrayHomeId}
              />
            </div>
          )}
          <div className="border-t border-border bg-background/95 p-3 backdrop-blur">
            {stepStrip}
          </div>
        </section>
        <aside className="min-w-0 overflow-y-auto border-l border-border bg-background p-4 space-y-3">
          {rightRail}
          {segments && segments.length > 0 && step !== "home" && step !== "road" && step !== "review" && (
            <RoadsPanel
              segments={segments}
              onAddSegment={onAddSegment}
              onRenameSegment={onRenameSegment}
              onDeleteSegment={onDeleteSegment}
              onSetSegmentWidth={onSetSegmentWidth}
              onStraightenSegment={onStraightenSegment}
              onExtendSegment={onExtendSegment}
            />
          )}
          {step !== "home" && step !== "review" && (onAddHome || onRenameHome || onDeleteHome) && homes && homes.length > 0 && (
            <HomesPanel
              homes={homes}
              parcels={PARCELS}
              segments={segments}
              onAddHome={onAddHome}
              onRenameHome={onRenameHome}
              onDeleteHome={onDeleteHome}
              onAssignHomeSegment={onAssignHomeSegment}
            />
          )}
        </aside>
      </main>
    );
  }

  return (
    <main className="surface-glow">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:py-8">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]">
          <section className="min-w-0 space-y-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-2xl border border-border bg-card/90 p-4 shadow-sm sm:p-5">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-primary">Interactive sample</p>
                <h2 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  Start with the map. The sample walks you one choice at a time.
                </h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                  This is not a form about road engineering. Pick a home, choose the neighbors who share the road, then see the estimated yearly share.
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={resetDemo} className="shrink-0">
                Reset
              </Button>
            </div>

            {platBlock}
            {stepStrip}
          </section>

          <aside className="min-w-0 space-y-3 lg:sticky lg:top-20 lg:h-fit">
            {rightRail}
          </aside>
        </div>
      </div>
    </main>
  );
}

function StepPanel({
  parcels,
  entrancesList,
  segments,
  totalSteps,
  displayStepN,
  onSetSegmentLength,
  onSetSegmentWidth,
  onRenameSegment,
  onGoToNeighbors,
  step,
  query,
  setQuery,
  matches,
  pickedHome,
  selected,
  suggested,
  entrances,
  methodology,
  setMethodology,
  onPickHome,
  onUseSuggestions,
  onClearNeighbors,
  onToggleEntrance,
  onUseBothEntrances,
  onGoToReview,
  canReview,
}: {
  parcels: LayoutParcel[];
  entrancesList: LayoutEntrance[];
  segments?: Segment[];
  totalSteps: number;
  displayStepN: number;
  onSetSegmentLength?: (id: string, lengthFt: number | undefined) => void;
  onSetSegmentWidth?: (id: string, widthFt: number) => void;
  onRenameSegment?: (id: string) => void;
  onGoToNeighbors: () => void;
  step: WalkStep;
  query: string;
  setQuery: (value: string) => void;
  matches: LayoutParcel[];
  pickedHome?: LayoutParcel;
  selected: string[];
  suggested: string[];
  entrances: string[];
  methodology: Methodology;
  setMethodology: (value: Methodology) => void;
  onPickHome: (id: string) => void;
  onUseSuggestions: () => void;
  onClearNeighbors: () => void;
  onToggleEntrance: (id: string) => void;
  onUseBothEntrances: () => void;
  onGoToReview: () => void;
  canReview: boolean;
}) {
  const meta = STEP_META[step];
  const Icon = meta.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Step {displayStepN} of {totalSteps}</p>
          <h2 className="font-display text-xl font-bold tracking-tight">{meta.title}</h2>
        </div>
      </div>

      {step === "home" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Tap your home on the map, or search the list below. Your home turns gold.</p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search your homes..." className="h-11 pl-9" />
          </div>
          <div className="space-y-2">
            {(matches.length > 0 ? matches : parcels.slice(0, 4)).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onPickHome(p.id)}
                className="flex w-full items-center justify-between gap-2 rounded-xl border border-border bg-background p-3 text-left text-sm transition-colors hover:border-primary/50 hover:bg-primary/5"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{p.address || `Home ${parcels.indexOf(p) + 1}`}</span>
                  <span className="block text-xs text-muted-foreground">Tap to make this your home</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "road" && segments && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pick how wide each road is. Length comes from what you drew on the map — use <span className="font-semibold">Extend / Shorten</span> on a road to change it.
          </p>
          <ul className="space-y-2">
            {segments.map((s) => (
              <li key={s.id} className="rounded-xl border border-border bg-background p-3">
                <div className="mb-2 flex items-center gap-2">
                  <RouteIcon className="h-4 w-4 text-primary" />
                  <span className="min-w-0 flex-1 truncate font-semibold text-sm">{s.name}</span>
                  {onRenameSegment && (
                    <button
                      type="button"
                      onClick={() => onRenameSegment(s.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-accent"
                      aria-label="Rename road"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Length (from map)</span>
                    <div className="flex h-9 items-center rounded-md border border-dashed border-border bg-muted/40 px-2 font-mono text-sm text-muted-foreground">
                      {Math.round(segmentLengthFt(s)).toLocaleString()} ft
                    </div>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Width</span>
                    <select
                      className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                      value={String(s.widthFt)}
                      onChange={(e) => onSetSegmentWidth?.(s.id, Number(e.target.value))}
                    >
                      <option value="12">1 lane · 12 ft</option>
                      <option value="16">Narrow · 16 ft</option>
                      <option value="20">2 lane · 20 ft</option>
                      <option value="24">Wide · 24 ft</option>
                      <option value="30">Extra wide · 30 ft</option>
                    </select>
                  </label>
                </div>
              </li>
            ))}
          </ul>
          <Button className="w-full" onClick={onGoToNeighbors}>
            Looks right — next <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {step === "neighbors" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {pickedHome ? `${pickedHome.address} is your home. Now choose who shares the private road.` : "Pick your home first, then choose who shares the road."}
          </p>
          <p className="rounded-lg border border-border bg-muted/40 p-2 text-[11px] text-muted-foreground">
            Tip: each home pill shows its road frontage (feet). Double-click a home to nudge it — more frontage = bigger share.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">Selected homes</div>
              <div className="mt-1 font-display text-2xl font-bold">{selected.length}</div>
            </div>
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="text-xs text-muted-foreground">Suggested group</div>
              <div className="mt-1 font-display text-2xl font-bold">{suggested.length}</div>
            </div>
          </div>
          <Button className="w-full" onClick={onUseSuggestions} disabled={!pickedHome}>
            <Sparkles className="h-4 w-4" /> Use suggested neighbors
          </Button>
          <Button className="w-full" variant="outline" onClick={onClearNeighbors} disabled={!pickedHome}>
            <X className="h-4 w-4" /> Clear and tap homes myself
          </Button>
        </div>
      )}

      {step === "entrances" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Pick where the private road connects to public roads. Most communities use both in this sample.</p>
          <div className="space-y-2">
            {entrancesList.map((entrance) => {
              const active = entrances.includes(entrance.id);
              return (
                <button
                  key={entrance.id}
                  type="button"
                  onClick={() => onToggleEntrance(entrance.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                    active ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-accent",
                  )}
                >
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                    {active ? <Check className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{entrance.label}</span>
                    <span className="block text-xs text-muted-foreground">Meets {entrance.meets}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <Button className="w-full" onClick={onUseBothEntrances}>
            Use both entrances <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {step === "review" && (
        <div className="space-y-4">
          {canReview ? (
            <p className="text-sm text-muted-foreground">Here is the sample estimate. Change the split method below to see how the secret sauce explains who benefits from each road segment.</p>
          ) : (
            <div className="rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm">
              Pick a home, choose neighbors, and confirm an entrance to unlock the yearly-share estimate.
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">How should RoadShare split it?</Label>
            {METHODS.map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => setMethodology(method.id)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-colors",
                  methodology === method.id ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-accent",
                )}
              >
                <span className="block font-semibold">{method.label}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{method.helper}</span>
              </button>
            ))}
          </div>
          {!canReview && (
            <Button className="w-full" variant="outline" onClick={onGoToReview} disabled>
              Result appears here when ready
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function TotalCostControl({
  fixedTotal,
  estimatedTotal,
  setFixedTotal,
}: {
  fixedTotal: number | undefined;
  estimatedTotal: number;
  setFixedTotal: (value: number | undefined) => void;
}) {
  const hasQuote = typeof fixedTotal === "number" && fixedTotal > 0;
  const displayed = hasQuote ? (fixedTotal as number) : Math.round(estimatedTotal);
  const [draft, setDraft] = useState<string>(displayed > 0 ? String(displayed) : "");
  // Keep the input synced when the estimate changes upstream (e.g. width slider).
  useEffect(() => {
    if (!hasQuote) setDraft(displayed > 0 ? String(displayed) : "");
  }, [displayed, hasQuote]);
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <Label className="block text-sm font-semibold">Total project cost</Label>
        {hasQuote ? (
          <button
            type="button"
            onClick={() => setFixedTotal(undefined)}
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            Use estimate instead
          </button>
        ) : null}
      </div>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {hasQuote
          ? "Using your contractor quote — split updates live."
          : "Change this anytime — the share updates live."}
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span className="font-mono text-lg font-bold text-primary">$</span>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          step={100}
          className="h-9"
          value={draft}
          onChange={(e) => {
            const v = e.target.value;
            setDraft(v);
            const n = Number(v);
            if (Number.isFinite(n) && n > 0) setFixedTotal(n);
            else setFixedTotal(undefined);
          }}
          placeholder="e.g. 42000"
        />
        <span className="text-xs text-muted-foreground">total</span>
      </div>
    </div>
  );
}

function SliderControl({
  label,
  value,
  suffix,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs font-semibold">{label}</Label>
        <span className="font-mono text-xs font-bold">{value} {suffix}</span>
      </div>
      <Slider value={[value]} min={min} max={max} step={1} onValueChange={(v) => onChange(v[0])} className="mt-2" />
    </div>
  );
}

function PlatToolbar({
  onAddHome,
  onAddSegment,
  onRotate,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: {
  onAddHome?: () => void;
  onAddSegment?: () => void;
  onRotate?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}) {
  if (!onAddHome && !onAddSegment && !onRotate && !onUndo && !onRedo) return null;
  return (
    <div className="absolute left-6 top-6 z-10 flex items-center gap-1 rounded-full bg-background/95 p-1 shadow-md ring-1 ring-border backdrop-blur">
      {onAddHome && (
        <Button size="sm" variant="ghost" onClick={onAddHome} className="h-8 rounded-full px-3">
          <Plus className="h-4 w-4" /> Add home
        </Button>
      )}
      {onAddSegment && (
        <Button size="sm" variant="ghost" onClick={onAddSegment} className="h-8 rounded-full px-3">
          <RouteIcon className="h-4 w-4" /> Add road
        </Button>
      )}
      {onRotate && (
        <Button size="sm" variant="ghost" onClick={onRotate} className="h-8 rounded-full px-3">
          <RotateCw className="h-4 w-4" /> Rotate
        </Button>
      )}
      {onUndo && (
        <Button size="sm" variant="ghost" onClick={onUndo} disabled={!canUndo} className="h-8 rounded-full px-2">
          <Undo2 className="h-4 w-4" />
        </Button>
      )}
      {onRedo && (
        <Button size="sm" variant="ghost" onClick={onRedo} disabled={!canRedo} className="h-8 rounded-full px-2">
          <Redo2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function HomesPanel({
  homes,
  parcels,
  segments,
  onAddHome,
  onRenameHome,
  onDeleteHome,
  onAssignHomeSegment,
}: {
  homes: RoadHome[];
  parcels: LayoutParcel[];
  segments?: Segment[];
  onAddHome?: () => void;
  onRenameHome?: (id: string) => void;
  onDeleteHome?: (id: string) => void;
  onAssignHomeSegment?: (homeId: string, segmentId: string) => void;
}) {
  const showSegPicker = !!(segments && segments.length > 1 && onAssignHomeSegment);
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-bold">Homes on this road</h3>
        {onAddHome && (
          <Button size="sm" variant="outline" onClick={onAddHome} className="h-7 px-2 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        )}
      </div>
      <ul className="space-y-1.5 max-h-72 overflow-auto pr-1">
        {homes.map((h, i) => {
          const parcel = parcels.find((p) => p.id === h.id.replace(/[^a-z0-9_-]/gi, "")) ?? parcels[i];
          const label = h.ownerLabel || parcel?.name || parcel?.address || h.label;
          const pid = parcel?.id ?? h.id;
          return (
            <li key={h.id} className="flex items-center gap-2 rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs">
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted font-mono text-[10px] font-bold">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate">{label}</span>
              {showSegPicker && (
                <select
                  className="h-7 rounded-md border border-border bg-background px-1 text-[11px]"
                  value={h.segmentId ?? segments![0].id}
                  onChange={(e) => onAssignHomeSegment!(h.id, e.target.value)}
                  aria-label="Road segment"
                >
                  {segments!.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              )}
              {onRenameHome && (
                <button type="button" aria-label="Rename" onClick={() => onRenameHome(pid)} className="rounded p-1 text-muted-foreground hover:bg-accent">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {onDeleteHome && homes.length > 1 && (
                <button type="button" aria-label="Remove" onClick={() => onDeleteHome(pid)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RoadsPanel({
  segments,
  onAddSegment,
  onRenameSegment,
  onDeleteSegment,
  onSetSegmentWidth,
  onStraightenSegment,
  onExtendSegment,
}: {
  segments: Segment[];
  onAddSegment?: () => void;
  onRenameSegment?: (id: string) => void;
  onDeleteSegment?: (id: string) => void;
  onSetSegmentWidth?: (id: string, widthFt: number) => void;
  onStraightenSegment?: (id: string) => void;
  onExtendSegment?: (id: string, deltaFt: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-bold">Roads</h3>
        {onAddSegment && (
          <Button size="sm" variant="outline" onClick={onAddSegment} className="h-7 px-2 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add road
          </Button>
        )}
      </div>
      <ul className="space-y-2">
        {segments.map((s) => (
          <li key={s.id} className="rounded-lg border border-border/60 bg-background p-2">
            <div className="mb-1.5 flex items-center gap-1.5">
              <RouteIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.name}</span>
              {onRenameSegment && (
                <button type="button" aria-label="Rename road" onClick={() => onRenameSegment(s.id)} className="rounded p-1 text-muted-foreground hover:bg-accent">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {onDeleteSegment && segments.length > 1 && (
                <button type="button" aria-label="Remove road" onClick={() => onDeleteSegment(s.id)} className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Length (from map)</span>
                <div className="flex h-8 items-center rounded-md border border-dashed border-border bg-muted/40 px-2 font-mono text-xs text-muted-foreground">
                  {Math.round(segmentLengthFt(s)).toLocaleString()} ft
                </div>
              </label>
              <label className="block">
                <span className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Width (ft)</span>
                <select
                  className="h-8 w-full rounded-md border border-border bg-background px-1 text-xs"
                  value={String(s.widthFt)}
                  onChange={(e) => onSetSegmentWidth?.(s.id, Number(e.target.value))}
                >
                  <option value="12">1-lane · 12</option>
                  <option value="16">Narrow · 16</option>
                  <option value="20">2-lane · 20</option>
                  <option value="24">Wide · 24</option>
                  <option value="30">Extra wide · 30</option>
                </select>
              </label>
            </div>
            {(onStraightenSegment || onExtendSegment) && s.geometry && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {onStraightenSegment && (
                  <button
                    type="button"
                    onClick={() => onStraightenSegment(s.id)}
                    className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    Straighten
                  </button>
                )}
                {onExtendSegment && (
                  <>
                    <button
                      type="button"
                      onClick={() => onExtendSegment(s.id, 50)}
                      className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      Extend +50 ft
                    </button>
                    <button
                      type="button"
                      onClick={() => onExtendSegment(s.id, -50)}
                      className="rounded-md border border-border bg-background px-2 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
                    >
                      Shorten −50 ft
                    </button>
                  </>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}