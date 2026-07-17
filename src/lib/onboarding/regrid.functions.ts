import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Simplified parcel record returned to the browser. */
export type RegridParcel = {
  id: string;
  headline: string;
  address: string | null;
  owner: string | null;
  areaSqft: number | null;
  lat: number;
  lng: number;
  /** GeoJSON Polygon or MultiPolygon geometry (WGS84). */
  geometry: GeoJsonPolygon | GeoJsonMultiPolygon;
};

type GeoJsonPolygon = { type: "Polygon"; coordinates: number[][][] };
type GeoJsonMultiPolygon = { type: "MultiPolygon"; coordinates: number[][][][] };

type RegridFeature = {
  type: "Feature";
  geometry: GeoJsonPolygon | GeoJsonMultiPolygon | null;
  properties: {
    headline?: string;
    ll_uuid?: string;
    path?: string;
    fields?: {
      ogc_fid?: number;
      address?: string | null;
      owner?: string | null;
      ll_gissqft?: number | null;
      gisacre?: number | null;
      lat?: number | null;
      lon?: number | null;
    };
  };
};

type RegridResponse = {
  parcels?: { features?: RegridFeature[] };
  status?: string;
  message?: string;
};

function centroid(geom: RegridFeature["geometry"]): { lat: number; lng: number } | null {
  if (!geom) return null;
  const rings =
    geom.type === "Polygon"
      ? geom.coordinates
      : geom.type === "MultiPolygon"
        ? geom.coordinates.flat()
        : [];
  let x = 0;
  let y = 0;
  let n = 0;
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      x += lng;
      y += lat;
      n++;
    }
  }
  if (n === 0) return null;
  return { lat: y / n, lng: x / n };
}

function toParcel(f: RegridFeature): RegridParcel | null {
  if (!f.geometry) return null;
  const p = f.properties ?? {};
  const fields = p.fields ?? {};
  const c = centroid(f.geometry) ?? { lat: fields.lat ?? 0, lng: fields.lon ?? 0 };
  const id = p.ll_uuid ?? p.path ?? String(fields.ogc_fid ?? `${c.lat},${c.lng}`);
  const areaSqft =
    typeof fields.ll_gissqft === "number"
      ? Math.round(fields.ll_gissqft)
      : typeof fields.gisacre === "number"
        ? Math.round(fields.gisacre * 43560)
        : null;
  return {
    id,
    headline: p.headline ?? fields.address ?? "Parcel",
    address: fields.address ?? null,
    owner: fields.owner ?? null,
    areaSqft,
    lat: c.lat,
    lng: c.lng,
    geometry: f.geometry,
  };
}

async function callRegrid(url: URL): Promise<RegridResponse> {
  const token = process.env.REGRID_API_TOKEN;
  if (!token) throw new Error("Regrid API token is not configured.");
  url.searchParams.set("token", token);
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  const bodyText = await res.text();
  if (!res.ok) {
    console.error(`[regrid] ${res.status}: ${bodyText.slice(0, 300)}`);
    throw new Error(`Regrid request failed (${res.status}). Check your API token and plan coverage.`);
  }
  try {
    return JSON.parse(bodyText) as RegridResponse;
  } catch {
    throw new Error("Regrid returned an invalid response.");
  }
}

/** Look up parcels near a single lat/lon coordinate. Radius in meters. */
export const regridPointLookup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { lat: number; lng: number; radius?: number; limit?: number }) => data,
  )
  .handler(async ({ data }) => {
    const url = new URL("https://app.regrid.com/api/v2/parcels/point");
    url.searchParams.set("lat", String(data.lat));
    url.searchParams.set("lon", String(data.lng));
    url.searchParams.set("radius", String(Math.max(10, Math.min(2000, data.radius ?? 300))));
    url.searchParams.set("limit", String(Math.max(1, Math.min(200, data.limit ?? 200))));
    const json = await callRegrid(url);
    const features = json.parcels?.features ?? [];
    const parcels = features
      .map(toParcel)
      .filter((p): p is RegridParcel => p !== null);
    return { parcels, sandboxHint: features.length === 0 };
  });

/** Search parcels within a rectangular bounding box (lng/lat). */
export const regridBboxLookup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { south: number; west: number; north: number; east: number; limit?: number }) => data,
  )
  .handler(async ({ data }) => {
    const geometry = {
      type: "Polygon" as const,
      coordinates: [
        [
          [data.west, data.south],
          [data.east, data.south],
          [data.east, data.north],
          [data.west, data.north],
          [data.west, data.south],
        ],
      ],
    };
    const url = new URL("https://app.regrid.com/api/v2/parcels/area");
    url.searchParams.set("geojson", JSON.stringify(geometry));
    url.searchParams.set("limit", String(Math.max(1, Math.min(500, data.limit ?? 300))));
    const json = await callRegrid(url);
    const features = json.parcels?.features ?? [];
    const parcels = features
      .map(toParcel)
      .filter((p): p is RegridParcel => p !== null);
    return { parcels };
  });