import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { MapPin, Search, X } from "lucide-react";

import { PlatMap } from "@/components/roadshare/PlatMap";
import { ResultsPanel } from "@/components/roadshare/ResultsPanel";
import {
  DEFAULTS,
  ENTRANCES,
  PARCELS,
  SURFACE_TYPES,
} from "@/lib/roadshare/data";
import {
  computeAllocation,
  formatUSD,
  type Methodology,
} from "@/lib/roadshare/engine";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  component: Index,
});

function Section({
  step,
  title,
  children,
}: {
  step: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">
          {step}
        </span>
        <h2 className="font-display text-sm font-semibold uppercase tracking-wide">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

const METHODS: { id: Methodology; label: string }[] = [
  { id: "distance", label: "Distance" },
  { id: "frontage", label: "Frontage" },
  { id: "equal", label: "Equal / lot" },
];

function Index() {
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
    setSelected((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    );
  const toggleEntrance = (id: "west" | "north") =>
    setEntrances((e) =>
      e.includes(id) ? e.filter((x) => x !== id) : [...e, id],
    );
  const pickYou = (id: string, address: string) => {
    setYou(id);
    setQuery(address);
    setSelected((s) => (s.includes(id) ? s : [...s, id]));
  };

  const pctTotal = surfaces.reduce((s, x) => s + (Number(x.pct) || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-selected" />
            <span className="font-display text-lg font-bold tracking-tight">
              RoadShare
            </span>
            <Badge variant="secondary" className="ml-1 font-mono text-[10px]">
              PROTOTYPE
            </Badge>
          </div>
          <p className="hidden text-sm text-muted-foreground sm:block">
            Cedar Hollow · private road cost sharing
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Share private road maintenance costs, fairly.
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Pick your property, choose the neighborhood group, pin the entrances,
            and set the surface and cost. RoadShare allocates each household's
            share using along-road distance responsibility.
          </p>
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

            {/* Step 1 */}
            <Section step={1} title="Find your property">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search an address…"
                  className="pl-9"
                />
                {matches.length > 0 && query !== you && (
                  <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg">
                    {matches.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => pickYou(p.id, p.address)}
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent"
                        >
                          {p.address}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {you && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Your property is highlighted in{" "}
                  <span className="font-semibold text-gold">gold</span>.
                </p>
              )}
            </Section>

            {/* Step 2 */}
            <Section step={2} title="Select the neighborhood">
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelected(PARCELS.map((p) => p.id))}
                >
                  Select all
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelected(you ? [you] : [])}
                >
                  <X className="mr-1 h-3.5 w-3.5" /> Clear
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selected.length} of {PARCELS.length} parcels
                </span>
              </div>
            </Section>

            {/* Step 3 */}
            <Section step={3} title="Pin the entrances">
              <div className="flex flex-wrap gap-2">
                {ENTRANCES.map((e) => (
                  <button
                    key={e.id}
                    type="button"
                    onClick={() => toggleEntrance(e.id)}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      entrances.includes(e.id)
                        ? "border-selected bg-selected/15"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    <div className="font-medium">{e.label}</div>
                    <div className="text-xs text-muted-foreground">
                      meets {e.meets}
                    </div>
                  </button>
                ))}
              </div>
            </Section>

            {/* Step 4 */}
            <Section step={4} title="Road surface & cost">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Surface mix</span>
                  <span
                    className={cn(
                      "font-mono font-semibold",
                      Math.abs(pctTotal - 100) < 0.001
                        ? "text-selected"
                        : "text-destructive",
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
                              arr.map((x, j) =>
                                j === i ? { ...x, pct: Number(e.target.value) } : x,
                              ),
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
                              arr.map((x, j) =>
                                j === i ? { ...x, cost: Number(e.target.value) } : x,
                              ),
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

          {/* Results (sticky) */}
          <aside className="lg:sticky lg:top-6 lg:h-fit">
            <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
              <div className="mb-4">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Allocation method
                </Label>
                <div className="mt-2 grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                  {METHODS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setMethodology(m.id)}
                      className={cn(
                        "rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                        methodology === m.id
                          ? "bg-card text-foreground shadow-sm"
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

        <footer className="mt-10 border-t border-border pt-4 text-xs text-muted-foreground">
          Self-contained prototype. Map, parcels, addresses and unit costs are
          fictional placeholders; the allocation engine is production logic. Total
          project figures shown are demo estimates (e.g.{" "}
          {formatUSD(result.totalCost)} over {fundingPeriod} years).
        </footer>
      </main>
    </div>
  );
}
