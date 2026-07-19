import { useMemo, useState } from "react";
import { Check, Home, MapPin, Route as RouteIcon, Search, Sparkles, X } from "lucide-react";

import { PlatMap } from "@/components/roadshare/PlatMap";
import { ResultsPanel } from "@/components/roadshare/ResultsPanel";
import { DEFAULTS, ENTRANCES, PARCELS, SURFACE_TYPES } from "@/lib/roadshare/data";
import { computeAllocation, type Methodology } from "@/lib/roadshare/engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

function Section({
  step,
  title,
  hint,
  done,
  icon: Icon,
  children,
}: {
  step: number;
  title: string;
  hint?: string;
  done?: boolean;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-2xl border bg-card p-4 shadow-sm transition-all",
        done ? "border-selected/40 bg-gradient-to-br from-selected/5 to-transparent" : "border-border hover:border-primary/30",
      )}
    >
      <div className="mb-3 flex items-center gap-2.5">
        <span
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold transition-colors",
            done ? "bg-selected text-selected-foreground" : "bg-primary text-primary-foreground",
          )}
        >
          {done ? <Check className="h-4 w-4" /> : Icon ? <Icon className="h-3.5 w-3.5" /> : step}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold tracking-tight">
            <span className="mr-1.5 font-mono text-[10px] text-muted-foreground">Step {step}</span>
            {title}
          </h2>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

const METHODS: { id: Methodology; label: string }[] = [
  { id: "distance", label: "By distance" },
  { id: "frontage", label: "By frontage" },
  { id: "equal", label: "Split evenly" },
];

