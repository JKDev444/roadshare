import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { GeocodeResult } from "./geocode.server";

export const geocodeAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { query: string; state?: string }) => ({
    query: String(data.query ?? "").trim(),
    state: data.state ? String(data.state).trim() : undefined,
  }))
  .handler(async ({ data }): Promise<GeocodeResult | null> => {
    if (data.query.length < 5) return null;
    const { geocodeAddressQuery } = await import("./geocode.server");
    return geocodeAddressQuery(data.query, data.state);
  });

export const searchAddressSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { query: string }) => ({
    query: String(data.query ?? "").trim(),
  }))
  .handler(async ({ data }): Promise<GeocodeResult[]> => {
    if (data.query.length < 5) return [];
    const { searchAddressCandidates } = await import("./geocode.server");
    return searchAddressCandidates(data.query);
  });

/** Mapbox Search Box: per-keystroke suggestions. Cheap — session_token bundles the flow. */
export const suggestAddresses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { query: string; sessionToken: string }) => ({
    query: String(data.query ?? "").trim(),
    sessionToken: String(data.sessionToken ?? "").trim(),
  }))
  .handler(async ({ data }) => {
    if (data.query.length < 3 || !data.sessionToken) return [];
    const { mapboxSuggestAddresses } = await import("./geocode.server");
    return mapboxSuggestAddresses(data.query, data.sessionToken);
  });

/** Mapbox Search Box: retrieve final coordinates for a picked suggestion. */
export const retrieveAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { mapboxId: string; sessionToken: string }) => ({
    mapboxId: String(data.mapboxId ?? "").trim(),
    sessionToken: String(data.sessionToken ?? "").trim(),
  }))
  .handler(async ({ data }): Promise<GeocodeResult | null> => {
    if (!data.mapboxId || !data.sessionToken) return null;
    const { mapboxRetrieveAddress } = await import("./geocode.server");
    return mapboxRetrieveAddress(data.mapboxId, data.sessionToken);
  });