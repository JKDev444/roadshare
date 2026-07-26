## Goal

Simplify the right rail on Step 5 and move the contractor-quote decision into onboarding, so the Estimated Share number is always visible and updates live.

## Changes

### 1. Onboarding — add a "Cost" screen (`src/routes/_authenticated/welcome.tsx`)

Insert a new screen after `shape` (before `homes`): **"Do you already have a quote?"**
- Two big tiles: **"Yes, I have a contractor quote"** (reveals a `$` input) and **"No — estimate it for me"**.
- Store `fixedTotal?: number` in local state and pass it into `createMyRoad` as part of the initial planner snapshot (extend the server fn payload / initial state persisted for the road).
- Screen sequence becomes: `name → docs → shape → cost → homes`.

### 2. Planner right rail (`src/components/roadshare/Planner.tsx`)

Restructure the sticky right rail so the **Estimated Share hero is always pinned at the top and visible without scrolling**:

```text
┌─ Right rail (380px, app variant) ─────────┐
│ [PINNED, non-scrolling]                   │
│   Your estimated share  $X,XXX / yr       │
│   share % · vs equal split                │
│   Total project · Per year (group)        │
├───────────────────────────────────────────┤
│ [SCROLLABLE below]                        │
│   Step panel (walkthrough for current step│
│   Split-method picker (on review)         │
│   Simple controls:                        │
│     • Road width slider                   │
│     • Plan over years slider              │
│     • (If no quote) "Adjust estimated cost│
│        total" — single $ input replacing  │
│        the surface-mix panel              │
└───────────────────────────────────────────┘
```

Specifically:
- Split the `<aside>` into a fixed header region (share hero + totals, always mounted for steps ≥ neighbors) and a scrollable region below. Use `flex flex-col` with the hero as `shrink-0` and the rest as `flex-1 overflow-y-auto`.
- Remove the entire **"Fine-tune the math"** collapsible wrapper. Surface only two sliders directly in the rail: Road width and Plan over years. No collapse.
- Remove the **`QuoteControl`** component from the rail. The quote is set in onboarding. If the user did *not* provide a quote, show a single **"Adjust estimated total cost"** `$` input (editable `fixedTotal`) in place of it. If they did provide a quote, show a small "Contractor quote: $X,XXX — edit" line with an inline edit affordance.
- Delete the surface-mix picker UI from the rail entirely (kept default surface values under the hood only as a fallback when no `fixedTotal` and user hasn't touched the total; simplest path: seed `fixedTotal` from the default blended-rate × pavement-area on first mount when unset, so the rail only ever exposes one cost number to the user).

### 3. Always-live Estimated Share

The share hero must render for every step from `neighbors` onward (not only on `review`). Move the compact `ResultsPanel` (or a new lean `ShareHero` component built from `result`) into the pinned header region so it recomputes automatically via the existing `useMemo` on `result` whenever selected homes, width, years, or total cost change.

### 4. Remove "What if more neighbors join?" (`src/components/roadshare/ResultsPanel.tsx`)

Delete the entire projection block (the `Users`-icon card with the `extraNeighbors` slider) and the associated `useState`, `Slider`, and `Users` imports. Estimated Share already updates live when a home is added/removed from the group.

### 5. Copy / labels

- Onboarding cost screen: heading "Do you already have a contractor quote?", helper "If yes, we'll split that exact number. If no, we'll estimate it and you can adjust the total anytime."
- Rail no-quote input label: "Estimated total cost" with helper "Change this anytime — the share updates live."
- Rail quote line: "Using your contractor quote" with edit pencil.

## Technical notes

- `PlannerSnapshot` already carries `fixedTotal`; wiring onboarding → planner just requires seeding it in the initial state persisted by `createMyRoad`.
- The engine already treats `fixedTotal > 0` as an override that bypasses surface-mix (`pctValid` gate), so hiding the surface UI is safe.
- Keep the demo (`/tools/cedar-hollow`) rail behavior consistent: also drop "What if more neighbors join?" and the surface-mix UI, replacing with the single total input for parity.

## Testing

Playwright pass covering: onboarding through new cost screen (both branches), landing on `/my-road`, verifying the Estimated Share hero stays visible while scrolling the rail, and confirming the number updates live when toggling neighbors, width, years, and the editable total. Screenshots at each step saved under `/tmp/browser/`.
