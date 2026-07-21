# Plan — "Cedar Hollow inside the app"

Goal: kill the fragile single-address search flow. Get every user onto a Cedar Hollow-style interactive plat within 60 seconds, then let them shape it.

## 1. New onboarding: three easy paths, one destination

Replace the current start choices with three cards that all land on the same plat editor:

1. **Paste addresses** — big textarea, one per line. Reuses `parseAddressList.ts`. Instant.
2. **Upload a list** — CSV / TXT / XLSX / PDF. We extract addresses (CSV parser for structured, existing doc parser + regex for PDFs/CC&Rs). Preview extracted addresses; user confirms.
3. **Start blank** — go straight to the plat with zero homes; user adds tiles by clicking "+ Add home".

Community name is asked once, up front (single input). No mandatory address search, no Mapbox lookup in the critical path. Mapbox search stays available inside the plat editor as an optional "Add by address" action for one-offs.

Result of any path: N homes get created with `label` + `address` only (no lat/lng required). We go directly to the plat editor.

## 2. The plat editor (Cedar Hollow, in-app)

One screen, `PlatCanvas` upgraded to be **interactive**:

- **Layout**: auto-lay homes along one horizontal road, split evenly north/south (already the fallback in `PlatCanvas`). This becomes the primary render, not a fallback.
- **Drag tiles**: click-and-drag a home tile to any position on the canvas. Snap to a light grid. Persist `pos_x`, `pos_y` per parcel.
- **Road editing**: the road is a polyline with draggable vertices. "+ Add bend" adds a vertex; drag to reshape (straight, L-curve, cul-de-sac, whatever). "+ Add road" adds a second polyline for branch roads. Each home can be assigned to a road via a small dropdown on the tile (or by dragging near it — road membership = nearest polyline).
- **Add home**: "+" button drops a new tile near the road; user types the label/address inline.
- **Remove / rename**: right-click or a tile popover with Rename / Delete / Mark as "You".
- **You marker**: one tile can be flagged "This is my home" (gold, matches Cedar Hollow).
- **Zoom/pan**: simple SVG viewBox pan+zoom (no Mapbox).

Everything persists to existing `parcels` / `road_segments` tables. `parcels.geometry` becomes optional; when absent we use `pos_x`/`pos_y` (already in schema per legacy). Road polyline stored as GeoJSON LineString in `road_segments.geometry` using canvas coordinates when no real geo is provided.

Answer to your layout questions:
- **One line horizontally?** Only for very small communities. For >~10 homes, two rows (north + south of road) reads much better and matches Cedar Hollow. Auto-wrap into more rows as count grows.
- **Move parcels?** Yes, drag freely. Auto-layout is the starting point, not a cage.
- **Create roads?** Auto one straight road on day one; user drags vertices or adds bends/new roads as needed.

## 3. Document upload becomes a secondary, non-blocking feature

Uploads live on the new **Documents** page (see nav below), not in onboarding. When a CC&R PDF is uploaded we still try to extract addresses and offer "Add these X homes to your map?". No user is ever forced through document upload to see a map.

## 4. App navigation

Replace the current sidebar with four items:

- **Home** — dashboard, greeting, next-step checklist
- **My Road** — the interactive plat editor (default landing after onboarding)
- **Neighbors** — list of homes, contact/verification status, invite links
- **Documents & Decisions** — combined: uploads, extracted rules, votes/decisions timeline

Everything else (Ask, Pulse, Reports, Clauses) either folds into these four or gets removed from the nav. Settings stays in a footer/avatar menu.

## 5. Cleanup / removals

- Retire the guided 5-step planner inside the app; it duplicates the plat editor.
- Retire the Mapbox community editor in the onboarding critical path.
- Keep `/tools/cedar-hollow` as the marketing demo — it now literally previews the in-app experience.

## Technical notes (for the dev, skip if not technical)

- Extend `PlatCanvas` into `PlatEditor` with pointer-event drag handlers writing back to a parent state; debounced save to Supabase.
- New columns if missing: `parcels.pos_x float`, `parcels.pos_y float`, `parcels.road_segment_id uuid null`. Migration required.
- Road polyline editing: store `road_segments.geometry` as GeoJSON LineString in a synthetic 0–1000 coord space when no real geo present; render with same projection as before.
- CSV/XLSX parser: `papaparse` for CSV, existing `document--parse_document` path for PDFs. Address column auto-detected by header name; fallback to "first column with commas + digits".
- Nav refactor in `AppShell.tsx`; delete unused route entries; add `/documents` combined route.

## Out of scope (ask separately if you want them)

- Real-world geocoding of the drawn plat (aligning to actual streets).
- Multi-user collaborative editing of the plat.
- Mobile-optimized drag interactions (desktop first; mobile falls back to tap-to-select + arrow-nudge).
