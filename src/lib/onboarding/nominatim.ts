/** Client-side Nominatim (OpenStreetMap) address search.
 *
 * Nominatim usage policy: send a descriptive User-Agent (browsers set this
 * automatically, but we identify ourselves in the referrer/query) and cap
 * requests to ~1/sec. We debounce in the calling component and cache the
 * last few queries here.
 */

export type NominatimHit = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country_code?: string;
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

const cache = new Map<string, NominatimHit[]>();
const MAX_CACHE = 24;
let lastCall = 0;

function keyFor(q: string, state?: string) {
  return `${(state ?? "").toLowerCase()}|${q.toLowerCase().trim()}`;
}

export async function searchAddresses(
  query: string,
  opts: { state?: string; countryCode?: string; signal?: AbortSignal } = {},
): Promise<NominatimHit[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const cacheKey = keyFor(q, opts.state);
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // Respect Nominatim rate limit (1 req/sec).
  const now = Date.now();
  const wait = Math.max(0, 1000 - (now - lastCall));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", opts.state ? `${q}, ${opts.state}` : q);
  url.searchParams.set("format", "json");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "6");
  if (opts.countryCode ?? "us") {
    url.searchParams.set("countrycodes", (opts.countryCode ?? "us").toLowerCase());
  }

  const res = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    signal: opts.signal,
  });
  if (!res.ok) return [];
  const raw = (await res.json()) as NominatimHit[];
  if (raw.length === 0) {
    const fallback = await searchCensusAddress(q, opts.signal);
    if (fallback.length > 0) {
      if (cache.size >= MAX_CACHE) {
        const first = cache.keys().next().value;
        if (first) cache.delete(first);
      }
      cache.set(cacheKey, fallback);
      return fallback;
    }
  }
  // Nominatim occasionally returns duplicate place_ids across pages; dedupe
  // so React list keys stay unique in the autocomplete dropdown.
  const seen = new Set<number>();
  const data = raw.filter((h) => {
    if (seen.has(h.place_id)) return false;
    seen.add(h.place_id);
    return true;
  });
  if (cache.size >= MAX_CACHE) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(cacheKey, data);
  return data;
}

async function searchCensusAddress(query: string, signal?: AbortSignal): Promise<NominatimHit[]> {
  const url = new URL("https://geocoding.geo.census.gov/geocoder/locations/onelineaddress");
  url.searchParams.set("address", query);
  url.searchParams.set("benchmark", "Public_AR_Current");
  url.searchParams.set("format", "json");
  try {
    const res = await fetch(url.toString(), { headers: { Accept: "application/json" }, signal });
    if (!res.ok) return [];
    const json = (await res.json()) as CensusResponse;
    const hits: NominatimHit[] = [];
    for (const [index, match] of (json.result?.addressMatches ?? []).slice(0, 6).entries()) {
        const lat = match.coordinates?.y;
        const lon = match.coordinates?.x;
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        hits.push({
          place_id: -1 - index,
          display_name: match.matchedAddress ?? query,
          lat: String(lat),
          lon: String(lon),
          address: {
            city: match.addressComponents?.city,
            state: match.addressComponents?.state,
            postcode: match.addressComponents?.zip,
          },
        });
    }
    return hits;
  } catch {
    return [];
  }
}

export function formatHit(hit: NominatimHit): string {
  const a = hit.address ?? {};
  const parts = [
    [a.house_number, a.road].filter(Boolean).join(" "),
    a.city ?? a.town ?? a.village,
    a.state,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : hit.display_name;
}