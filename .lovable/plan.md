## Three things in this plan

1. Fix the "click a home → map zooms out" bug (confirmed root cause).
2. Answer the Kalama / Mapbox question and lock in the current approach.
3. Generate two reference documents you asked for — a **User Workflow Guide** and a **Developer / Architecture Guide**.

The prior Vercel deploy work (vite.config.ts + vercel.json + env vars) stays as-is — this plan adds on top, it doesn't replace it.

---

## 1. Map zoom-out bug — confirmed

**File:** `src/components/onboarding/steps/MapPickStepImpl.tsx` around lines 360–389.

Right now a single `useEffect` keyed on `[parcels, selected, anchorParcelId, mapLoaded]` does two things at once: (a) repaints the parcel colors, and (b) calls `map.fitBounds(bounds, { padding: 40, maxZoom: 19 })`. Because `selected` is in the dependency array, **every tap on a home re-runs `fitBounds` and yanks the camera back out to fit every parcel**. That's exactly what you're seeing.

**Fix:** split it into two effects.

- Effect A (paint) — deps `[parcels, selected, anchorParcelId, mapLoaded]`. Only `source.setData(...)`. No camera calls.
- Effect B (frame) — deps `[parcels, mapLoaded]` only. Computes bounds and calls `map.fitBounds` **only when the parcel list itself changes** (initial load / new address / lasso re-query), never on selection toggles. Add `duration: 400` for a smooth ease and drop `maxZoom` to `18` so we don't over-zoom on tiny lots.

Verification: reproduce the current bug in Playwright (zoom in → click a home → confirm zoom level drops), apply the fix, then confirm zoom level is preserved across 3 consecutive clicks.

---

## 2. Kalama / Mapbox — do we need another tool?

**Short answer: no.** Mapbox handles Kalama fine. Your latest Munn Lake screenshot rendered 207 nearby homes — Mapbox found the address and Mapbox tiles drew the map. The earlier "blank map" wasn't Mapbox failing to recognize the neighborhood; it was our own parcels lookup timing out before buildings could render.

Two distinct data sources are at play, and it's worth being clear:

| Layer | Provider | Rural coverage |
| --- | --- | --- |
| Address typeahead / geocoding | Mapbox Search Box (with US Census fallback) | Excellent everywhere in the US |
| Map tiles | Mapbox streets style | Excellent everywhere |
| **Building / parcel polygons** | Dallas County GIS (Dallas only) → **OpenStreetMap Overpass** everywhere else | Depends on OSM coverage in that area |

The only place rural areas can get thin is that third row — OSM building footprints. In practice OSM is very good in the US (Munn Lake had 207 homes mapped), and for the rare gap we already have the lasso: users draw their neighborhood and we snap it to whatever OSM knows. Adding Google Places / Google Maps would not improve rural building data — Google doesn't expose parcel polygons via API either, and it'd add cost, key management, and terms-of-service friction on top of a problem the lasso already solves.

**Plan action:** no new provider. Two small hardenings only:

- Cap the Overpass call at 8s and treat 0 results as "empty," not "error," so the empty-state UI can render.
- In `MapPickStepImpl.tsx`, when the parcels lookup returns empty, show a clear callout: *"We couldn't find nearby homes automatically. Tap **Lasso** and draw around your neighborhood — we'll pull the buildings from your outline."* Right now empty and loading look identical.

---

## 3. Documents to generate

Both saved to `/mnt/documents` as `.docx` (editable in Word/Google Docs) plus a matching `.md` in the repo under `docs/` so it stays version-controlled with the code.

### A. `RoadShare — User Workflow Guide.docx`

Audience: a non-technical HOA board member or neighbor. Written in plain language, screenshots-optional, ~8–12 pages.

Sections:
1. **What RoadShare is** — one-paragraph plain-English pitch.
2. **The 4 core roles** — Homeowner, HOA board, road committee lead, invited neighbor. What each one can do.
3. **First-time onboarding, step by step** — Welcome → address lookup → "Pick my neighbors on a map" → lasso vs. tap → review homes → naming your community → confetti / dashboard drop-off. Called out: what "Skip for now" does, what the sandbox banner means, the `roadshare` easter-egg reset.
4. **The dashboard after onboarding** — WelcomeBanner, next-step CTAs, where to find My Road / Neighbors / Documents / Decisions.
5. **Adding neighbors after the fact** — lasso re-run, manual address entry, CSV import path.
6. **Documents workflow** — upload a PDF (CC&Rs / HOA rules / invoices), what the classifier does, where extracted clauses show up.
7. **Decisions workflow** — how a decision is proposed, voted on, closed. Quorum + Fair-Share math in plain words.
8. **The "Fair Share" calculator** — distance vs. frontage vs. equal split, worked example from Cedar Hollow, when each is fairest.
9. **Cedar Hollow sample** — what it's for, why the numbers aren't real, how to leave the sandbox.
10. **FAQ / troubleshooting** — "the map is blank," "my address isn't found," "I picked the wrong neighborhood," "reset my account."

