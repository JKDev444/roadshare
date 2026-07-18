import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Check,
  Loader2,
  MapPin,
  RotateCcw,
  SquareDashedMousePointer,
  ShieldCheck,
  Shield,
  Car,
  Route,
  X,
  Info,
  Sparkles,
} from "lucide-react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { searchAddresses } from "@/lib/onboarding/nominatim";
import {
  dcadPointLookup,
  dcadPolygonLookup,
  type DcadParcel,
} from "@/lib/onboarding/dcad.functions";
import { detectRoadsInPolygon, type OsmRoad } from "@/lib/onboarding/osm.functions";
import { getMapboxToken } from "@/lib/mapbox";
import type { Json } from "@/integrations/supabase/types";
import type { BasicInfo } from "./BasicInfoStep";

export type MapPickResult = {
  kind: "map";
  items: Array<{
    label: string;
    address?: string;
    owner_name?: string;
    area_sqft?: number;
    lat?: number;
    lng?: number;
    geojson?: Json;
  }>;
  roads: Array<{ id: string; name: string; class: string; responsibility: "shared" | "private" | "public"; geometry: { type: "LineString"; coordinates: [number, number][] } }>;
};

type Status = "geocoding" | "fetching" | "ready" | "error" | "empty";

export type MapPickStepProps = {
  basicInfo: BasicInfo;
  onCancel: () => void;
  onSubmit: (r: MapPickResult) => void | Promise<void>;
  submitting?: boolean;
};

type RoadEntry = {
  id: string;
  name: string;
  class: string;
  included: boolean;
  responsibility: "shared" | "private" | "public";
  geometry: { type: "LineString"; coordinates: [number, number][] };
};

const RESP_LABEL: Record<string, { label: string; icon: typeof Shield }> = {
  shared: { label: "Shared", icon: ShieldCheck },
  private: { label: "Private", icon: Shield },
  public: { label: "Public", icon: Car },
};

/**
 * Interactive Mapbox map step (Dallas County / DCAD).
 *
 * Flow:
 *   1. Geocode the starting address and center the map.
 *   2. Draw a lasso around the neighborhood; every parcel inside gets selected.
 *   3. OpenStreetMap roads inside the lasso are auto-detected and suggested.
 *   4. Fine-tune parcels by clicking them, then confirm.
 */
