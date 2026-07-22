# Make `/my-road` show *your* road

Right now `/welcome` only asks for a road name, and `/my-road` renders the Cedar Hollow sample homes for everyone. This phase makes the planner render the signed-in user's actual road.

## What we're building

### 1. New onboarding at `/welcome` (2 screens)

**Screen 1 — Name your road**
- Single input: "What's your road called?" (e.g. "Five Peaks Dr")
- Big "Next" button. That's it.

**Screen 2 — Who's on your road?**
Three big playful choice tiles (same style as `/tools/cedar-hollow`):

1. **Use my address** — user types their address, we auto-find nearby homes (reuse the existing `parcelsPointLookup` + widening-radius logic). Result is a list of home addresses the user can check/uncheck.
2. **Paste a list** — textarea, one address or house number per line. We parse into homes.
3. **Enter by hand** — pick a number (2–40) with a +/− stepper. Generates "Home 1, Home 2, …" placeholders the user can rename later.

Every tile ends the same way: a saved `roads.state` with `{ roadName, homes: [{ id, label, address? }] }` and a redirect to `/my-road`.

No modals, no wizard steps beyond these two screens, no "save & exit" trap. A single "Back" arrow returns to screen 1.

### 2. Generalize `Planner` for real user data

- Remove hardcoded Cedar Hollow `PARCELS` import from `/my-road`.
- `Planner` accepts `homes` + `roadName` as props and lays them out on the SVG road automatically (two rows either side of the road, sized to fit any count from 2 to ~40; anything larger collapses to a compact grid like today's fallback).
- The interactive walkthrough (pick your home → pick neighbors → assign shares → done) works against the user's homes.
- `/tools/cedar-hollow` keeps using the hardcoded sample — it stays as the marketing demo, unchanged.

### 3. Persistence & reset

- `saveMyRoadState` already exists — extend the JSON shape to include `homes` and `roadName`.
- The `roadshare` easter egg already wipes `roads` rows; confirm it still lands the user back on `/welcome` with a clean slate.
- If a signed-in user hits `/my-road` with no saved homes, redirect to `/welcome`.

### 4. Non-technical QA pass (with screenshots)

Playwright run through every path, saving screenshots to `/tmp/browser/phase-real-road/`:

- Path A: address lookup with `787 Five Peaks Dr, Kalama, WA 98625`
- Path B: paste list of 8 addresses
- Path C: manual count of 6 homes
- Refresh mid-walkthrough → resumes on same step
- Sign out / sign back in → homes still there
- Type `roadshare` → back to empty `/welcome`

For each path I answer the three questions:
1. Was the flow easy enough for a non-technical user?
2. Was anything confusing?
3. Did you get the result you wanted?

## Technical notes

- Files touched: `src/routes/welcome.tsx` (rebuild), `src/components/onboarding/*` (new choice tiles), `src/components/planner/Planner.tsx` (props-driven), `src/routes/my-road.tsx` (feed real state), `src/lib/road.functions.ts` (extend state shape).
- No DB migration needed — `roads.state` is already `jsonb`.
- Reuse existing address search + `parcelsPointLookup` server functions; no new external APIs.
- Auth-gated pages stay under `_authenticated/`; `/welcome` stays public-until-signed-in per current setup.

## Out of scope for this phase

Neighbors/voting, documents, decisions, cost-share math — the walkthrough still surfaces them, but this phase only guarantees the homes shown are the user's own. Those flows already work against `roads.state` and inherit the new data automatically.
