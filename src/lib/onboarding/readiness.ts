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
  const [{ count: parcels }, { count: roads }, { data: community }] = await Promise.all([
    supabase.from("parcels").select("*", { count: "exact", head: true }).eq("community_id", communityId),
    supabase.from("road_segments").select("*", { count: "exact", head: true }).eq("community_id", communityId),
    supabase.from("communities").select("cost_method").eq("id", communityId).maybeSingle(),
  ]);

  // Unresolved = parcels without an address AND not confirmed.
  const { count: unresolved } = await supabase
    .from("parcels")
    .select("*", { count: "exact", head: true })
    .eq("community_id", communityId)
    .is("address", null);

  const p = parcels ?? 0;
  const r = roads ?? 0;
  const hasCostMethod = Boolean(community?.cost_method);
  const reasons: string[] = [];
  if (p < 2) reasons.push(`Add at least 2 properties (you have ${p}).`);
  if (r < 1) reasons.push(`Add at least 1 road segment (you have ${r}).`);
  if (!hasCostMethod) reasons.push("Choose how costs should be split (community settings).");
  return { ok: reasons.length === 0, parcels: p, roads: r, hasCostMethod, unresolved: unresolved ?? 0, reasons };
}