import type { Json } from "@/integrations/supabase/types";

export type CcrDraft = {
  community: {
    name: string;
    region: string | null;
    description: string | null;
  };
  lots: Array<{
    label: string;
    address?: string | null;
    owner_name?: string | null;
    area_sqft?: number | null;
    frontage_ft?: number | null;
    lat?: number | null;
    lng?: number | null;
    geojson?: Json | null;
    provenance?: "extracted" | "entered" | "confirmed" | "sample" | "unresolved";
    source_doc?: string | null;
    source_page?: number | null;
  }>;
  roads: Array<{
    name: string;
    responsibility: "shared" | "private" | "public" | "association";
    surface?: string | null;
    provenance?: "extracted" | "entered" | "confirmed" | "sample" | "unresolved";
    has_geometry?: boolean;
    geometry?: { type: "LineString"; coordinates: [number, number][] } | null;
  }>;
  maintenance_summary: string | null;
  assessment_formula: string | null;
  meta?: {
    community_found?: boolean;
    region_found?: boolean;
    addresses_found?: number;
    lot_refs_found?: number;
    roads_found?: number;
    maintenance_found?: boolean;
    formula_found?: boolean;
    missing_exhibits?: string[];
    documents_processed?: number;
  };
};

export const EMPTY_CCR_DRAFT: CcrDraft = {
  community: { name: "", region: null, description: null },
  lots: [],
  roads: [],
  maintenance_summary: null,
  assessment_formula: null,
};

export function coerceCcrDraft(raw: unknown): CcrDraft {
  if (!raw || typeof raw !== "object") return EMPTY_CCR_DRAFT;
  const r = raw as Record<string, unknown>;
  const community = (r.community ?? {}) as Record<string, unknown>;
  const rawLots = Array.isArray(r.lots) ? r.lots : [];
  const rawRoads = Array.isArray(r.roads) ? r.roads : [];

  const str = (v: unknown, max = 200): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t ? t.slice(0, max) : null;
  };
  const num = (v: unknown): number | null => {
    if (v == null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  return {
    community: {
      name: str(community.name, 160) ?? "",
      region: str(community.region, 160),
      description: str(community.description, 800),
    },
    lots: rawLots
      .slice(0, 250)
      .map((l): CcrDraft["lots"][number] | null => {
        if (!l || typeof l !== "object") return null;
        const lot = l as Record<string, unknown>;
        const label = str(lot.label ?? lot.number ?? lot.id ?? lot.lot, 60);
        if (!label) return null;
        return {
          label,
          address: str(lot.address, 200),
          owner_name: str(lot.owner_name ?? lot.owner, 160),
          area_sqft: num(lot.area_sqft ?? lot.area),
          frontage_ft: num(lot.frontage_ft ?? lot.frontage),
        };
      })
      .filter((x): x is CcrDraft["lots"][number] => x !== null),
    roads: rawRoads
      .slice(0, 60)
      .map((rd): CcrDraft["roads"][number] | null => {
        if (!rd || typeof rd !== "object") return null;
        const road = rd as Record<string, unknown>;
        const name = str(road.name, 160);
        if (!name) return null;
        const resp = String(road.responsibility ?? "shared").toLowerCase();
        const responsibility: CcrDraft["roads"][number]["responsibility"] =
          resp === "private" || resp === "public" || resp === "association" ? resp : "shared";
        return {
          name,
          responsibility,
          surface: str(road.surface, 80),
        };
      })
      .filter((x): x is CcrDraft["roads"][number] => x !== null),
    maintenance_summary: str(r.maintenance_summary, 1200),
    assessment_formula: str(r.assessment_formula, 600),
  };
}

export function buildManualCcrDraft(input: {
  name: string;
  region?: string;
  description?: string;
  lotText?: string;
  roadText?: string;
}): CcrDraft {
  const lines = (value?: string) =>
    (value ?? "")
      .split(/[\n,]+/)
      .map((line) => line.trim())
      .filter(Boolean);

  return {
    community: {
      name: input.name.trim(),
      region: input.region?.trim() || null,
      description: input.description?.trim() || null,
    },
    lots: lines(input.lotText).slice(0, 250).map((label) => ({ label })),
    roads: lines(input.roadText).slice(0, 60).map((name) => ({ name, responsibility: "shared" })),
    maintenance_summary: null,
    assessment_formula: null,
  };
}