### B. `RoadShare — Developer & Architecture Guide.docx`

Audience: a new engineer or a reviewing consultant. ~10–14 pages.

Sections:
1. **Stack at a glance** — TanStack Start v1 (React 19), Vite 7, TanStack Router file-based routing, TanStack Query, Tailwind v4, shadcn/ui, Framer Motion, Lucide, Mapbox GL JS + mapbox-gl-draw (freehand mode), Leaflet.draw (legacy planner), Zod v4, Supabase (Lovable Cloud) for DB + auth + RLS + storage.
2. **Runtime targets** — Lovable's managed hosting (Cloudflare Workers via nitro) and Vercel (nitro `vercel` preset). Env-var matrix for each, cross-referencing `VERCEL_ENV.md`.
3. **Routing map** — `src/routes/` file conventions, `__root.tsx`, `_authenticated/` gate, `api/public/*` for webhooks, why we don't use `src/pages/`.
4. **Server functions vs. server routes** — when we use `createServerFn` (address lookup, parcels, AI classify, extract, ask), when we'd use `createFileRoute` server blocks (webhooks/cron under `api/public/*`). Auth-middleware pattern for the ones that touch user data; explicit call-out that `geocode.*` and `parcels.*` are **public** and must NOT use `requireSupabaseAuth` (that was the Vercel 401 bug).
5. **AI layer** — `ai-gateway.server.ts` and `ai-chat.server.ts`. Lovable AI Gateway is primary; `OPENAI_API_KEY` is the drop-in fallback for external hosts. Which server fn uses which model (`gpt-4o-mini` for classify/ask, `gpt-4o` for PDF extract).
6. **Geocoding pipeline** — Mapbox Search Box (suggest + retrieve, session tokens) → US Census Geocoder fallback → title-casing helper. Why we abandoned Nominatim (rural gaps, rate limits).
7. **Parcel pipeline** — DCAD (Dallas County) shortcut → OSM Overpass buildings elsewhere → lasso fallback. Batch insert path in `lib/community/api.ts`.
8. **Onboarding state machine** — `useOnboarding.ts`, Welcome/BasicInfo/MapPick/Docs/Upload/Review/Success step order, the `?welcome=1` re-trigger, the "roadshare" easter-egg reset hook.
9. **Data model** — high-level ERD: `profiles`, `user_roles`, `communities`, `parcels`, `documents`, `clauses`, `decisions`, `votes`. RLS pattern (`has_role`, `SECURITY DEFINER`), why roles live in a separate table.
10. **Front-end architecture** — `AppShell`, primary nav simplification (Home / My Road / Neighbors / Documents / Decisions), design tokens in `styles.css`, no hardcoded colors rule.
11. **Marketing site** — `StoryPath`, `SecretSauce`, persona subpages, why we killed the pill-shaped links and card grids.
12. **Deployment** — Lovable Publish (zero-config) vs. Vercel (see `vercel.json` and the isVercel branch in `vite.config.ts`). Which env vars per host.
13. **Known limitations & follow-ups** — rural OSM gaps, Vercel Hobby 10s timeout raised via `functions.maxDuration`, no realtime yet, invites/pulse still hidden.
14. **How to run locally** — `bun install`, dev server, seed data, `?welcome=1` for QA, the easter-egg reset.

### How the docs get built

Using the DOCX skill: I'll write both documents in JS via `docx` (Arial 12pt, US Letter, proper Heading1/Heading2 styles, real bulleted lists with `LevelFormat.BULLET`, tables using DXA widths for Google Docs compatibility). Each generated `.docx` gets validated, then converted to page images and inspected before I hand them to you. Markdown twins land in `docs/user-workflow.md` and `docs/developer-guide.md` so the repo has a versioned source of truth.

Deliverables in `/mnt/documents`:
- `RoadShare — User Workflow Guide.docx`
- `RoadShare — Developer & Architecture Guide.docx`

---

## Order of operations

1. Fix the MapPickStepImpl zoom-out bug and the empty-state banner.
2. Verify the fix in Playwright (zoom-preserved-on-click check).
3. Write both `.md` sources under `docs/`.
4. Generate both `.docx` files, validate, render to page images, spot-check every page.
5. Report back with artifact links and the Playwright evidence for the map fix.

## Explicitly not doing

- Not adding Google Maps / Google Places. Mapbox + OSM + lasso already covers the rural case.
- Not touching the Vercel plan already in `.lovable/plan.md` — it stays.
- Not editing schema, RLS, or auth.