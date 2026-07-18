import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  dcadPointLookup,
  dcadPolygonLookup,
  type DcadParcel,
  type GeoJsonPolygon,
  type GeoJsonMultiPolygon,
} from "./dcad.functions";

/**
 * Nationwide parcel/home lookup.
 *
 * Strategy: try Dallas County (DCAD) first because it has real cadastral
 * parcel polygons. If it returns nothing (outside Dallas), fall back to
 * OpenStreetMap building footprints via the free Overpass API. Buildings
 * aren't tax parcels, but for the purpose of "pick your neighbors on a
 * map" they give us a clickable polygon per home, everywhere in the world.
 */

export type ParcelSource = "dcad" | "osm";

export type ParcelLookupResult = {
  parcels: DcadParcel[];
  source: ParcelSource;
};

// -- Rough Dallas County bounding box; used to skip DCAD entirely elsewhere
function inDallasCounty(lat: number, lng: number): boolean {
  return lat >= 32.5 && lat <= 33.1 && lng >= -97.05 && lng <= -96.4;
}

// -- OSM Overpass: buildings inside a bbox or polygon --------------------

type OsmNode = { type: "node"; id: number; lat: number; lon: number };
type OsmWay = {
  type: "way";
  id: number;
  nodes?: number[];
  tags?: Record<string, string>;
};
type OsmRelMember = { type: "way" | "node"; ref: number; role?: string };
type OsmRel = {
  type: "relation";
  id: number;
  members?: OsmRelMember[];
  tags?: Record<string, string>;
};
type OsmElement = OsmNode | OsmWay | OsmRel;

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

async function runOverpass(query: string): Promise<OsmElement[]> {
  let lastErr: unknown = null;
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "RoadShare/1.0 (nationwide parcel lookup)",
          Accept: "application/json",
        },
        body: `data=${encodeURIComponent(query)}`,
      });
      if (!res.ok) {
        lastErr = new Error(`Overpass ${res.status} @ ${new URL(url).host}`);
        continue;
      }
      const json = (await res.json()) as { elements?: OsmElement[] };
      return json.elements ?? [];
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(
    `Map service is busy right now (${lastErr instanceof Error ? lastErr.message : "unknown"}). Try again in a few seconds.`,
  );
}

function ringFromNodes(
  nodeIds: number[],
  nodes: Map<number, [number, number]>,
): [number, number][] | null {
  const coords: [number, number][] = [];
  for (const id of nodeIds) {
    const p = nodes.get(id);
    if (!p) continue;
    coords.push(p);
  }
  if (coords.length < 3) return null;
  // Close ring if the source didn't
  const [fx, fy] = coords[0];
  const [lx, ly] = coords[coords.length - 1];
  if (fx !== lx || fy !== ly) coords.push([fx, fy]);
  return coords;
}

function centroidOfRing(ring: [number, number][]): { lat: number; lng: number } {
  let x = 0;
  let y = 0;
  for (const [lng, lat] of ring) {
    x += lng;
    y += lat;
  }
  const n = ring.length || 1;
  return { lat: y / n, lng: x / n };
}

// Rough polygon area in square meters via equirectangular projection.
function ringAreaSqMeters(ring: [number, number][]): number {
  if (ring.length < 3) return 0;
  const latRef = ring[0][1];
  const mPerDegLat = 111_320;
  const mPerDegLng = 111_320 * Math.cos((latRef * Math.PI) / 180);
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    a += x1 * mPerDegLng * (y2 * mPerDegLat) - x2 * mPerDegLng * (y1 * mPerDegLat);
  }
  return Math.abs(a / 2);
}

function formatOsmAddress(tags: Record<string, string> = {}): string | null {
  const num = tags["addr:housenumber"]?.trim();
  const street = tags["addr:street"]?.trim();
  const city = tags["addr:city"]?.trim();
  const streetLine = [num, street].filter(Boolean).join(" ");
  if (!streetLine && !city) return null;
  return city ? `${streetLine || street || ""}${streetLine ? ", " : ""}${city}` : streetLine;
}

