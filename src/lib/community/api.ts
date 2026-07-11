import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Community = Database["public"]["Tables"]["communities"]["Row"];
export type Parcel = Database["public"]["Tables"]["parcels"]["Row"];
export type RoadSegment = Database["public"]["Tables"]["road_segments"]["Row"];
export type RecordEvent = Database["public"]["Tables"]["record_events"]["Row"];
export type Confidence = Database["public"]["Enums"]["confidence_level"];
export type Verification = Database["public"]["Enums"]["verification_status"];

export type Point = { x: number; y: number };

/** Canvas units are 0..100; treat the plat as ~1000 ft wide. */
export const FT_PER_UNIT = 10;

export function toPoints(geometry: unknown): Point[] {
  if (!Array.isArray(geometry)) return [];
  return geometry
    .filter((p): p is Point => !!p && typeof p === "object" && "x" in p && "y" in p)
    .map((p) => ({ x: Number(p.x), y: Number(p.y) }));
}

export function pathLengthFt(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return Math.round(total * FT_PER_UNIT);
}

async function unwrap<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>): Promise<T> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as T;
}

// ---------------- Communities ----------------

export async function listCommunities(): Promise<Community[]> {
  return unwrap(
    supabase.from("communities").select("*").order("created_at", { ascending: false }),
  );
}

export async function getCommunity(id: string): Promise<Community> {
  return unwrap(supabase.from("communities").select("*").eq("id", id).single());
}

export async function createCommunity(input: {
  name: string;
  region?: string;
  description?: string;
}): Promise<Community> {
  const community = await unwrap(
    supabase.from("communities").insert(input).select().single(),
  );
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

// ---------------- Parcels ----------------

export async function listParcels(communityId: string): Promise<Parcel[]> {
  return unwrap(
    supabase.from("parcels").select("*").eq("community_id", communityId).order("label"),
  );
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
  const parcel = await unwrap(
    supabase.from("parcels").update(input).eq("id", id).select().single(),
  );
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

// ---------------- Road segments ----------------

export async function listSegments(communityId: string): Promise<RoadSegment[]> {
  return unwrap(
    supabase.from("road_segments").select("*").eq("community_id", communityId).order("created_at"),
  );
}

export type SegmentInput = {
  name?: string;
  geometry?: Point[];
  surface?: string | null;
  responsibility?: string;
  source?: string | null;
  confidence?: Confidence;
  verification?: Verification;
};

export async function createSegment(communityId: string, input: SegmentInput): Promise<RoadSegment> {
  const geometry = input.geometry ?? [];
  const segment = await unwrap(
    supabase
      .from("road_segments")
      .insert({
        community_id: communityId,
        name: input.name ?? "New segment",
        geometry,
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
  const patch: Record<string, unknown> = { ...input };
  if (input.geometry) patch.length_ft = pathLengthFt(input.geometry);
  const segment = await unwrap(
    supabase.from("road_segments").update(patch).eq("id", id).select().single(),
  );
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