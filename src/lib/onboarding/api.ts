import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  createCommunity,
  createSegment,
  logEvent,
  type Community,
  type GeoJSONLineString,
  type ParcelInput,
  type Point,
} from "@/lib/community/api";
import { createParcel } from "@/lib/community/api";
import type { CcrDraft } from "./ccrDraft";

/** Auto-arrange N parcels in a grid on the 0..100 plat canvas. */
function gridPositions(count: number): Point[] {
  const cols = Math.max(2, Math.min(8, Math.ceil(Math.sqrt(count))));
  const rows = Math.ceil(count / cols);
  const marginX = 12;
  const marginY = 12;
  const spanX = 100 - marginX * 2;
  const spanY = 100 - marginY * 2;
  const dx = cols > 1 ? spanX / (cols - 1) : 0;
  const dy = rows > 1 ? spanY / (rows - 1) : 0;
  const out: Point[] = [];
  for (let i = 0; i < count; i++) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    out.push({ x: marginX + c * dx, y: marginY + r * dy });
  }
  return out;
}

/** Normalize lat/lng lots to 0..100 canvas positions. */
function mapBounds(lots: CcrDraft["lots"]) {
  const points = lots
    .map((l) => ({ lat: l.lat, lng: l.lng }))
    .filter((p): p is { lat: number; lng: number } => p.lat != null && p.lng != null);
  if (points.length < 2) return null;
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
  return { minLat, maxLat, minLng, maxLng };
}

/** Create a community + its parcels + its roads from a reviewed CCR draft. */
export async function applyCcrDraft(
  draft: CcrDraft,
  opts: { onProgress?: (done: number, total: number, phase: string) => void } = {},
): Promise<Community> {
  if (!draft.community.name.trim()) throw new Error("Community name is required");
  const total = draft.lots.length + Math.min(draft.roads.length, 20) + 1;
  let done = 0;
  const bump = (phase: string) => {
    done++;
    opts.onProgress?.(done, total, phase);
  };

  const community = await createCommunity({
    name: draft.community.name.trim(),
    region: draft.community.region ?? undefined,
    description: draft.community.description ?? undefined,
  });
  bump("Community created");

  // Bulk-insert all parcels in one round trip.
  if (draft.lots.length > 0) {
    const bounds = mapBounds(draft.lots);
    const grid = gridPositions(draft.lots.length);
    const rows = draft.lots.map((lot, i) => {
      let pos_x = grid[i].x;
      let pos_y = grid[i].y;
      if (bounds && lot.lat != null && lot.lng != null) {
        pos_x = 10 + ((lot.lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 80;
        pos_y = 10 + ((bounds.maxLat - lot.lat) / (bounds.maxLat - bounds.minLat)) * 80;
      }
      return {
        community_id: community.id,
        label: lot.label || `Lot ${i + 1}`,
        owner_name: lot.owner_name ?? null,
        address: lot.address ?? null,
        area_sqft: lot.area_sqft ?? null,
        frontage_ft: lot.frontage_ft ?? null,
        lat: lot.lat ?? null,
        lng: lot.lng ?? null,
        geojson: lot.geojson ?? null,
        pos_x,
        pos_y,
        confidence: "medium" as const,
        verification: "unverified" as const,
        source: "map selection",
      };
    });
    const { error } = await supabase.from("parcels").insert(rows);
    if (error) console.error("applyCcrDraft bulk parcels", error);
    done += draft.lots.length;
    opts.onProgress?.(done, total, `Added ${draft.lots.length} properties`);
  }

  // Persist roads with real geometry from the map, or a placeholder if none.
  const roads = draft.roads.slice(0, 20);
  for (let i = 0; i < roads.length; i++) {
    const rd = roads[i];
    const geometry: Point[] | GeoJSONLineString = rd.geometry ?? [
      { x: 10, y: 20 + (i * 60) / Math.max(1, roads.length - 1) },
      { x: 90, y: 20 + (i * 60) / Math.max(1, roads.length - 1) },
    ];
    try {
      await createSegment(community.id, {
        name: rd.name,
        responsibility: rd.responsibility,
        surface: rd.surface ?? undefined,
        geometry,
        confidence: "medium",
        verification: "unverified",
        source: rd.geometry ? "OpenStreetMap" : "CCR import",
      });
    } catch (err) {
      console.error("applyCcrDraft segment", rd.name, err);
    }
    bump(`Added road "${rd.name}"`);
  }

  await logEvent(community.id, {
    entity_type: "community",
    entity_label: community.name,
    action: "imported",
    note: `Created from map selection: ${draft.lots.length} lots, ${roads.length} roads.`,
  });

  return community;
}

/** Bulk-create parcels for an existing community from a parsed list. */
export async function bulkCreateParcels(
  communityId: string,
  parcels: ParcelInput[],
): Promise<number> {
  const positions = gridPositions(parcels.length);
  let created = 0;
  for (let i = 0; i < parcels.length; i++) {
    try {
      await createParcel(communityId, {
        ...parcels[i],
        pos_x: parcels[i].pos_x ?? positions[i].x,
        pos_y: parcels[i].pos_y ?? positions[i].y,
      });
      created++;
    } catch (err) {
      console.error("bulkCreateParcels", err);
    }
  }
  return created;
}

export type OnboardingState = Database["public"]["Tables"]["onboarding_state"]["Row"];

/** Minimum first-run setup, plus advanced workflow flags for dashboard prompts. */
export type ChecklistProgress = {
  community: boolean;
  parcels: boolean;
  roads: boolean;
  scenario: boolean;
  input: boolean;
  report: boolean;
  completed: number;
  total: number;
};

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Not authenticated");
  return data.user.id;
}

/** Fetch the signed-in user's onboarding row, creating a default row on first access. */
export async function getOnboardingState(): Promise<OnboardingState> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("onboarding_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (data) return data;

  const { data: created, error: insertError } = await supabase
    .from("onboarding_state")
    .insert({ user_id: userId })
    .select()
    .single();
  if (insertError) throw new Error(insertError.message);
  return created;
}

export type OnboardingPatch = Partial<
  Pick<
    OnboardingState,
    | "wizard_completed"
    | "wizard_skipped"
    | "checklist_dismissed"
    | "report_generated"
    | "dismissed_hints"
  >
>;

export async function updateOnboardingState(patch: OnboardingPatch): Promise<OnboardingState> {
  const userId = await currentUserId();
  // Ensure a row exists before updating.
  await getOnboardingState();
  const { data, error } = await supabase
    .from("onboarding_state")
    .update(patch)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
}

/** Add a hint id to the dismissed set (idempotent). */
export async function dismissHint(hintId: string): Promise<OnboardingState> {
  const state = await getOnboardingState();
  if (state.dismissed_hints.includes(hintId)) return state;
  return updateOnboardingState({
    dismissed_hints: [...state.dismissed_hints, hintId],
  });
}

async function count(
  table: "communities" | "parcels" | "road_segments" | "projects" | "surveys" | "decisions",
): Promise<number> {
  const { count: n, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });
  if (error) throw new Error(error.message);
  return n ?? 0;
}

