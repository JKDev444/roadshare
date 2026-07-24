import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

function makeSlug() {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export const createShare = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { snapshot: Json }) => ({ snapshot: input.snapshot }))
  .handler(async ({ data, context }) => {
    const { data: road, error: rErr } = await context.supabase
      .from("roads")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (rErr) throw rErr;
    if (!road) throw new Error("No road to share yet.");
    // Try to reuse an existing share for this road (idempotent)
    const { data: existing } = await context.supabase
      .from("road_shares")
      .select("slug")
      .eq("road_id", road.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (existing?.slug) {
      await context.supabase
        .from("road_shares")
        .update({ snapshot: data.snapshot })
        .eq("slug", existing.slug);
      return { slug: existing.slug as string };
    }
    let slug = makeSlug();
    for (let i = 0; i < 5; i++) {
      const { error } = await context.supabase.from("road_shares").insert({
        road_id: road.id,
        user_id: context.userId,
        slug,
        snapshot: data.snapshot,
      });
      if (!error) return { slug };
      slug = makeSlug();
    }
    throw new Error("Could not generate a share link. Try again.");
  });