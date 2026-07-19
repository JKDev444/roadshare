
# RoadShare v3 — Simple by default

Goal: any low-tech user goes from "I have a private road" to "here's my fair share" without ever seeing a real map, sidebar tabs, or jargon. Cedar Hollow's look becomes the design language for the whole app — including the Cedar Hollow demo page itself, which stops using Mapbox so it truly mirrors the app.

## The one happy path

```text
1. Create your community      →  Pick ONE of 3 big buttons
2. We build your road picture →  SVG plat, always the same look
3. Walk through your project  →  Guided steps, one card at a time
4. See each home's share      →  One clear results screen
5. Share with neighbors        →  Link + simple vote
```

No sidebar tabs during onboarding. Zero Mapbox in the authenticated app. Mapbox stays only on the setup screen's address autocomplete input (no visible map).

## 1. Create your community

One screen, three equal big playful buttons:

- 📄 **Upload your HOA papers** — CC&Rs / rules PDF. We read it and pull out homes, roads, cost language.
- 📍 **Type your address** — We look up homes near you for you to review.
- ✍️ **Add homes manually** — Paste addresses, upload a spreadsheet, or type them in.

Each opens its own dead-simple flow. No wizard steps, no left rail, no progress dots beyond "Step 1 of 3".

### CC&R upload — fix the stall

The attachment shows upload hanging at "Uploading documents" step 1 of 8.

- Audit the doc pipeline (`src/lib/documents/classify.functions.ts` + `src/lib/onboarding/jobs.functions.ts`); today the checklist advances on optimistic client timers instead of real job progress.
- Drive the 8-step checklist from actual job status events.
- Per-step timeout (60s) with a visible error + per-file retry.
- Keep the inline checklist visual — user liked it — but make it truthful.

### Address path
- Mapbox Search Box for autocomplete only. No visible map, no lasso.
- Result: a scrollable checklist of nearby homes the user confirms.

### Manual path
- Big textarea, "Upload .xlsx / .csv" button, downloadable template.
- Reuses `parseParcelCsv` and `parseAddressList`.

## 2. The in-app "map" becomes a Cedar Hollow plat

Delete every Mapbox map instance from the authenticated app. Build one new component `PlatCanvas`:

- SVG, homes as rounded rectangles with labels, roads as thick lines, entrances as pins.
- **Scales to any community size** (not just 200). For very large communities:
  - Cluster homes along road segments with automatic pagination / zoom-to-region controls.
  - "Fit all" / "Zoom to my street" / arrow-key pan.
  - Homes render as compact dots below a density threshold, expand to labeled rectangles as you zoom in.
  - Virtualized: only homes inside the current SVG viewBox are rendered as full nodes.
- Auto-layout: given homes + roads, place homes along road segments deterministically. Real lat/lng stays in the DB but is only used as a layout hint; the picture is abstract.

## 3. Guided steps inside the community

Replace `MyRoadTab` / `community.$id` screen with a single-page planner styled like `/tools/cedar-hollow`:

```text
┌─────────────────────────────────────────────┐
│  [Plat picture — always visible]            │
├─────────────────────────────────────────────┤
│  Step 1 · Which home is yours? →            │
│  Step 2 · Which road needs work? →          │
│  Step 3 · What's the project? →             │
│  Step 4 · How should we split the cost? →   │
│  Step 5 · Your fair share ✓                 │
└─────────────────────────────────────────────┘
```

One card at a time, big buttons, plain language, plat updates live. Cost split methods reuse `costShare.ts`: equal / by frontage / by distance-to-entrance.

## 4. Results & sharing

- Big card per home: address, dollar amount, share %.
- "Send to neighbors" — copy link or email invite.
- Neighbor decisions collapse into a single "Vote" screen (👍/👎 + comment).

## 5. Cedar Hollow demo mirrors the app

`/tools/cedar-hollow` is rebuilt around the same `PlatCanvas` + guided-steps components as the in-app experience — no Mapbox, no separate design language. It becomes a preview of what the user will get inside the app, using the fictional Cedar Hollow data. Same buttons, same steps, same visual style.

## 6. Cleanup — hide, don't delete

Per your note, keep the code but remove from nav/routing surface:

- Sidebar reduces to **Home · My road · Settings**.
- Hidden (routes still exist, links removed everywhere): Neighbors, Documents, Decisions, Ask, Clauses, Pulse, Portfolio, Reports, Map, Project.
- Old Mapbox-based `CommunityMapEditor*`, `GisEditor`, `MapPickStep` files remain in repo but are unreferenced.
- Any deep-link that lands on a hidden route still works but is not linked from anywhere.

## 7. Terminology sweep

In-app copy: community, homes, roads, your share, your neighbors. Kill: parcel, frontage (say "feet of road in front of your house"), segment, GIS, plat, geometry, confidence, verification, provenance, needs review.

## Phases

**Phase A — Foundation**
- Build `PlatCanvas` (large-scale virtualized SVG plat).
- Fix CC&R upload pipeline (real progress + timeouts + retry).
- New route shells: `/setup`, `/community/$id/plan`.

**Phase B — New onboarding**
- 3-button `/setup` screen.
- Wire each path to create a community and land on `/community/$id/plan`.
- Retire old `WelcomeWizard` steps that don't feed the 3 paths.

**Phase C — New in-app experience**
- `/community/$id/plan` with the guided step cards + always-visible plat.
- Sidebar → 3 items.
- Remove links to hidden routes.

**Phase D — Cedar Hollow rebuild**
- Rebuild `/tools/cedar-hollow` on top of `PlatCanvas` + shared step components. No Mapbox.

**Phase E — End-to-end regression as a low-tech user**
- Fresh account (`roadshare` easter egg).
- Run all three paths: CC&R upload (the stalling PDF), address in Kalama WA, CSV manual entry.
- Test on a large community fixture (500+ homes) to verify plat performance.
- Answer the 4 audit questions after each run.

## Technical notes

- No DB migrations. Existing schema handles it.
- `PlatCanvas` performance: SVG element virtualization + level-of-detail rendering; measured against a 1,000-home fixture before shipping.
- Doc pipeline: replace optimistic client timers with real job step events from `jobs.functions.ts`; expose `current_step`, `error`, `retryable` fields.
- Mapbox usage after this pass: address autocomplete on `/setup` only.

## Out of scope

- Mobile-specific tuning (desktop first).
- Real invite email sending (link-copy only).
- Marketing site pages other than `/tools/cedar-hollow`.
- DB migrations.
