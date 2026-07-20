import { useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, Home as HomeIcon, MapPin, Pencil, Route as RouteIcon, Ruler } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { haversineFt, pathLengthFt, type Parcel, type RoadSegment } from "@/lib/community/api";
import { computeCostShare, formatUSD, type CostMethod } from "@/lib/community/costShare";
import { PlatCanvas } from "@/components/community/PlatCanvas";

type Props = {
  parcels: Parcel[];
  segments: RoadSegment[];
  /** The full geographic map + segment editor from the current route. */
  detailedMap: ReactNode;
};

/**
 * "My Road" workspace — three plain-language sub-sections:
 *   1. Overview            — visual summary of the shared road + toggle to the map.
 *   2. Homes & Access      — per-home list (address, status, distance).
 *   3. Cost sharing        — three Fair Share methods with editable total.
 *
 * The Mapbox map is still the source of truth; Overview just presents it.
 */
export function MyRoadTab({ parcels, segments, detailedMap }: Props) {
  const roadFeet = segments.reduce((sum, s) => sum + pathLengthFt(s.geometry), 0);
  const [showDetailed, setShowDetailed] = useState(false);

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryTile
          icon={RouteIcon}
          tint="bg-teal-500/12 text-teal-600 dark:text-teal-400"
          headline={
            segments.length === 0
              ? "No shared road drawn yet"
              : `${segments.length} shared road${segments.length === 1 ? "" : "s"}`
          }
          body={
            segments.length === 0
              ? "Draw the road you share so distances and costs can be measured."
              : `About ${roadFeet.toLocaleString()} feet total.`
          }
        />
        <SummaryTile
          icon={HomeIcon}
          tint="bg-indigo-500/12 text-indigo-600 dark:text-indigo-400"
          headline={
            parcels.length === 0
              ? "No homes connected yet"
              : `${parcels.length} connected home${parcels.length === 1 ? "" : "s"}`
          }
          body={
            parcels.length === 0
              ? "Add the homes that share this road."
              : "Everyone below shares the road."
          }
        />
      </div>

      <PlatCanvas
        parcels={parcels}
        segments={segments}
        title="Your community"
        className="fun-shadow-sm"
      />

      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setShowDetailed((v) => !v)}
          className="gap-1.5"
        >
          <Pencil className="h-3.5 w-3.5" />
          {showDetailed ? "Hide precise map" : "Edit precisely on satellite map"}
          {showDetailed ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </Button>
        {showDetailed && (
          <div className="mt-3 h-[60vh] min-h-[420px] overflow-hidden rounded-2xl border border-border bg-card fun-shadow-sm">
            {detailedMap}
          </div>
        )}
      </div>

      <HomesAccessPane parcels={parcels} segments={segments} />
      <CostSharingPane parcels={parcels} segments={segments} />
    </div>
  );
}

