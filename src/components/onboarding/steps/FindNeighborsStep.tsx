import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Home as HomeIcon,
  Loader2,
  MapPin,
  RefreshCcw,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { parcelsPointLookup } from "@/lib/onboarding/parcels.functions";
import type { BasicInfo } from "./BasicInfoStep";
import type { NoDocsResult } from "./NoDocsStep";

type FoundParcel = {
  id: string;
  headline: string;
  address: string | null;
  areaSqft: number | null;
  lat: number;
  lng: number;
};

type LoadState =
  | { kind: "idle" }
  | { kind: "loading"; radius: number }
  | { kind: "ok"; radius: number; parcels: FoundParcel[]; source: "dcad" | "osm" }
  | { kind: "empty"; radius: number }
  | { kind: "error"; message: string };

// Feet. We start tight (in-town neighborhoods) and expand aggressively so
// rural roads — where homes can sit 1/4 to 1 mile apart — still land hits.
// 5,280 ft = 1 mile. Server clamps the underlying meters at 5,000m (~16,400 ft).
const RADIUS_STEPS = [400, 1500, 5280, 15000] as const;

function metersFromFeet(ft: number) {
  // parcelsPointLookup treats `radius` as meters in the underlying implementation
  // (server clamps 50..2000). We surface feet in the UI and convert here.
  return Math.round(ft * 0.3048);
}

/**
 * Step: auto-find neighbors from a picked address.
 *
 * Runs `parcelsPointLookup` against the user's coordinates and shows a
 * friendly checklist (all pre-selected). Users can widen the search or
 * bail out to the manual menu.
 */
