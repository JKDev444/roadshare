import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

export type Community = Database["public"]["Tables"]["communities"]["Row"];
export type Parcel = Database["public"]["Tables"]["parcels"]["Row"];
export type RoadSegment = Database["public"]["Tables"]["road_segments"]["Row"];
export type RecordEvent = Database["public"]["Tables"]["record_events"]["Row"];
export type Confidence = Database["public"]["Enums"]["confidence_level"];
export type Verification = Database["public"]["Enums"]["verification_status"];

export type Point = { x: number; y: number };
export type GeoJSONLineString = { type: "LineString"; coordinates: [number, number][] };
export type GeoJSONPolygon = { type: "Polygon"; coordinates: number[][][] };

/** Canvas units are 0..100; treat the plat as ~1000 ft wide. */
export const FT_PER_UNIT = 10;

const RADIUS_FT = 20_925_000; // approximate Earth radius in feet

function toRadians(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Haversine distance in feet between two lat/lng points. */
export function haversineFt(a: [number, number], b: [number, number]): number {
  const dLat = toRadians(b[1] - a[1]);
  const dLng = toRadians(b[0] - a[0]);
  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * RADIUS_FT * Math.asin(Math.sqrt(h));
}

export function isGeoJSONLineString(geometry: unknown): geometry is GeoJSONLineString {
  return (
    !!geometry &&
    typeof geometry === "object" &&
    (geometry as GeoJSONLineString).type === "LineString" &&
    Array.isArray((geometry as GeoJSONLineString).coordinates)
  );
}

function coordinateLooksLikeLegacyPlat(coordinate: unknown[]): boolean {
  const lng = Number(coordinate[0]);
  const lat = Number(coordinate[1]);
  return Number.isFinite(lng) && Number.isFinite(lat) && lng >= 0 && lng <= 100 && lat >= 0 && lat <= 100;
}

function lineStringUsesLegacyPlatCoordinates(geometry: GeoJSONLineString): boolean {
  return geometry.coordinates.length > 0 && geometry.coordinates.every(coordinateLooksLikeLegacyPlat);
}

export function isGeoJSONPolygon(geometry: unknown): geometry is GeoJSONPolygon {
  return (
    !!geometry &&
    typeof geometry === "object" &&
    (geometry as GeoJSONPolygon).type === "Polygon" &&
    Array.isArray((geometry as GeoJSONPolygon).coordinates)
  );
}

function polygonUsesLegacyPlatCoordinates(geometry: GeoJSONPolygon): boolean {
  const ring = geometry.coordinates[0] ?? [];
  return ring.length > 0 && ring.every(coordinateLooksLikeLegacyPlat);
}

function remapLegacyPolygon(geometry: GeoJSONPolygon): GeoJSONPolygon {
  return {
    type: "Polygon",
    coordinates: geometry.coordinates.map((ring) => ring.map(([x, y]) => legacyPointToLngLat({ x: Number(x), y: Number(y) }))),
  };
}

export function toPoints(geometry: unknown): Point[] {
  if (!Array.isArray(geometry)) return [];
  return geometry
    .filter((p): p is Point => !!p && typeof p === "object" && "x" in p && "y" in p)
    .map((p) => ({ x: Number(p.x), y: Number(p.y) }));
}

export function lineStringToPoints(geometry: unknown): Point[] {
  if (!isGeoJSONLineString(geometry)) return [];
  return geometry.coordinates.map(([lng, lat]) => ({ x: lng, y: lat }));
}

export function pathLengthFt(geometry: Point[] | GeoJSONLineString | unknown): number {
  if (isGeoJSONLineString(geometry)) {
    let total = 0;
    for (let i = 1; i < geometry.coordinates.length; i++) {
      total += haversineFt(geometry.coordinates[i - 1], geometry.coordinates[i]);
    }
    return Math.round(total);
  }
  const points = Array.isArray(geometry) ? (geometry as Point[]) : toPoints(geometry);
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return Math.round(total * FT_PER_UNIT);
}

/** Convert a road segment to a GeoJSON Feature for the map. */
export function segmentToFeature(
  seg: RoadSegment,
): {
  type: "Feature";
  geometry: GeoJSONLineString;
  properties: Record<string, unknown>;
} | null {
  if (isGeoJSONLineString(seg.geometry)) {
    return {
      type: "Feature",
      geometry: lineStringUsesLegacyPlatCoordinates(seg.geometry)
        ? { type: "LineString", coordinates: seg.geometry.coordinates.map(([x, y]) => legacyPointToLngLat({ x: Number(x), y: Number(y) })) }
        : seg.geometry,
      properties: { id: seg.id, name: seg.name, surface: seg.surface, responsibility: seg.responsibility },
    };
  }
  const pts = toPoints(seg.geometry);
  if (pts.length < 2) return null;
  return {
    type: "Feature",
    geometry: { type: "LineString", coordinates: pts.map(legacyPointToLngLat) },
    properties: { id: seg.id, name: seg.name, surface: seg.surface, responsibility: seg.responsibility },
  };
}

const DEFAULT_SQUARE_OFFSET = 0.00008; // roughly 25 ft in degrees
const LEGACY_CENTER_LNG = -120.95;
const LEGACY_CENTER_LAT = 39.08;
const LEGACY_UNIT_DEGREES = 0.00018;

function legacyPointToLngLat(point: Point): [number, number] {
  return [LEGACY_CENTER_LNG + (point.x - 50) * LEGACY_UNIT_DEGREES, LEGACY_CENTER_LAT + (50 - point.y) * LEGACY_UNIT_DEGREES];
}

/** Convert a parcel to a GeoJSON Feature for the map. */
export function parcelToFeature(p: Parcel): {
  type: "Feature";
  geometry: GeoJSONPolygon;
  properties: Record<string, unknown>;
} | null {
  if (isGeoJSONPolygon(p.geojson)) {
    return {
      type: "Feature",
      geometry: polygonUsesLegacyPlatCoordinates(p.geojson) ? remapLegacyPolygon(p.geojson) : p.geojson,
      properties: { id: p.id, label: p.label, selected: false },
    };
  }
  const lat = p.lat ?? p.pos_y ?? 0;
  const lng = p.lng ?? p.pos_x ?? 0;
  if (lat === 0 && lng === 0) return null;
  if (p.lat == null && p.lng == null && p.pos_x != null && p.pos_y != null) {
    const [legacyLng, legacyLat] = legacyPointToLngLat({ x: p.pos_x, y: p.pos_y });
    const o = DEFAULT_SQUARE_OFFSET;
    return {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [legacyLng - o, legacyLat - o],
            [legacyLng + o, legacyLat - o],
            [legacyLng + o, legacyLat + o],
            [legacyLng - o, legacyLat + o],
            [legacyLng - o, legacyLat - o],
          ],
        ],
      },
      properties: { id: p.id, label: p.label, selected: false },
    };
  }
  const o = DEFAULT_SQUARE_OFFSET;
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [lng - o, lat - o],
          [lng + o, lat - o],
          [lng + o, lat + o],
          [lng - o, lat + o],
          [lng - o, lat - o],
        ],
      ],
    },
    properties: { id: p.id, label: p.label, selected: false },
  };
}

