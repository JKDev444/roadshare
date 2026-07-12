import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import { logEvent } from "@/lib/community/api";

export type Survey = Database["public"]["Tables"]["surveys"]["Row"];
export type SurveyResponse = Database["public"]["Tables"]["survey_responses"]["Row"];
export type SurveyStatus = Database["public"]["Enums"]["survey_status"];

export type QuestionKind = "single_choice" | "multi_choice" | "rating" | "text";

export type SurveyQuestion = {
  id: string;
  prompt: string;
  kind: QuestionKind;
  options: string[]; // for single/multi choice
  required: boolean;
};

/** A single household's answers, keyed by question id. */
export type AnswerMap = Record<string, string | string[] | number | null>;

async function unwrap<T>(p: PromiseLike<{ data: T; error: { message: string } | null }>): Promise<NonNullable<T>> {
  const { data, error } = await p;
  if (error) throw new Error(error.message);
  return data as NonNullable<T>;
}

export function parseQuestions(value: unknown): SurveyQuestion[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((q): SurveyQuestion | null => {
      const o = q as Partial<SurveyQuestion>;
      if (!o || typeof o.id !== "string" || typeof o.prompt !== "string") return null;
      const kind: QuestionKind =
        o.kind === "multi_choice" || o.kind === "rating" || o.kind === "text" ? o.kind : "single_choice";
      return {
        id: o.id,
        prompt: o.prompt,
        kind,
        options: Array.isArray(o.options) ? o.options.filter((x): x is string => typeof x === "string") : [],
        required: Boolean(o.required),
      };
    })
    .filter((q): q is SurveyQuestion => q !== null);
}

export function parseAnswers(value: unknown): AnswerMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as AnswerMap;
}

export function newQuestion(kind: QuestionKind = "single_choice"): SurveyQuestion {
  return {
    id: crypto.randomUUID(),
    prompt: "",
    kind,
    options: kind === "single_choice" || kind === "multi_choice" ? ["", ""] : [],
    required: false,
  };
}

export const KIND_LABEL: Record<QuestionKind, string> = {
  single_choice: "Single choice",
  multi_choice: "Multiple choice",
  rating: "Rating (1–5)",
  text: "Open text",
};

export const STATUS_LABEL: Record<SurveyStatus, string> = {
  draft: "Draft",
  open: "Open",
  closed: "Closed",
};

// ---------------- Surveys ----------------

export async function listSurveys(communityId: string): Promise<Survey[]> {
  return unwrap(
    supabase.from("surveys").select("*").eq("community_id", communityId).order("created_at", { ascending: false }),
  );
}

export async function getSurvey(id: string): Promise<Survey> {
  return unwrap(supabase.from("surveys").select("*").eq("id", id).single());
}

export async function createSurvey(
  communityId: string,
  input: { title: string; description?: string; questions?: SurveyQuestion[]; min_report_threshold?: number },
): Promise<Survey> {
  const { data: userData } = await supabase.auth.getUser();
  const survey = await unwrap(
    supabase
      .from("surveys")
      .insert({
        community_id: communityId,
        title: input.title,
        description: input.description ?? null,
        questions: (input.questions ?? []) as unknown as Json,
        min_report_threshold: input.min_report_threshold ?? 4,
        created_by: userData.user?.id ?? null,
      })
      .select()
      .single(),
  );
  await logEvent(communityId, { entity_type: "survey", entity_label: survey.title, action: "created" });
  return survey;
}

export async function updateSurvey(
  id: string,
  communityId: string,
  input: Partial<{ title: string; description: string | null; questions: SurveyQuestion[]; status: SurveyStatus; min_report_threshold: number }>,
): Promise<Survey> {
  const patch: Database["public"]["Tables"]["surveys"]["Update"] = {
    title: input.title,
    description: input.description,
    status: input.status,
    min_report_threshold: input.min_report_threshold,
    questions: input.questions ? (input.questions as unknown as Json) : undefined,
  };
  const survey = await unwrap(supabase.from("surveys").update(patch).eq("id", id).select().single());
  if (input.status) {
    await logEvent(communityId, { entity_type: "survey", entity_label: survey.title, action: input.status === "open" ? "opened" : input.status === "closed" ? "closed" : "updated" });
  }
  return survey;
}

