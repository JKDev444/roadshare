
## What's wrong today
1. **Selected frontage bar** is drawn in `--color-selected-foreground` at 0.9 opacity — on the dark asphalt it's almost invisible.
2. **Map colors drift from the homepage hero.** The hero uses a very specific look (asphalt + animated dashed lane, gold "you" tile with selected-blue "neighbors", pulsing entrance dots). The editor uses similar tokens but different weights/opacities so it feels off-brand.
3. **Selecting all parcels leaves gaps** because each parcel draws its own short frontage line — the road between two homes shows no highlight. There's no single "shared portion of the road" overlay.
4. **No way to reorder homes** along the road. Users can drag freely (and detach), but can't say "put me second from the west."
5. **Adding a road is a click-around free-draw** — endpoints land wherever the mouse goes, angles get weird, and connections to existing roads aren't snapped.
6. **No way to change the road template later** once the map is created.

## Fix plan

### A. Make the "sharing this road" highlight obvious (rebrand to match hero)
- Repaint the selected-frontage line as a **bright gold ribbon on top of the asphalt**: `var(--color-gold)` at full opacity, 7px wide, rounded caps, with a soft outer glow (SVG filter) so it reads on dark asphalt exactly like the hero's animated lane reads on the demo.
- Add an **animated dashed overlay** on top of the ribbon (same marching-ants motion the hero uses) so a selected home visually "owns" a piece of road.
- Tooltip on hover of the ribbon: "This is the piece of Maple Lane The Smiths share the cost of."

### B. Continuous "group frontage" overlay (fixes the gap in attachment 2)
- Compute the **union** of all selected parcels' frontage per road segment, merge overlapping/adjacent intervals, and draw **one continuous gold ribbon per segment** covering the merged span (plus a small pad between adjacent homes so there's no visible gap).
- If every home on a segment is selected, the ribbon covers the full segment end-to-end.
- Keeps per-home ribbons visible in a lighter tint when only some are selected, so you can still see which slice belongs to which house.

### C. Match the homepage hero exactly
- Reuse the hero's exact tokens/weights on `/my-road`:
  - Asphalt stroke width, lane dash pattern, lane animation duration, entrance pulse.
  - Home tiles: **gold for "you"**, **selected-blue for "sharing"**, muted lavender for "available" — same opacities as hero (0.9 / 0.55 / 0.35).
  - Rounded corners `rx=5`, soft shadow filter, same font weight.
- Extract the shared visual constants into `src/lib/roadshare/mapTheme.ts` so hero + editor render from one source.
- Add the same topo-grid backdrop opacity (0.5) the hero uses.

### D. Let users reorder homes without breaking the map
Add a **"Reorder homes"** mode toggle (button in the toolbar). While on:
- Homes lock to their road side (top/bottom of segment).
- Dragging a home along the road **swaps positions** with its neighbor (like reordering photos in Apple Photos) — no free-form placement, no detaching.
- A small "↑↓ Move" chip on each home lets non-drag users tap to shift left/right.
- A side toggle per home ("North side / South side") flips it across the road cleanly.
This removes the "detached" problem entirely for users who just want to rearrange.

### E. Kid-simple road adder (fixes attachment 3)
Replace the free-draw flow with a **guided modal**:
1. **"Where does the new road go?"** — three big cards:
   - **Connects to an existing road** (T-intersection) → pick which road, pick which side (north/south/east/west), pick length. We compute geometry, snap to endpoint or midpoint, no dragging.
   - **Parallel to an existing road** → pick which one, pick distance. Auto-drawn parallel.
   - **Standalone road** → pick direction (↑ ↓ ← →) and length. Auto-placed in empty space.
2. **Templates for the whole layout**: "Straight," "L," "T," "Cross," "Cul-de-sac," "Loop" — same set as `ROAD_TEMPLATES`, shown as thumbnails. One tap replaces or extends the current layout.
3. No free clicking on the canvas. Every road lands snapped, orthogonal, and connected.

### F. Change the template later
- Add a **"Change layout"** action in the header menu.
- Opens the same template gallery. Warns "This will rearrange your homes to fit the new layout — home names and settings are kept." On confirm, we re-run `autoArrangeHomes` against the new segments and preserve every home's owner/address/side preference where possible.

### G. Other little adjustments users will want (all included)
- **Flip a home to the other side of the road** (one tap).
- **Rename a road** inline on the map (double-click the road label).
- **Set a road as private/shared/public** (affects who pays).
- **Mark a home as "skip from cost math"** (already in data model — surface as a toggle in the drawer with a clear "This home doesn't help pay").
- **Straighten a road** (one tap to snap crooked endpoints to horizontal/vertical).
- **Extend / shorten a road** with +/- buttons in feet (no dragging).
- **Duplicate a home** ("Add another neighbor here").
- **Move an entrance** to the other end of a road (one tap).
- **Undo/Redo** already exists — surface keyboard shortcuts (⌘Z / ⌘⇧Z) in a tooltip.
- **Reset zoom / fit to screen** button.
- **Compass rotate** (already exists) with a "Snap to north" button.
- **"Show cost per foot"** toggle that overlays each home's dollar share on the ribbon.

## Verification (per your standing rule)
Playwright regression on `/my-road`:
- Select a home → gold ribbon is clearly visible on asphalt (screenshot).
- Select all homes → single continuous ribbon per road, no gap (screenshot matching attachment 2 scenario).
- Reorder mode: drag home 4 into position 2 → swap succeeds, no detach (screenshot).
- Add road via guided modal (T-intersection to Maple Lane) → lands snapped, no free-draw mess (screenshot matching attachment 3 scenario).
- Change layout from Straight → L → homes redistribute, names preserved (screenshot).
- Compare `/my-road` side-by-side with homepage hero → same asphalt, lane dash, tile colors.

I'll post the screenshots and answer your three standing questions (easy? confusing? got the result you wanted?) after the run.

## Technical notes
- New file: `src/lib/roadshare/mapTheme.ts` — shared constants (asphalt width, lane dash, tile rx, opacities, animation timings).
- `HeroMap` in `src/routes/index.tsx` and `PlatMap.tsx` both consume `mapTheme.ts`.
- New file: `src/lib/roadshare/frontageMerge.ts` — merges per-parcel frontage intervals per segment into continuous ranges.
- `PlatMap.tsx`: add SVG `<filter>` for gold glow; add merged-ribbon layer above asphalt, below per-parcel ribbons.
- New component: `src/components/roadshare/AddRoadDialog.tsx` — guided 3-choice modal; replaces click-to-draw handler in `PlatMap.tsx`.
- New component: `src/components/roadshare/ChangeLayoutDialog.tsx` — reuses `ROAD_TEMPLATES`; calls `autoArrangeHomes` after swap.
- New component: `src/components/roadshare/ReorderHomesMode.tsx` — swap-based drag using array index on the segment; disables free drag while active.
- `HomeDetailsDrawer.tsx`: add "Flip side," "Skip from cost math," "Duplicate."
- No schema changes required — everything persists in the existing `road_shares` JSON blob via the debounced autosave.
