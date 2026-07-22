import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

import type { Json } from "@/integrations/supabase/types";

export type MyRoad = {
  id: string;
  name: string | null;
  state: Json;
  created_at: string;
  updated_at: string;
};

export const getMyRoad = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("roads")
      .select("id, name, state, created_at, updated_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as MyRoad | null;
  });

export const createMyRoad = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { name: string; homes?: unknown }) => ({
    name: (input?.name ?? "").trim().slice(0, 80) || "My road",
    homes: Array.isArray(input?.homes) ? input!.homes : [],
  }))
  .handler(async ({ data, context }) => {
    const state = { homes: data.homes, roadName: data.name } as unknown as Json;
    const { data: row, error } = await context.supabase
      .from("roads")
      .upsert(
        { user_id: context.userId, name: data.name, state },
        { onConflict: "user_id" },
      )
      .select("id, name, state, created_at, updated_at")
      .single();
    if (error) throw error;
    return row as MyRoad;
  });

export const resetMyRoad = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { error } = await context.supabase
      .from("roads")
      .delete()
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });

export const saveMyRoadState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { state: Json; name?: string | null }) => ({
    state: input.state,
    name: typeof input.name === "string" ? input.name.trim().slice(0, 80) : undefined,
  }))
  .handler(async ({ data, context }) => {
    const patch: { state: Json; name?: string } = { state: data.state };
    if (typeof data.name === "string" && data.name.length > 0) patch.name = data.name;
    const { error } = await context.supabase
      .from("roads")
      .update(patch)
      .eq("user_id", context.userId);
    if (error) throw error;
    return { ok: true };
  });