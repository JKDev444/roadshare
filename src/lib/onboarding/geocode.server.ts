export type GeocodeResult = {
  lat: number;
  lng: number;
  label: string;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  source: "mapbox" | "openstreetmap" | "census";
};

// ---- Mapbox Search Box API (primary) ---------------------------------------
// Airbnb/Zillow-tier per-keystroke autocomplete via the Lovable connector gateway.
// Free tier: 100k sessions/mo. A session token bundles /suggest + /retrieve as one bill.

const MAPBOX_GATEWAY = "https://connector-gateway.lovable.dev/mapbox";

function mapboxHeaders(): Record<string, string> | null {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.MAPBOX_API_KEY;
  if (!lovableKey || !connKey) return null;
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connKey,
  };
}

type MapboxSuggestion = {
  name: string;
  mapbox_id: string;
  feature_type: string;
  full_address?: string;
  place_formatted?: string;
  context?: {
    place?: { name?: string };
    region?: { name?: string; region_code?: string };
    postcode?: { name?: string };
  };
};

type MapboxRetrieveFeature = {
  properties: {
    full_address?: string;
    name?: string;
    context?: MapboxSuggestion["context"];
    coordinates?: { longitude: number; latitude: number };
  };
  geometry?: { coordinates: [number, number] };
};

async function mapboxSuggest(query: string, sessionToken: string): Promise<MapboxSuggestion[]> {
  const headers = mapboxHeaders();
  if (!headers) return [];
  const url = new URL(`${MAPBOX_GATEWAY}/search/searchbox/v1/suggest`);
  url.searchParams.set("q", query);
  url.searchParams.set("session_token", sessionToken);
  url.searchParams.set("country", "us");
  url.searchParams.set("types", "address");
  url.searchParams.set("limit", "6");
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) return [];
  const json = (await res.json()) as { suggestions?: MapboxSuggestion[] };
  return json.suggestions ?? [];
}

async function mapboxRetrieve(mapboxId: string, sessionToken: string): Promise<GeocodeResult | null> {
  const headers = mapboxHeaders();
  if (!headers) return null;
  const url = new URL(`${MAPBOX_GATEWAY}/search/searchbox/v1/retrieve/${encodeURIComponent(mapboxId)}`);
  url.searchParams.set("session_token", sessionToken);
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) return null;
  const json = (await res.json()) as { features?: MapboxRetrieveFeature[] };
  const feat = json.features?.[0];
  if (!feat) return null;
  const coords = feat.properties.coordinates ?? (feat.geometry ? { longitude: feat.geometry.coordinates[0], latitude: feat.geometry.coordinates[1] } : null);
  if (!coords) return null;
  const ctx = feat.properties.context;
  return {
    lat: coords.latitude,
    lng: coords.longitude,
    label: feat.properties.full_address ?? feat.properties.name ?? "",
    city: ctx?.place?.name ?? null,
    state: ctx?.region?.region_code ?? ctx?.region?.name ?? null,
    postcode: ctx?.postcode?.name ?? null,
    source: "mapbox",
  };
}

function suggestionToResult(s: MapboxSuggestion): GeocodeResult & { mapboxId: string } {
  const ctx = s.context;
  return {
    lat: 0, // placeholder — client calls retrieve on selection
    lng: 0,
    label: s.full_address ?? `${s.name}${s.place_formatted ? ", " + s.place_formatted : ""}`,
    city: ctx?.place?.name ?? null,
    state: ctx?.region?.region_code ?? ctx?.region?.name ?? null,
    postcode: ctx?.postcode?.name ?? null,
    source: "mapbox",
    mapboxId: s.mapbox_id,
  };
}

export async function mapboxSuggestAddresses(
  query: string,
  sessionToken: string,
): Promise<Array<GeocodeResult & { mapboxId: string }>> {
  const suggestions = await mapboxSuggest(query, sessionToken);
  return suggestions.map(suggestionToResult);
}

export async function mapboxRetrieveAddress(
  mapboxId: string,
  sessionToken: string,
): Promise<GeocodeResult | null> {
  return mapboxRetrieve(mapboxId, sessionToken);
}

// ---- Fallbacks -------------------------------------------------------------

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

export async function geocodeAddressQuery(query: string, state?: string): Promise<GeocodeResult | null> {
  // Mapbox one-shot (single-call geocode via suggest+retrieve with a fresh token).
  const headers = mapboxHeaders();
  if (headers) {
    const sessionToken = crypto.randomUUID();
    const suggestions = await mapboxSuggest(state ? `${query}, ${state}` : query, sessionToken);
    const first = suggestions[0];
    if (first) {
      const retrieved = await mapboxRetrieve(first.mapbox_id, sessionToken);
      if (retrieved) return retrieved;
    }
  }
  const osm = await geocodeWithOpenStreetMap(query, state);
  if (osm) return osm;
  const census = await searchWithCensus(query);
  return census[0] ?? null;
}

export async function searchAddressCandidates(query: string): Promise<GeocodeResult[]> {
  const headers = mapboxHeaders();
  if (headers) {
    const sessionToken = crypto.randomUUID();
    const suggestions = await mapboxSuggest(query, sessionToken);
    if (suggestions.length > 0) {
      // For legacy callers, retrieve top 3 to get coords.
      const results: GeocodeResult[] = [];
      for (const s of suggestions.slice(0, 3)) {
        const r = await mapboxRetrieve(s.mapbox_id, sessionToken);
        if (r) results.push(r);
      }
      if (results.length) return results;
    }
  }
  return searchWithCensus(query);
}