# Plan: Make mapping + community page easy and fun

## Big picture

Four coordinated changes, in this order so nothing lands broken:

1. **Swap Leaflet/OSM tiles for Mapbox Streets** (vibrant, matches Cedar Hollow).
2. **Auto-detect roads from OpenStreetMap** when the user lassos a neighborhood, so the "Draw road" step goes away for most people.
3. **Collapse community page** from 5 tabs (Overview / Property layer / Road geometry / Projects / Provenance) down to **3: Map · Properties · Projects**, with Provenance moved to a small "history" popover.
4. **Playful visual refresh** (rounded cards, warm accents, bounce toasts, celebratory micro-interactions) across the onboarding + community pages, keeping current semantic tokens.

Existing DCAD parcel lookup (free, Dallas-only) stays as-is — that part works.

## 1. Mapbox integration

- **Prereq:** Connect the Mapbox connector so the app gets a public token (`VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN`). Free tier is enough; no server calls needed for tiles.
- Replace Leaflet with **`mapbox-gl` + `@mapbox/mapbox-gl-draw`** in `MapPickStep.tsx` and the community "Map" tab.
- Base style: `mapbox://styles/mapbox/streets-v12` with a small custom overlay: rounded parcel polygons, primary-color fills for selected (`#0ea5e9`), warm amber for unselected (`#f59e0b`), soft glow on hover.
- Bigger map canvas: on the community page and map-picker, expand to a **near-full-viewport map** (calc height minus header) with a collapsible sidebar so users can go big when a neighborhood is huge.
- Draw tool: Mapbox Draw's polygon/rectangle controls (better UX than Leaflet.draw). Add a "Lasso" quick button in the toolbar so it's obvious how to select an area.

## 2. Auto-detect roads (Overpass API)

New server function `detectRoadsInPolygon` in `src/lib/onboarding/osm.functions.ts`:

- Input: the drawn GeoJSON polygon.
- Query Overpass for `way["highway"]` inside the polygon (free, no key).
- Return road segments as GeoJSON LineStrings with name + highway class.
- Onboarding: after parcels are picked, show a **"Roads we found"** panel with checkboxes ("Include this road", "Private / Shared / Public" chip per road, default Shared). One-click "Include all", one-click "Skip roads for now".
- Roads get persisted alongside parcels during `createCommunity`. They land on the community's Map tab as editable segments — the user can still tweak names/labels/classifications after.
- If Overpass returns nothing (rural), fall back to the current "Draw road" tool with a friendly explainer.

## 3. Community page — 3 tabs

Rework `src/routes/_authenticated/community.$id.tsx`:

- **Map** (default) — parcels + roads on one Mapbox canvas. Tools sidebar: layer toggles (parcels / roads / satellite), select-move / draw-road / draw-parcel. This absorbs today's Overview + Property layer + Road geometry.
- **Properties** — the list table of parcels with owner, address, verification status. Bulk verify.
- **Projects** — unchanged (existing ProjectsTab).
- **Provenance** — becomes a small clock-icon button on the top-right that opens a slide-over showing the audit trail. Not a tab anymore.
- Empty states get rewritten with a single obvious CTA each ("Add roads on the map →").

## 4. Playful visual refresh

Scoped to onboarding + community, not the marketing site:

- **Type + color:** keep semantic tokens; introduce a fresh accent palette in `styles.css`: `--color-fun-1` (#22c55e), `--color-fun-2` (#facc15), `--color-fun-3` (#3b82f6). Larger, rounded card radii (`rounded-3xl`), soft dual-tone gradients on hero panels.
- **Motion:** framer-motion for wizard step transitions (slide + fade), a confetti burst on community creation (component already exists — wire it), micro-bounce on primary CTAs.
- **Toasts:** replace plain sonner toasts with playful copy + emoji ("🎉 JK Hollow is ready").
- **Empty states:** friendly illustrations (simple SVGs, no external deps) instead of grey boxes.
- **Progress:** the wizard gets a rounded progress dot row at the top, not just a header.

## Technical notes

- Mapbox package: `bun add mapbox-gl @mapbox/mapbox-gl-draw` + types.
- Overpass endpoint: `https://overpass-api.de/api/interpreter` — free, rate-limited; called from a server function to avoid CORS.
- `createCommunity` API extends to accept `roads: Array<{name, class, geometry}>` — existing parcel path is unchanged.
- Provenance data still stored & readable; only the surface moves.
- No DB migrations required — road_segments table already exists.

## What I will NOT touch this pass

- Marketing site look (already good).
- DCAD lookup (works).
- Auth flow, onboarding jobs table, decisions gating (all recently fixed).
- Regrid code (already removed).

## Testing plan

After each of the 4 phases lands, drive Playwright end-to-end against the live session:

1. Onboarding: basics → map pick → auto-detected roads → community created; screenshot each step.
2. Community page: verify 3 tabs render, map is full-height, parcel + road layers toggle, provenance slide-over opens.
3. Report red flags + answer the non-tech user questions honestly before testing.

## One thing I need from you

**Connect Mapbox** via the Lovable connector. Free public token is fine; the connector stores it as an env var and I never see the raw value.