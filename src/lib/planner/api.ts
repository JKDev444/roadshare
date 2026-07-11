import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Parcel } from "@/lib/community/api";
import { logEvent } from "@/lib/community/api";

export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type LineItem = Database["public"]["Tables"]["project_line_items"]["Row"];
export type Allocation = Database["public"]["Tables"]["project_allocations"]["Row"];
export type AllocationMethod = Database["public"]["Enums"]["allocation_method"];
export type ProjectStatus = Database["public"]["Enums"]["project_status"];

export const ALLOCATION_METHODS: { value: AllocationMethod; label: string; blurb: string }[] = [
  { value: "equal", label: "Equal share", blurb: "Every benefiting parcel pays the same amount." },
  { value: "frontage", label: "By road frontage", blurb: "Proportional to each parcel's frontage in feet." },
  { value: "area", label: "By lot area", blurb: "Proportional to each parcel's area in square feet." },
  { value: "segment_benefit", label: "By benefit weight", blurb: "Proportional to a per-parcel benefit weight you set." },
  { value: "base_plus_use", label: "Base + use", blurb: "A flat base per parcel, remainder split by weight." },
  { value: "distance", label: "By distance from entrance", blurb: "Proportional to how far each parcel sits from the community entrance." },
  { value: "custom", label: "Custom weights", blurb: "Full control: weights and fixed overrides per parcel." },
];

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: "Planning",
  bidding: "Bidding",
  funded: "Funded",
  complete: "Complete",
};

async function unwrap<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

// ---------------- Projects ----------------
export async function listProjects(communityId: string): Promise<Project[]> {
  return unwrap(supabase.from("projects").select("*").eq("community_id", communityId).order("created_at", { ascending: false }));
}
export async function getProject(id: string): Promise<Project> {
  return unwrap(supabase.from("projects").select("*").eq("id", id).single());
}

export type ProjectInput = Partial<
  Pick<Project, "name" | "description" | "status" | "total_cost" | "contingency_pct" | "reserve_target" | "base_amount" | "allocation_method" | "notes" | "entrance_x" | "entrance_y">
>;

export async function createProject(communityId: string, input: ProjectInput): Promise<Project> {
  const project = await unwrap(
    supabase.from("projects").insert({ ...input, name: input.name ?? "New project", community_id: communityId }).select().single(),
  );
  await logEvent(communityId, { entity_type: "project", entity_label: project.name, action: "created" });
  return project;
}
export async function updateProject(id: string, communityId: string, input: ProjectInput, { silent }: { silent?: boolean } = {}): Promise<Project> {
  const project = await unwrap(supabase.from("projects").update(input).eq("id", id).select().single());
  if (!silent) await logEvent(communityId, { entity_type: "project", entity_label: project.name, action: "updated" });
  return project;
}
export async function deleteProject(id: string, communityId: string, name: string): Promise<void> {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logEvent(communityId, { entity_type: "project", entity_label: name, action: "removed" });
}