/** Serialize road segments to a GeoJSON FeatureCollection. */
export function segmentsToGeoJSON(
  community: Pick<Community, "name" | "region"> | null,
  segments: RoadSegment[],
) {
  return {
    type: "FeatureCollection" as const,
    name: community?.name ?? "RoadShare export",
    metadata: {
      community: community?.name ?? null,
      region: community?.region ?? null,
      generated_at: new Date().toISOString(),
      coordinate_note: "WGS84 for real geometry; local plat units (0-100) for legacy segments.",
    },
    features: segments.map((seg) => segmentToFeature(seg)).filter((f): f is NonNullable<typeof f> => f !== null),
  };
}

/** Trigger a browser download of the community's road geometry as GeoJSON. */
export function downloadGeoJSON(community: Pick<Community, "name" | "region"> | null, segments: RoadSegment[]) {
  const json = JSON.stringify(segmentsToGeoJSON(community, segments), null, 2);
  const blob = new Blob([json], { type: "application/geo+json" });
  const url = URL.createObjectURL(blob);
  const slug = (community?.name ?? "roadshare")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug || "roadshare"}-roads.geojson`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function unwrap<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

// ---------------- Communities ----------------

export async function listCommunities(): Promise<Community[]> {
  return unwrap(supabase.from("communities").select("*").order("created_at", { ascending: false }));
}

export async function getCommunity(id: string): Promise<Community> {
  return unwrap(supabase.from("communities").select("*").eq("id", id).single());
}

export async function createCommunity(input: {
  name: string;
  region?: string;
  description?: string;
}): Promise<Community> {
  const community = await unwrap(supabase.from("communities").insert(input).select().single());
  await logEvent(community.id, {
    entity_type: "community",
    entity_label: community.name,
    action: "created",
    note: "Community record established.",
  });
  return community;
}

export async function deleteCommunity(id: string): Promise<void> {
  const { error } = await supabase.from("communities").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

/**
 * Wipe every community owned by the current signed-in user. Used by the
 * "roadshare" easter egg to give testers a fresh onboarding start.
 * RLS scopes the delete to the caller's own rows; parcels / road_segments /
 * events cascade via foreign keys.
 */
export async function deleteAllCommunities(): Promise<number> {
  const list = await listCommunities();
  for (const c of list) {
    const { error } = await supabase.from("communities").delete().eq("id", c.id);
    if (error) throw new Error(error.message);
  }
  return list.length;
}

// ---------------- Parcels ----------------

export async function listParcels(communityId: string): Promise<Parcel[]> {
  return unwrap(supabase.from("parcels").select("*").eq("community_id", communityId).order("label"));
}

export type ParcelInput = Partial<
  Pick<
    Parcel,
    | "label"
    | "owner_name"
    | "address"
    | "area_sqft"
    | "frontage_ft"
    | "pos_x"
    | "pos_y"
    | "lat"
    | "lng"
    | "geojson"
    | "source"
    | "confidence"
    | "verification"
    | "effective_date"
  >
>;

export async function createParcel(communityId: string, input: ParcelInput): Promise<Parcel> {
  const parcel = await unwrap(
    supabase
      .from("parcels")
      .insert({ ...input, label: input.label ?? "New parcel", community_id: communityId })
      .select()
      .single(),
  );
  await logEvent(communityId, {
    entity_type: "parcel",
    entity_label: parcel.label,
    action: "created",
  });
  return parcel;
}

export async function updateParcel(
  id: string,
  communityId: string,
  input: ParcelInput,
  { silent }: { silent?: boolean } = {},
): Promise<Parcel> {
  const parcel = await unwrap(supabase.from("parcels").update(input).eq("id", id).select().single());
  if (!silent) {
    await logEvent(communityId, {
      entity_type: "parcel",
      entity_label: parcel.label,
      action: "updated",
    });
  }
  return parcel;
}

export async function deleteParcel(id: string, communityId: string, label: string): Promise<void> {
  const { error } = await supabase.from("parcels").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logEvent(communityId, { entity_type: "parcel", entity_label: label, action: "removed" });
}

/** Compute a bounding box from real parcel lat/lng coordinates. */
export function boundsFromParcels(parcels: Pick<Parcel, "lat" | "lng">[]): { sw: [number, number]; ne: [number, number] } | null {
  const points = parcels
    .map((p) => ({ lat: p.lat, lng: p.lng }))
    .filter((p): p is { lat: number; lng: number } => p.lat != null && p.lng != null);
  if (points.length === 0) return null;
  let minLat = points[0].lat;
  let maxLat = points[0].lat;
  let minLng = points[0].lng;
  let maxLng = points[0].lng;
  for (const p of points) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  return { sw: [minLng, minLat], ne: [maxLng, maxLat] };
}

// ---------------- Road segments ----------------

export async function listSegments(communityId: string): Promise<RoadSegment[]> {
  return unwrap(
    supabase.from("road_segments").select("*").eq("community_id", communityId).order("created_at"),
  );
}

export type SegmentInput = {
  name?: string;
  geometry?: Point[] | GeoJSONLineString;
  surface?: string | null;
  responsibility?: string;
  source?: string | null;
  confidence?: Confidence;
  verification?: Verification;
};

export async function createSegment(communityId: string, input: SegmentInput): Promise<RoadSegment> {
  const geometry = input.geometry ?? ([] as Point[]);
  const segment = await unwrap(
    supabase
      .from("road_segments")
      .insert({
        community_id: communityId,
        name: input.name ?? "New segment",
        geometry: geometry as Json,
        length_ft: pathLengthFt(geometry),
        surface: input.surface,
        responsibility: input.responsibility ?? "shared",
        source: input.source,
        confidence: input.confidence,
        verification: input.verification,
      })
      .select()
      .single(),
  );
  await logEvent(communityId, {
    entity_type: "road",
    entity_label: segment.name,
    action: "drawn",
  });
  return segment;
}

export async function updateSegment(
  id: string,
  communityId: string,
  input: SegmentInput,
  { silent }: { silent?: boolean } = {},
): Promise<RoadSegment> {
  const patch: Database["public"]["Tables"]["road_segments"]["Update"] = {
    name: input.name,
    surface: input.surface,
    responsibility: input.responsibility,
    source: input.source,
    confidence: input.confidence,
    verification: input.verification,
    geometry: input.geometry as Json | undefined,
  };
  if (input.geometry) patch.length_ft = pathLengthFt(input.geometry);
  const segment = await unwrap(supabase.from("road_segments").update(patch).eq("id", id).select().single());
  if (!silent) {
    await logEvent(communityId, {
      entity_type: "road",
      entity_label: segment.name,
      action: "edited",
    });
  }
  return segment;
}

export async function deleteSegment(id: string, communityId: string, name: string): Promise<void> {
  const { error } = await supabase.from("road_segments").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logEvent(communityId, { entity_type: "road", entity_label: name, action: "removed" });
}

// ---------------- Provenance ----------------

export async function listEvents(communityId: string): Promise<RecordEvent[]> {
  return unwrap(
    supabase
      .from("record_events")
      .select("*")
      .eq("community_id", communityId)
      .order("created_at", { ascending: false })
      .limit(200),
  );
}

export async function logEvent(
  communityId: string,
  input: { entity_type: string; entity_label?: string | null; action: string; note?: string },
): Promise<void> {
  const { error } = await supabase.from("record_events").insert({
    community_id: communityId,
    entity_type: input.entity_type,
    entity_label: input.entity_label ?? null,
    action: input.action,
    note: input.note ?? null,
  });
  if (error) console.error("logEvent", error.message);
}

// ---------------- Sample data ----------------

export async function seedCedarHollow(): Promise<Community> {
  const community = await createCommunity({
    name: "Cedar Hollow Road",
    region: "Sample · Placer County, CA",
    description:
      "A 14-lot private-road community used to demonstrate the RoadShare record. Parcels, owners, and geometry are illustrative placeholders.",
  });

  const parcels: ParcelInput[] = [
    { label: "101", owner_name: "M. Alvarez", address: "101 Cedar Hollow Ln", area_sqft: 43560, frontage_ft: 120, pos_x: 12, pos_y: 72, confidence: "high", verification: "verified", source: "County parcel viewer" },
    { label: "102", owner_name: "R. Chen", address: "102 Cedar Hollow Ln", area_sqft: 41000, frontage_ft: 110, pos_x: 12, pos_y: 52, confidence: "high", verification: "verified", source: "County parcel viewer" },
    { label: "105", owner_name: "T. Okafor", address: "105 Cedar Hollow Ln", area_sqft: 44500, frontage_ft: 125, pos_x: 27, pos_y: 72, confidence: "high", verification: "verified", source: "County parcel viewer" },
    { label: "106", owner_name: "S. Patel", address: "106 Cedar Hollow Ln", area_sqft: 40200, frontage_ft: 108, pos_x: 27, pos_y: 52, confidence: "medium", verification: "unverified", source: "Owner statement" },
    { label: "109", owner_name: "J. Nguyen", address: "109 Cedar Hollow Ln", area_sqft: 46000, frontage_ft: 130, pos_x: 42, pos_y: 72, confidence: "high", verification: "verified", source: "County parcel viewer" },
    { label: "110", owner_name: "D. Brooks", address: "110 Cedar Hollow Ln", area_sqft: 39800, frontage_ft: 105, pos_x: 42, pos_y: 52, confidence: "medium", verification: "unverified", source: "Owner statement" },
    { label: "113", owner_name: "K. Larsen", address: "113 Cedar Hollow Ln", area_sqft: 47500, frontage_ft: 135, pos_x: 57, pos_y: 72, confidence: "medium", verification: "disputed", source: "Conflicting deed" },
    { label: "205", owner_name: "A. Rossi", address: "205 Ridge Rd", area_sqft: 42000, frontage_ft: 115, pos_x: 72, pos_y: 72, confidence: "high", verification: "verified", source: "County parcel viewer" },
    { label: "206", owner_name: "L. Meyer", address: "206 Ridge Rd", area_sqft: 43000, frontage_ft: 118, pos_x: 72, pos_y: 52, confidence: "medium", verification: "unverified", source: "Owner statement" },
    { label: "209", owner_name: "P. Silva", address: "209 Ridge Rd", area_sqft: 41500, frontage_ft: 112, pos_x: 86, pos_y: 72, confidence: "high", verification: "verified", source: "County parcel viewer" },
    { label: "222", owner_name: "G. Ford", address: "222 Ridge Rd", area_sqft: 45000, frontage_ft: 128, pos_x: 92, pos_y: 66, confidence: "low", verification: "unverified", source: "Estimated" },
    { label: "301", owner_name: "H. Kim", address: "301 Summit Ct", area_sqft: 40800, frontage_ft: 109, pos_x: 64, pos_y: 36, confidence: "high", verification: "verified", source: "County parcel viewer" },
    { label: "302", owner_name: "C. Weber", address: "302 Summit Ct", area_sqft: 39500, frontage_ft: 104, pos_x: 50, pos_y: 36, confidence: "medium", verification: "unverified", source: "Owner statement" },
    { label: "305", owner_name: "V. Costa", address: "305 Summit Ct", area_sqft: 44000, frontage_ft: 122, pos_x: 64, pos_y: 20, confidence: "medium", verification: "unverified", source: "Owner statement" },
  ];

  const rows = parcels.map((p) => ({ ...p, community_id: community.id, label: p.label! }));
  const { error: pErr } = await supabase.from("parcels").insert(rows);
  if (pErr) throw new Error(pErr.message);

  const segments: SegmentInput[] = [
    {
      name: "Cedar Hollow Ln (main)",
      responsibility: "shared",
      surface: "2\" asphalt",
      confidence: "high",
      verification: "verified",
      source: "Field survey",
      geometry: [
        { x: 6, y: 62 },
        { x: 64, y: 62 },
      ],
    },
    {
      name: "Summit Ct spur",
      responsibility: "shared",
      surface: "Chip seal",
      confidence: "medium",
      verification: "unverified",
      source: "Owner statement",
      geometry: [
        { x: 64, y: 62 },
        { x: 64, y: 14 },
      ],
    },
    {
      name: "Ridge Rd connector",
      responsibility: "private",
      surface: "Gravel",
      confidence: "low",
      verification: "disputed",
      source: "Estimated",
      geometry: [
        { x: 64, y: 62 },
        { x: 94, y: 62 },
      ],
    },
  ];

  const segRows = segments.map((s) => ({
    community_id: community.id,
    name: s.name!,
    geometry: s.geometry ?? [],
    length_ft: pathLengthFt(s.geometry ?? []),
    surface: s.surface,
    responsibility: s.responsibility ?? "shared",
    source: s.source,
    confidence: s.confidence,
    verification: s.verification,
  }));
  const { error: sErr } = await supabase.from("road_segments").insert(segRows);
  if (sErr) throw new Error(sErr.message);

  await logEvent(community.id, {
    entity_type: "community",
    entity_label: community.name,
    action: "seeded",
    note: "Imported 14 sample parcels and 3 road segments.",
  });

  return community;
}
