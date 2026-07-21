import { useCallback, useEffect, useRef, useState } from "react";
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
  Timer,
  AlertCircle,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
  | { kind: "loading"; radius: number; attempt: number; slow?: boolean }
  | { kind: "ok"; radius: number; parcels: FoundParcel[]; source: "dcad" | "osm" }
  | { kind: "empty"; radius: number; exhausted: boolean }
  | { kind: "error"; message: string };

// Feet. We start tight (in-town neighborhoods) and expand aggressively so
// rural roads — where homes can sit 1/4 to 1 mile apart — still land hits.
// 5,280 ft = 1 mile. Server clamps the underlying meters at 5,000m (~16,400 ft).
const RADIUS_STEPS = [400, 1500, 5280, 15000] as const;

// If a single lookup hangs longer than this, the client treats it as a soft
// timeout and auto-widens to the next radius so the UI never feels frozen.
const LOOKUP_TIMEOUT_MS = 18_000;

function metersFromFeet(ft: number) {
  // parcelsPointLookup treats `radius` as meters in the underlying implementation
  // (server clamps 50..5000). We surface feet in the UI and convert here.
  return Math.round(ft * 0.3048);
}

function formatDistance(ft: number): string {
  if (ft >= 5280) {
    const miles = ft / 5280;
    return `${miles % 1 === 0 ? miles.toFixed(0) : miles.toFixed(1)} mile${miles === 1 ? "" : "s"}`;
  }
  return `${ft.toLocaleString()} ft`;
}

// Cardinal bearing from (lat1,lng1) → (lat2,lng2). Rough but perfect for a
// short human locator like "~320 ft NW of your address".
function bearingLabel(lat1: number, lng1: number, lat2: number, lng2: number): string {
  const dLat = lat2 - lat1;
  const dLng = lng2 - lng1;
  const deg = (Math.atan2(dLng, dLat) * 180) / Math.PI;
  const norm = (deg + 360) % 360;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(norm / 45) % 8];
}

function distanceFeet(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((lat1 * Math.PI) / 180);
  const dx = (lng2 - lng1) * mPerDegLng;
  const dy = (lat2 - lat1) * mPerDegLat;
  return Math.round(Math.hypot(dx, dy) * 3.28084);
}

