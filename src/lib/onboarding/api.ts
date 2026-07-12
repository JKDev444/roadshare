import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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