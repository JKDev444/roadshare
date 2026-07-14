## What's happening today

The wizard "skips to done" because it only has three screens: welcome → create community → success. Creating the community flips `wizard_completed = true`, so the guided flow ends at step 1 of a 6-step journey. Parcels and roads are hand-drawn on a blank canvas — a dealbreaker for non-tech users.

Your CCR upload (Heron Woods PUD, Clark County WA — 47 lots, 19.37 acres, association-maintained common areas) is exactly the kind of document a real user shows up with. It has almost every field we need to seed a community, and its plat page has the lot layout. That's our automation lever.

## What we'll build

### 1. Fix the wizard — walk all 6 steps, don't skip

Turn `WelcomeWizard` into a real 6-station guided tour that stays open until each stage is either done or explicitly skipped. Each station has a mini-action inside the wizard AND a "Do this on the real page" button that navigates and keeps a floating "next step" coach open.

```text
1. Community      → create it (form, or import from CCR — see below)
2. Parcels        → import from CCR / paste addresses / spreadsheet
3. Roads          → auto-suggested from CCR or drawn on the map with guide
4. Cost scenario  → one-click "starter scenario" using the parcels
5. Gather input   → create a first survey OR decision room from a template
6. Report         → generate the starter report
```

The wizard only marks `wizard_completed` when all 6 are done OR the user hits an explicit "Finish onboarding" at the end. Each step's completion is derived from the same live counts the dashboard checklist already uses, so no drift.

### 2. The CCR / plat import — the "magic" step for non-tech users

New wizard action: **"Upload your CCR or plat PDF"**. This is the star of the show and it directly answers "how do users get parcels/roads in without drawing".

Server function (`extractCcr.functions.ts`) that:
- Accepts the PDF (via storage `documents` bucket, already exists)
- Sends it to Lovable AI Gateway (`google/gemini-2.5-pro`, PDF file block) with a structured-extraction prompt
- Returns a JSON draft: `{ community: { name, region, description }, lots: [{ label, address?, owner_name?, area_sqft? }], roads: [{ name, responsibility, surface? }], maintenance_summary, assessment_formula }`
- User sees an **"AI drafted this from your CCR — review and accept"** preview screen with everything editable inline. Nothing writes to the DB until they hit "Looks right, create everything".

For the plat map page (geometry), a follow-up call to the same model with `modalities: ["image"]` extracts approximate lot positions on a 0–100 canvas, matching the existing `pos_x/pos_y` schema. Confidence is stamped as `medium` and verification as `unverified` so the provenance trail is honest.

Additional low-friction on-ramps offered on the same screen (so users have a path even without a CCR):
- **Paste a list of owner addresses** → geocode via a free provider (Nominatim, no key) and normalize onto the plat canvas
- **Upload a CSV** (owner, address, frontage, area) → bulk-insert parcels
- **Skip / draw by hand** (current path, still available)

GeoJSON/KML import is deferred — the CCR path covers 90% of real users and reads as far more magical.

### 3. Make it fun

- **Progress ring + step celebrations**: as each of the 6 stations completes, a confetti burst (framer-motion, ~600ms) and a friendly one-liner ("Community on the map. 5 to go.")
- **Named milestones**: "First parcel logged", "Roads on paper", "Fair share calculated", "Neighbors invited", "Report shipped" — shown as small badges on the dashboard
- **Encouraging copy** everywhere non-tech-friendly: no jargon in the wizard, plain-English descriptions ("who pays for what" instead of "cost allocation methodology")
- **"Cedar Hollow demo mode"** button at the top of the wizard: "Not ready? Take a 90-second tour of a finished community first" — loads the sample without polluting the user's own data
- Playful microcopy on the AI extract screen: "I read your CCR so you don't have to. Here's what I found — fix anything wrong."

### 4. Everything is user-scoped and safe

- Uses existing `onboarding_state` table (no schema change needed for the wizard fix)
- CCR uploads go to the existing private `documents` bucket, RLS already scoped to the owner
- All AI extraction is behind `requireSupabaseAuth` server functions — no service role, no leaked data
- Import writes go through the existing `createCommunity` / `createParcel` / `createSegment` APIs so provenance events still get logged

## Technical outline

- `src/components/onboarding/WelcomeWizard.tsx` — expand to 6 stations, remove premature completion, add per-station navigate-and-return hand-off
- `src/components/onboarding/CcrImportStep.tsx` (new) — upload UI + AI-draft review + accept/apply
- `src/lib/onboarding/extractCcr.functions.ts` (new) — server fn: PDF → structured community/lots/roads JSON via Lovable AI
- `src/lib/onboarding/extractPlat.functions.ts` (new) — server fn: plat image → approximate lot positions
- `src/lib/onboarding/geocode.functions.ts` (new) — server fn: address list → coarse plat coordinates (Nominatim)
- `src/lib/onboarding/csvParcels.ts` (new) — client CSV parser + bulk insert
- `src/components/onboarding/Confetti.tsx` (new) — reusable celebration (framer-motion, no new deps)
- `src/components/onboarding/GettingStarted.tsx` — surface milestone badges + re-open-wizard button
- `src/routes/auth.tsx` — update `OnboardingPreview` to reflect the new 6-station flow (preview only)

No database migrations. No new secrets — Lovable AI Gateway is already wired.

## Out of scope for this pass

- Real geographic map tiles / Mapbox integration (assisted schematic canvas stays)
- Shapefile / KML uploads
- County parcel-viewer API integrations (jurisdiction-specific, huge scope)
- Reworking the GIS editor itself — only its onboarding hand-off changes
