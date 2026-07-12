import { supabase } from "@/integrations/supabase/client";
import { listCommunities, type Community } from "@/lib/community/api";

export type CommunityMetrics = {
  community: Community;
  parcels: number;
  verifiedParcels: number;
  roads: number;
  documents: number;
  clauses: number;
  decisions: number;
  openDecisions: number;
  surveys: number;
  projects: number;
  events: number;
};

async function count(table: string, communityId: string, extra?: (q: any) => any): Promise<number> {
  let q = supabase.from(table as any).select("id", { count: "exact", head: true }).eq("community_id", communityId);
  if (extra) q = extra(q);
  const { count: c, error } = await q;
  if (error) return 0;
  return c ?? 0;
}

export async function loadPortfolio(): Promise<CommunityMetrics[]> {
  const communities = await listCommunities();
  return Promise.all(
    communities.map(async (community): Promise<CommunityMetrics> => {
      const [
        parcels, verifiedParcels, roads, documents, clauses, decisions, openDecisions, surveys, projects, events,
      ] = await Promise.all([
        count("parcels", community.id),
        count("parcels", community.id, (q) => q.eq("verification", "verified")),
        count("road_segments", community.id),
        count("documents", community.id),
        count("clauses", community.id),
        count("decisions", community.id),
        count("decisions", community.id, (q) => q.in("status", ["discussion", "voting"])),
        count("surveys", community.id),
        count("projects", community.id),
        count("record_events", community.id),
      ]);
      return { community, parcels, verifiedParcels, roads, documents, clauses, decisions, openDecisions, surveys, projects, events };
    }),
  );
}

export type PortfolioTotals = {
  communities: number;
  parcels: number;
  roads: number;
  documents: number;
  openDecisions: number;
};

export function sumTotals(metrics: CommunityMetrics[]): PortfolioTotals {
  return metrics.reduce<PortfolioTotals>(
    (acc, m) => ({
      communities: acc.communities + 1,
      parcels: acc.parcels + m.parcels,
      roads: acc.roads + m.roads,
      documents: acc.documents + m.documents,
      openDecisions: acc.openDecisions + m.openDecisions,
    }),
    { communities: 0, parcels: 0, roads: 0, documents: 0, openDecisions: 0 },
  );
}

/** Full auditable export of a community's record as a JSON archive. */
export async function exportCommunityArchive(communityId: string): Promise<{ filename: string; json: string }> {
  const tables = [
    "communities", "parcels", "road_segments", "clauses", "documents",
    "surveys", "survey_responses", "decisions", "decision_votes",
    "projects", "qa_answers", "record_events",
  ] as const;

  const archive: Record<string, unknown> = {
    _meta: {
      generated_at: new Date().toISOString(),
      community_id: communityId,
      format: "roadshare.audit.v1",
      note: "Complete owner-scoped record export. Append-only history preserved.",
    },
  };

  for (const table of tables) {
    const col = table === "communities" ? "id" : "community_id";
    const { data, error } = await supabase.from(table as any).select("*").eq(col, communityId);
    archive[table] = error ? { error: error.message } : data ?? [];
  }

  // Project children link via project_id, not community_id.
  const projectIds = ((archive.projects as any[]) ?? []).map((p) => p.id).filter(Boolean);
  for (const child of ["project_line_items", "project_scenarios", "project_allocations"] as const) {
    if (projectIds.length === 0) { archive[child] = []; continue; }
    const { data, error } = await supabase.from(child as any).select("*").in("project_id", projectIds);
    archive[child] = error ? { error: error.message } : data ?? [];
  }

  const name = (archive.communities as any)?.[0]?.name ?? "community";
  const slug = String(name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return { filename: `${slug || "community"}-archive.json`, json: JSON.stringify(archive, null, 2) };
}

export function downloadArchive(filename: string, json: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
