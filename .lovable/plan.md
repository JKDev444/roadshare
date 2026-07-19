# Redesign Home and My Road

I agree with the uploaded document. This plan implements it end-to-end while preserving the existing architecture (TanStack Router, 5-item nav, Mapbox as source of truth, Fair Share methods, RLS, onboarding state machine).

Delivered in 4 phases so you can approve/test each one before the next.

---

## Phase 1 — Success Summary and routing after onboarding

- Rewrite the existing `SuccessSummary` step to match the spec:
  - Headline: "Your RoadShare Community Is Ready"
  - Line: `{name} has been created in {city, state}.`
  - Plain-language stats: homes, possible shared road, approximate feet, documents.
  - Primary: **Go to Community Home** → `/community/$id` (Home, not the map).
  - Secondary: Review My Road, Upload Documents, Add Neighbors.
- Change post-completion navigation so the wizard lands on Home.
- Keep confetti; move the welcome banner into the new Home layout in Phase 2.

## Phase 2 — Rebuild Home as a guided dashboard

- **Header** — name, city/state, one-line status, one primary CTA (**Continue Setup**). History/Export move into a secondary menu. When all 5 steps are complete, hide **Continue Setup** and surface an "All set — invite your neighbors" link back into My Road.
- **Setup checklist** — 5 plain-language steps with per-item status + action button + completed state. Progress reads `X of 5 complete`.
- **Community summary cards** — Homes, Shared Road, Documents, Decisions. Each card has a plain sentence + one action button. No bare numbers.
- **Recent Activity** — collapsible section at the bottom (demoted, not deleted).
- Remove the four unexplained stat cards from the current Home.

## Phase 3 — Rebuild My Road

- Sub-sections replacing the current tab strip:
  - **Overview** — simplified visual of shared road, connected homes, segments, current split method, anything needing confirmation. Presentation layer over the same Mapbox data — geographic map remains source of truth.
  - **Homes & Access** — list with address, membership status, road access point, distance used, review status. Selecting a home opens a brief panel (address, community status, owner, road access, distance) — not a full form.
  - **Cost sharing** — existing three Fair Share methods, presented more visually. Math untouched.
- Remove the Map / Properties / **Projects** switch from `AppShell`/community workspace. Road-work proposals live under **Decisions**.
- Keep the Mapbox map available as a "detailed view" toggle inside Overview.

## Phase 4 — Drawing, terminology, empty/error states, responsive

**Drawing (3 steps):**
- Prepare: explain what drawing does + Start / Cancel.
- Draw: visible point per click, live length readout, sticky Undo Last Point / Finish Road / Cancel controls. Finish via button or double-click.
- Confirm: name (default "Shared Road 1"), approximate length, homes-using count, Save Road / Edit Drawing / Cancel. No advanced maintenance/legal fields here.

**Terminology sweep:**
- "Verified" → "Home details confirmed" / "Neighbor confirmed their home" / "Needs review" depending on what was confirmed.
- "Parcel" → "Home" in homeowner-facing surfaces (kept where accuracy matters).
- "Projects" → "Decisions" for road-work proposals.
- Only rename where underlying data supports the new label.

**Empty / loading / error states:**
- Preserve the lasso fallback.
- No-homes empty state: "We Could Not Automatically Find the Homes" — Add Address / Use Lasso / Try Again.
- Map load error: "We Could Not Load the Map Data" — same three actions.

**Responsive behavior (Part 8):**
- Desktop, smaller laptops, tablets, mobile — every new surface (Home checklist, summary cards, My Road tabs, drawing controls) tested at each viewport.
- Drawing controls stay fixed and visible while editing, on every viewport.
- Home checklist collapses to a single column on mobile; summary cards stack.
- My Road sub-sections switch to a segmented control on mobile, not a hidden dropdown.

---

## Constraints (from the doc + existing conventions)

- No `src/pages/`. Everything under `src/routes/`.
- No new top-level nav item — 5-item nav stays.
- No hardcoded colors — tokens in `src/styles.css` + shadcn variants only.
- Mapbox + US Census address fallback preserved.
- OSM building + lasso fallback preserved.
- Fair Share methods and math untouched.
- Onboarding state machine step order untouched — only the Success step's content and the routing that follows it.

---

## Testing after each phase

After every phase I will run Playwright against the live preview, take screenshots at each step, and answer these four questions in writing before calling the phase done:

1. If I were a non-tech user, was the flow easy enough?
2. Did anything on the screens confuse me or seem out of place?
3. Was any part of it confusing?
4. Did I get the result I wanted?

Per phase, the flows I'll run:

- **Phase 1** — fresh signup → onboarding → Success Summary → clicks "Go to Community Home" → lands on Home.
- **Phase 2** — Home renders correctly with no map; setup checklist advances step-by-step; each summary card's action button opens the right screen; Recent Activity is present but collapsed.
- **Phase 3** — My Road opens on Overview; Projects tab is gone; selecting a home shows the brief panel; switching Fair Share methods shows different splits with the same underlying math.
- **Phase 4** — draw a road end-to-end (button-finish and double-click-finish); force an empty-parcels area (rural lasso) and confirm the empty-state UI; force a map load error and confirm recovery actions; every step re-run at desktop, small laptop, tablet, and mobile widths.

Regression pass at the end: run the full journey (signup → onboarding → Success → Home → My Road → draw a road → save → back to Home → checklist marks the step complete) and re-answer the four questions.

---

## Acceptance criteria (from the doc)

The redesign is done when all of these are true:

- Home is the default post-onboarding destination.
- Home contains the setup checklist and community summary; no dense map.
- My Road contains the road map and cost-sharing tools.
- The 5-item app navigation is preserved.
- "Projects" is removed from the community workspace.
- Road-related proposals continue through Decisions.
- Numbers on Home have plain-language explanations.
- Recent Activity is demoted during initial setup.
- The shared road is visually distinguishable on the map.
- Terminology matches the underlying data.
- The Fair Share calculator's three methods still work.
- The full user journey (12 checkpoints in the doc) passes end-to-end on desktop and mobile.

---

## Deliverables at the end

- The new Home, My Road, and Success Summary shipped.
- A short written summary covering: the new onboarding end, new Home, new My Road, how the simplified visualization uses existing data, terminology changes, the new drawing flow, and confirmation that Fair Share is preserved.
- Playwright screenshots + written non-tech-user Q&A per phase.
