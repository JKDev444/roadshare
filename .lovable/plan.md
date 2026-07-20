
Two related problems to fix in Step 1 / onboarding. Both boil down to: **the tool promises something and then dumps the user somewhere confusing.**

---

## Problem 1 — "Type your address" doesn't actually find neighbors

Step 1's card says **"We find every home near you."** — but the code doesn't. After you pick an address, the wizard sends you straight to a manual menu with four "add homes yourself" options. The card is lying.

The infrastructure exists: `parcelsPointLookup` in `src/lib/onboarding/parcels.functions.ts` uses DCAD in Dallas County and OSM building footprints everywhere else. It's just not wired to the address flow — only the older "draw on a map" path.

### Fix

Once we have your address + coordinates, auto-run the lookup and show what we found for a one-tap confirm.

```text
[Type your address] → 787 Five Peaks Dr, Kalama WA
       │
       ▼
[Finding your neighbors…]   ← parcelsPointLookup(lat, lng, radius=400ft)
       │
       ├── Found N homes ──►  friendly checklist (all pre-checked)
       │                       "Search wider" (400 → 800 → 1500 ft)
       │                       "None of these — I'll add by hand"
       │
       └── 0 / offline ─────►  fall through to today's manual menu with
                               "We couldn't find parcel data for this
                                address — let's add them another way"
```

### Changes
- **New:** `src/components/onboarding/steps/FindNeighborsStep.tsx`
  - Auto-runs `parcelsPointLookup` with `basicInfo.lat/lng`.
  - Loading → results checklist → confirm. Falls through to manual on 0/error.
  - Emits the same `NoDocsResult` shape (`kind: "addresses"`), so nothing downstream changes.
- **Update:** `src/components/onboarding/WelcomeWizard.tsx`
  - Add `"findNeighbors"` to the `Step` union.
  - `BasicInfoStep.onContinue` → `findNeighbors` when coords exist, otherwise `nodocs` (fallback for un-picked free text).
- **Copy fix:** `StartChoiceStep.tsx` — change "Type your address" sub-copy to something honest: *"We'll try to find every home on your road automatically. If we can't, we'll help you add them."*
- **Copy fix:** `BasicInfoStep.tsx` sub-headline to *"Type your address — we'll look for your neighbors on the map."*

---

## Problem 2 — Closing onboarding drops you on a dead-end dashboard

Screenshot: after tapping the X (backdrop / Esc are already blocked), the dashboard is essentially empty — just "Welcome back, Justin" with a "Let's start with your road" button and a Cedar Hollow peek. That looks like the app is broken, especially because the app just made noise about "let's set you up" and now shows nothing.

Root cause in `dashboard.tsx`: `hasCommunity` is `false` and we render only the greeting + the "Not sure yet?" sample card. There's no "you were in the middle of something" context, no picture of what onboarding will do, and no clear resume path.

### Fix — three parts

**A. Never lose the user's progress on exit.**
When the user closes the wizard mid-flow, remember what they told us:
- Persist `{ step, basicInfo, choice }` for that user in the `onboarding_state` row (new JSON column `resume_state`), OR — cheaper for MVP — in `sessionStorage` keyed by user id. Recommend sessionStorage first; upgrade to a DB column only if we hear about people losing progress across devices.
- On the next dashboard visit, the wizard's `open` derivation still sees `wizard_skipped: true` (so it doesn't auto-pop), but the dashboard shows a **"Pick up where you left off"** card that reopens the wizard at the saved step.

**B. Make the exit itself less abrupt.**
On close from any step past `start`, show a small confirm inside the wizard footer (not a modal): *"Save and come back later?"* with two buttons: **Save & exit** / **Keep going**. This turns the accidental X-tap into an intentional pause instead of a data loss.

**C. Rebuild the empty/paused dashboard so it feels intentional.**
Replace the current one-button hero + tiny sample card with a warmer layout:

```text
┌──────────────────────────────────────────────────────────┐
│  HOME                                                    │
│  Welcome back, Justin                                    │
│  You paused setup at "Where's your road?" — 2 min left.  │  ← only when paused
│  [ Pick up where you left off → ]  [ Start over ]        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ Here's what RoadShare will do once your road is set up   │
│  ● Find every home on your road (auto)                   │
│  ● Draw the road you all share                           │
│  ● Split costs fairly and put it to a vote               │
│  All you need is your street address to start.           │
└──────────────────────────────────────────────────────────┘

┌────── Take a peek at a finished road: Cedar Hollow ──────┐
│  [ See the Cedar Hollow sample → ]                       │
└──────────────────────────────────────────────────────────┘
```

- Paused-state card shows only if we have saved progress.
- The "what RoadShare will do" card replaces the current small blurb — gives context and confidence to a user who bailed once.
- Cedar Hollow becomes a demoted, tertiary card rather than the second-most-prominent thing on the screen.

### Changes
- **Update:** `src/lib/onboarding/useOnboarding.ts` — add read/write helpers for `resume_state` (sessionStorage).
- **Update:** `src/components/onboarding/WelcomeWizard.tsx`
  - Save resume state on `close(true)` and on step transitions.
  - Restore it on next open.
  - Add the inline "Save & exit / Keep going" footer for close-from-mid-flow.
- **Update:** `src/routes/_authenticated/dashboard.tsx`
  - New empty/paused state block (paused card if resume state exists).
  - New "what RoadShare will do" info block.
  - Demote Cedar Hollow to a small tertiary card.
- Copy pass on the paused-state strings.

---

## What's still out of scope for this plan
- Roads auto-detect (handled after community creation).
- Rebuilding the "Add homes by hand" path (still fine as fallback).
- Marketing site.
- Persisting resume state to the DB (sessionStorage first; can upgrade later).

---

## One decision I need from you before building

For the auto-found list in **Problem 1**, do you want:
- **(A) Plain checklist** in the wizard modal — checkboxes, "Search wider" button, one screen. Fastest to ship, non-tech friendly, no map complexity. **← My recommendation.**
- **(B) Mini map preview** with the found homes plotted so users see them spatially, plus the same confirm list.

(A) is faster and matches the "dumb this down" direction. (B) is more visually impressive but reintroduces map complexity we just took out.