// ---------------- Line items ----------------
export async function listLineItems(projectId: string): Promise<LineItem[]> {
  return unwrap(supabase.from("project_line_items").select("*").eq("project_id", projectId).order("created_at"));
}
export type LineItemInput = Partial<Pick<LineItem, "label" | "category" | "amount" | "is_bid" | "contractor">>;
export async function createLineItem(projectId: string, input: LineItemInput): Promise<LineItem> {
  return unwrap(
    supabase.from("project_line_items").insert({ ...input, label: input.label ?? "New item", amount: input.amount ?? 0, project_id: projectId }).select().single(),
  );
}
export async function deleteLineItem(id: string): Promise<void> {
  const { error } = await supabase.from("project_line_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------- Allocations ----------------
export async function listAllocations(projectId: string): Promise<Allocation[]> {
  return unwrap(supabase.from("project_allocations").select("*").eq("project_id", projectId));
}
export type AllocationInput = { weight?: number; override_amount?: number | null; benefits?: boolean };
export async function upsertAllocation(projectId: string, parcelId: string, input: AllocationInput): Promise<Allocation> {
  return unwrap(
    supabase
      .from("project_allocations")
      .upsert({ project_id: projectId, parcel_id: parcelId, ...input }, { onConflict: "project_id,parcel_id" })
      .select()
      .single(),
  );
}

// ---------------- Allocation engine ----------------
export function fundingTarget(project: Pick<Project, "total_cost" | "contingency_pct" | "reserve_target">): number {
  const base = Number(project.total_cost) || 0;
  const contingency = base * ((Number(project.contingency_pct) || 0) / 100);
  return base + contingency + (Number(project.reserve_target) || 0);
}

export type AllocationRow = {
  parcel: Parcel;
  benefits: boolean;
  weight: number;
  override: number | null;
  amount: number;
  share: number; // 0..1 of total target
};

/** Pure allocation computation. Returns per-parcel dollar amounts for the project. */
export function computeAllocations(
  project: Pick<Project, "total_cost" | "contingency_pct" | "reserve_target" | "base_amount" | "allocation_method" | "entrance_x" | "entrance_y">,
  parcels: Parcel[],
  allocations: Allocation[],
): { rows: AllocationRow[]; target: number; allocated: number; unallocated: number } {
  const target = fundingTarget(project);
  const byParcel = new Map(allocations.map((a) => [a.parcel_id, a]));

  const rows: AllocationRow[] = parcels.map((parcel) => {
    const a = byParcel.get(parcel.id);
    return {
      parcel,
      benefits: a ? a.benefits : true,
      weight: a ? Number(a.weight) : 1,
      override: a && a.override_amount != null ? Number(a.override_amount) : null,
      amount: 0,
      share: 0,
    };
  });

  const benefiting = rows.filter((r) => r.benefits);

  // Fixed overrides come out of the pool first.
  const overridden = benefiting.filter((r) => r.override != null);
  const overrideTotal = overridden.reduce((s, r) => s + (r.override ?? 0), 0);
  overridden.forEach((r) => (r.amount = r.override ?? 0));

  const pool = Math.max(0, target - overrideTotal);
  const distributable = benefiting.filter((r) => r.override == null);
  const method = project.allocation_method;

  function weightOf(r: AllocationRow): number {
    switch (method) {
      case "equal":
        return 1;
      case "frontage":
        return Number(r.parcel.frontage_ft) || 0;
      case "area":
        return Number(r.parcel.area_sqft) || 0;
      case "distance": {
        const ex = project.entrance_x != null ? Number(project.entrance_x) : 50;
        const ey = project.entrance_y != null ? Number(project.entrance_y) : 92;
        const dx = (Number(r.parcel.pos_x) || 0) - ex;
        const dy = (Number(r.parcel.pos_y) || 0) - ey;
        return Math.sqrt(dx * dx + dy * dy);
      }
      case "segment_benefit":
      case "custom":
      case "base_plus_use":
        return r.weight;
      default:
        return 1;
    }
  }

  if (method === "base_plus_use") {
    const base = Number(project.base_amount) || 0;
    const baseTotal = base * distributable.length;
    const remainder = Math.max(0, pool - baseTotal);
    const totalW = distributable.reduce((s, r) => s + weightOf(r), 0);
    distributable.forEach((r) => {
      const w = weightOf(r);
      const useShare = totalW > 0 ? (w / totalW) * remainder : remainder / (distributable.length || 1);
      r.amount = base + useShare;
    });
  } else {
    const totalW = distributable.reduce((s, r) => s + weightOf(r), 0);
    distributable.forEach((r) => {
      const w = weightOf(r);
      r.amount = totalW > 0 ? (w / totalW) * pool : pool / (distributable.length || 1);
    });
  }

  const allocated = rows.reduce((s, r) => s + r.amount, 0);
  rows.forEach((r) => (r.share = target > 0 ? r.amount / target : 0));
  return { rows, target, allocated, unallocated: Math.max(0, target - allocated) };
}

export function money(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Math.round(n));
}

// ---------------- Scenarios (named comparison + versioning) ----------------
export type Scenario = Database["public"]["Tables"]["project_scenarios"]["Row"];

export type ScenarioConfig = {
  allocation_method: AllocationMethod;
  total_cost: number;
  contingency_pct: number;
  reserve_target: number;
  base_amount: number;
  entrance_x: number | null;
  entrance_y: number | null;
};

export type ScenarioSummary = {
  target: number;
  allocated: number;
  benefiting: number;
  parcels: number;
  rows: { parcel_id: string; label: string; owner: string | null; benefits: boolean; amount: number; share: number }[];
};

export function snapshotConfig(project: Project): ScenarioConfig {
  return {
    allocation_method: project.allocation_method,
    total_cost: Number(project.total_cost) || 0,
    contingency_pct: Number(project.contingency_pct) || 0,
    reserve_target: Number(project.reserve_target) || 0,
    base_amount: Number(project.base_amount) || 0,
    entrance_x: project.entrance_x != null ? Number(project.entrance_x) : null,
    entrance_y: project.entrance_y != null ? Number(project.entrance_y) : null,
  };
}

export function snapshotSummary(result: ReturnType<typeof computeAllocations>): ScenarioSummary {
  return {
    target: result.target,
    allocated: result.allocated,
    benefiting: result.rows.filter((r) => r.benefits).length,
    parcels: result.rows.length,
    rows: result.rows.map((r) => ({
      parcel_id: r.parcel.id,
      label: r.parcel.label,
      owner: r.parcel.owner_name,
      benefits: r.benefits,
      amount: r.amount,
      share: r.share,
    })),
  };
}

export async function listScenarios(projectId: string): Promise<Scenario[]> {
  return unwrap(
    supabase.from("project_scenarios").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
  );
}

export async function saveScenario(
  communityId: string,
  projectId: string,
  name: string,
  project: Project,
  result: ReturnType<typeof computeAllocations>,
): Promise<Scenario> {
  // Version = one more than the highest existing version for this project.
  const existing = await listScenarios(projectId);
  const version = existing.reduce((m, s) => Math.max(m, s.version), 0) + 1;
  const scenario = await unwrap(
    supabase
      .from("project_scenarios")
      .insert({
        project_id: projectId,
        name: name.trim() || `Scenario ${version}`,
        version,
        config: snapshotConfig(project) as unknown as Database["public"]["Tables"]["project_scenarios"]["Insert"]["config"],
        summary: snapshotSummary(result) as unknown as Database["public"]["Tables"]["project_scenarios"]["Insert"]["summary"],
      })
      .select()
      .single(),
  );
  await logEvent(communityId, { entity_type: "project", entity_label: `${project.name} · ${scenario.name}`, action: "created" });
  return scenario;
}

export async function deleteScenario(id: string): Promise<void> {
  const { error } = await supabase.from("project_scenarios").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export function scenarioConfig(s: Scenario): ScenarioConfig {
  return s.config as unknown as ScenarioConfig;
}
export function scenarioSummary(s: Scenario): ScenarioSummary {
  return s.summary as unknown as ScenarioSummary;
}

// ---------------- Shareable evidence package ----------------
export function buildEvidenceHtml(args: {
  communityName: string;
  project: Project;
  lineItems: LineItem[];
  result: ReturnType<typeof computeAllocations>;
}): string {
  const { communityName, project, lineItems, result } = args;
  const method = ALLOCATION_METHODS.find((m) => m.value === project.allocation_method);
  const rows = result.rows
    .map(
      (r) => `<tr><td>${esc(r.parcel.label)}</td><td>${esc(r.parcel.owner_name ?? "—")}</td><td>${r.benefits ? "Yes" : "No"}</td><td class="r">${r.benefits ? money(r.amount) : "—"}</td><td class="r">${r.benefits ? (r.share * 100).toFixed(1) + "%" : "—"}</td></tr>`,
    )
    .join("");
  const items = lineItems
    .map((i) => `<tr><td>${esc(i.label)}</td><td>${esc(i.contractor ?? "—")}</td><td class="r">${money(Number(i.amount))}</td></tr>`)
    .join("");
  const generated = new Date().toLocaleString("en-US");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(project.name)} — Cost-share evidence package</title>
<style>
:root{color-scheme:light}
body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;max-width:840px;margin:40px auto;padding:0 24px;line-height:1.5}
h1{font-size:26px;margin:0 0 4px}h2{font-size:16px;margin:28px 0 8px;border-bottom:1px solid #e2e8f0;padding-bottom:6px}
.muted{color:#64748b}.pill{display:inline-block;background:#eef2ff;color:#4338ca;border-radius:999px;padding:2px 10px;font-size:12px;font-weight:600}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px}
.card{border:1px solid #e2e8f0;border-radius:12px;padding:12px}.card b{display:block;font-size:20px}
table{width:100%;border-collapse:collapse;margin-top:8px;font-size:14px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eef2f6}
th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b}.r{text-align:right}
footer{margin-top:32px;font-size:12px;color:#94a3b8}
</style></head><body>
<span class="pill">Cost-share evidence package</span>
<h1>${esc(project.name)}</h1>
<p class="muted">${esc(communityName)} · ${esc(STATUS_LABEL[project.status])}${project.description ? " · " + esc(project.description) : ""}</p>
<div class="grid">
<div class="card"><span class="muted">Funding target</span><b>${money(result.target)}</b></div>
<div class="card"><span class="muted">Allocated</span><b>${money(result.allocated)}</b></div>
<div class="card"><span class="muted">Benefiting parcels</span><b>${result.rows.filter((r) => r.benefits).length}</b></div>
</div>
<h2>Method &amp; assumptions</h2>
<p><b>${esc(method?.label ?? project.allocation_method)}</b> — ${esc(method?.blurb ?? "")}</p>
<p class="muted">Total cost ${money(Number(project.total_cost))} · Contingency ${Number(project.contingency_pct)}% · Reserve ${money(Number(project.reserve_target))}${project.allocation_method === "base_plus_use" ? " · Base per parcel " + money(Number(project.base_amount)) : ""}</p>
<h2>Cost breakdown</h2>
<table><thead><tr><th>Item</th><th>Contractor</th><th class="r">Amount</th></tr></thead><tbody>${items || '<tr><td colspan="3" class="muted">No line items recorded.</td></tr>'}</tbody></table>
<h2>Per-parcel allocation</h2>
<table><thead><tr><th>Lot</th><th>Owner</th><th>Benefits</th><th class="r">Amount</th><th class="r">Share</th></tr></thead><tbody>${rows}</tbody></table>
<footer>Generated ${esc(generated)} · RoadShare. Figures reflect the settings recorded at generation time and are for community discussion, not a legal assessment.</footer>
</body></html>`;
}

function esc(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}