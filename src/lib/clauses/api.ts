import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { logEvent } from "@/lib/community/api";

export type Clause = Database["public"]["Tables"]["clauses"]["Row"];
export type ClauseCategory = Database["public"]["Enums"]["clause_category"];
export type ClauseStatus = Database["public"]["Enums"]["clause_status"];

export const CLAUSE_CATEGORIES: { value: ClauseCategory; label: string }[] = [
  { value: "maintenance_responsibility", label: "Maintenance responsibility" },
  { value: "cost_sharing", label: "Cost sharing" },
  { value: "access_rights", label: "Access rights" },
  { value: "easement", label: "Easement" },
  { value: "use_restriction", label: "Use restriction" },
  { value: "enforcement", label: "Enforcement" },
  { value: "dispute_resolution", label: "Dispute resolution" },
  { value: "amendment_process", label: "Amendment process" },
  { value: "insurance", label: "Insurance" },
  { value: "other", label: "Other" },
];

export const CLAUSE_STATUS: Record<ClauseStatus, { label: string; tone: "green" | "amber" | "blue" | "red" }> = {
  active: { label: "Active", tone: "green" },
  proposed: { label: "Proposed", tone: "blue" },
  superseded: { label: "Superseded", tone: "amber" },
  void: { label: "Void", tone: "red" },
};

export function categoryLabel(c: ClauseCategory | null): string {
  return CLAUSE_CATEGORIES.find((x) => x.value === c)?.label ?? "—";
}

async function unwrap<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

export async function listClauses(communityId: string): Promise<Clause[]> {
  return unwrap(
    supabase.from("clauses").select("*").eq("community_id", communityId).order("effective_date", { ascending: true, nullsFirst: true }).order("created_at", { ascending: true }),
  );
}

export type ClauseInput = Partial<
  Pick<
    Clause,
    | "document_id"
    | "category"
    | "title"
    | "clause_text"
    | "effective_date"
    | "status"
    | "supersedes_id"
    | "source"
    | "confidence"
    | "verification"
    | "ai_suggested_category"
    | "ai_summary"
    | "ai_confidence"
  >
>;

export async function createClause(communityId: string, input: ClauseInput): Promise<Clause> {
  const { data: userData } = await supabase.auth.getUser();
  const clause = await unwrap(
    supabase
      .from("clauses")
      .insert({
        community_id: communityId,
        title: (input.title ?? "").trim() || "Untitled clause",
        clause_text: input.clause_text ?? "",
        category: input.category ?? "other",
        status: input.status ?? "active",
        effective_date: input.effective_date ?? null,
        document_id: input.document_id ?? null,
        supersedes_id: input.supersedes_id ?? null,
        source: input.source ?? null,
        confidence: input.confidence ?? "medium",
        verification: input.verification ?? "unverified",
        ai_suggested_category: input.ai_suggested_category ?? null,
        ai_summary: input.ai_summary ?? null,
        ai_confidence: input.ai_confidence ?? null,
        created_by: userData.user?.id ?? null,
      })
      .select()
      .single(),
  );
  // If this clause supersedes another, mark the older one superseded.
  if (clause.supersedes_id) {
    await supabase.from("clauses").update({ status: "superseded" }).eq("id", clause.supersedes_id);
  }
  await logEvent(communityId, { entity_type: "clause", entity_label: clause.title, action: "added" });
  return clause;
}

export async function updateClause(id: string, communityId: string, input: ClauseInput, action = "edited"): Promise<Clause> {
  const clause = await unwrap(supabase.from("clauses").update(input).eq("id", id).select().single());
  if (clause.supersedes_id) {
    await supabase.from("clauses").update({ status: "superseded" }).eq("id", clause.supersedes_id);
  }
  await logEvent(communityId, { entity_type: "clause", entity_label: clause.title, action });
  return clause;
}

export async function deleteClause(clause: Pick<Clause, "id" | "community_id" | "title">): Promise<void> {
  const { error } = await supabase.from("clauses").delete().eq("id", clause.id);
  if (error) throw new Error(error.message);
  await logEvent(clause.community_id, { entity_type: "clause", entity_label: clause.title, action: "removed" });
}

/** A detected conflict between two clauses in the same category. */
export type ClauseConflict = {
  category: ClauseCategory;
  clauses: Clause[];
  reason: string;
};

/**
 * Detect potential conflicts: two or more *active* clauses in the same category
 * with no supersession relationship between them. This surfaces provisions that
 * may contradict each other and need human review.
 */
export function detectConflicts(clauses: Clause[]): ClauseConflict[] {
  const active = clauses.filter((c) => c.status === "active");
  const byCategory = new Map<ClauseCategory, Clause[]>();
  for (const c of active) {
    const arr = byCategory.get(c.category) ?? [];
    arr.push(c);
    byCategory.set(c.category, arr);
  }
  const conflicts: ClauseConflict[] = [];
  for (const [category, arr] of byCategory) {
    if (arr.length < 2) continue;
    // Ignore if they form a clean supersession chain (each supersedes another in the group).
    const ids = new Set(arr.map((c) => c.id));
    const superseded = arr.filter((c) => c.supersedes_id && ids.has(c.supersedes_id));
    if (superseded.length >= arr.length - 1) continue;
    conflicts.push({
      category,
      clauses: arr,
      reason: `${arr.length} active clauses govern the same topic with no supersession chain — they may contradict each other.`,
    });
  }
  return conflicts;
}

/** Categories that should generally be present in a complete road record. */
const EXPECTED_CATEGORIES: ClauseCategory[] = [
  "maintenance_responsibility",
  "cost_sharing",
  "access_rights",
  "dispute_resolution",
  "amendment_process",
];

export function detectMissing(clauses: Clause[]): ClauseCategory[] {
  const present = new Set(clauses.filter((c) => c.status !== "void").map((c) => c.category));
  return EXPECTED_CATEGORIES.filter((c) => !present.has(c));
}