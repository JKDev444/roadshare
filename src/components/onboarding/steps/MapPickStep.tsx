import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight,
  Check,
  Loader2,
  MapPin,
  Pencil,
  RotateCcw,
} from "lucide-react";
import L from "leaflet";
import "leaflet-draw";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

import { Button } from "@/components/ui/button";
import { searchAddresses } from "@/lib/onboarding/nominatim";
import {
  dcadPointLookup,
  dcadPolygonLookup,
  type DcadParcel,
} from "@/lib/onboarding/dcad.functions";
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
 * Interactive map step (Dallas County / DCAD).
 *
 * Flow:
 *   1. Geocode the starting address, load nearby DCAD parcels.
 *   2. User can click any parcel to toggle it,
 *      OR use the draw tool (top-right) to lasso a whole area — every parcel
 *      inside gets auto-selected, then fine-tune by clicking.
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

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const drawLayerRef = useRef<L.FeatureGroup | null>(null);
  const centerMarkerRef = useRef<L.CircleMarker | null>(null);

  const [status, setStatus] = useState<Status>("geocoding");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [parcels, setParcels] = useState<DcadParcel[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hasDrawn, setHasDrawn] = useState(false);

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
        const hits = await searchAddresses(address, { state: basicInfo.state || "TX" });
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

  // 2) Initialize Leaflet + Leaflet.draw once center is known
  useEffect(() => {
    if (!center || !containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [center.lat, center.lng],
      zoom: 17,
      zoomControl: true,
      scrollWheelZoom: true,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);

    // FeatureGroup that holds the user-drawn polygon; required by Leaflet.draw.
    const drawn = new L.FeatureGroup().addTo(map);
    drawLayerRef.current = drawn;

    const drawControl = new L.Control.Draw({
      position: "topright",
      edit: { featureGroup: drawn, remove: true, edit: false },
      draw: {
        polygon: {
          allowIntersection: false,
          showArea: false,
          shapeOptions: { color: "#0ea5e9", weight: 3 },
        },
        rectangle: { shapeOptions: { color: "#0ea5e9", weight: 3 } } as L.DrawOptions.RectangleOptions,
        polyline: false,
        circle: false,
        marker: false,
        circlemarker: false,
      },
    });
    map.addControl(drawControl);

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
      drawLayerRef.current = null;
      centerMarkerRef.current = null;
    };
  }, [center]);

  // 3) Fetch parcels around the starting address
  const fetchNearPoint = useCallback(
    async (c: { lat: number; lng: number }) => {
      setStatus("fetching");
      setErrorMsg(null);
      try {
        const res = await pointFn({ data: { lat: c.lat, lng: c.lng, radius: 300, limit: 300 } });
        setParcels(res.parcels);
        setSelected(new Set());
        setHasDrawn(false);
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

  // 4) Wire up Leaflet.draw events → run polygon query, bulk-select matches
  useEffect(() => {
    const map = mapRef.current;
    const drawn = drawLayerRef.current;
    if (!map || !drawn) return;

    const onCreated = async (event: L.LeafletEvent) => {
      const e = event as L.DrawEvents.Created;
      drawn.clearLayers();
      drawn.addLayer(e.layer);
      const geo = (e.layer as L.Polygon).toGeoJSON();
      const ring: number[][] =
        geo.geometry.type === "Polygon"
          ? (geo.geometry.coordinates[0] as number[][])
          : [];
      if (ring.length < 4) return;
      setStatus("fetching");
      setErrorMsg(null);
      try {
        const res = await polygonFn({
          data: { polygon: { type: "Polygon", coordinates: [ring] }, limit: 500 },
        });
        setParcels(res.parcels);
        setSelected(new Set(res.parcels.map((p) => p.id)));
        setHasDrawn(true);
        setStatus(res.parcels.length === 0 ? "empty" : "ready");
      } catch (err) {
        setStatus("error");
        setErrorMsg(err instanceof Error ? err.message : "Failed to load parcels in the drawn area.");
      }
    };
    const onDeleted = () => {
      if (center) void fetchNearPoint(center);
    };

    map.on(L.Draw.Event.CREATED, onCreated);
    map.on(L.Draw.Event.DELETED, onDeleted);
    return () => {
      map.off(L.Draw.Event.CREATED, onCreated);
      map.off(L.Draw.Event.DELETED, onDeleted);
    };
  }, [polygonFn, fetchNearPoint, center]);

  // 5) Render parcel polygons whenever parcels/selection change
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (parcels.length === 0) return;
    for (const p of parcels) {
      const isSel = selected.has(p.id);
      const rings =
        p.geometry.type === "Polygon"
          ? [p.geometry.coordinates]
          : p.geometry.coordinates;
      const latlngs = rings.map((polygon) =>
        polygon.map((ring) => ring.map(([lng, lat]) => [lat, lng] as [number, number])),
      );
      const poly = L.polygon(latlngs, {
        color: isSel ? "#0369a1" : "#1e293b",
        weight: isSel ? 3 : 2,
        fillColor: isSel ? "#0ea5e9" : "#f59e0b",
        fillOpacity: isSel ? 0.55 : 0.35,
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
    if (selected.size === 0) {
      const bounds = L.latLngBounds([]);
      layer.eachLayer((child) => {
        const b = (child as L.Polygon).getBounds?.();
        if (b) bounds.extend(b);
      });
      if (bounds.isValid()) map.fitBounds(bounds, { padding: [20, 20], maxZoom: 19 });
    }
  }, [parcels, selected]);

  const selectedList = useMemo(
    () => parcels.filter((p) => selected.has(p.id)),
    [parcels, selected],
  );

  function clearAll() {
    setSelected(new Set());
  }
  function resetView() {
    drawLayerRef.current?.clearLayers();
    if (center) void fetchNearPoint(center);
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
          Use the <Pencil className="inline h-3 w-3" /> pencil (top-right) to draw around your community —
          every parcel inside gets selected. Then click any parcel to add or remove it.
          Dallas County data via DCAD.
        </p>
      </div>

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

      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
            <Check className="h-3 w-3" />
            {selected.size} selected
          </span>
          <span className="text-muted-foreground">of {parcels.length} shown</span>
          {hasDrawn && <span className="text-muted-foreground">· from your drawn area</span>}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="sm" onClick={clearAll} disabled={selected.size === 0}>
            <RotateCcw className="h-3.5 w-3.5" /> Clear selection
          </Button>
          <Button variant="outline" size="sm" onClick={resetView}>
            Reset map
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