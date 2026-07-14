import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  createCommunity,
  createParcel,
  createSegment,
  logEvent,
  type Community,
  type ParcelInput,
  type Point,
} from "@/lib/community/api";
import type { CcrDraft } from "./extractCcr.functions";

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

/** Create a community + its parcels + its roads from a reviewed CCR draft. */
export async function applyCcrDraft(draft: CcrDraft): Promise<Community> {
  if (!draft.community.name.trim()) throw new Error("Community name is required");

  const community = await createCommunity({
    name: draft.community.name.trim(),
    region: draft.community.region ?? undefined,
    description: draft.community.description ?? undefined,
  });

  const positions = gridPositions(draft.lots.length);
  for (let i = 0; i < draft.lots.length; i++) {
    const lot = draft.lots[i];
    const pos = positions[i];
    const input: ParcelInput = {
      label: lot.label,
      owner_name: lot.owner_name ?? undefined,
      address: lot.address ?? undefined,
      area_sqft: lot.area_sqft ?? undefined,
      frontage_ft: lot.frontage_ft ?? undefined,
      pos_x: pos.x,
      pos_y: pos.y,
      confidence: "medium",
      verification: "unverified",
      source: "CCR import",
    };
    // Best-effort: continue on error rather than aborting.
    try {
      await createParcel(community.id, input);
    } catch (err) {
      console.error("applyCcrDraft parcel", input.label, err);
    }
  }

  // Give each named road a placeholder centerline so it appears on the map.
  // The user refines geometry in the map editor.
  const roads = draft.roads.slice(0, 20);
  for (let i = 0; i < roads.length; i++) {
    const y = 20 + (i * 60) / Math.max(1, roads.length - 1);
    try {
      await createSegment(community.id, {
        name: roads[i].name,
        responsibility: roads[i].responsibility,
        surface: roads[i].surface ?? undefined,
        geometry: [
          { x: 10, y },
          { x: 90, y },
        ],
        confidence: "medium",
        verification: "unverified",
        source: "CCR import",
      });
    } catch (err) {
      console.error("applyCcrDraft segment", roads[i].name, err);
    }
  }

  await logEvent(community.id, {
    entity_type: "community",
    entity_label: community.name,
    action: "imported",
    note: `AI-imported from CCR: ${draft.lots.length} lots, ${roads.length} roads.`,
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

/** The six stages of the RoadShare workflow, tracked on the dashboard checklist. */
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
 * Derive checklist completion live from the user's real data (RLS scopes each
 * count to rows the user can see) plus the persisted report flag.
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
  const completed = Object.values(flags).filter(Boolean).length;
  return { ...flags, completed, total: 6 };
}