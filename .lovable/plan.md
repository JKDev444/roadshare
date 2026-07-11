# RoadShare Prototype — Build Plan

A fully client-side, self-contained interactive prototype matching the spec, wrapped in a clean modern app shell. No backend, no data connections — all mocked data lives in the code, matching the document exactly. Adds the near-term **methodology toggle** (distance / frontage / equal-per-lot).

## What gets built

A single interactive page (`/`) with a two-column layout:
- **Left / center:** the Cedar Hollow map + the step controls.
- **Right (sticky):** the live allocation results panel.

### The demo data (Cedar Hollow)
Hard-coded model of the neighborhood, faithful to the spec:
- Two private roads as centerlines: Cedar Hollow Lane (west→east from County Rd 12 to a cul-de-sac) and Hollow Ridge Court (branches north from a mid-block T-junction to Ridge Rd).
- A small road-network graph (nodes + segments) so distances route through the junction, not straight-line.
- 14 fictional parcels (address, road frontage span along a centerline, shape polygon for drawing).
- Two entrance points: West (County Rd 12) and North (Ridge Rd).
- Scale: 1.25 ft per drawing unit (~1,230 ft total road), north arrow, scale bar.

### The 5-step user flow
1. **Find your property** — typeahead address search over the 14 addresses; selected parcel marked "you" (gold) everywhere including the results row.
2. **Select the neighborhood** — click parcels to add/remove from the cost-sharing group; Select All / Clear buttons; selected parcels turn green.
3. **Pin the entrances** — two dashed pulsing markers; click to pin/unpin a flag; recalculates instantly with one or both pinned.
4. **Road surface & cost** — 6 surface-type percentage inputs (must total 100%, otherwise dollar figures are withheld and the mismatch is flagged), editable per-sq-ft unit costs, road width, funding period (1–40 yrs).
5. **Allocation** — live results: summary tiles (total road length, blended $/sq ft, total project cost, highlighted per-year), plus a table of every selected address with responsibility footage (proportional bar), share %, total $, bold per-year, and equal-split-per-year comparison column. User's row highlighted gold.

### Allocation engine (the real, proprietary logic — implemented exactly as specified)
- Responsibility = along-road network distance from entrance to the far edge of a property's frontage (direction-aware: greater of network distances to the two frontage endpoints).
- Two entrances pinned → compute per entrance and average.
- Network routing through the T-junction (Dijkstra/shortest-path over the segment graph).
- Cost flow: pavement area = centerline length × width; blended rate = %-weighted average of the 6 unit costs; total = area × blended rate; each share = its responsibility ÷ sum of responsibilities; every figure ÷ funding period for the flat annual figure; equal-per-lot column always shown.

### Methodology toggle (added enhancement)
A control switching the responsibility basis among:
- **Distance** (default, the network far-edge method above),
- **Frontage** (each lot's own frontage length),
- **Equal per lot** (uniform share).
Results panel + map bars update live for the chosen method; the equal-split comparison column remains.

## Design direction (modern polished UI)
- Clean app shell with a distinctive display + body font pairing (not Inter/Poppins), generous spacing, card-based control groups, sticky results panel.
- Keep the plat map legible and technical (north arrow, scale bar, true-scale SVG) but rendered with a refined, modern palette rather than a literal blueprint look. Parcel states: default, hover, gold ("you"), green (selected).
- All colors as semantic oklch tokens in `src/styles.css`; light/dark support; subtle depth (shadows, layered surfaces); restrained framer-motion (entrance pulse, results transitions).

## Technical notes
- Stack: TanStack Start (existing shell). Everything renders on `/` — no server functions, no Cloud, nothing persists (matches the "no accounts / no export" prototype scope).
- Structure:
  - `src/lib/roadshare/data.ts` — Cedar Hollow parcels, centerlines, network graph, entrances, defaults.
  - `src/lib/roadshare/engine.ts` — network distance, responsibility, methodology, cost flow (pure functions, unit-testable).
  - `src/components/roadshare/PlatMap.tsx` — SVG map with interaction.
  - `src/components/roadshare/*` — step control panels + results panel.
  - `src/routes/index.tsx` — composes the page, holds app state.
- Update `__root.tsx` head: real title/description/og/twitter (e.g. "RoadShare — Private Road Cost Sharing").
- Load the chosen web fonts via `<link>` in `__root.tsx`.
- Verify with a Playwright pass: search a lot, select the group, pin entrances, confirm totals recompute and the 100% validation gate works.

## Explicitly out of scope (deferred to production, per the doc)
Real base map / Mapbox, real parcel & geocoder APIs, OSM/TIGER centerlines, DOT bid-tab costs, accounts, saved projects, sharing, PDF export, inflation schedule.
