import { supabase } from "@/integrations/supabase/client";

/** Soft-gating readiness per plan §14. Returns why an action is blocked, if so. */
export type Readiness = {
  ok: boolean;
  parcels: number;
  roads: number;
  hasCostMethod: boolean;
  unresolved: number;
  reasons: string[];
};

export async function checkScenarioReadiness(communityId: string): Promise<Readiness> {
  const [parcelsRes, roadsRes, unresolvedRes] = await Promise.all([
    supabase.from("parcels").select("*", { count: "exact", head: true }).eq("community_id", communityId),
    supabase.from("road_segments").select("*", { count: "exact", head: true }).eq("community_id", communityId),
    supabase.from("parcels").select("*", { count: "exact", head: true }).eq("community_id", communityId).is("address", null),
  ]);

  const p = parcelsRes.count ?? 0;
  const r = roadsRes.count ?? 0;
  // Cost method lives on projects (allocation_method) — chosen at project-creation time.
  const hasCostMethod = true;
  const reasons: string[] = [];
  if (p < 2) reasons.push(`Add at least 2 properties (you have ${p}).`);
  if (r < 1) reasons.push(`Add at least 1 road segment (you have ${r}).`);
  return { ok: reasons.length === 0, parcels: p, roads: r, hasCostMethod, unresolved: unresolvedRes.count ?? 0, reasons };
}