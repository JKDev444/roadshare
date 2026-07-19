import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runChatCompletion } from "@/lib/ai-chat.server";

const DOC_TYPES = ["deed", "plat", "agreement", "amendment", "bylaws", "bid", "invoice", "correspondence", "other"] as const;

const InputSchema = z.object({
  title: z.string().min(1),
  mimeType: z.string().optional().default(""),
  textSample: z.string().optional().default(""),
});

export type ClassifyResult = {
  type: (typeof DOC_TYPES)[number];
  summary: string;
  confidence: number; // 0..1
};

/**
 * AI classification of an uploaded document. Returns a SUGGESTED type + summary.
 * These outputs are advisory only and are stored separately from human-verified facts.
 */
export const classifyDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<ClassifyResult> => {
    const fallback: ClassifyResult = { type: "other", summary: "", confidence: 0 };

    const sample = data.textSample.slice(0, 6000);
    const prompt = `You classify documents for a private-road community record system.
Allowed types: ${DOC_TYPES.join(", ")}.
Given the file title and any extracted text, respond with STRICT JSON only:
{"type": one of the allowed types, "summary": one or two plain-English sentences, "confidence": number 0 to 1}
Title: ${data.title}
File type: ${data.mimeType}
Extracted text (may be empty):
"""
${sample}
"""`;

    try {
      const result = await runChatCompletion({
        messages: [
          { role: "system", content: "You are a precise document classifier. Reply with JSON only, no markdown." },
          { role: "user", content: prompt },
        ],
      });
      if (!result.ok) return fallback;
      const cleaned = result.text.replace(/```json|```/g, "").trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) return fallback;
      const parsed = JSON.parse(match[0]);
      const type = DOC_TYPES.includes(parsed.type) ? parsed.type : "other";
      const confidence = Math.max(0, Math.min(1, Number(parsed.confidence) || 0));
      const summary = typeof parsed.summary === "string" ? parsed.summary.slice(0, 600) : "";
      return { type, summary, confidence };
    } catch {
      return fallback;
    }
  });