// ----- Homes & Access -----
function HomesAccessPane({ parcels, segments }: { parcels: Parcel[]; segments: RoadSegment[] }) {
  const entrance = useMemo(() => firstEntrance(segments), [segments]);
  if (parcels.length === 0) {
    return null;
  }
  return (
    <div>
      <h3 className="mb-2 font-display text-base font-semibold">Homes on this road</h3>
      <ul className="grid gap-2 sm:grid-cols-2">
      {parcels.map((p) => {
        const dist = distanceFt(p, entrance);
        return (
          <li key={p.id} className="rounded-2xl border border-border bg-card p-3 fun-shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold">{p.label}</p>
                {p.address && <p className="mt-0.5 text-xs text-muted-foreground">{p.address}</p>}
                {p.owner_name && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{p.owner_name}</p>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {p.lat != null && p.lng != null ? "On map" : "Location not set"}
              </span>
              <span className="inline-flex items-center gap-1">
                <Ruler className="h-3.5 w-3.5" />
                {dist > 0
                  ? `${Math.round(dist).toLocaleString()} ft from entrance`
                  : "Distance unknown"}
              </span>
              {p.frontage_ft ? (
                <span className="inline-flex items-center gap-1">
                  <RouteIcon className="h-3.5 w-3.5" />
                  {Number(p.frontage_ft).toLocaleString()} ft touching the road
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
      </ul>
    </div>
  );
}

// ----- Cost sharing -----
function CostSharingPane({ parcels, segments }: { parcels: Parcel[]; segments: RoadSegment[] }) {
  const [method, setMethod] = useState<CostMethod>("equal");
  const [totalStr, setTotalStr] = useState("10000");
  const total = Math.max(0, Number(totalStr.replace(/[^\d.]/g, "")) || 0);
  const result = useMemo(
    () => computeCostShare(parcels, segments, total, method),
    [parcels, segments, total, method],
  );

  if (parcels.length === 0) {
    return null;
  }

  const methods: { id: CostMethod; label: string; blurb: string }[] = [
    { id: "equal", label: "Split evenly", blurb: "Every home pays the same." },
    {
      id: "frontage",
      label: "By road frontage",
      blurb: "Homes with more road along them pay more.",
    },
    {
      id: "distance",
      label: "By distance from entrance",
      blurb: "Homes farther down the road pay more.",
    },
  ];

  return (
    <div className="space-y-4">
      <h3 className="font-display text-base font-semibold">Split the cost</h3>
      <div className="rounded-2xl border border-border bg-card p-4 fun-shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Estimated project cost
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Label htmlFor="cost-total" className="sr-only">
                Total cost
              </Label>
              <span className="text-lg font-semibold">$</span>
              <Input
                id="cost-total"
                inputMode="numeric"
                value={totalStr}
                onChange={(e) => setTotalStr(e.target.value)}
                className="max-w-[10rem] font-display text-lg font-bold"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground sm:text-right">
            Try each method to see how the split changes. The math stays the same as the Fair Share
            tools.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {methods.map((m) => {
          const active = method === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={cn(
                "rounded-2xl border p-3 text-left transition-colors",
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40",
              )}
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{m.label}</p>
                {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{m.blurb}</p>
            </button>
          );
        })}
      </div>

      {result.fallback === "equal" && method !== "equal" && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          We don't have enough data for that method yet, so we split it evenly. Add{" "}
          {method === "frontage"
            ? "road frontage on each home"
            : "the shared road and home locations"}{" "}
          to unlock it.
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card fun-shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Home</th>
              <th className="px-4 py-3 font-semibold">Share</th>
              <th className="px-4 py-3 font-semibold text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {result.rows.map((r) => (
              <tr key={r.parcelId} className="border-b border-border/60 last:border-0">
                <td className="px-4 py-3">
                  <div className="font-semibold">{r.label}</div>
                  {r.address && <div className="text-xs text-muted-foreground">{r.address}</div>}
                </td>
                <td className="px-4 py-3 text-muted-foreground">{(r.share * 100).toFixed(1)}%</td>
                <td className="px-4 py-3 text-right font-semibold">{formatUSD(r.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/40 text-sm font-semibold">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-muted-foreground">100%</td>
              <td className="px-4 py-3 text-right">{formatUSD(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ----- Helpers -----
function SummaryTile({
  icon: Icon,
  tint,
  headline,
  body,
}: {
  icon: typeof RouteIcon;
  tint: string;
  headline: string;
  body: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4 fun-shadow-sm">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tint)}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="font-semibold">{headline}</p>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function firstEntrance(segments: RoadSegment[]): [number, number] | null {
  for (const s of segments) {
    const g = s.geometry as unknown as { type?: string; coordinates?: unknown };
    if (g && g.type === "LineString" && Array.isArray(g.coordinates)) {
      const first = (g.coordinates as unknown[])[0];
      if (Array.isArray(first) && first.length >= 2) {
        const lng = Number(first[0]);
        const lat = Number(first[1]);
        if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
      }
    }
  }
  return null;
}

function distanceFt(p: Parcel, entrance: [number, number] | null): number {
  if (!entrance || p.lat == null || p.lng == null) return 0;
  return haversineFt(entrance, [Number(p.lng), Number(p.lat)]);
}
