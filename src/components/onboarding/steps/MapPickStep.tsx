import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Check,
  Loader2,
  MapPin,
  Sparkles,
  ZoomIn,
  RotateCcw,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { searchAddresses } from "@/lib/onboarding/nominatim";
import { regridPointLookup, type RegridParcel } from "@/lib/onboarding/regrid.functions";
import type { BasicInfo } from "./BasicInfoStep";

export type MapPickResult = {
  kind: "map";
  items: Array<{
    label: string;
    address?: string;
    owner_name?: string;
    area_sqft?: number;
  }>;
};

type Status = "geocoding" | "fetching" | "ready" | "error" | "empty";

/**
 * Interactive map step. Geocodes the user's starting address, then loads parcel
 * polygons from Regrid within a radius. The user clicks polygons to include or
 * exclude parcels, then confirms the selection.
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
  const regridFn = useServerFn(regridPointLookup);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const centerMarkerRef = useRef<L.Marker | null>(null);

  const [status, setStatus] = useState<Status>("geocoding");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(400); // meters
  const [parcels, setParcels] = useState<RegridParcel[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // 1) Geocode starting address once
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const address = basicInfo.startingAddress?.trim();
      if (!address) {
        setStatus("error");
        setErrorMsg("No starting address provided. Go back and enter one address on your road.");
        return;
      }
      try {
        const hits = await searchAddresses(address, { state: basicInfo.state });
        if (cancelled) return;
        if (hits.length === 0) {
          setStatus("error");
          setErrorMsg(`We couldn't find "${address}" on the map. Check spelling or try adding city and state.`);
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
  }, [basicInfo.startingAddress, basicInfo.state]);

  // 2) Initialize Leaflet once center is known
  useEffect(() => {
    if (!center || !containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: 18,
      zoomControl: true,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    // Marker for the starting address
    centerMarkerRef.current = L.circleMarker([center.lat, center.lng], {
      radius: 6,
      color: "#f59e0b",
      fillColor: "#f59e0b",
      fillOpacity: 1,
      weight: 2,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      centerMarkerRef.current = null;
    };
  }, [center]);

  // 3) Fetch parcels whenever center or radius changes
  const fetchParcels = useCallback(
    async (c: { lat: number; lng: number }, r: number) => {
      setStatus("fetching");
      setErrorMsg(null);
      try {
        const res = await regridFn({ data: { lat: c.lat, lng: c.lng, radius: r, limit: 200 } });
        setParcels(res.parcels);
        setStatus(res.parcels.length === 0 ? "empty" : "ready");
      } catch (err) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Failed to load parcels.");
      }
    },
    [regridFn],
  );

  useEffect(() => {
    if (!center) return;
    void fetchParcels(center, radius);
  }, [center, radius, fetchParcels]);

  // 4) Render parcel polygons whenever parcels/selection change
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (parcels.length === 0) return;
    for (const p of parcels) {
      const isSel = selected.has(p.id);
      // Convert GeoJSON to Leaflet-friendly latlng arrays
      const rings =
        p.geometry.type === "Polygon"
          ? [p.geometry.coordinates]
          : p.geometry.coordinates;
      const latlngs = rings.map((polygon) =>
        polygon.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number])),
      );
      const poly = L.polygon(latlngs, {
        color: isSel ? "#0ea5e9" : "#94a3b8",
        weight: isSel ? 3 : 1.5,
        fillColor: isSel ? "#38bdf8" : "#cbd5e1",
        fillOpacity: isSel ? 0.45 : 0.15,
      });
      poly.bindTooltip(p.headline, { direction: "top", offset: [0, -4] });
      poly.on("click", () => {
        setSelected((prev) => {
          const next = new Set(prev);
          if (next.has(p.id)) next.delete(p.id);
          else next.add(p.id);
          return next;
        });
      });
      poly.addTo(layer);
    }
    // Fit bounds on first load only (when nothing is selected yet)
    if (selected.size === 0) {
      const bounds = layer.getBounds();
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20], maxZoom: 19 });
    }
  }, [parcels, selected]);

  const selectedList = useMemo(
    () => parcels.filter((p) => selected.has(p.id)),
    [parcels, selected],
  );

  function selectAll() {
    setSelected(new Set(parcels.map((p) => p.id)));
  }
  function clearAll() {
    setSelected(new Set());
  }
  function expandRadius() {
    setRadius((r) => Math.min(1500, Math.round(r * 1.75)));
    setSelected(new Set());
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
      })),
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-display text-lg font-semibold">Pick your neighbors on the map</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          We loaded parcels near <span className="font-medium">{basicInfo.startingAddress || "your address"}</span>.
          Tap each home on your private road to include it. Skip ones that aren't part of the group.
        </p>
      </div>

      {/* Map container */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-muted">
        <div ref={containerRef} className="h-[420px] w-full" />
        {(status === "geocoding" || status === "fetching") && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-full bg-card px-3 py-1.5 shadow-md">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-xs font-medium">
                {status === "geocoding" ? "Finding your address…" : "Loading parcels…"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
            <Check className="h-3 w-3" />
            {selected.size} selected
          </span>
          <span className="text-muted-foreground">of {parcels.length} nearby</span>
          <span className="text-muted-foreground">· radius {radius}m</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={selectAll} disabled={parcels.length === 0}>
            <Sparkles className="h-3.5 w-3.5" /> Select all
          </Button>
          <Button variant="outline" size="sm" onClick={clearAll} disabled={selected.size === 0}>
            <RotateCcw className="h-3.5 w-3.5" /> Clear
          </Button>
          <Button variant="outline" size="sm" onClick={expandRadius} disabled={radius >= 1500}>
            <ZoomIn className="h-3.5 w-3.5" /> Widen search
          </Button>
        </div>
      </div>

      {/* Empty / error message */}
      {status === "empty" && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <p className="font-medium">No parcels found here.</p>
          <p className="mt-0.5">
            Regrid's sandbox coverage is limited. On a paid API plan, this will populate every nearby parcel.
            For now, use "Widen search," or go back and paste addresses instead.
          </p>
        </div>
      )}
      {status === "error" && errorMsg && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
          {errorMsg}
        </div>
      )}

      {/* Selected preview */}
      {selectedList.length > 0 && (
        <div className="max-h-32 overflow-y-auto rounded-lg border border-border bg-card p-2">
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
        >
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Add {selectedList.length} {selectedList.length === 1 ? "property" : "properties"}{" "}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// Kept for compatibility with strict eslint import-if-used rule
void toast;