export function FindNeighborsStep({
  basicInfo,
  onConfirm,
  onManualInstead,
  onBack,
}: {
  basicInfo: BasicInfo;
  onConfirm: (result: NoDocsResult) => void;
  onManualInstead: () => void;
  onBack: () => void;
}) {
  const lookupFn = useServerFn(parcelsPointLookup);
  const [state, setState] = useState<LoadState>({ kind: "idle" });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const radiusIndex = useRef(0);

  const hasCoords =
    typeof basicInfo.lat === "number" && typeof basicInfo.lng === "number";

  const runLookup = useCallback(
    async (radiusFt: number) => {
      if (!hasCoords) return;
      setState({ kind: "loading", radius: radiusFt });
      try {
        const res = await lookupFn({
          data: {
            lat: basicInfo.lat as number,
            lng: basicInfo.lng as number,
            radius: metersFromFeet(radiusFt),
            limit: 120,
          },
        });
        const parcels: FoundParcel[] = res.parcels.map((p) => ({
          id: p.id,
          headline: p.headline,
          address: p.address,
          areaSqft: p.areaSqft,
          lat: p.lat,
          lng: p.lng,
        }));
        if (parcels.length === 0) {
          setState({ kind: "empty", radius: radiusFt });
        } else {
          setState({ kind: "ok", radius: radiusFt, parcels, source: res.source });
          setSelected(new Set(parcels.map((p) => p.id)));
        }
      } catch (err) {
        setState({
          kind: "error",
          message: err instanceof Error ? err.message : "Lookup failed.",
        });
      }
    },
    [basicInfo.lat, basicInfo.lng, hasCoords, lookupFn],
  );

  // Kick off the first lookup once, at the smallest radius.
  useEffect(() => {
    if (state.kind === "idle" && hasCoords) {
      radiusIndex.current = 0;
      void runLookup(RADIUS_STEPS[0]);
    }
  }, [state.kind, hasCoords, runLookup]);

  const canWiden =
    (state.kind === "ok" || state.kind === "empty") &&
    radiusIndex.current < RADIUS_STEPS.length - 1;

  function widenSearch() {
    if (!canWiden) return;
    radiusIndex.current += 1;
    void runLookup(RADIUS_STEPS[radiusIndex.current]);
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function confirm() {
    if (state.kind !== "ok") return;
    const items = state.parcels
      .filter((p) => selected.has(p.id))
      .map((p, i) => ({
        label: `Home ${i + 1}`,
        address: p.address ?? p.headline,
      }));
    onConfirm({ kind: "addresses", items });
  }

  const selectedCount = selected.size;

  const header = (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-fun-2/10 to-fun-3/15 px-4 py-4">
      <div className="pointer-events-none absolute -right-3 -top-3 opacity-20">
        <HomeIcon className="h-20 w-20 text-primary" />
      </div>
      <div className="pointer-events-none absolute right-14 top-2 opacity-40">
        <Sparkles className="h-4 w-4 text-fun-3-foreground animate-pulse" />
      </div>
      <div className="relative">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-background/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
          Step 3 of 3
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">
          {state.kind === "loading"
            ? "Finding your neighbors…"
            : state.kind === "ok"
              ? "Here's who we found on your road"
              : state.kind === "empty"
                ? "We couldn't find your neighbors automatically"
                : state.kind === "error"
                  ? "Something went sideways"
                  : "Looking around your address…"}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {state.kind === "ok"
            ? "Uncheck any that aren't part of your road. You can tweak everything later."
            : state.kind === "loading"
              ? "We're checking the map for homes near you."
              : state.kind === "empty"
                ? "Try a wider search, or add homes another way."
                : state.kind === "error"
                  ? "The address lookup service didn't respond. You can retry or add homes another way."
                  : "This takes a moment on rural roads."}
        </p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-primary"
      >
        <ArrowLeft className="h-3 w-3" /> Change my address
      </button>

      {header}

      {state.kind === "loading" && (
        <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-10 text-sm text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p>Scanning about {Math.round(state.radius)} ft around your home…</p>
        </div>
      )}

      {state.kind === "ok" && (
        <>
          <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Found {state.parcels.length} home{state.parcels.length === 1 ? "" : "s"} within {state.radius} ft
            </span>
            <span className="text-[11px] text-muted-foreground">
              Source: {state.source === "dcad" ? "county parcels" : "OpenStreetMap"}
            </span>
          </div>

          <ul className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-border bg-card p-2">
            {state.parcels.map((p, i) => {
              const checked = selected.has(p.id);
              return (
                <li key={p.id}>
                  <label
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-muted/60 ${
                      checked ? "bg-primary/5" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      checked={checked}
                      onChange={() => toggle(p.id)}
                    />
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        {p.address || p.headline || `Home ${i + 1}`}
                      </p>
                      {p.areaSqft ? (
                        <p className="text-[11px] text-muted-foreground">
                          ~{Math.round(p.areaSqft).toLocaleString()} sq ft parcel
                        </p>
                      ) : null}
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              {canWiden && (
                <Button variant="outline" size="sm" onClick={widenSearch}>
                  <RefreshCcw className="h-3.5 w-3.5" /> Search wider
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onManualInstead}>
                None of these — I'll add by hand
              </Button>
            </div>
            <Button
              size="lg"
              className="h-11 rounded-xl bg-gradient-to-r from-primary to-fun-2 px-5 text-sm font-semibold shadow-md hover:opacity-95"
              onClick={confirm}
              disabled={selectedCount === 0}
            >
              Add {selectedCount} home{selectedCount === 1 ? "" : "s"} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}

      {state.kind === "empty" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-dashed border-border bg-muted/30 px-4 py-4 text-sm text-muted-foreground">
            <p>
              We searched about {state.radius} ft around your address and didn't
              find any mapped homes.
            </p>
            <p className="mt-2">
              Rural roads sometimes need a wider search, or the buildings
              haven't been added to the map yet.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            {canWiden ? (
              <Button variant="outline" size="sm" onClick={widenSearch}>
                <RefreshCcw className="h-3.5 w-3.5" /> Search wider ({RADIUS_STEPS[radiusIndex.current + 1]} ft)
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">
                We've searched as wide as we can.
              </span>
            )}
            <Button size="sm" onClick={onManualInstead}>
              Let's add them another way <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {state.kind === "error" && (
        <div className="space-y-3">
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {state.message}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void runLookup(RADIUS_STEPS[radiusIndex.current])}
            >
              <RefreshCcw className="h-3.5 w-3.5" /> Try again
            </Button>
            <Button size="sm" onClick={onManualInstead}>
              Add homes another way <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {!hasCoords && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm">
          <p>We need a picked address to look up neighbors. Go back and choose an address from the list.</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={onBack}>
            <ArrowLeft className="h-3.5 w-3.5" /> Back to address
          </Button>
        </div>
      )}
    </div>
  );
}