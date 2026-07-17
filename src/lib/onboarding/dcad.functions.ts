import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Dallas Central Appraisal District (DCAD) parcel lookups.
 * Uses the public City of Dallas ArcGIS FeatureServer — no API key, no quota.
 * Coverage: Dallas County only. Multi-county support is a follow-up.
 */

const DCAD_LAYER =
  "https://services2.arcgis.com/rwnOSbfKSwyTBcwN/arcgis/rest/services/DallasTaxParcels/FeatureServer/0/query";

export type GeoJsonPolygon = { type: "Polygon"; coordinates: number[][][] };
export type GeoJsonMultiPolygon = { type: "MultiPolygon"; coordinates: number[][][][] };

export type DcadParcel = {
  id: string;
  headline: string;
  address: string | null;
  owner: string | null;
  city: string | null;
  areaSqft: number | null;
  lat: number;
  lng: number;
  geometry: GeoJsonPolygon | GeoJsonMultiPolygon;
};

type DcadFeature = {
  type: "Feature";
  geometry: GeoJsonPolygon | GeoJsonMultiPolygon | null;
  properties: {
    OBJECTID?: number;
    ACCT?: string | null;
    ST_NUM?: string | null;
    ST_DIR?: string | null;
    ST_NAME?: string | null;
    ST_TYPE?: string | null;
    CITY?: string | null;
    TAXPANAME1?: string | null;
    AREA_FEET?: number | null;
  };
};

function centroid(geom: DcadFeature["geometry"]): { lat: number; lng: number } | null {
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

function formatAddress(p: DcadFeature["properties"]): string | null {
  const parts = [p.ST_NUM, p.ST_DIR, p.ST_NAME, p.ST_TYPE]
    .map((s) => (s ?? "").trim())
    .filter(Boolean);
  if (parts.length === 0) return null;
  const street = parts.join(" ");
  const city = (p.CITY ?? "").trim();
  return city ? `${street}, ${city}` : street;
}

function toParcel(f: DcadFeature): DcadParcel | null {
  if (!f.geometry) return null;
  const p = f.properties ?? {};
  const c = centroid(f.geometry);
  if (!c) return null;
  const address = formatAddress(p);
  const id = (p.ACCT && p.ACCT.trim()) || (p.OBJECTID != null ? `oid:${p.OBJECTID}` : `${c.lat},${c.lng}`);
  return {
    id,
    headline: address ?? `Parcel ${p.ACCT ?? ""}`.trim(),
    address,
    owner: p.TAXPANAME1?.trim() || null,
    city: p.CITY?.trim() || null,
    areaSqft: typeof p.AREA_FEET === "number" ? Math.round(p.AREA_FEET) : null,
    lat: c.lat,
    lng: c.lng,
    geometry: f.geometry,
  };
}

const OUT_FIELDS = "ACCT,ST_NUM,ST_DIR,ST_NAME,ST_TYPE,CITY,TAXPANAME1,AREA_FEET,OBJECTID";

async function queryDcad(params: URLSearchParams): Promise<DcadParcel[]> {
  params.set("outFields", OUT_FIELDS);
  params.set("returnGeometry", "true");
  params.set("outSR", "4326");
  params.set("f", "geojson");
  params.set("where", "1=1");
  const res = await fetch(`${DCAD_LAYER}?${params.toString()}`, {
    headers: { Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[dcad] ${res.status}: ${text.slice(0, 300)}`);
    throw new Error(`Dallas parcel service failed (${res.status}).`);
  }
  let json: { features?: DcadFeature[] };
  try {
    json = JSON.parse(text) as { features?: DcadFeature[] };
  } catch {
    throw new Error("Dallas parcel service returned an invalid response.");
  }
  const features = json.features ?? [];
  const parcels: DcadParcel[] = [];
  const seen = new Set<string>();
  for (const f of features) {
    const p = toParcel(f);
    if (!p) continue;
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    parcels.push(p);
  }
  return parcels;
}

/** Look up parcels near a lat/lon inside a square envelope (meters). */
export const dcadPointLookup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { lat: number; lng: number; radius?: number; limit?: number }) => data,
  )
  .handler(async ({ data }) => {
    const radius = Math.max(50, Math.min(2000, data.radius ?? 400));
    // Approx meters → degrees. 1 deg lat ≈ 111_111 m; lng scales by cos(lat).
    const dLat = radius / 111_111;
    const dLng = radius / (111_111 * Math.max(0.2, Math.cos((data.lat * Math.PI) / 180)));
    const params = new URLSearchParams({
      geometry: JSON.stringify({
        xmin: data.lng - dLng,
        ymin: data.lat - dLat,
        xmax: data.lng + dLng,
        ymax: data.lat + dLat,
        spatialReference: { wkid: 4326 },
      }),
      geometryType: "esriGeometryEnvelope",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      resultRecordCount: String(Math.max(1, Math.min(500, data.limit ?? 300))),
    });
    const parcels = await queryDcad(params);
    return { parcels };
  });

/** Look up parcels that intersect a user-drawn GeoJSON polygon (WGS84). */
export const dcadPolygonLookup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { polygon: GeoJsonPolygon; limit?: number }) => data,
  )
  .handler(async ({ data }) => {
    // ArcGIS esriGeometryPolygon uses { rings: number[][][] }.
    const rings = data.polygon.coordinates;
    const params = new URLSearchParams({
      geometry: JSON.stringify({ rings, spatialReference: { wkid: 4326 } }),
      geometryType: "esriGeometryPolygon",
      inSR: "4326",
      spatialRel: "esriSpatialRelIntersects",
      resultRecordCount: String(Math.max(1, Math.min(500, data.limit ?? 500))),
    });
    const parcels = await queryDcad(params);
    return { parcels };
  });