function buildingsToParcels(elements: OsmElement[]): DcadParcel[] {
  const nodes = new Map<number, [number, number]>();
  const waysById = new Map<number, OsmWay>();
  const ways: OsmWay[] = [];
  const rels: OsmRel[] = [];
  for (const el of elements) {
    if (el.type === "node") {
      nodes.set(el.id, [el.lon, el.lat]);
    } else if (el.type === "way") {
      waysById.set(el.id, el);
      ways.push(el);
    } else if (el.type === "relation") {
      rels.push(el);
    }
  }

  const parcels: DcadParcel[] = [];
  const seen = new Set<string>();

  const pushParcel = (
    id: string,
    tags: Record<string, string>,
    geometry: GeoJsonPolygon | GeoJsonMultiPolygon,
    outerRing: [number, number][],
  ) => {
    if (seen.has(id)) return;
    // Filter obvious noise but be generous — dense urban buildings can be
    // large (apartments, condos) and we still want them as "homes".
    const area = ringAreaSqMeters(outerRing);
    if (area < 15) return; // sheds / map noise
    const c = centroidOfRing(outerRing);
    const address = formatOsmAddress(tags);
    const areaSqft = Math.round(area * 10.7639);
    parcels.push({
      id,
      headline: address ?? `Home #${id.replace(/^osm-\w-/, "")}`,
      address,
      owner: null,
      city: tags["addr:city"]?.trim() || null,
      areaSqft,
      lat: c.lat,
      lng: c.lng,
      geometry,
    });
    seen.add(id);
  };

  // Simple way-buildings (closed rings tagged building=*)
  for (const w of ways) {
    if (!w.tags?.building || !w.nodes || w.nodes.length < 3) continue;
    const ring = ringFromNodes(w.nodes, nodes);
    if (!ring) continue;
    const geom: GeoJsonPolygon = { type: "Polygon", coordinates: [ring] };
    pushParcel(`osm-w-${w.id}`, w.tags, geom, ring);
  }

  // Multipolygon relations (buildings with holes / complex shapes)
  for (const r of rels) {
    if (!r.tags?.building || !r.members) continue;
    const outerRings: [number, number][][] = [];
    for (const m of r.members) {
      if (m.type !== "way" || m.role !== "outer") continue;
      const way = waysById.get(m.ref);
      if (!way?.nodes) continue;
      const ring = ringFromNodes(way.nodes, nodes);
      if (ring) outerRings.push(ring);
    }
    if (outerRings.length === 0) continue;
    const geom: GeoJsonMultiPolygon = {
      type: "MultiPolygon",
      coordinates: outerRings.map((ring) => [ring]),
    };
    pushParcel(`osm-r-${r.id}`, r.tags, geom, outerRings[0]);
  }

  return parcels;
}

function bboxAround(lat: number, lng: number, radiusMeters: number) {
  const dLat = radiusMeters / 111_111;
  const dLng = radiusMeters / (111_111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return { south: lat - dLat, north: lat + dLat, west: lng - dLng, east: lng + dLng };
}

async function osmBuildingsNearPoint(
  lat: number,
  lng: number,
  radiusMeters: number,
  limit: number,
): Promise<DcadParcel[]> {
  const b = bboxAround(lat, lng, radiusMeters);
  const bbox = `${b.south},${b.west},${b.north},${b.east}`;
  const query = `[out:json][timeout:25];(way["building"](${bbox});relation["building"](${bbox}););out body;>;out skel qt;`;
  const elements = await runOverpass(query);
  const parcels = buildingsToParcels(elements);
  // Sort by distance and cap
  parcels.sort(
    (a, b2) =>
      Math.hypot(a.lng - lng, a.lat - lat) - Math.hypot(b2.lng - lng, b2.lat - lat),
  );
  return parcels.slice(0, Math.max(1, Math.min(500, limit)));
}

async function osmBuildingsInPolygon(
  polygon: GeoJsonPolygon,
  limit: number,
): Promise<DcadParcel[]> {
  const ring = polygon.coordinates[0];
  if (!ring || ring.length < 4) return [];
  const poly = ring.map(([lng, lat]) => `${lat} ${lng}`).join(" ");
  const query = `[out:json][timeout:25];(way["building"](poly:"${poly}");relation["building"](poly:"${poly}"););out body;>;out skel qt;`;
  const elements = await runOverpass(query);
  const parcels = buildingsToParcels(elements);
  return parcels.slice(0, Math.max(1, Math.min(500, limit)));
}

// -- Public server functions ---------------------------------------------

export const parcelsPointLookup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { lat: number; lng: number; radius?: number; limit?: number }) => data,
  )
  .handler(async ({ data }): Promise<ParcelLookupResult> => {
    const radius = Math.max(50, Math.min(2000, data.radius ?? 400));
    const limit = Math.max(1, Math.min(500, data.limit ?? 300));

    if (inDallasCounty(data.lat, data.lng)) {
      try {
        const dc = await dcadPointLookup({
          data: { lat: data.lat, lng: data.lng, radius, limit },
        });
        if (dc.parcels.length > 0) return { parcels: dc.parcels, source: "dcad" };
      } catch {
        /* fall through to OSM */
      }
    }

    const parcels = await osmBuildingsNearPoint(data.lat, data.lng, radius, limit);
    return { parcels, source: "osm" };
  });

export const parcelsPolygonLookup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { polygon: GeoJsonPolygon; limit?: number }) => data)
  .handler(async ({ data }): Promise<ParcelLookupResult> => {
    const limit = Math.max(1, Math.min(500, data.limit ?? 500));

    // Cheap check: is the centroid of the polygon inside Dallas County?
    const ring = data.polygon.coordinates[0] ?? [];
    let cx = 0;
    let cy = 0;
    for (const [lng, lat] of ring) {
      cx += lng;
      cy += lat;
    }
    const n = ring.length || 1;
    const centerLng = cx / n;
    const centerLat = cy / n;

    if (inDallasCounty(centerLat, centerLng)) {
      try {
        const dc = await dcadPolygonLookup({ data: { polygon: data.polygon, limit } });
        if (dc.parcels.length > 0) return { parcels: dc.parcels, source: "dcad" };
      } catch {
        /* fall through */
      }
    }

    const parcels = await osmBuildingsInPolygon(data.polygon, limit);
    return { parcels, source: "osm" };
  });