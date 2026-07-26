## Goals

1. Ask about the contractor quote **in onboarding** (not the app rail).
2. Redesign the right-rail **Estimated Share** area so it doesn't feel scrunched.
3. Make the drawer's **"How much road does this home touch?"** slider (a) update the pinned Estimated Share live and (b) actually persist to the map after Save.

---

## 1. Onboarding — new "Cost" step

`src/routes/_authenticated/welcome.tsx`

- Insert a new screen `cost` between `shape` and `homes`. New sequence: `name → docs → shape → cost → homes` (5 steps; update all "Step X of 4" labels to "Step X of 5").
- Screen content: **"Do you already have a contractor quote?"**
  - Two large tiles side-by-side:
    - **"Yes — I have a quote"** → reveals a `$` input (numeric, formatted with commas). CTA becomes enabled once a number > 0 is entered.
    - **"No — estimate it for me"** → proceeds immediately.
  - Helper: "If yes, we'll split that exact number. If no, we'll estimate it and you can adjust anytime."
- Store `quoteTotal: number | undefined` in local state and pass it through `finish()` into `create({ data: { …, fixedTotal: quoteTotal } })`.
- `createMyRoad` already persists arbitrary `state` JSON; extend the initial state written on create to include `fixedTotal` so `/my-road` boots with it in `PlannerSnapshot`.

## 2. Rail — redesign the Estimated Share area

`src/components/roadshare/Planner.tsx` + `src/components/roadshare/ResultsPanel.tsx`

Replace the current cramped stacked-cards look with a single, breathable **ShareHero** card at the top of the rail. Layout:

```text
┌─ Your estimated share ─────────────────┐
│                                        │
│   $450 / year                          │  ← 40px display number
│   ─────────────────────────────        │
│   12.5% of the group   ● equal split   │  ← chip row
│                                        │
│   Total project   Per year (group)     │  ← two inline stats, no boxes
│   $54,000         $3,600               │
└────────────────────────────────────────┘
```

Specifics:
- Bigger, single hero card with generous padding (`p-5`), gold gradient background kept but softened.
- Kill the separate `TOTAL PROJECT` / `PER YEAR (GROUP)` bordered tiles under the hero. Fold those two numbers into the hero footer as a two-column inline stat row (small uppercase label above a mono value, no box).
- Remove the redundant sticky wrapper's extra border + shadow so the hero reads as one clean block, not "card inside a card".
- Update `ResultsPanel` compact mode to render this new inline stat row instead of the two-tile grid; keep `hideHero` behaviour for the review-step breakdown table.
- Keep the pinned/sticky behaviour so it stays visible while scrolling.

## 3. Frontage slider — live update + save

`src/components/roadshare/HomeDetailsDrawer.tsx` + `src/routes/_authenticated/my-road.tsx`

Two fixes:

**a. Live pinned Estimated Share while dragging.**
- Add an optional `onPreviewPatch?: (id, patch) => void` callback to `HomeDetailsDrawer`. Call it (debounced ~120 ms) whenever `frontage` or `skip` changes.
- In `my-road.tsx`, wire that callback to update a `previewHomes` array (homes with the pending patch applied). Pass `previewHomes ?? homes` into `Planner` so the map + pinned rail recompute in real time as the slider moves.
- Clear the preview on drawer close or on Save (Save promotes the preview to real state via existing `pushHistory`).

**b. Make Save actually stick on the map.**
- Root cause: `handleSaveHome` → `pushHistory` updates `homes` state, and the persistence `useEffect` (line 520) writes it to the DB. That part works, but the drawer's `frontage` is stored as a string and cleared to `""` when the user hits "Use map estimate" — currently saving a blank writes `frontageFtOverride: null`, which reverts to the auto value. Verify + fix any off-by-one where a dragged value doesn't reach the patch:
  - Ensure `save()` uses the current `frontageNumber` (already derived) rather than re-parsing `frontage`.
  - After `onSave`, do NOT call `onClose()` until state has committed; keep it as-is but confirm the Planner's `homes` prop is the same reference `my-road` holds (it is — direct `homes` state).
- Add a small toast "Saved — share updated" on successful save so users get feedback the change landed.

## 4. Technical notes

- `PlannerSnapshot.fixedTotal` is already threaded through the engine; only the seed path from onboarding and the initial DB state need updating.
- `SliderControl`s for road width / plan years and the `TotalCostControl` remain in the rail unchanged.
- No schema changes; `roads.state` is `jsonb`.

## 5. Testing (Playwright, screenshots under `/tmp/browser/`)

Non-tech user pass answering: was the flow easy? confusing? did I get what I wanted?
1. Trigger "roadshare" reset → land on `/welcome`.
2. Walk through name → docs (skip) → shape (Straight) → **cost (Yes, $60,000)** → homes (Manual, 6) → land on `/my-road`.
3. Verify pinned Estimated Share reads a value derived from $60,000 and stays visible while scrolling.
4. Double-click a home → drag the frontage slider → screenshot: pinned Estimated Share number changes in real time.
5. Click Save → close drawer → refresh the page → confirm the new frontage persisted (drawer reopens with the new value; share unchanged after refresh).
6. Repeat with the "No — estimate it for me" branch and confirm the rail's Total-cost override still works.