export function MapPickStep({
  basicInfo,
  onCancel,
  onSubmit,
  submitting,
}: {
  basicInfo: BasicInfo;
  onCancel: () => void;
  onSubmit: (r: MapPickResult) => void | Promise<void>;
  submitting?: boolean;
}) {
  const pointFn = useServerFn(dcadPointLookup);
  const polygonFn = useServerFn(dcadPolygonLookup);
  const detectRoadsFn = useServerFn(detectRoadsInPolygon);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  const [status, setStatus] = useState<Status>("geocoding");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [parcels, setParcels] = useState<DcadParcel[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hasDrawn, setHasDrawn] = useState(false);
  const [roads, setRoads] = useState<RoadEntry[]>([]);
  const [detectingRoads, setDetectingRoads] = useState(false);
  const [drawingActive, setDrawingActive] = useState(false);
  const [anchorParcelId, setAnchorParcelId] = useState<string | null>(null);

  // 1) Geocode starting address once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const address = basicInfo.startingAddress?.trim();
      const cityState = [basicInfo.city, basicInfo.state].filter(Boolean).join(", ");
      if (!address && !cityState) {
        setStatus("error");
        setErrorMsg("No location yet. Go back and add a city, state, or one starting address.");
        return;
      }
      try {
        const q = address
          ? cityState
            ? `${address}, ${cityState}`
            : address
          : cityState;
        const hits = await searchAddresses(q, { state: basicInfo.state || undefined });
        if (cancelled) return;
        if (hits.length === 0) {
          setStatus("error");
          setErrorMsg(`We couldn't find "${address || cityState}" on the map. Check spelling or try adding city and state.`);
          return;
        }
        const h = hits[0];
        setCenter({ lat: parseFloat(h.lat), lng: parseFloat(h.lon) });
      } catch {
        if (!cancelled) {
          setStatus("error");
          setErrorMsg("Address lookup failed. Check your connection and try again.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [basicInfo.startingAddress, basicInfo.city, basicInfo.state]);

  // 2) Initialize Mapbox once center is known.
  useEffect(() => {
    if (!center || !containerRef.current || mapRef.current) return;
    let token: string;
    try {
      token = getMapboxToken();
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Mapbox token is missing.");
      return;
    }
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/outdoors-v12",
      center: [center.lng, center.lat],
      zoom: 17.5,
      attributionControl: true,
    });

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true },
      defaultMode: "simple_select",
    });
    map.addControl(draw, "top-right");
    drawRef.current = draw;

    new mapboxgl.Marker({ color: "#f59e0b" }).setLngLat([center.lng, center.lat]).addTo(map);

    map.on("load", () => {
      map.addSource("parcels", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "parcels-fill",
        type: "fill",
        source: "parcels",
        paint: {
          "fill-color": [
            "case",
            ["boolean", ["get", "anchor"], false], "#a855f7",
            ["boolean", ["get", "selected"], false], "#22d3ee",
            "#fbbf24",
          ],
          "fill-opacity": [
            "case",
            ["boolean", ["get", "selected"], false], 0.65,
            0.5,
          ],
        },
      });
      map.addLayer({
        id: "parcels-outline",
        type: "line",
        source: "parcels",
        paint: {
          "line-color": [
            "case",
            ["boolean", ["get", "anchor"], false], "#7e22ce",
            ["boolean", ["get", "selected"], false], "#0e7490",
            "#b45309",
          ],
          "line-width": [
            "case",
            ["boolean", ["get", "anchor"], false], 3.5,
            ["boolean", ["get", "selected"], false], 3,
            2,
          ],
        },
      });
    });

    map.on("click", "parcels-fill", (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const id = String(feature.properties?.id ?? "");
      if (!id) return;
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    });
    map.on("mouseenter", "parcels-fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "parcels-fill", () => {
      map.getCanvas().style.cursor = "";
    });

    mapRef.current = map;
    const onModeChange = (e: { mode: string }) => {
      setDrawingActive(e.mode === "draw_polygon");
    };
    map.on("draw.modechange", onModeChange as unknown as (...args: unknown[]) => void);
    return () => {
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, [center]);

  // 3) Fetch parcels around the starting address.
  const fetchNearPoint = useCallback(
    async (c: { lat: number; lng: number }) => {
      setStatus("fetching");
      setErrorMsg(null);
      try {
        const res = await pointFn({ data: { lat: c.lat, lng: c.lng, radius: 400, limit: 300 } });
        setParcels(res.parcels);
        // Auto-select the nearest ~8 parcels so the user sees immediate progress.
        const withDist = res.parcels
          .map((p) => ({
            id: p.id,
            d: Math.hypot((p.lng ?? c.lng) - c.lng, (p.lat ?? c.lat) - c.lat),
          }))
          .sort((a, b) => a.d - b.d);
        const anchor = withDist[0]?.id ?? null;
        setAnchorParcelId(anchor);
        setSelected(new Set(withDist.slice(0, Math.min(8, withDist.length)).map((p) => p.id)));
        setHasDrawn(false);
        setRoads([]);
        setStatus(res.parcels.length === 0 ? "empty" : "ready");
      } catch (err) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Failed to load parcels.");
      }
    },
    [pointFn],
  );

  useEffect(() => {
    if (!center) return;
    void fetchNearPoint(center);
  }, [center, fetchNearPoint]);

  // 4) Draw events → polygon query + road detection.
  useEffect(() => {
    const map = mapRef.current;
    const draw = drawRef.current;
    if (!map || !draw) return;

    const onCreated = async (e: mapboxgl.MapboxEvent) => {
      const feat = (e as { features?: GeoJSON.Feature[] }).features?.[0];
      if (!feat || feat.geometry.type !== "Polygon") return;
      draw.deleteAll();
      const ring: number[][] = (feat.geometry.coordinates as number[][][])[0];
      if (ring.length < 4) return;
      setStatus("fetching");
      setDetectingRoads(true);
      setErrorMsg(null);
      try {
        const [parcelRes, roadRes] = await Promise.all([
          polygonFn({ data: { polygon: { type: "Polygon", coordinates: [ring] }, limit: 500 } }),
          detectRoadsFn({ data: { polygon: { type: "Polygon", coordinates: [ring] } } }),
        ]);
        setParcels(parcelRes.parcels);
        setSelected(new Set(parcelRes.parcels.map((p) => p.id)));
        setHasDrawn(true);
        setRoads(
          roadRes.roads.map((r) => ({
            id: r.id,
            name: r.name,
            class: r.class,
            included: true,
            responsibility: "shared" as const,
            geometry: r.geometry,
          })),
        );
        setStatus(parcelRes.parcels.length === 0 ? "empty" : "ready");
      } catch (err) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Failed to load parcels or roads in the drawn area.");
      } finally {
        setDetectingRoads(false);
      }
    };
    map.on("draw.create", onCreated);
    return () => {
      map.off("draw.create", onCreated);
    };
  }, [polygonFn, detectRoadsFn]);

  // 5) Re-render parcel source whenever parcels/selection change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const source = map.getSource("parcels") as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    const features: GeoJSON.Feature[] = parcels.map((p) => {
      const isSel = selected.has(p.id);
      return {
        type: "Feature",
        properties: { id: p.id, label: p.headline, selected: isSel, anchor: p.id === anchorParcelId },
        geometry: p.geometry,
      };
    });
    source.setData({ type: "FeatureCollection", features });
    if (parcels.length > 0) {
      const bounds = new mapboxgl.LngLatBounds();
      let added = false;
      for (const p of parcels) {
        const rings =
          p.geometry.type === "Polygon"
            ? [p.geometry.coordinates]
            : p.geometry.type === "MultiPolygon"
              ? p.geometry.coordinates
              : [];
        for (const ring of rings) {
          for (const [lng, lat] of ring[0]) {
            bounds.extend([lng, lat]);
            added = true;
          }
        }
      }
      if (added) map.fitBounds(bounds, { padding: 40, maxZoom: 19 });
    }
  }, [parcels, selected, anchorParcelId]);

  const selectedList = useMemo(
    () => parcels.filter((p) => selected.has(p.id)),
    [parcels, selected],
  );

  function clearAll() {
    setSelected(new Set());
  }
  function resetView() {
    drawRef.current?.deleteAll();
    if (center) void fetchNearPoint(center);
  }
  function activateLasso() {
    drawRef.current?.changeMode("draw_polygon");
    setDrawingActive(true);
  }

  function finishLasso() {
    const map = mapRef.current;
    if (!map) return;
    // mapbox-gl-draw finishes the current polygon when Enter is pressed on the canvas.
    const canvas = map.getCanvas();
    canvas.focus();
    const ev = new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true });
    canvas.dispatchEvent(ev);
  }

  function selectAllVisible() {
    setSelected(new Set(parcels.map((p) => p.id)));
  }

  function toggleRoad(id: string) {
    setRoads((prev) => prev.map((r) => (r.id === id ? { ...r, included: !r.included } : r)));
  }
  function setRoadResp(id: string, responsibility: "shared" | "private" | "public") {
    setRoads((prev) => prev.map((r) => (r.id === id ? { ...r, responsibility } : r)));
  }
  function includeAllRoads(include: boolean) {
    setRoads((prev) => prev.map((r) => ({ ...r, included: include })));
  }

  async function confirm() {
    if (selectedList.length === 0) return;
    await onSubmit({
      kind: "map",
      items: selectedList.map((p, i) => ({
        label: p.address ? p.address.split(",")[0] : `Lot ${i + 1}`,
        address: p.address ?? p.headline,
        owner_name: p.owner ?? undefined,
        area_sqft: p.areaSqft ?? undefined,
        lat: p.lat,
        lng: p.lng,
        geojson: p.geometry,
      })),
      roads: roads.filter((r) => r.included).map((r) => ({ ...r })),
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold">Pick your neighborhood on the map</h2>
          <p className="mt-0.5 max-w-lg text-xs text-muted-foreground">
            We picked your closest neighbors to start. Tap any parcel to add or remove it, or use
            the lasso to draw around your whole community — we'll auto-detect the roads. Dallas
            County data via DCAD.
          </p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          {drawingActive ? (
            <Button size="sm" onClick={finishLasso} className="bounce animate-pulse hover:scale-105">
              <Check className="mr-1 h-3.5 w-3.5" /> Finish lasso
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={activateLasso} className="bounce hover:scale-105">
              <SquareDashedMousePointer className="mr-1 h-3.5 w-3.5" /> Lasso
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={selectAllVisible} disabled={parcels.length === 0}>
            <Sparkles className="mr-1 h-3.5 w-3.5" /> Select all
          </Button>
          <Button variant="outline" size="sm" onClick={resetView}>
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
        <Info className="h-3.5 w-3.5 shrink-0" />
        {drawingActive ? (
          <span>
            <strong>Drawing:</strong> click to add points around your community, then hit
            <span className="mx-1 rounded bg-primary/15 px-1 py-0.5 font-mono">Finish lasso</span>
            (or double-click the last point).
          </span>
        ) : (
          <span>
            <strong>Purple</strong> is your address. <strong>Teal</strong> = selected.
            <strong className="ml-1">Amber</strong> = tap to add. Prefer drawing? Hit
            <span className="mx-1 rounded bg-primary/15 px-1 py-0.5 font-medium">Lasso</span>.
          </span>
        )}
      </div>

      <div className="relative overflow-hidden rounded-2xl border border-border bg-muted shadow-sm">
        <div ref={containerRef} className="h-[560px] w-full" />
        {(status === "geocoding" || status === "fetching" || detectingRoads) && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 shadow-md fun-shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs font-medium">
                {status === "geocoding" ? "Finding your address…" : detectingRoads ? "Detecting roads…" : "Loading parcels…"}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
            <Check className="h-3 w-3" />
            {selected.size} selected
          </span>
          <span className="text-muted-foreground">of {parcels.length} shown</span>
          {hasDrawn && <span className="text-muted-foreground">· from your drawn area</span>}
          {roads.length > 0 && <span className="text-muted-foreground">· {roads.filter((r) => r.included).length} roads included</span>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={clearAll} disabled={selected.size === 0}>
            <X className="h-3.5 w-3.5" /> Clear selection
          </Button>
        </div>
      </div>

      {status === "empty" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-medium">No parcels found in that area.</p>
          <p className="mt-0.5">
            DCAD covers Dallas County only right now. Try a different address inside Dallas County, or
            go back and paste addresses instead.
          </p>
        </div>
      )}
      {status === "error" && errorMsg && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {errorMsg}
        </div>
      )}

      {roads.length > 0 && <RoadsPanel roads={roads} onToggle={toggleRoad} onRespChange={setRoadResp} onIncludeAll={includeAllRoads} />}

      {selectedList.length > 0 && (
        <div className="max-h-32 overflow-y-auto rounded-2xl border border-border bg-card p-2">
          <ul className="space-y-1">
            {selectedList.slice(0, 12).map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-xs">
                <MapPin className="h-3 w-3 shrink-0 text-primary" />
                <span className="truncate">{p.address ?? p.headline}</span>
              </li>
            ))}
            {selectedList.length > 12 && (
              <li className="text-xs text-muted-foreground">+ {selectedList.length - 12} more</li>
            )}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Back
        </Button>
        <Button
          size="sm"
          onClick={confirm}
          disabled={selectedList.length === 0 || submitting}
          className="bounce hover:scale-105"
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Add {selectedList.length} {selectedList.length === 1 ? "property" : "properties"}{" "}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function RoadsPanel({
  roads,
  onToggle,
  onRespChange,
  onIncludeAll,
}: {
  roads: RoadEntry[];
  onToggle: (id: string) => void;
  onRespChange: (id: string, resp: "shared" | "private" | "public") => void;
  onIncludeAll: (include: boolean) => void;
}) {
  const allIncluded = roads.every((r) => r.included);
  const someIncluded = roads.some((r) => r.included);
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm fun-shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-fun-2 text-fun-2-foreground">
            <Route className="h-3.5 w-3.5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Roads we found</p>
            <p className="text-xs text-muted-foreground">Uncheck any road that isn’t part of your community.</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onIncludeAll(!allIncluded)} className="text-xs">
          {allIncluded ? "Uncheck all" : "Include all"}
        </Button>
      </div>
      <ul className="mt-2 space-y-1.5">
        {roads.map((r) => {
          const meta = RESP_LABEL[r.responsibility] ?? RESP_LABEL.shared;
          const Icon = meta.icon;
          return (
            <li
              key={r.id}
              className={cn(
                "flex items-center gap-2 rounded-xl border p-2 transition-colors",
                r.included ? "border-primary/40 bg-primary/5" : "border-border bg-muted/40 opacity-70",
              )}
            >
              <input
                id={`road-${r.id}`}
                type="checkbox"
                checked={r.included}
                onChange={() => onToggle(r.id)}
                className="h-4 w-4 accent-primary"
              />
              <label htmlFor={`road-${r.id}`} className="flex-1 text-sm font-medium">
                {r.name}
              </label>
              <select
                value={r.responsibility}
                onChange={(e) => onRespChange(r.id, e.target.value as "shared" | "private" | "public")}
                className="rounded-md border border-border bg-background px-2 py-1 text-xs"
                disabled={!r.included}
              >
                <option value="shared">Shared</option>
                <option value="private">Private</option>
                <option value="public">Public</option>
              </select>
              <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide", r.responsibility === "shared" && "bg-fun-1/20 text-fun-1-foreground", r.responsibility === "private" && "bg-fun-2/20 text-fun-2-foreground", r.responsibility === "public" && "bg-fun-3/20 text-fun-3-foreground")}>
                <Icon className="h-3 w-3" /> {meta.label}
              </span>
            </li>
          );
        })}
      </ul>
      {!someIncluded && <p className="mt-2 text-xs text-muted-foreground">No roads selected — you can draw them later on the community map.</p>}
    </div>
  );
}
