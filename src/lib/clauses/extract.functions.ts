import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CATEGORIES = [
  "maintenance_responsibility",
  "cost_sharing",
  "access_rights",
  "easement",
  "use_restriction",
  "enforcement",
  "dispute_resolution",
  "amendment_process",
  "insurance",
  "other",
] as const;

const InputSchema = z.object({
  title: z.string().min(1),
  text: z.string().min(1),
});

export type ExtractedClause = {
  title: string;
  category: (typeof CATEGORIES)[number];
  clause_text: string;
  summary: string;
  confidence: number; // 0..1
};

/**
 * AI extraction of individual provisions ("clauses") from a document's text.
 * Outputs are SUGGESTIONS only and are stored separately from human-verified facts.
 */
export const extractClauses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<ExtractedClause[]> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return [];

    const sample = data.text.slice(0, 12000);
    const prompt = `You extract individual legal provisions ("clauses") from private-road community documents.
Allowed categories: ${CATEGORIES.join(", ")}.
Read the document text and identify each distinct provision. Respond with STRICT JSON only, an array:
[{"title": short label, "category": one allowed category, "clause_text": the exact or lightly-trimmed provision text, "summary": one plain-English sentence, "confidence": number 0 to 1}]
Return at most 12 clauses. If none are found, return [].
Document title: ${data.title}
Document text:
"""
${sample}
"""`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a precise legal-clause extractor. Reply with a JSON array only, no markdown." },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!res.ok) return [];
      const json = await res.json();
      const content: string = json?.choices?.[0]?.message?.content ?? "";
      const cleaned = content.replace(/```json|```/g, "").trim();
      const match = cleaned.match(/\[[\s\S]*\]/);
      if (!match) return [];
      const parsed = JSON.parse(match[0]);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .slice(0, 12)
        .map((c): ExtractedClause => ({
          title: typeof c.title === "string" ? c.title.slice(0, 160) : "Untitled clause",
          category: CATEGORIES.includes(c.category) ? c.category : "other",
          clause_text: typeof c.clause_text === "string" ? c.clause_text.slice(0, 4000) : "",
          summary: typeof c.summary === "string" ? c.summary.slice(0, 400) : "",
          confidence: Math.max(0, Math.min(1, Number(c.confidence) || 0)),
        }))
        .filter((c) => c.clause_text.trim().length > 0 || c.title !== "Untitled clause");
    } catch {
      return [];
    }
  });