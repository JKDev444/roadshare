import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { coerceCcrDraft, type CcrDraft } from "./ccrDraft";

export const JOB_STAGES = [
  "Uploading documents",
  "Checking file quality",
  "Reading document pages",
  "Identifying community and road information",
  "Looking for properties and lot references",
  "Finding maintenance and cost-sharing language",
  "Checking for amendments and missing exhibits",
  "Preparing the review",
] as const;
export type JobStage = (typeof JOB_STAGES)[number];

export type OnboardingJobRow = {
  id: string;
  user_id: string;
  status: "queued" | "uploading" | "processing" | "succeeded" | "failed" | "cancelled";
  stage: JobStage | null;
  stage_index: number;
  progress: number;
  filenames: string[];
  document_paths: string[];
  result: CcrDraft | null;
  error_message: string | null;
  started_at: string;
  updated_at: string;
  finished_at: string | null;
};

const CreateInput = z.object({
  files: z
    .array(
      z.object({
        filename: z.string().min(1).max(200),
        dataUrl: z.string().min(20).max(15_000_000).startsWith("data:"),
      }),
    )
    .min(1)
    .max(6),
});

/** Persist a plain-language error, mark job failed, return jobId. */
async function failJob(
  supabase: { from: (t: string) => any },
  jobId: string,
  message: string,
) {
  await supabase
    .from("onboarding_jobs")
    .update({
      status: "failed",
      error_message: message.slice(0, 800),
      finished_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}

/** Update stage/progress. Also checks if job was cancelled and bails. */
async function setStage(
  supabase: { from: (t: string) => any },
  jobId: string,
  stageIndex: number,
  progress: number,
): Promise<boolean> {
  const { data } = await supabase
    .from("onboarding_jobs")
    .update({
      stage: JOB_STAGES[stageIndex],
      stage_index: stageIndex,
      progress,
      status: stageIndex === 0 ? "uploading" : "processing",
    })
    .eq("id", jobId)
    .select("status")
    .maybeSingle();
  return data?.status !== "cancelled";
}

/** Fire-and-forget processing kicked off from createJob. Runs staged extraction
 *  and writes progress. Uses the admin client because it runs *after* the
 *  authenticated response, when the caller's bearer token is no longer in
 *  scope. Access is confined to the job row we created for `userId`. */
async function runProcessing(jobId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const supabase = supabaseAdmin;

  try {
    const { data: job } = await supabase
      .from("onboarding_jobs")
      .select("id, filenames, document_paths, status")
      .eq("id", jobId)
      .maybeSingle();
    if (!job || job.status === "cancelled") return;

    // Stage 0: uploading — already done by caller; just record.
    if (!(await setStage(supabase, jobId, 0, 5))) return;

    // Stage 1: file quality (superficial — real check happens during extraction).
    if (!(await setStage(supabase, jobId, 1, 15))) return;

    // Download the first file's bytes from storage for extraction.
    const paths: string[] = job.document_paths ?? [];
    if (paths.length === 0) {
      await failJob(supabase, jobId, "No documents were uploaded successfully. Please try again.");
      return;
    }

    // We extract from the first file for now; multi-doc merge is a follow-up.
    const firstPath = paths[0];
    const { data: fileBlob, error: dlError } = await supabase.storage
      .from("documents")
      .download(firstPath);
    if (dlError || !fileBlob) {
      await failJob(
        supabase,
        jobId,
        "We uploaded your document but couldn't read it back. Please retry.",
      );
      return;
    }

    if (!(await setStage(supabase, jobId, 2, 30))) return;

    const buffer = await fileBlob.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const filename = job.filenames?.[0] ?? "document.pdf";

    if (!(await setStage(supabase, jobId, 3, 45))) return;

    const { generateText } = await import("ai");
    const { createLovableAiGatewayProvider, createDirectOpenAIProvider } = await import(
      "@/lib/ai-gateway.server"
    );
    const lovableKey = process.env.LOVABLE_API_KEY;
    const openaiKey = process.env.OPENAI_API_KEY;
    if (!lovableKey && !openaiKey) {
      await failJob(
        supabase,
        jobId,
        "AI processing isn't configured for this project. Add OPENAI_API_KEY in Vercel or host on Lovable.",
      );
      return;
    }

    if (!(await setStage(supabase, jobId, 4, 55))) return;

    const prompt = `Read this road-community document (CC&R, plat, road maintenance agreement, easement, declaration, or amendment).

Return STRICT JSON. Only include information the document actually contains — do not invent addresses, owners, dollar amounts, formulas, or geometry.

Shape:
{
  "community": { "name": string|null, "region": string|null, "description": string|null },
  "lots": [{ "label": string, "address": string|null, "owner_name": string|null, "area_sqft": number|null, "frontage_ft": number|null, "source_page": number|null }],
  "roads": [{ "name": string, "responsibility": "shared"|"private"|"public"|"association", "surface": string|null }],
  "maintenance_summary": string|null,
  "assessment_formula": string|null,
  "missing_exhibits": string[]
}

Rules:
- Return lots only if the document explicitly lists them (by lot number, address, or name). A lot with only a number is fine; leave other fields null.
- Only fill address fields when the document contains a real street address for that lot.
- Include road names only when explicitly named.
- maintenance_summary and assessment_formula only when the document states them; leave null otherwise.
- missing_exhibits: names of exhibits the document references but does not include (e.g. "Exhibit B — Property Map").`;

    let text = "";
    try {
      const gateway = lovableKey
        ? createLovableAiGatewayProvider(lovableKey)
        : createDirectOpenAIProvider(openaiKey!);
      const result = await generateText({
        model: lovableKey ? gateway("openai/gpt-5.5") : gateway("gpt-4o"),
        system: "You extract facts from road-community documents. Reply with one JSON object only.",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "file", data: base64, filename: filename.slice(0, 120), mediaType: "application/pdf" },
            ],
          },
        ],
      });
      text = result.text;
    } catch (err) {
      console.error("processJob AI error", err);
      const msg = err instanceof Error ? err.message : "AI extraction failed.";
      // Provide a friendly message rather than raw gateway text.
      const friendly =
        msg.toLowerCase().includes("rate") || msg.includes("429")
          ? "The AI service is busy right now. Please try again in a minute."
          : msg.toLowerCase().includes("credit") || msg.includes("402")
          ? "The AI credits for this workspace are exhausted. Ask the workspace owner to add credits."
          : "We couldn't read the document. It may be scanned, protected, or empty. Try another file.";
      await failJob(supabase, jobId, friendly);
      return;
    }

    if (!(await setStage(supabase, jobId, 5, 75))) return;

    const cleaned = text.replace(/```json|```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      await failJob(
        supabase,
        jobId,
        "The document was read but we couldn't find setup information in it. Try uploading a different file or continue without documents.",
      );
      return;
    }
    let parsed: any;
    try {
      parsed = JSON.parse(match[0]);
    } catch {
      await failJob(supabase, jobId, "The extraction result was unreadable. Please try again.");
      return;
    }

    if (!(await setStage(supabase, jobId, 6, 85))) return;

    const draft = coerceCcrDraft(parsed);
    const missingExhibits = Array.isArray(parsed.missing_exhibits)
      ? parsed.missing_exhibits.filter((s: unknown): s is string => typeof s === "string").slice(0, 8)
      : [];

    // Tag every extracted item with provenance.
    const lots = draft.lots.map((l) => ({ ...l, provenance: "extracted" as const }));
    const roads = draft.roads.map((r) => ({ ...r, provenance: "extracted" as const, has_geometry: false }));

    const addressesFound = lots.filter((l) => !!l.address).length;

    const finalDraft: CcrDraft = {
      ...draft,
      lots,
      roads,
      meta: {
        community_found: !!draft.community.name,
        region_found: !!draft.community.region,
        addresses_found: addressesFound,
        lot_refs_found: lots.length,
        roads_found: roads.length,
        maintenance_found: !!draft.maintenance_summary,
        formula_found: !!draft.assessment_formula,
        missing_exhibits: missingExhibits,
        documents_processed: 1,
      },
    };

    if (!(await setStage(supabase, jobId, 7, 95))) return;

    await supabase
      .from("onboarding_jobs")
      .update({
        status: "succeeded",
        progress: 100,
        result: finalDraft,
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId);
  } catch (err) {
    console.error("runProcessing unexpected error", err);
    await failJob(
      supabase,
      jobId,
      "Something went wrong while processing your documents. Please retry.",
    );
  }
}

