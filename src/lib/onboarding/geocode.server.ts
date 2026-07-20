export type GeocodeResult = {
  lat: number;
  lng: number;
  label: string;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  source: "openstreetmap" | "census";
};

// Address search runs against the US Census onelineaddress geocoder first
// (best US coverage including rural addresses), falling back to OpenStreetMap
// Nominatim when Census returns nothing. No Mapbox anywhere.

type NominatimHit = {
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    postcode?: string;
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
    postcode: first.address?.postcode ?? null,
    source: "openstreetmap",
  };
}

async function searchWithNominatim(query: string): Promise<GeocodeResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");
  url.searchParams.set("countrycodes", "us");
  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "RoadShare/1.0 (address geocoding)",
    },
  });
  if (!res.ok) return [];
  const hits = (await res.json()) as NominatimHit[];
  const out: GeocodeResult[] = [];
  for (const h of hits) {
    const lat = Number(h.lat);
    const lng = Number(h.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    out.push({
      lat,
      lng,
      label: h.display_name,
      city: pickCity(h.address),
      state: h.address?.state ?? null,
      postcode: h.address?.postcode ?? null,
      source: "openstreetmap",
    });
  }
  return out;
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
  const census = await searchWithCensus(query);
  if (census[0]) return census[0];
  const osm = await geocodeWithOpenStreetMap(query, state);
  return osm;
}

export async function searchAddressCandidates(query: string): Promise<GeocodeResult[]> {
  const census = await searchWithCensus(query);
  if (census.length > 0) return census;
  return searchWithNominatim(query);
}

// ---- Unified suggest -------------------------------------------------------
// US Census first (best rural coverage), Nominatim fallback. Coordinates come
// back on every hit so callers never need a second "retrieve" round-trip.
export type SuggestHit = {
  label: string;
  city?: string | null;
  state?: string | null;
  postcode?: string | null;
  /** Coordinates. Always present — every source returns them inline. */
  lat: number;
  lng: number;
  source: "census" | "openstreetmap";
};

export async function suggestAddressesUnified(
  query: string,
  _sessionToken: string,
): Promise<SuggestHit[]> {
  const census = await searchWithCensus(query);
  if (census.length > 0) {
    return census.map((c) => ({
      label: toTitleCase(c.label),
      city: c.city,
      state: c.state,
      postcode: c.postcode,
      lat: c.lat,
      lng: c.lng,
      source: "census" as const,
    }));
  }
  const osm = await searchWithNominatim(query);
  return osm.map((c) => ({
    label: c.label,
    city: c.city,
    state: c.state,
    postcode: c.postcode,
    lat: c.lat,
    lng: c.lng,
    source: "openstreetmap" as const,
  }));
}

// Census returns everything in ALL CAPS. Title-case for a friendlier UI.
function toTitleCase(input: string): string {
  return input
    .toLowerCase()
    .split(/(\s+|,)/)
    .map((tok) => {
      if (/^\s+$/.test(tok) || tok === ",") return tok;
      // Keep 2-letter state codes uppercase (e.g. "wa" -> "WA").
      if (/^[a-z]{2}$/.test(tok) && US_STATES.has(tok.toUpperCase())) return tok.toUpperCase();
      // Numeric tokens (house #, ZIP) stay as-is.
      if (/^\d+(-\d+)?$/.test(tok)) return tok;
      // Directional suffixes like NW/SE stay uppercase.
      if (/^(n|s|e|w|nw|ne|sw|se)$/i.test(tok)) return tok.toUpperCase();
      return tok.charAt(0).toUpperCase() + tok.slice(1);
    })
    .join("");
}

const US_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA","ME",
  "MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA",
  "RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC",
]);