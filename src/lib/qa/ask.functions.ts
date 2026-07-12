import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** A single piece of evidence the model may cite, with a stable [n] index. */
const EvidenceSchema = z.object({
  ref: z.number(),
  kind: z.enum(["clause", "document", "parcel", "road", "community"]),
  label: z.string(),
  detail: z.string(),
});

const InputSchema = z.object({
  question: z.string().min(1),
  evidence: z.array(EvidenceSchema),
});

export type QaEvidence = z.infer<typeof EvidenceSchema>;

export type QaCitation = { ref: number; label: string };

export type QaAnswerResult = {
  answer: string;
  confidence: number; // 0..1
  abstained: boolean;
  high_risk: boolean;
  risk_reason: string | null;
  citations: QaCitation[];
};

function abstain(reason: string): QaAnswerResult {
  return {
    answer:
      "I can't answer this confidently from the community's verified record. " +
      reason +
      " Add or verify the relevant documents and clauses, then ask again.",
    confidence: 0,
    abstained: true,
    high_risk: false,
    risk_reason: null,
    citations: [],
  };
}

/**
 * Evidence-first Q&A. The model MUST answer only from supplied evidence, cite
 * every claim with [n] references, report a calibrated confidence, abstain when
 * evidence is insufficient, and flag high-risk questions for professional review.
 * All outputs are advisory and must never be presented as legal advice.
 */
export const askCommunity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<QaAnswerResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return abstain("The answer engine is not configured.");
    if (data.evidence.length === 0)
      return abstain("There is no verified record to draw from yet.");

    const evidenceBlock = data.evidence
      .map((e) => `[${e.ref}] (${e.kind}) ${e.label}: ${e.detail}`)
      .join("\n");

    const prompt = `You answer questions about a specific private-road community using ONLY the numbered evidence below. This is not legal advice.

RULES:
- Use only the evidence. Never invent facts, dates, dollar amounts, or obligations.
- Cite EVERY factual claim with bracketed references like [1] or [2][3] that match the evidence numbers.
- If the evidence does not clearly support an answer, set "abstained" to true and keep "answer" a short honest statement of what's missing.
- "confidence" is 0 to 1 and must reflect how directly the evidence answers the question (partial/indirect evidence => lower).
- Set "high_risk" to true when the question involves active legal disputes, liability, litigation, foreclosure/liens, tax, or anything where a wrong answer could cause legal or financial harm. Put a one-sentence reason in "risk_reason" (recommend a qualified professional). Otherwise high_risk=false and risk_reason=null.
- Keep the answer concise and plain-English.

Respond with STRICT JSON only:
{"answer": string, "confidence": number, "abstained": boolean, "high_risk": boolean, "risk_reason": string or null, "citations": [{"ref": number, "label": string}]}

Evidence:
${evidenceBlock}

Question: ${data.question}`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are a precise, evidence-first assistant. Reply with a single JSON object only, no markdown." },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!res.ok) return abstain("The answer engine is temporarily unavailable.");
      const json = await res.json();
      const content: string = json?.choices?.[0]?.message?.content ?? "";
      const cleaned = content.replace(/```json|```/g, "").trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) return abstain("The answer engine returned no usable result.");
      const parsed = JSON.parse(match[0]);

      const validRefs = new Set(data.evidence.map((e) => e.ref));
      const citations: QaCitation[] = Array.isArray(parsed.citations)
        ? parsed.citations
            .map((c: unknown) => {
              const obj = c as { ref?: unknown; label?: unknown };
              return { ref: Number(obj?.ref), label: typeof obj?.label === "string" ? obj.label.slice(0, 200) : "" };
            })
            .filter((c: QaCitation) => validRefs.has(c.ref))
        : [];

      const abstained = Boolean(parsed.abstained) || citations.length === 0;
      const confidence = abstained ? 0 : Math.max(0, Math.min(1, Number(parsed.confidence) || 0));

      return {
        answer: typeof parsed.answer === "string" ? parsed.answer.slice(0, 4000) : "",
        confidence,
        abstained,
        high_risk: Boolean(parsed.high_risk),
        risk_reason: typeof parsed.risk_reason === "string" ? parsed.risk_reason.slice(0, 500) : null,
        citations,
      };
    } catch {
      return abstain("The answer could not be generated.");
    }
  });