export async function deleteSurvey(id: string, communityId: string, title: string): Promise<void> {
  const { error } = await supabase.from("surveys").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await logEvent(communityId, { entity_type: "survey", entity_label: title, action: "removed" });
}

// ---------------- Responses ----------------

export async function listResponses(surveyId: string): Promise<SurveyResponse[]> {
  return unwrap(
    supabase.from("survey_responses").select("*").eq("survey_id", surveyId).order("created_at", { ascending: false }),
  );
}

export async function submitResponse(
  survey: Survey,
  householdLabel: string,
  answers: AnswerMap,
): Promise<SurveyResponse> {
  return unwrap(
    supabase
      .from("survey_responses")
      .upsert(
        {
          survey_id: survey.id,
          community_id: survey.community_id,
          household_label: householdLabel,
          answers: answers as unknown as Json,
        },
        { onConflict: "survey_id,household_label" },
      )
      .select()
      .single(),
  );
}

export async function deleteResponse(id: string): Promise<void> {
  const { error } = await supabase.from("survey_responses").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------------- Privacy-preserving analysis (§12.2, §12.3) ----------------

export type ChoiceTally = { option: string; count: number; pct: number };

export type QuestionAnalysis =
  | { kind: "choice"; tallies: ChoiceTally[] }
  | { kind: "rating"; average: number; count: number; distribution: ChoiceTally[] }
  | { kind: "text"; count: number };

export type SurveyAnalysis = {
  totalResponses: number;
  threshold: number;
  /** Aggregate results are withheld entirely until the household threshold is met. */
  suppressed: boolean;
  perQuestion: Record<string, QuestionAnalysis>;
};

/**
 * Aggregate-only analysis. Individual responses are never scored or profiled.
 * Results (including any per-question breakdown) are suppressed until the
 * minimum household threshold is met, preventing small-n re-identification.
 */
export function analyze(survey: Survey, responses: SurveyResponse[]): SurveyAnalysis {
  const questions = parseQuestions(survey.questions);
  const total = responses.length;
  const threshold = survey.min_report_threshold;
  const suppressed = total < threshold;

  const perQuestion: Record<string, QuestionAnalysis> = {};
  if (suppressed) return { totalResponses: total, threshold, suppressed, perQuestion };

  const maps = responses.map((r) => parseAnswers(r.answers));

  for (const q of questions) {
    if (q.kind === "single_choice" || q.kind === "multi_choice") {
      const counts = new Map<string, number>();
      for (const opt of q.options) counts.set(opt, 0);
      for (const m of maps) {
        const v = m[q.id];
        const picks = Array.isArray(v) ? v : v == null || v === "" ? [] : [String(v)];
        for (const p of picks) counts.set(p, (counts.get(p) ?? 0) + 1);
      }
      const tallies: ChoiceTally[] = Array.from(counts.entries()).map(([option, count]) => ({
        option,
        count,
        pct: total ? Math.round((count / total) * 100) : 0,
      }));
      perQuestion[q.id] = { kind: "choice", tallies };
    } else if (q.kind === "rating") {
      const nums = maps.map((m) => Number(m[q.id])).filter((n) => Number.isFinite(n) && n >= 1 && n <= 5);
      const sum = nums.reduce((a, b) => a + b, 0);
      const dist: ChoiceTally[] = [1, 2, 3, 4, 5].map((star) => {
        const count = nums.filter((n) => n === star).length;
        return { option: `${star}★`, count, pct: nums.length ? Math.round((count / nums.length) * 100) : 0 };
      });
      perQuestion[q.id] = {
        kind: "rating",
        average: nums.length ? Math.round((sum / nums.length) * 100) / 100 : 0,
        count: nums.length,
        distribution: dist,
      };
    } else {
      const count = maps.filter((m) => typeof m[q.id] === "string" && (m[q.id] as string).trim() !== "").length;
      perQuestion[q.id] = { kind: "text", count };
    }
  }

  return { totalResponses: total, threshold, suppressed, perQuestion };
}
