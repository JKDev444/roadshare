import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { categoryLabel, listClauses } from "@/lib/clauses/api";
import { listDocuments, docTypeLabel } from "@/lib/documents/api";
import { getCommunity, listParcels, listSegments, pathLengthFt, toPoints } from "@/lib/community/api";
import type { QaCitation, QaEvidence, QaAnswerResult } from "@/lib/qa/ask.functions";

export type QaAnswer = Database["public"]["Tables"]["qa_answers"]["Row"];

async function unwrap<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

/**
 * Assemble the community's VERIFIED record into numbered evidence the answer
 * engine may cite. Only verified clauses/documents and non-void data feed the
 * model, so answers rest on facts the owner has confirmed.
 */
export async function buildEvidence(communityId: string): Promise<QaEvidence[]> {
  const [community, clauses, docs, parcels, segments] = await Promise.all([
    getCommunity(communityId),
    listClauses(communityId),
    listDocuments(communityId),
    listParcels(communityId),
    listSegments(communityId),
  ]);

  const evidence: QaEvidence[] = [];
  let ref = 1;

  evidence.push({
    ref: ref++,
    kind: "community",
    label: community.name,
    detail: `${community.region ?? "Region unspecified"}. ${community.description ?? ""}`.trim(),
  });

  for (const c of clauses.filter((c) => c.verification === "verified" && c.status !== "void")) {
    evidence.push({
      ref: ref++,
      kind: "clause",
      label: `${categoryLabel(c.category)} — ${c.title}`,
      detail: `${c.clause_text || c.ai_summary || ""} (status: ${c.status}${c.effective_date ? `, effective ${c.effective_date}` : ""})`.trim(),
    });
  }

  for (const d of docs.filter((d) => d.status === "verified")) {
    evidence.push({
      ref: ref++,
      kind: "document",
      label: `${docTypeLabel(d.doc_type)} — ${d.title}`,
      detail: `${d.ai_summary ?? "Verified document"}${d.effective_date ? ` (effective ${d.effective_date})` : ""}`,
    });
  }

  for (const p of parcels.filter((p) => p.verification === "verified")) {
    evidence.push({
      ref: ref++,
      kind: "parcel",
      label: `Parcel ${p.label}`,
      detail: `Owner ${p.owner_name ?? "unknown"}${p.area_sqft ? `, ${p.area_sqft} sq ft` : ""}${p.frontage_ft ? `, ${p.frontage_ft} ft frontage` : ""}.`,
    });
  }

  for (const s of segments.filter((s) => s.verification === "verified")) {
    evidence.push({
      ref: ref++,
      kind: "road",
      label: s.name,
      detail: `${s.surface ?? "surface unknown"}, ${s.responsibility} responsibility, ~${pathLengthFt(toPoints(s.geometry))} ft.`,
    });
  }

  return evidence;
}

export async function listAnswers(communityId: string): Promise<QaAnswer[]> {
  return unwrap(
    supabase.from("qa_answers").select("*").eq("community_id", communityId).order("created_at", { ascending: false }).limit(100),
  );
}

export async function saveAnswer(
  communityId: string,
  question: string,
  result: QaAnswerResult,
): Promise<QaAnswer> {
  const { data: userData } = await supabase.auth.getUser();
  return unwrap(
    supabase
      .from("qa_answers")
      .insert({
        community_id: communityId,
        question,
        answer: result.answer,
        confidence: result.confidence,
        abstained: result.abstained,
        high_risk: result.high_risk,
        risk_reason: result.risk_reason,
        citations: result.citations as unknown as Database["public"]["Tables"]["qa_answers"]["Insert"]["citations"],
        created_by: userData.user?.id ?? null,
      })
      .select()
      .single(),
  );
}

export async function deleteAnswer(id: string): Promise<void> {
  const { error } = await supabase.from("qa_answers").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export function parseCitations(value: unknown): QaCitation[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((c) => {
      const obj = c as { ref?: unknown; label?: unknown };
      return { ref: Number(obj?.ref), label: typeof obj?.label === "string" ? obj.label : "" };
    })
    .filter((c) => Number.isFinite(c.ref));
}

export function confidenceLabel(v: number): { label: string; tone: "green" | "amber" | "red" } {
  if (v >= 0.75) return { label: "High confidence", tone: "green" };
  if (v >= 0.4) return { label: "Moderate confidence", tone: "amber" };
  return { label: "Low confidence", tone: "red" };
}