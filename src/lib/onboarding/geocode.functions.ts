import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { GeocodeResult } from "./geocode.server";
import { geocodeAddressQuery, searchAddressCandidates } from "./geocode.server";

export const geocodeAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { query: string; state?: string }) => ({
    query: String(data.query ?? "").trim(),
    state: data.state ? String(data.state).trim() : undefined,
  }))
  .handler(async ({ data }): Promise<GeocodeResult | null> => {
    if (data.query.length < 5) return null;
    return geocodeAddressQuery(data.query, data.state);
  });

export const searchAddressSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { query: string }) => ({
    query: String(data.query ?? "").trim(),
  }))
  .handler(async ({ data }): Promise<GeocodeResult[]> => {
    if (data.query.length < 5) return [];
    return searchAddressCandidates(data.query);
  });