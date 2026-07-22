import { useEffect, useMemo, useRef, useState, type ComponentType, type Dispatch, type SetStateAction } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Home,
  MapPin,
  Route as RouteIcon,
  Search,
  SlidersHorizontal,
  Sparkles,
  X,
} from "lucide-react";

import { PlatMap } from "@/components/roadshare/PlatMap";
import { ResultsPanel } from "@/components/roadshare/ResultsPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { DEFAULTS, SURFACE_TYPES } from "@/lib/roadshare/data";
import { buildLayout, cedarHollowLayout, type Home as RoadHome, type Layout, type LayoutEntrance, type LayoutParcel } from "@/lib/roadshare/layout";
import { computeAllocation, type Methodology } from "@/lib/roadshare/engine";
import { cn } from "@/lib/utils";

type WalkStep = "home" | "neighbors" | "entrances" | "review";

export type PlannerSnapshot = {
  step: WalkStep;
  you: string | null;
  selected: string[];
  entrances: string[];
  methodology: Methodology;
  roadWidth: number;
  fundingPeriod: number;
  surfaces: { pct: number; cost: number }[];
};

const METHODS: { id: Methodology; label: string; helper: string }[] = [
  { id: "distance", label: "Road used", helper: "Homes farther down the road pay more." },
  { id: "frontage", label: "Road frontage", helper: "Homes with more frontage pay more." },
  { id: "equal", label: "Equal split", helper: "Every selected home pays the same." },
];

const STEP_META: Record<WalkStep, { n: number; title: string; short: string; icon: ComponentType<{ className?: string }> }> = {
  home: { n: 1, title: "Pick your home", short: "Start here", icon: Home },
  neighbors: { n: 2, title: "Choose who shares", short: "Neighbors", icon: Sparkles },
  entrances: { n: 3, title: "Confirm entrances", short: "Entrances", icon: MapPin },
  review: { n: 4, title: "See your share", short: "Result", icon: RouteIcon },
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
  initialState,
  onStateChange,
  variant = "demo",
}: {
  homes?: RoadHome[];
  roadName?: string;
  initialState?: Partial<PlannerSnapshot> | null;
  onStateChange?: (snapshot: PlannerSnapshot) => void;
  variant?: "demo" | "app";
} = {}) {
  const layout = useMemo<Layout>(() => {
    if (homes && homes.length > 0) return buildLayout(homes, roadName || "My road");
    return cedarHollowLayout();
  }, [homes, roadName]);
  const PARCELS = layout.parcels;
  const ENTRANCES = layout.entrances;

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

  // Debounced snapshot emit
  const firstRun = useRef(true);
  useEffect(() => {
    if (!onStateChange) return;
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    const t = setTimeout(() => {
      onStateChange({ step, you, selected, entrances, methodology, roadWidth, fundingPeriod, surfaces });
    }, 700);
    return () => clearTimeout(t);
  }, [step, you, selected, entrances, methodology, roadWidth, fundingPeriod, surfaces, onStateChange]);

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
      }),
    [selected, entrances, methodology, surfaces, roadWidth, fundingPeriod, you, layout],
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
    setStep("neighbors");
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
      onToggleParcel={toggleParcel}
      onHoverParcel={setHovered}
      onToggleEntrance={toggleEntrance}
    />
  );

  const stepStrip = (
    <div className="grid gap-2 rounded-2xl border border-border bg-card/90 p-3 text-xs shadow-sm sm:grid-cols-4">
      {(Object.keys(STEP_META) as WalkStep[]).map((key) => {
        const meta = STEP_META[key];
        const done =
          (key === "home" && !!you) ||
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
              <span className="block truncate text-muted-foreground">Step {meta.n}</span>
            </span>
          </button>
        );
      })}
    </div>
  );

  const rightRail = (
    <>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-md">
        <StepPanel
          parcels={PARCELS}
          entrancesList={ENTRANCES}
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

      {step === "review" && (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-md">
          <ResultsPanel result={result} methodology={methodology} />
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
        <button
          type="button"
          onClick={() => setAssumptionsOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-3 text-left"
        >
          <span className="flex min-w-0 items-center gap-2">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
              <SlidersHorizontal className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block font-display text-sm font-semibold">Change the details</span>
              <span className="block truncate text-xs text-muted-foreground">What the road is made of, how wide, and how many years</span>
            </span>
          </span>
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", assumptionsOpen && "rotate-180")} />
        </button>

        {assumptionsOpen && (
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            <SurfaceControls surfaces={surfaces} setSurfaces={setSurfaces} pctTotal={pctTotal} pctValid={pctValid} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <SliderControl label="How wide is the road?" value={roadWidth} suffix="ft" min={8} max={40} onChange={setRoadWidth} />
              <SliderControl label="Plan over how many years?" value={fundingPeriod} suffix="yr" min={1} max={40} onChange={setFundingPeriod} />
            </div>
          </div>
        )}
      </div>
    </>
  );

  if (isApp) {
    // Full-bleed: plat fills the viewport, right rail is a fixed 380px column.
    return (
      <main className="grid h-[calc(100dvh-57px)] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="relative min-w-0 overflow-hidden bg-muted/20">
          <div className="absolute inset-0 flex flex-col">
            <div className="flex-1 min-h-0 p-3 sm:p-4">
              <div className="h-full [&>div]:h-full [&_svg]:h-full [&_svg]:w-full">
                {platBlock}
              </div>
            </div>
            <div className="border-t border-border bg-background/95 p-3 backdrop-blur">
              {stepStrip}
            </div>
          </div>
        </section>
        <aside className="min-w-0 overflow-y-auto border-l border-border bg-background p-4 space-y-3">
          {rightRail}
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
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Step {meta.n} of 4</p>
          <h2 className="font-display text-xl font-bold tracking-tight">{meta.title}</h2>
        </div>
      </div>

      {step === "home" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Search the sample addresses or tap a home on the map. Your home turns gold.</p>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Try 101 Cedar Hollow Lane" className="h-11 pl-9" />
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
                  <span className="block truncate font-semibold">{p.address}</span>
                  <span className="block text-xs text-muted-foreground">Tap to make this your home</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}

      {step === "neighbors" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {pickedHome ? `${pickedHome.address} is your home. Now choose who shares the private road.` : "Pick your home first, then choose who shares the road."}
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

function SurfaceControls({
  surfaces,
  setSurfaces,
  pctTotal,
  pctValid,
}: {
  surfaces: { pct: number; cost: number }[];
  setSurfaces: Dispatch<SetStateAction<{ pct: number; cost: number }[]>>;
  pctTotal: number;
  pctValid: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <Label className="font-semibold">Road surface mix</Label>
        <span className={cn("font-mono font-bold", pctValid ? "text-selected" : "text-destructive")}>{pctTotal.toFixed(0)}%</span>
      </div>
      {SURFACE_TYPES.map((surface, i) => (
        <div key={surface.id} className="grid grid-cols-[minmax(0,1fr)_68px_82px] items-center gap-2">
          <Label className="truncate text-xs">{surface.label}</Label>
          <Input
            type="number"
            min={0}
            max={100}
            value={surfaces[i].pct}
            onChange={(e) => setSurfaces((arr) => arr.map((x, j) => (j === i ? { ...x, pct: Number(e.target.value) } : x)))}
            className="h-8 text-sm"
          />
          <Input
            type="number"
            step="0.25"
            value={surfaces[i].cost}
            onChange={(e) => setSurfaces((arr) => arr.map((x, j) => (j === i ? { ...x, cost: Number(e.target.value) } : x)))}
            className="h-8 text-sm"
          />
        </div>
      ))}
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