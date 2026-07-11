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
  Pick<Project, "name" | "description" | "status" | "total_cost" | "contingency_pct" | "reserve_target" | "base_amount" | "allocation_method" | "notes">
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
  project: Pick<Project, "total_cost" | "contingency_pct" | "reserve_target" | "base_amount" | "allocation_method">,
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