/** Live, per-user counts for the dashboard stat cards. */
export type DashboardStats = {
  scenarios: number;
  parcels: number;
  documents: number;
  openDecisions: number;
  latestCommunity: string | null;
};

export async function getDashboardStats(): Promise<DashboardStats> {
  const [scenarios, parcels, docs, openDecisions, latest] = await Promise.all([
    count("projects"),
    count("parcels"),
    (async () => {
      const { count: n, error } = await supabase
        .from("documents")
        .select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return n ?? 0;
    })(),
    (async () => {
      const { count: n, error } = await supabase
        .from("decisions")
        .select("id", { count: "exact", head: true })
        .in("status", ["discussion", "voting"]);
      if (error) throw new Error(error.message);
      return n ?? 0;
    })(),
    (async () => {
      const { data, error } = await supabase
        .from("communities")
        .select("name")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data?.name ?? null;
    })(),
  ]);

  return {
    scenarios,
    parcels,
    documents: docs,
    openDecisions,
    latestCommunity: latest,
  };
}

/**
  * Derive setup completion from the user's real data. Scenarios, decisions,
  * and reports are advanced next actions, not onboarding gates.
 */
export async function getChecklistProgress(reportGenerated: boolean): Promise<ChecklistProgress> {
  const [communities, parcels, roads, projects, surveys, decisions] = await Promise.all([
    count("communities"),
    count("parcels"),
    count("road_segments"),
    count("projects"),
    count("surveys"),
    count("decisions"),
  ]);

  const flags = {
    community: communities > 0,
    parcels: parcels > 0,
    roads: roads > 0,
    scenario: projects > 0,
    input: surveys > 0 || decisions > 0,
    report: reportGenerated,
  };
  const completed = [flags.community, flags.parcels, flags.roads].filter(Boolean).length;
  return { ...flags, completed, total: 3 };
}