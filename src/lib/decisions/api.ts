import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { logEvent } from "@/lib/community/api";

export type Decision = Database["public"]["Tables"]["decisions"]["Row"];
export type DecisionVote = Database["public"]["Tables"]["decision_votes"]["Row"];
export type DecisionStatus = Database["public"]["Enums"]["decision_status"];

/** A single piece of assembled supporting evidence for a decision (§13.2). */
export type EvidenceItem = {
  id: string;
  kind: "clause" | "document" | "scenario" | "survey" | "record" | "note";
  label: string;
  detail?: string;
};

export const STATUS_LABEL: Record<DecisionStatus, string> = {
  draft: "Draft",
  discussion: "Discussion",
  voting: "Voting",
  decided: "Decided",
  withdrawn: "Withdrawn",
};

/** Ordered lifecycle used to render the workflow tracker (§13.1). */
export const STATUS_FLOW: DecisionStatus[] = ["draft", "discussion", "voting", "decided"];

export const EVIDENCE_KIND_LABEL: Record<EvidenceItem["kind"], string> = {
  clause: "Clause",
  document: "Document",
  scenario: "Planner scenario",
  survey: "Survey result",
  record: "Community record",
  note: "Note",
};

async function unwrap<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

export function parseOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((x): x is string => typeof x === "string" && x.trim() !== "");
}

export function parseEvidence(value: unknown): EvidenceItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((e): EvidenceItem | null => {
      const o = e as Partial<EvidenceItem>;
      if (!o || typeof o.label !== "string") return null;
      const kind: EvidenceItem["kind"] =
        o.kind && o.kind in EVIDENCE_KIND_LABEL ? (o.kind as EvidenceItem["kind"]) : "note";
      return {
        id: typeof o.id === "string" ? o.id : crypto.randomUUID(),
        kind,
        label: o.label,
        detail: typeof o.detail === "string" ? o.detail : undefined,
      };
    })
    .filter((e): e is EvidenceItem => e !== null);
}

export function newEvidence(kind: EvidenceItem["kind"] = "note"): EvidenceItem {
  return { id: crypto.randomUUID(), kind, label: "", detail: "" };
}

// ---------------- Decisions ----------------

export async function listDecisions(communityId: string): Promise<Decision[]> {
  return unwrap(
    supabase.from("decisions").select("*").eq("community_id", communityId).order("created_at", { ascending: false }),
  );
}

export async function createDecision(
  communityId: string,
  input: { title: string; question?: string; description?: string; options?: string[]; quorum?: number },
): Promise<Decision> {
  const { data: userData } = await supabase.auth.getUser();
  const decision = await unwrap(
    supabase
      .from("decisions")
      .insert({
        community_id: communityId,
        title: input.title,
        question: input.question ?? null,
        description: input.description ?? null,
        options: (input.options ?? ["Approve", "Reject"]) as unknown as Json,
        quorum: input.quorum ?? 1,
        created_by: userData.user?.id ?? null,
      })
      .select()
      .single(),
  );
  await logEvent(communityId, { entity_type: "decision", entity_label: decision.title, action: "created" });
  return decision;
}

export type DecisionPatch = Partial<{
  title: string;
  question: string | null;
  description: string | null;
  options: string[];
  quorum: number;
  evidence: EvidenceItem[];
  notice_date: string | null;
}>;

export async function updateDecision(
  id: string,
  communityId: string,
  input: DecisionPatch,
  { silent }: { silent?: boolean } = {},
): Promise<Decision> {
  const patch: Database["public"]["Tables"]["decisions"]["Update"] = {
    title: input.title,
    question: input.question,
    description: input.description,
    quorum: input.quorum,
    notice_date: input.notice_date,
    options: input.options ? (input.options as unknown as Json) : undefined,
    evidence: input.evidence ? (input.evidence as unknown as Json) : undefined,
  };
  const decision = await unwrap(supabase.from("decisions").update(patch).eq("id", id).select().single());
  if (!silent) {
    await logEvent(communityId, { entity_type: "decision", entity_label: decision.title, action: "updated" });
  }
  return decision;
}

