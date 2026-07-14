import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Draft returned by the AI. Nothing is written to the DB — the user reviews
 *  it in the wizard and hits "Create everything" to apply. */
export type CcrDraft = {
  community: {
    name: string;
    region: string | null;
    description: string | null;
  };
  lots: Array<{
    label: string;
    address?: string | null;
    owner_name?: string | null;
    area_sqft?: number | null;
    frontage_ft?: number | null;
  }>;
  roads: Array<{
    name: string;
    responsibility: "shared" | "private" | "public" | "association";
    surface?: string | null;
  }>;
  maintenance_summary: string | null;
  assessment_formula: string | null;
};

const InputSchema = z.object({
  filename: z.string().min(1),
  /** data:application/pdf;base64,... — capped ~10MB */
  dataUrl: z
    .string()
    .min(20)
    .max(15_000_000)
    .startsWith("data:"),
});

const EMPTY: CcrDraft = {
  community: { name: "", region: null, description: null },
  lots: [],
  roads: [],
  maintenance_summary: null,
  assessment_formula: null,
};

function coerce(raw: unknown): CcrDraft {
  if (!raw || typeof raw !== "object") return EMPTY;
  const r = raw as Record<string, unknown>;
  const community = (r.community ?? {}) as Record<string, unknown>;
  const rawLots = Array.isArray(r.lots) ? r.lots : [];
  const rawRoads = Array.isArray(r.roads) ? r.roads : [];

  const str = (v: unknown, max = 200): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t ? t.slice(0, max) : null;
  };
  const num = (v: unknown): number | null => {
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  return {
    community: {
      name: str(community.name, 160) ?? "",
      region: str(community.region, 160),
      description: str(community.description, 800),
    },
    lots: rawLots
      .slice(0, 200)
      .map((l): CcrDraft["lots"][number] | null => {
        if (!l || typeof l !== "object") return null;
        const lot = l as Record<string, unknown>;
        const label = str(lot.label ?? lot.number ?? lot.id, 40);
        if (!label) return null;
        return {
          label,
          address: str(lot.address, 200),
          owner_name: str(lot.owner_name ?? lot.owner, 160),
          area_sqft: num(lot.area_sqft ?? lot.area),
          frontage_ft: num(lot.frontage_ft ?? lot.frontage),
        };
      })
      .filter((x): x is CcrDraft["lots"][number] => x !== null),
    roads: rawRoads
      .slice(0, 40)
      .map((rd): CcrDraft["roads"][number] | null => {
        if (!rd || typeof rd !== "object") return null;
        const road = rd as Record<string, unknown>;
        const name = str(road.name, 160);
        if (!name) return null;
        const resp = String(road.responsibility ?? "shared").toLowerCase();
        const responsibility: CcrDraft["roads"][number]["responsibility"] =
          resp === "private" || resp === "public" || resp === "association"
            ? resp
            : "shared";
        return {
          name,
          responsibility,
          surface: str(road.surface, 80),
        };
      })
      .filter((x): x is CcrDraft["roads"][number] => x !== null),
    maintenance_summary: str(r.maintenance_summary, 1200),
    assessment_formula: str(r.assessment_formula, 600),
  };
}

/** Read a CCR / plat PDF and draft a starter community record. */
export const extractCcr = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<CcrDraft> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return EMPTY;

    const mimeMatch = data.dataUrl.match(/^data:([^;]+);base64,/);
    const mime = mimeMatch?.[1] ?? "application/pdf";

    const prompt = `You are reading a Covenants, Conditions & Restrictions (CCR), plat, or subdivision declaration for a private-road community. Draft a starter community record.

Return STRICT JSON only, matching this exact shape:
{
  "community": { "name": string, "region": string|null, "description": string|null },
  "lots":  [ { "label": string, "address": string|null, "owner_name": string|null, "area_sqft": number|null, "frontage_ft": number|null } ],
  "roads": [ { "name": string, "responsibility": "shared"|"private"|"public"|"association", "surface": string|null } ],
  "maintenance_summary": string|null,
  "assessment_formula": string|null
}

Rules:
- community.name: the subdivision or road name (e.g. "Heron Woods PUD").
- community.region: "County, State" if you can find it.
- community.description: one plain-English sentence about the community.
- lots: enumerate every lot you can find. Use the plat's own lot numbers as "label". Include address/owner/area/frontage only when the document states them — otherwise null.
- roads: name each named street or common road; pick the responsibility based on who the CCR says maintains it (association-maintained → "association"; homeowner shared → "shared"; dedicated to city/county → "public").
- maintenance_summary: one paragraph, plain English, explaining who maintains the roads and common areas.
- assessment_formula: how costs are split among owners (e.g. "1/47th per lot") if stated.
- No markdown, no code fences, no commentary. JSON object only.`;

    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-pro",
          messages: [
            {
              role: "system",
              content:
                "You extract structured community facts from CCR/plat PDFs. Respond with a single JSON object. No markdown.",
            },
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                {
                  type: "file",
                  file: { filename: data.filename.slice(0, 120), file_data: `data:${mime};base64,${data.dataUrl.split(",")[1] ?? ""}` },
                },
              ],
            },
          ],
        }),
      });
      if (!res.ok) {
        console.error("extractCcr gateway", res.status, await res.text().catch(() => ""));
        return EMPTY;
      }
      const json = await res.json();
      const content: string = json?.choices?.[0]?.message?.content ?? "";
      const cleaned = content.replace(/```json|```/g, "").trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) return EMPTY;
      const parsed = JSON.parse(match[0]);
      return coerce(parsed);
    } catch (err) {
      console.error("extractCcr error", err);
      return EMPTY;
    }
  });