
# Replace Regrid with Dallas County GIS (DCAD)

Swap the parcel data source in the map-picker step from Regrid to the Dallas Central Appraisal District (DCAD) ArcGIS FeatureServer — free, public, no token, real parcel geometry + APN + owner + situs address for all of Dallas County.

Selection UX becomes **draw first, then fine-tune by clicking**: user draws a polygon (or drops a radius) to bulk-select every parcel inside, then clicks individual parcels to add/remove them before continuing.

## Data source

**DCAD Parcels FeatureServer** (ArcGIS REST). Query endpoint returns GeoJSON directly:

```
GET {DCAD_PARCELS_URL}/query
  ?where=1=1
  &geometry=<envelope-or-polygon>
  &geometryType=esriGeometryPolygon
  &spatialRel=esriSpatialRelIntersects
  &outFields=ACCOUNT_NUM,OWNER_NAME,SITUS_ADDRESS,SITUS_CITY,SITUS_ZIP,ACREAGE
  &returnGeometry=true
  &outSR=4326
  &f=geojson
```

The exact FeatureServer URL will be confirmed during implementation (DCAD publishes it at dcad.org / dallascad.org open data; if the official DCAD server rate-limits or CORS-blocks, fall back to Dallas County's ArcGIS Hub parcel layer). No API key required. Called from a server function so CORS and rate limits are absorbed server-side.

## What changes

### Backend — new server functions in `src/lib/onboarding/dcad.functions.ts`
- `searchParcelsByPolygon({ polygon })` — takes a GeoJSON polygon drawn by the user, queries DCAD by spatial intersect, returns array of `{ apn, owner, address, city, zip, acreage, geometry }`.
- `searchParcelsNearPoint({ lat, lon, radiusMeters })` — convenience wrapper for the initial "here's where you are" view; builds an envelope and calls the same endpoint.
- Lightweight in-memory cache keyed by rounded bbox to avoid re-hitting DCAD on small map nudges.

### Frontend — `src/components/onboarding/steps/MapPickStep.tsx` (rewrite)
- Base map: keep Google Maps JS (already wired via connector) OR switch to Leaflet + OSM tiles (free, no key). **Recommend Leaflet** to remove any dependency on the Google browser key for this step and to get free polygon-draw tooling.
- Add **Leaflet.draw** for polygon + rectangle drawing.
- Flow on the step:
  1. Map centers on a Dallas default (or the user's typed address, geocoded via the existing Google Maps gateway).
  2. User draws a polygon → we call `searchParcelsByPolygon` → all intersecting DCAD parcels render as amber polygons and are marked selected by default.
  3. User clicks any parcel to toggle it in/out of the selection (bright cyan = selected, amber = deselected).
  4. Sidebar list shows selected parcels with address + owner + APN and a running count.
  5. "Continue" button is disabled until at least one parcel is selected; it hands the selected parcels to the existing `applyCcrDraft` batch insert.

### Cleanup
- Remove the Regrid code path: `src/lib/onboarding/regrid.functions.ts`, `REGRID_API_TOKEN` references (leave the secret in place for now, mark it unused).
- Remove the Regrid trial-exhausted error handling and the "try the address list instead" fallback banner from the map step (no longer relevant since DCAD has no quota).
- Keep the paste-an-address-list path exactly as-is as a secondary option.

## Technical details

- **DCAD data quality:** DCAD is the authoritative parcel source for Dallas County — every parcel has APN (ACCOUNT_NUM), owner name, situs address, situs city, ZIP, acreage, and clean polygon geometry. Coverage is 100% of Dallas County (residential + commercial + vacant).
- **Scope:** Dallas County only. If a user draws a polygon outside Dallas County, DCAD returns zero features; we show a "No parcels found — this data source currently covers Dallas County only" hint. Multi-county support is a follow-up (Tarrant County TAD, Collin CAD, etc. all publish similar ArcGIS endpoints — same code shape, different URLs).
- **Data mapping to our `parcels` table:** APN → `apn`, OWNER_NAME → `owner_name`, SITUS_ADDRESS/CITY/ZIP → `situs_address` / `city` / `zip`, geometry → `geometry` (existing JSONB), ACREAGE → `acreage` if column exists (otherwise dropped). Confirmed against current `parcels` schema during implementation.
- **Rate limiting:** DCAD's ArcGIS server has generous limits for anonymous reads, but we still cap per-query result count at 500 parcels and warn the user if their drawn polygon returns more (asks them to narrow the area).
- **New deps:** `leaflet`, `react-leaflet`, `leaflet-draw`, `@types/leaflet`, `@types/leaflet-draw`. All MIT-licensed, all client-side.
- **Testing:** Same Playwright E2E as before — open wizard → basics → map step → draw polygon around a Dallas block → verify parcels appear → click to deselect one → continue → verify community + parcels created in DB → verify count matches selected. Non-tech UX review answered at the end.

```text
User draws polygon
        │
        ▼
searchParcelsByPolygon(polygon)  ──▶  DCAD FeatureServer
        │                                      │
        │◀─────────  GeoJSON FeatureCollection ─┘
        ▼
Render on map + selection sidebar
        │
   click to toggle
        ▼
applyCcrDraft(selectedParcels)  ──▶  batch insert into parcels
```

## Out of scope for this plan
- Non-Dallas counties (follow-up).
- Owner-based search / APN lookup (follow-up — DCAD supports it, easy add later).
- Removing the `REGRID_API_TOKEN` secret entirely (leave for now in case we want it back for national coverage).
