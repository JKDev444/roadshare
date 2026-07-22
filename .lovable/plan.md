## What you're seeing and why

- **Two scrollbars on the left** — the map area has its own `overflow-auto` wrapper *and* the page scrolls, so you get one scrollbar from each.
- **"Documents saved" tile** lives in the right rail as a collapsible card; it's clutter on a full-bleed screen.
- **Header** — logo is centered because it's the only item in a `justify-between` bar with a menu on the right.
- **New roads are just stacked horizontal bars** — `buildLayout` places every segment as a straight west→east line, one below the other. You can't grab, rotate, or reshape them.
- **Nothing is draggable** — `PlatMap` is a static SVG. Homes and roads have click handlers only.

## The fix (scoped to layout + editability, no data model change)

### 1. Top bar becomes the app nav
- Logo pinned left, road name next to it.
- Center: nav pills — **Map**, **Documents**, **Neighbors** (Neighbors reveals when we add it later; ship Map + Documents now).
- Right: the existing `⋯` menu (Start over / Sign out).
- Remove the "Documents saved" collapsible tile from the right rail. Move Documents to its own route `/documents` reached from the top nav.

### 2. Kill the double scrollbar
- Right rail keeps its own scroll (`overflow-y-auto`), map area becomes non-scrolling (`overflow-hidden`) and the plat SVG scales to fit — same pattern the Cedar Hollow demo uses. Result: one scrollbar, on the right rail only.

### 3. Draggable homes and roads on the map
Turn `PlatMap` into an interactive editor:
- **Drag a home**: pointer-down on a parcel rect, pointer-move updates its `poly` + `label` + `frontageLine` offsets. Snaps to a light grid (12px). Persists via a new `positions` map on each home (`{ x, y }` overrides).
- **Drag a road**: pointer-down on the asphalt line grabs the whole segment; move translates both endpoints together. Endpoint handles (the gold circles already drawn) become individual drag handles to reshape length/angle. Live length readout in feet while dragging.
- **Rotate a road**: small rotate handle on the segment midpoint (already visible via toolbar becomes per-road).
- Shift-drag = constrain to horizontal/vertical. Escape cancels an in-progress drag.
- All drags feed into the existing history stack so ⌘Z / ⌘⇧Z undo/redo them.

### 4. New roads land where you want them
When you press **Add road**:
- Instead of appending another horizontal bar underneath, the cursor enters a **"place your road"** mode — click once for the start point, again for the end point. Preview line follows the cursor.
- Escape or right-click cancels.
- The placed road is stored with real endpoints (not derived from row index), so the next drag/edit works naturally.
- Existing segments migrate lazily: if a segment has no stored endpoints, we fall back to the current auto-row placement, so nothing breaks for saved roads.

### 5. Persistence
Extend the `state` JSON on `roads` with:
- `homePositions: Record<homeId, { x, y }>`
- `segmentGeometry: Record<segmentId, { ax, ay, bx, by }>`

`buildLayout` uses these when present, falls back to the current row layout when absent. Same debounced save path already wired in `/my-road`.

### 6. Small polish
- Toolbar moves into the top bar (Add home / Add road / Rotate / Undo / Redo) so it isn't floating over the map.
- Bottom "Double-click to rename · Shift-click to remove" hint stays, plus a new line: "Drag to move · Drag endpoints to reshape."

## Files touched

- `src/routes/_authenticated/my-road.tsx` — top-bar nav, remove floating toolbar wiring, thread `homePositions` / `segmentGeometry` state + history.
- `src/components/roadshare/Planner.tsx` — drop DocumentsPanel from right rail, drop bottom stepStrip's redundancy, single-scroll shell.
- `src/components/roadshare/PlatMap.tsx` — pointer-based drag for parcels and segments, endpoint handles, "place road" mode.
- `src/lib/roadshare/layout.ts` — accept and honor `homePositions` + `segmentGeometry` overrides.
- New `src/routes/_authenticated/documents.tsx` — hosts `DocumentsPanel` as a full page.
- `src/components/roadshare/Planner.tsx` app-variant: remove the DocumentsPanel import/render.

## QA (I'll run and report back the three answers)

1. Onboard fresh → land on `/my-road`, verify single scrollbar, top nav visible with logo-left.
2. Add a road via click-click placement, drag it, drag its endpoints, drag a home, undo/redo.
3. Click **Documents** in the top nav → uploads work on the standalone page.
4. Non-tech pass answering: easy? confusing? got what I wanted?

Ready to build on approval.