/** Advance the workflow state, stamping notice/outcome as appropriate (§13.1). */
export async function setDecisionStatus(
  decision: Decision,
  status: DecisionStatus,
  extra?: { outcome?: string | null },
): Promise<Decision> {
  const patch: Database["public"]["Tables"]["decisions"]["Update"] = { status };
  if (status === "voting" && !decision.notice_date) {
    patch.notice_date = new Date().toISOString().slice(0, 10);
  }
  if (status === "decided") {
    patch.decided_at = new Date().toISOString();
    if (extra?.outcome !== undefined) patch.outcome = extra.outcome;
  }
  const updated = await unwrap(supabase.from("decisions").update(patch).eq("id", decision.id).select().single());
  await logEvent(decision.community_id, {
    entity_type: "decision",
    entity_label: decision.title,
    action: status === "voting" ? "opened voting" : status === "decided" ? "decided" : status,
  });
  return updated;
}

/** Publish (or re-publish) a versioned plain-English explanation (§13.3). */
export async function publishRationale(decision: Decision, rationale: string): Promise<Decision> {
  const updated = await unwrap(
    supabase
      .from("decisions")
      .update({ rationale, rationale_version: decision.rationale_version + 1 })
      .eq("id", decision.id)
      .select()
      .single(),
  );
  await logEvent(decision.community_id, {
    entity_type: "decision",
    entity_label: decision.title,
    action: `published explanation v${updated.rationale_version}`,
  });
  return updated;
}

export async function deleteDecision(id: string, communityId: string, title: string): Promise<void> {
  const { error } = await supabase.from("decisions").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logEvent(communityId, { entity_type: "decision", entity_label: title, action: "removed" });
}

// ---------------- Votes ----------------

export async function listVotes(decisionId: string): Promise<DecisionVote[]> {
  return unwrap(
    supabase.from("decision_votes").select("*").eq("decision_id", decisionId).order("created_at", { ascending: false }),
  );
}

export async function castVote(
  decision: Decision,
  householdLabel: string,
  choice: string,
  comment?: string,
): Promise<DecisionVote> {
  return unwrap(
    supabase
      .from("decision_votes")
      .upsert(
        {
          decision_id: decision.id,
          community_id: decision.community_id,
          household_label: householdLabel,
          choice,
          comment: comment?.trim() ? comment.trim() : null,
        },
        { onConflict: "decision_id,household_label" },
      )
      .select()
      .single(),
  );
}

export async function deleteVote(id: string): Promise<void> {
  const { error } = await supabase.from("decision_votes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------- Tally (§13.2) ----------------

export type Tally = { option: string; count: number; pct: number };

export type DecisionResult = {
  totalVotes: number;
  quorum: number;
  quorumMet: boolean;
  tallies: Tally[];
  /** Leading option, or null on a tie / no votes. */
  leader: string | null;
  tie: boolean;
};

export function tally(decision: Decision, votes: DecisionVote[]): DecisionResult {
  const options = parseOptions(decision.options);
  const counts = new Map<string, number>();
  for (const opt of options) counts.set(opt, 0);
  for (const v of votes) counts.set(v.choice, (counts.get(v.choice) ?? 0) + 1);

  const total = votes.length;
  const tallies: Tally[] = Array.from(counts.entries()).map(([option, count]) => ({
    option,
    count,
    pct: total ? Math.round((count / total) * 100) : 0,
  }));

  const max = tallies.reduce((m, t) => Math.max(m, t.count), 0);
  const leaders = tallies.filter((t) => t.count === max && max > 0);
  const tie = leaders.length > 1;

  return {
    totalVotes: total,
    quorum: decision.quorum,
    quorumMet: total >= decision.quorum,
    tallies,
    leader: max > 0 && !tie ? leaders[0].option : null,
    tie,
  };
}
