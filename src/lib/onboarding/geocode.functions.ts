import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type GeocodeResult = {
  lat: number;
  lng: number;
  label: string;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  source: "openstreetmap" | "census";
};

type NominatimHit = {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
  };
};

type CensusResponse = {
  result?: {
    addressMatches?: Array<{
      matchedAddress?: string;
      coordinates?: { x?: number; y?: number };
      addressComponents?: { city?: string; state?: string; zip?: string };
    }>;
  };
};

function pickCity(address?: NominatimHit["address"]) {
  return address?.city ?? address?.town ?? address?.village ?? null;
}

async function geocodeWithOpenStreetMap(query: string, state?: string): Promise<GeocodeResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", state ? `${query}, ${state}` : query);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "us");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "RoadShare/1.0 (address geocoding)",
    },
  });
  if (!res.ok) return null;
  const hits = (await res.json()) as NominatimHit[];
  const first = hits[0];
  if (!first) return null;
  const lat = Number(first.lat);
  const lng = Number(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    lat,
    lng,
    label: first.display_name,
    city: pickCity(first.address),
    state: first.address?.state ?? null,
    source: "openstreetmap",
  };
}

async function geocodeWithCensus(query: string): Promise<GeocodeResult | null> {
  const matches = await searchWithCensus(query);
  return matches[0] ?? null;
}

async function searchWithCensus(query: string): Promise<GeocodeResult[]> {
  const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  url.searchParams.set("address", query);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");

  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) return [];
  const json = (await res.json()) as CensusResponse;
  const hits: GeocodeResult[] = [];
  for (const match of (json.result?.addressMatches ?? []).slice(0, 6)) {
    const lat = match.coordinates?.y;
    const lng = match.coordinates?.x;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    hits.push({
      lat: lat as number,
      lng: lng as number,
      label: match.matchedAddress || query,
      city: match.addressComponents?.city ?? null,
      state: match.addressComponents?.state ?? null,
      postcode: match.addressComponents?.zip ?? null,
      source: "census",
    });
  }
  return hits;
}

export const geocodeAddress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { query: string; state?: string }) => ({
    query: String(data.query ?? "").trim(),
    state: data.state ? String(data.state).trim() : undefined,
  }))
  .handler(async ({ data }): Promise<GeocodeResult | null> => {
    if (data.query.length < 5) return null;
    const osm = await geocodeWithOpenStreetMap(data.query, data.state);
    if (osm) return osm;
    return geocodeWithCensus(data.query);
  });

export const searchAddressSuggestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { query: string }) => ({
    query: String(data.query ?? "").trim(),
  }))
  .handler(async ({ data }): Promise<GeocodeResult[]> => {
    if (data.query.length < 5) return [];
    return searchWithCensus(data.query);
  });