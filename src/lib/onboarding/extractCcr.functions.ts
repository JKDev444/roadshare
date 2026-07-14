import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { coerceCcrDraft, EMPTY_CCR_DRAFT, type CcrDraft } from "./ccrDraft";

const InputSchema = z.object({
  filename: z.string().min(1),
  dataUrl: z.string().min(20).max(15_000_000).startsWith("data:"),
});

export const extractCcr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<CcrDraft> => {
    const { generateText } = await import("ai");
    const { createLovableAiGatewayProvider } = await import("@/lib/ai-gateway.server");

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Lovable AI is not configured for this project.");

    const mime = data.dataUrl.match(/^data:([^;]+);base64,/)?.[1] ?? "application/pdf";
    const base64 = data.dataUrl.split(",")[1] ?? "";
    if (!base64) throw new Error("The PDF could not be read. Please try exporting it again.");

    const prompt = `Read this CC&R, plat, or subdivision declaration and draft the minimum starter setup for a private-road community.

Return STRICT JSON only:
{
  "community": { "name": string, "region": string|null, "description": string|null },
  "lots": [{ "label": string, "address": string|null, "owner_name": string|null, "area_sqft": number|null, "frontage_ft": number|null }],
  "roads": [{ "name": string, "responsibility": "shared"|"private"|"public"|"association", "surface": string|null }],
  "maintenance_summary": string|null,
  "assessment_formula": string|null
}

Rules:
- Prefer the subdivision / PUD / road-group name for community.name.
- Use "County, State" for region when present.
- Extract every lot number you can identify. A label alone is useful.
- Extract named roads, access easements, and common maintenance areas.
- Summarize who maintains roads/common areas and how costs are shared, only when stated.
- Do not invent addresses, owners, geometry, or dollar amounts.`;

    try {
      const gateway = createLovableAiGatewayProvider(apiKey);
      const result = await generateText({
        model: gateway("openai/gpt-5.5"),
        system: "You extract structured setup facts from CC&R and plat PDFs. Reply with one JSON object only.",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              { type: "file", data: base64, filename: data.filename.slice(0, 120), mediaType: mime },
            ],
          },
        ],
      });

      const cleaned = result.text.replace(/```json|```/g, "").trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("The PDF was read, but no setup details were found.");
      const draft = coerceCcrDraft(JSON.parse(match[0]));
      if (!draft.community.name && draft.lots.length === 0 && draft.roads.length === 0) {
        throw new Error("The PDF did not contain enough lot or road details to start setup.");
      }
      return draft;
    } catch (err) {
      console.error("extractCcr error", err);
      if (err instanceof Error) throw err;
      return EMPTY_CCR_DRAFT;
    }
  });