function locatorLabel(
  origin: { lat: number; lng: number } | null,
  p: { lat: number; lng: number },
): string {
  if (!origin) return "House on your road";
  const ft = distanceFeet(origin.lat, origin.lng, p.lat, p.lng);
  const dir = bearingLabel(origin.lat, origin.lng, p.lat, p.lng);
  if (ft < 30) return "House at your address";
  return `House ~${ft.toLocaleString()} ft ${dir} of your address`;
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
  const slowTimerRef = useRef<number | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const hasCoords =
    typeof basicInfo.lat === "number" && typeof basicInfo.lng === "number";

  const runLookup = useCallback(
    async (radiusFt: number, attempt = 1) => {
      if (!hasCoords) return;
      setState({ kind: "loading", radius: radiusFt, attempt });
      slowTimerRef.current = window.setTimeout(() => {
        setState((prev) =>
          prev.kind === "loading" && prev.radius === radiusFt
            ? { kind: "loading", radius: radiusFt, attempt, slow: true }
            : prev,
        );
      }, 5_000);

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const res = await Promise.race([
          lookupFn({
            data: {
              lat: basicInfo.lat as number,
              lng: basicInfo.lng as number,
              radius: metersFromFeet(radiusFt),
              limit: 120,
            },
          }),
          new Promise<never>((_, reject) => {
            const t = window.setTimeout(() => {
              controller.abort();
              reject(new Error("This lookup took too long. Trying a wider search…"));
            }, LOOKUP_TIMEOUT_MS);
            controller.signal.addEventListener("abort", () => window.clearTimeout(t));
          }),
        ]);

        if (slowTimerRef.current) {
          window.clearTimeout(slowTimerRef.current);
          slowTimerRef.current = null;
        }
        if (controller.signal.aborted) return;

        const parcels: FoundParcel[] = res.parcels.map((p) => ({
          id: p.id,
          headline: p.headline,
          address: p.address,
          areaSqft: p.areaSqft,
          lat: p.lat,
          lng: p.lng,
        }));
        if (parcels.length === 0) {
          // Auto-widen: if there are more radii to try, roll straight into
          // the next one instead of dead-ending the user at "0 found".
          const nextIdx = radiusIndex.current + 1;
          if (nextIdx < RADIUS_STEPS.length) {
            radiusIndex.current = nextIdx;
            void runLookup(RADIUS_STEPS[nextIdx], attempt + 1);
            return;
          }
          setState({ kind: "empty", radius: radiusFt, exhausted: true });
        } else {
          setState({ kind: "ok", radius: radiusFt, parcels, source: res.source });
          setSelected(new Set(parcels.map((p) => p.id)));
        }
      } catch (err) {
        if (slowTimerRef.current) {
          window.clearTimeout(slowTimerRef.current);
          slowTimerRef.current = null;
        }
        if (controller.signal.aborted) return;

        // On transient failure or timeout, try the next radius before giving up —
        // rural lookups against Overpass sometimes need a retry.
        const nextIdx = radiusIndex.current + 1;
        if (nextIdx < RADIUS_STEPS.length) {
          radiusIndex.current = nextIdx;
          void runLookup(RADIUS_STEPS[nextIdx], attempt + 1);
          return;
        }
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

  // Clean up any pending timers on unmount.
  useEffect(() => {
    return () => {
      if (slowTimerRef.current) window.clearTimeout(slowTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

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
    const origin =
      typeof basicInfo.lat === "number" && typeof basicInfo.lng === "number"
        ? { lat: basicInfo.lat, lng: basicInfo.lng }
        : null;
    const items = state.parcels
      .filter((p) => selected.has(p.id))
      .map((p, i) => ({
        label: `Home ${i + 1}`,
        address: p.address ?? locatorLabel(origin, p),
      }));
    onConfirm({ kind: "addresses", items });
  }

  const selectedCount = selected.size;
  const currentAttemptIndex =
    state.kind === "loading" ? RADIUS_STEPS.indexOf(state.radius as typeof RADIUS_STEPS[number]) : radiusIndex.current;

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
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-fun-2/5 to-fun-3/10 p-5">
          <div className="flex items-center justify-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                Scanning {formatDistance(state.radius)} around your home
              </p>
              <p className="text-xs text-muted-foreground">
                Try {state.attempt} of {RADIUS_STEPS.length}
              </p>
            </div>
          </div>

          {/* Progress through radius steps */}
          <div className="mt-5 grid grid-cols-4 gap-2">
            {RADIUS_STEPS.map((r, i) => {
              const active = i === currentAttemptIndex;
              const done = i < currentAttemptIndex;
              return (
                <div key={r} className="text-center">
                  <div
                    className={cn(
                      "h-2 rounded-full transition-colors",
                      active ? "bg-primary animate-pulse" : done ? "bg-primary/60" : "bg-muted",
                    )}
                    aria-hidden
                  />
                  <p
                    className={cn(
                      "mt-1 text-[10px] font-medium",
                      active ? "text-primary" : done ? "text-muted-foreground" : "text-muted-foreground/60",
                    )}
                  >
                    {formatDistance(r)}
                  </p>
                </div>
              );
            })}
          </div>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {state.attempt === 1
              ? "Looking for mapped homes near your address…"
              : state.slow
                ? `Still searching ${formatDistance(state.radius)} — this area is a little slow to respond.`
                : `Widening to ${formatDistance(state.radius)} to catch rural neighbors…`}
          </p>

          {/* Fallback CTA shown clearly during any lookup */}
          <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/40 px-3 py-3 text-center">
            <p className="flex items-center gap-1 text-xs text-muted-foreground">
              <Timer className="h-3.5 w-3.5" />
              Taking too long, or want to skip the wait?
            </p>
            <Button variant="ghost" size="sm" onClick={onManualInstead}>
              Add homes by hand instead
            </Button>
          </div>
        </div>
      )}

      {state.kind === "ok" && (
        <>
          <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
            <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Found {state.parcels.length} home{state.parcels.length === 1 ? "" : "s"} within {formatDistance(state.radius)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Source: {state.source === "dcad" ? "county parcels" : "OpenStreetMap"}
            </span>
          </div>

          <ul className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-border bg-card p-2">
            {state.parcels.map((p, i) => {
              const checked = selected.has(p.id);
              const origin =
                typeof basicInfo.lat === "number" && typeof basicInfo.lng === "number"
                  ? { lat: basicInfo.lat, lng: basicInfo.lng }
                  : null;
              const primary = p.address ?? locatorLabel(origin, p);
              const hasRealAddress = Boolean(p.address);
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
                      <p className="truncate font-medium">{primary}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {hasRealAddress ? "Address from OpenStreetMap" : "No address on file — you can rename it later"}
                        {p.areaSqft ? ` · ~${Math.round(p.areaSqft).toLocaleString()} sq ft` : ""}
                      </p>
                    </div>
                    <span className="text-[10px] font-medium text-muted-foreground">#{i + 1}</span>
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
              We searched about {formatDistance(state.radius)} around your address and didn't
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
                <RefreshCcw className="h-3.5 w-3.5" /> Search wider ({formatDistance(RADIUS_STEPS[radiusIndex.current + 1])})
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