export function Planner() {
  const [you, setYou] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [entrances, setEntrances] = useState<("west" | "north")[]>([]);
  const [hovered, setHovered] = useState<string | null>(null);
  const [methodology, setMethodology] = useState<Methodology>("distance");
  const [roadWidth, setRoadWidth] = useState(DEFAULTS.roadWidth);
  const [fundingPeriod, setFundingPeriod] = useState(DEFAULTS.fundingPeriod);
  const [surfaces, setSurfaces] = useState(
    SURFACE_TYPES.map((s) => ({ pct: s.defaultPct, cost: s.defaultCost })),
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return PARCELS.filter((p) => p.address.toLowerCase().includes(q)).slice(0, 6);
  }, [query]);

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
      }),
    [selected, entrances, methodology, surfaces, roadWidth, fundingPeriod, you],
  );

  const toggleParcel = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const toggleEntrance = (id: "west" | "north") =>
    setEntrances((e) => (e.includes(id) ? e.filter((x) => x !== id) : [...e, id]));
  const pickYou = (id: string, address: string) => {
    setYou(id);
    setQuery(address);
    setSelected((s) => (s.includes(id) ? s : [...s, id]));
  };

  const pctTotal = surfaces.reduce((s, x) => s + (Number(x.pct) || 0), 0);
  const pctValid = Math.abs(pctTotal - 100) < 0.001;

  const steps = [
    { label: "Your home", done: !!you },
    { label: "Neighbors", done: selected.length > 0 },
    { label: "Entrances", done: entrances.length > 0 },
    { label: "Surface", done: pctValid },
  ];
  const completedCount = steps.filter((s) => s.done).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {steps.map((s, i) => (
          <div key={s.label} className="flex items-center gap-2">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                s.done
                  ? "border-selected/50 bg-selected/15 text-foreground"
                  : "border-border bg-card text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold",
                  s.done ? "bg-selected text-selected-foreground" : "bg-muted text-muted-foreground",
                )}
              >
                {s.done ? <Check className="h-3 w-3" /> : i + 1}
              </span>
              {s.label}
            </div>
            {i < steps.length - 1 && <span className="hidden h-px w-4 bg-border sm:block" />}
          </div>
        ))}
        <span className="ml-1 font-mono text-xs text-muted-foreground">{completedCount}/4</span>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <PlatMap
            selected={selected}
            you={you}
            entrances={entrances}
            hovered={hovered}
            onToggleParcel={toggleParcel}
            onHoverParcel={setHovered}
            onToggleEntrance={toggleEntrance}
          />

          <Section step={1} icon={Home} title="Which home is yours?" hint="Search an address in Cedar Hollow — the map highlights it in gold." done={!!you}>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Try 101 Cedar Hollow Lane"
                className="pl-9"
              />
              {matches.length > 0 && query !== you && (
                <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                  {matches.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => pickYou(p.id, p.address)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                      >
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        {p.address}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            {you && (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-gold/15 px-3 py-2 text-xs">
                <MapPin className="h-3.5 w-3.5 text-gold" />
                <span className="font-medium text-foreground">{query}</span>
                <span className="text-muted-foreground">is your home</span>
              </div>
            )}
          </Section>

          <Section
            step={2}
            icon={RouteIcon}
            title="Add your neighbors"
            hint="Tap homes on the map to add them to the group that shares the road."
            done={selected.length > 0}
          >
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setSelected(PARCELS.map((p) => p.id))}>
                Add all homes
              </Button>
              <Button size="sm" variant="outline" onClick={() => setSelected(you ? [you] : [])}>
                <X className="mr-1 h-3.5 w-3.5" /> Clear
              </Button>
              <span className="ml-auto rounded-full bg-selected/15 px-2.5 py-1 font-mono text-xs font-semibold text-foreground">
                {selected.length}/{PARCELS.length} homes
              </span>
            </div>
          </Section>

          <Section
            step={3}
            icon={MapPin}
            title="Where does your road connect?"
            hint="Tap each spot where your private road meets a public road."
            done={entrances.length > 0}
          >
            <div className="flex flex-wrap gap-2">
              {ENTRANCES.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => toggleEntrance(e.id)}
                  className={cn(
                    "flex flex-1 items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors",
                    entrances.includes(e.id) ? "border-primary bg-primary/10" : "border-border hover:bg-accent",
                  )}
                >
                  <MapPin
                    className={cn(
                      "h-4 w-4 shrink-0",
                      entrances.includes(e.id) ? "text-primary" : "text-muted-foreground",
                    )}
                  />
                  <div className="min-w-0">
                    <div className="font-medium">{e.label}</div>
                    <div className="truncate text-xs text-muted-foreground">meets {e.meets}</div>
                  </div>
                </button>
              ))}
            </div>
          </Section>

          <Section
            step={4}
            icon={Sparkles}
            title="What's the road made of?"
            hint="Set the surface mix (must total 100%), the road width, and how many years to spread the cost."
            done={pctValid}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Surface mix</span>
                <span
                  className={cn(
                    "font-mono font-semibold",
                    pctValid ? "text-selected" : "text-destructive",
                  )}
                >
                  {pctTotal.toFixed(0)}%
                </span>
              </div>
              <div className="space-y-2">
                {SURFACE_TYPES.map((s, i) => (
                  <div key={s.id} className="grid grid-cols-[1fr_72px_84px] items-center gap-2">
                    <Label className="text-sm">{s.label}</Label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={surfaces[i].pct}
                        min={0}
                        max={100}
                        onChange={(e) =>
                          setSurfaces((arr) =>
                            arr.map((x, j) => (j === i ? { ...x, pct: Number(e.target.value) } : x)),
                          )
                        }
                        className="h-8 pr-5 font-mono text-sm"
                      />
                      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        %
                      </span>
                    </div>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        step="0.25"
                        value={surfaces[i].cost}
                        onChange={(e) =>
                          setSurfaces((arr) =>
                            arr.map((x, j) => (j === i ? { ...x, cost: Number(e.target.value) } : x)),
                          )
                        }
                        className="h-8 pl-5 font-mono text-sm"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Road width</Label>
                    <span className="font-mono text-sm">{roadWidth} ft</span>
                  </div>
                  <Slider
                    value={[roadWidth]}
                    min={8}
                    max={40}
                    step={1}
                    onValueChange={(v) => setRoadWidth(v[0])}
                    className="mt-2"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">Funding period</Label>
                    <span className="font-mono text-sm">{fundingPeriod} yr</span>
                  </div>
                  <Slider
                    value={[fundingPeriod]}
                    min={1}
                    max={40}
                    step={1}
                    onValueChange={(v) => setFundingPeriod(v[0])}
                    className="mt-2"
                  />
                </div>
              </div>
            </div>
          </Section>
        </div>

        <aside className="lg:sticky lg:top-20 lg:h-fit">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-md">
            <div className="mb-4">
              <h2 className="font-display text-lg font-bold tracking-tight">Allocation</h2>
              <Label className="mt-3 block text-xs uppercase tracking-wide text-muted-foreground">
                Method
              </Label>
              <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-muted p-1">
                {METHODS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethodology(m.id)}
                    className={cn(
                      "rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                      methodology === m.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <ResultsPanel result={result} methodology={methodology} />
          </div>
        </aside>
      </div>
    </div>
  );
}
