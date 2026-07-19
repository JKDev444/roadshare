import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { Home, Route, Satellite, Pencil, X, Undo2, Check, Info } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getMapboxToken, MAP_STYLE } from "@/lib/mapbox";
import {
  haversineFt,
  parcelToFeature,
  segmentToFeature,
  type GeoJSONLineString,
  type Parcel,
  type RoadSegment,
} from "@/lib/community/api";

import "mapbox-gl/dist/mapbox-gl.css";
import "@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css";

export type CommunityMapEditorProps = {
  parcels: Parcel[];
  segments: RoadSegment[];
  selectedSegmentId: string | null;
  onSelectSegment: (id: string | null) => void;
  onCreateSegment: (geometry: GeoJSONLineString) => void;
};

export function CommunityMapEditor({
  parcels,
  segments,
  selectedSegmentId,
  onSelectSegment,
  onCreateSegment,
}: CommunityMapEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const drawRef = useRef<MapboxDraw | null>(null);

  const [showParcels, setShowParcels] = useState(true);
  const [showRoads, setShowRoads] = useState(true);
  const [satellite, setSatellite] = useState(false);
  const [drawStep, setDrawStep] = useState<"idle" | "prepare" | "draw" | "confirm">("idle");
  const [draftCoords, setDraftCoords] = useState<[number, number][]>([]);
  const [pendingGeometry, setPendingGeometry] = useState<GeoJSONLineString | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const streets = MAP_STYLE;
  const sat = "mapbox://styles/mapbox/satellite-streets-v12";
  const currentStyleRef = useRef(streets);

  // 1) Initialize map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let token: string;
    try {
      token = getMapboxToken();
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Mapbox token is missing.");
      return;
    }
    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: streets,
      center: [-96.8, 32.78],
      zoom: 12,
    });
    mapRef.current = map;

    const addDrawControl = () => {
      if (drawRef.current || !mapRef.current) return;
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: { line_string: true, trash: true },
        defaultMode: "simple_select",
      });
      map.addControl(draw, "top-right");
      drawRef.current = draw;
    };

    if (map.loaded() && map.isStyleLoaded()) addDrawControl();
    else map.once("load", addDrawControl);

    return () => {
      map.off("load", addDrawControl);
      map.remove();
      mapRef.current = null;
      drawRef.current = null;
    };
  }, []);

  // 2) Add sources and layers when style is loaded, and switch styles.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const setup = () => {
      if (!mapRef.current || !map.isStyleLoaded()) return;
      if (!map.getSource("parcels")) {
        map.addSource("parcels", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }
      if (!map.getSource("roads")) {
        map.addSource("roads", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
      }
      if (!map.getLayer("parcels-fill")) {
        map.addLayer({
          id: "parcels-fill",
          type: "fill",
          source: "parcels",
          paint: {
            "fill-color": "#f59e0b",
            "fill-opacity": 0.35,
          },
        });
      }
      if (!map.getLayer("parcels-outline")) {
        map.addLayer({
          id: "parcels-outline",
          type: "line",
          source: "parcels",
          paint: {
            "line-color": "#1e293b",
            "line-width": 1.5,
          },
        });
      }
      if (!map.getLayer("roads")) {
        map.addLayer({
          id: "roads",
          type: "line",
          source: "roads",
          paint: {
            "line-color": "#0ea5e9",
            "line-width": 4,
            "line-opacity": 0.9,
          },
        });
      }
      if (!map.getLayer("roads-selected")) {
        map.addLayer({
          id: "roads-selected",
          type: "line",
          source: "roads",
          filter: ["==", ["get", "selected"], true],
          paint: {
            "line-color": "#f59e0b",
            "line-width": 6,
            "line-opacity": 1,
          },
        });
      }
      updateData();
    };

    const updateData = () => {
      const parcelSource = map.getSource("parcels") as mapboxgl.GeoJSONSource | undefined;
      const roadSource = map.getSource("roads") as mapboxgl.GeoJSONSource | undefined;
      if (parcelSource) {
        parcelSource.setData({
          type: "FeatureCollection",
          features: parcels.map((p) => parcelToFeature(p)).filter((f): f is NonNullable<typeof f> => f !== null),
        });
      }
      if (roadSource) {
        roadSource.setData({
          type: "FeatureCollection",
          features: segments
            .map((s) => segmentToFeature(s))
            .filter((f): f is NonNullable<typeof f> => f !== null)
            .map((f) => ({ ...f, properties: { ...f.properties, selected: f.properties.id === selectedSegmentId } })),
        });
      }
    };

    if (map.loaded() && map.isStyleLoaded()) setup();
    else map.once("style.load", setup);

    const onClickRoad = (e: mapboxgl.MapMouseEvent & { features?: mapboxgl.MapboxGeoJSONFeature[] }) => {
      const feat = e.features?.[0];
      if (!feat) return;
      const id = String(feat.properties?.id ?? "");
      onSelectSegment(id === selectedSegmentId ? null : id);
    };
    const onMouseEnter = () => (map.getCanvas().style.cursor = "pointer");
    const onMouseLeave = () => (map.getCanvas().style.cursor = "");
    map.on("click", "roads", onClickRoad);
    map.on("mouseenter", "roads", onMouseEnter);
    map.on("mouseleave", "roads", onMouseLeave);

    const onCreate = (e: mapboxgl.MapboxEvent) => {
      const feat = (e as { features?: GeoJSON.Feature[] }).features?.[0];
      if (!feat || feat.geometry.type !== "LineString") return;
      const geom = feat.geometry as GeoJSONLineString;
      if (geom.coordinates.length < 2) {
        drawRef.current?.deleteAll();
        setDrawStep("prepare");
        setDraftCoords([]);
        return;
      }
      setPendingGeometry(geom);
      setDraftCoords(geom.coordinates as [number, number][]);
      setDrawStep("confirm");
    };
    map.on("draw.create", onCreate);

    const onRender = () => {
      const fc = drawRef.current?.getAll();
      const feat = fc?.features?.[0];
      if (feat && feat.geometry.type === "LineString") {
        setDraftCoords(feat.geometry.coordinates as [number, number][]);
      }
    };
    map.on("draw.render", onRender);

    return () => {
      map.off("click", "roads", onClickRoad);
      map.off("mouseenter", "roads", onMouseEnter);
      map.off("mouseleave", "roads", onMouseLeave);
      map.off("draw.create", onCreate);
      map.off("draw.render", onRender);
      map.off("style.load", setup);
    };
  }, [parcels, segments, selectedSegmentId, onSelectSegment, onCreateSegment]);

  // 3) Switch style for satellite.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const target = satellite ? sat : streets;
    if (currentStyleRef.current !== target) {
      currentStyleRef.current = target;
      map.setStyle(target);
    }
  }, [satellite, sat, streets]);

  // 4) Fit bounds to parcels when they change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || (parcels.length === 0 && segments.length === 0)) return;

    const bounds = new mapboxgl.LngLatBounds();
    let added = false;
    const extend = ([lng, lat]: [number, number]) => {
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      if (Math.abs(lng) > 180 || Math.abs(lat) > 85) return;
      bounds.extend([lng, lat]);
      added = true;
    };

    for (const p of parcels) {
      const feature = parcelToFeature(p);
      if (!feature) continue;
      for (const polygon of feature.geometry.type === "Polygon" ? [feature.geometry.coordinates] : []) {
        for (const ring of polygon) {
          for (const coordinate of ring) extend(coordinate as [number, number]);
        }
      }
    }
    for (const segment of segments) {
      const feature = segmentToFeature(segment);
      if (!feature) continue;
      for (const coordinate of feature.geometry.coordinates) extend(coordinate);
    }

    if (!added) return;
    const fit = () => {
      map.resize();
      map.fitBounds(bounds, { padding: 70, maxZoom: 17, duration: 0 });
    };
    if (map.loaded() && map.isStyleLoaded()) fit();
    else map.once("idle", fit);
    return () => {
      map.off("idle", fit);
    };
  }, [parcels, segments]);

  // 5) Toggle layer visibility.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const id of ["parcels-fill", "parcels-outline"]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", showParcels ? "visible" : "none");
    }
    for (const id of ["roads", "roads-selected"]) {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", showRoads ? "visible" : "none");
    }
  }, [showParcels, showRoads]);

  function prepareDrawing() {
    setDrawStep("prepare");
  }
  function beginDrawing() {
    setDrawStep("draw");
    setDraftCoords([]);
    drawRef.current?.deleteAll();
    drawRef.current?.changeMode("draw_line_string");
  }
  function undoLastPoint() {
    const draw = drawRef.current;
    if (!draw) return;
    const fc = draw.getAll();
    const feat = fc?.features?.[0];
    if (!feat || feat.geometry.type !== "LineString") return;
    const coords = [...(feat.geometry.coordinates as [number, number][])];
    if (coords.length <= 1) return;
    coords.pop();
    const id = String(feat.id);
    draw.delete(id);
    draw.add({
      ...feat,
      geometry: { ...feat.geometry, coordinates: coords },
    } as GeoJSON.Feature);
    draw.changeMode("draw_line_string", { featureId: id, from: coords[coords.length - 1] });
    setDraftCoords(coords);
  }
  function finishDrawing() {
    const draw = drawRef.current;
    if (!draw) return;
    const fc = draw.getAll();
    const feat = fc?.features?.[0];
    if (!feat || feat.geometry.type !== "LineString") return;
    if (feat.geometry.coordinates.length < 2) return;
    draw.changeMode("simple_select");
  }
  function cancelDrawing() {
    drawRef.current?.deleteAll();
    drawRef.current?.changeMode("simple_select");
    setDraftCoords([]);
    setPendingGeometry(null);
    setDrawStep("idle");
  }
  function saveDrawnRoad() {
    if (!pendingGeometry) return;
    onCreateSegment(pendingGeometry);
    drawRef.current?.deleteAll();
    setDraftCoords([]);
    setPendingGeometry(null);
    setDrawStep("idle");
  }
  function redrawDrawnRoad() {
    setPendingGeometry(null);
    setDraftCoords([]);
    drawRef.current?.deleteAll();
    beginDrawing();
  }

  const liveLengthFt = computeLineLengthFt(draftCoords);
  const parcelsCount = parcels.length;

  return (
    <div className="relative flex h-full min-h-[520px] overflow-hidden rounded-2xl border border-border bg-muted">
      <div ref={containerRef} className="h-full w-full" />
      {errorMsg && (
        <div className="absolute inset-x-0 top-0 z-20 border-b border-destructive/30 bg-destructive/10 px-4 py-2 text-xs text-destructive">
          {errorMsg}
        </div>
      )}

      <div className="absolute left-3 top-3 z-10 flex flex-col gap-2">
        <div className="rounded-xl border border-border bg-card/95 p-2 shadow-sm backdrop-blur fun-shadow-sm">
          <div className="flex flex-col gap-1.5">
            <ToggleBtn active={showParcels} onClick={() => setShowParcels((v) => !v)} icon={Home} label="Homes" />
            <ToggleBtn active={showRoads} onClick={() => setShowRoads((v) => !v)} icon={Route} label="Roads" />
            <ToggleBtn active={satellite} onClick={() => setSatellite((v) => !v)} icon={Satellite} label="Satellite" />
          </div>
        </div>
      </div>

      {drawStep === "idle" && (
        <div className="absolute right-3 top-3 z-10">
          <div className="rounded-xl border border-border bg-card/95 p-2 shadow-sm backdrop-blur fun-shadow-sm">
            <Button size="sm" variant="outline" onClick={prepareDrawing}>
              <Pencil className="mr-1.5 h-3.5 w-3.5" /> Draw road
            </Button>
          </div>
        </div>
      )}

      {drawStep === "prepare" && (
        <div className="absolute inset-x-3 top-3 z-10 sm:inset-x-auto sm:right-3 sm:max-w-sm">
          <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur fun-shadow-md">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-fun-1/20 text-fun-1-foreground">
                <Info className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-sm font-semibold">Trace the shared road</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Click along the road on the map — each click drops a point. Finish when the line covers the whole shared stretch. You can undo or redraw at any time.
                </p>
              </div>
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={cancelDrawing}>Cancel</Button>
              <Button size="sm" onClick={beginDrawing}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" /> Start drawing
              </Button>
            </div>
          </div>
        </div>
      )}

      {drawStep === "draw" && (
        <div className="absolute inset-x-3 top-3 z-10 sm:inset-x-auto sm:right-3 sm:max-w-sm">
          <div className="rounded-2xl border border-primary/40 bg-card/95 p-3 shadow-lg backdrop-blur fun-shadow-md">
            <p className="text-xs font-semibold text-primary">
              {draftCoords.length < 2
                ? "Click on the map to add points"
                : `${draftCoords.length} points · ~${formatFt(liveLengthFt)}`}
            </p>
            <p className="text-[11px] text-muted-foreground">Double-click the last point, or press Finish, when you&apos;re done.</p>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={cancelDrawing}>
                <X className="mr-1 h-3.5 w-3.5" /> Cancel
              </Button>
              <Button size="sm" variant="outline" onClick={undoLastPoint} disabled={draftCoords.length < 2}>
                <Undo2 className="mr-1 h-3.5 w-3.5" /> Undo last point
              </Button>
              <Button size="sm" onClick={finishDrawing} disabled={draftCoords.length < 2}>
                <Check className="mr-1 h-3.5 w-3.5" /> Finish road
              </Button>
            </div>
          </div>
        </div>
      )}

      {drawStep === "confirm" && pendingGeometry && (
        <div className="absolute inset-x-3 top-3 z-10 sm:inset-x-auto sm:right-3 sm:max-w-sm">
          <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur fun-shadow-md">
            <p className="font-display text-sm font-semibold">Save this road?</p>
            <dl className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Approximate length</dt>
                <dd className="font-semibold">{formatFt(liveLengthFt)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Homes on the map</dt>
                <dd className="font-semibold">{parcelsCount} {parcelsCount === 1 ? "home" : "homes"}</dd>
              </div>
            </dl>
            <p className="mt-2 text-[11px] text-muted-foreground">You can edit the name and other details after saving.</p>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={cancelDrawing}>Cancel</Button>
              <Button size="sm" variant="outline" onClick={redrawDrawnRoad}>
                <Pencil className="mr-1 h-3.5 w-3.5" /> Redraw
              </Button>
              <Button size="sm" onClick={saveDrawnRoad}>
                <Check className="mr-1 h-3.5 w-3.5" /> Save road
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ToggleBtn({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Home;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function computeLineLengthFt(coords: [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    total += haversineFt(coords[i - 1], coords[i]);
  }
  return total;
}

function formatFt(ft: number): string {
  if (!Number.isFinite(ft) || ft <= 0) return "0 ft";
  if (ft >= 5280) return `${(ft / 5280).toFixed(2)} mi`;
  return `${Math.round(ft)} ft`;
}