export const createJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CreateInput.parse(d))
  .handler(async ({ data, context }): Promise<{ jobId: string }> => {
    const { supabase, userId } = context;

    // Cancel any prior in-flight job for this user so only one is active.
    await supabase
      .from("onboarding_jobs")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("status", ["queued", "uploading", "processing"]);

    const filenames = data.files.map((f) => f.filename.slice(0, 200));
    const { data: job, error } = await supabase
      .from("onboarding_jobs")
      .insert({
        user_id: userId,
        status: "uploading",
        stage: JOB_STAGES[0],
        stage_index: 0,
        progress: 1,
        filenames,
      })
      .select("id")
      .single();
    if (error || !job) throw new Error(error?.message ?? "Could not create job");
    const jobId = job.id as string;

    // Upload each file to storage. Errors are captured onto the job row.
    const paths: string[] = [];
    for (const f of data.files) {
      const base64 = f.dataUrl.split(",")[1] ?? "";
      if (!base64) continue;
      const bytes = Buffer.from(base64, "base64");
      const path = `${userId}/onboarding/${jobId}/${Date.now()}-${f.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80)}`;
      const { error: upErr } = await supabase.storage
        .from("documents")
        .upload(path, bytes, { contentType: "application/pdf", upsert: false });
      if (upErr) {
        console.error("createJob upload error", upErr);
        continue;
      }
      paths.push(path);
    }
    if (paths.length === 0) {
      await supabase
        .from("onboarding_jobs")
        .update({
          status: "failed",
          error_message: "None of the files uploaded successfully. Please retry.",
          finished_at: new Date().toISOString(),
        })
        .eq("id", jobId);
      return { jobId };
    }

    await supabase
      .from("onboarding_jobs")
      .update({ document_paths: paths })
      .eq("id", jobId);

    // Kick off processing without awaiting; we return jobId immediately so the
    // client can move to the processing screen. Cloudflare Workers may cut
    // background promises after the response, but the client polls status and
    // will call `resumeJob` if the job appears stalled.
    void runProcessing(jobId);

    return { jobId };
  });

export const getJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<OnboardingJobRow | null> => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("onboarding_jobs")
      .select("*")
      .eq("id", data.jobId)
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (row as OnboardingJobRow | null) ?? null;
  });

export const listActiveJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<OnboardingJobRow | null> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("onboarding_jobs")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["queued", "uploading", "processing", "succeeded"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as OnboardingJobRow | null) ?? null;
  });

export const cancelJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase
      .from("onboarding_jobs")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("id", data.jobId)
      .eq("user_id", userId);
    return { ok: true };
  });

/** Client can call this if a job appears stalled (no updated_at movement for >60s).
 *  It reads the job's storage paths and re-invokes processing from the last stage. */
export const resumeJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: job } = await supabase
      .from("onboarding_jobs")
      .select("id, status")
      .eq("id", data.jobId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!job) return { ok: false };
    if (job.status !== "processing" && job.status !== "uploading") return { ok: true };
    void runProcessing(data.jobId);
    return { ok: true };
  });

/** Discard the succeeded job row after the user consumes its result (or cancels the review). */
export const dismissJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ jobId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await supabase.from("onboarding_jobs").delete().eq("id", data.jobId).eq("user_id", userId);
    return { ok: true };
  });