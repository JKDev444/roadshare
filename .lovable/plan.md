# Make the community map look and feel like Cedar Hollow

## What's broken today
On `/community/:id` the map shows a green grid of tiny gray squares. There's no clickable parcel, no road, no legend, no starting point. The 121 Kalama homes have coordinates but they're clustered tightly, so the current `PlatCanvas` falls back to abstract dots.

## What we're building instead
One shared plat renderer, styled exactly like `/tools/cedar-hollow`:

- Rounded parcel tiles with lot labels, hover tooltip showing the address
- Asphalt road bands with dashed centerlines
- Entrance pins (gold pulse when unset, blue pin when placed)
- Legend chip row: You / Selected / Available
- North arrow + scale bar in the corners
- Parcels are always clickable when `onSelectParcel` is passed (Step 1 "Pick your home")
- An "Add a road" affordance right on the map when there are zero road segments

## Changes

### 1. `src/components/community/PlatCanvas.tsx` — rewrite the render
- Adopt the exact visual language from `src/components/roadshare/PlatMap.tsx` (gradients, filters, dashed centerlines, road labels).
- Replace the "tooManyOrphans" summary card with a real projected view. When parcels cluster or lack polygons, synthesize a tidy grid of parcel tiles arranged along the projected road line (or a stub horizontal road if no segments exist). It should always look like a neighborhood, never like abstract dots.
- Make parcel tiles clickable with the standard highlight states (you = gold, selected = blue, hovered = thicker stroke). Wire hover tooltip.
- When `segments.length === 0`, draw a placeholder "Your road (not drawn yet)" band across the middle so the picture is never empty, and overlay a call-to-action button "Draw the road →" that scrolls/switches to the road-add UI.

### 2. `src/components/community/MyRoadTab.tsx` — hook up the interactivity
- Pass `onSelectParcel`, `selectedIds`, and `youId` to `PlatCanvas` so Step 1 works by clicking the map (in addition to the list below).
- When the picture is clicked in Step 1, jump the step rail to Step 2 automatically (same behavior the list already has).
- On Step 2 ("Which road needs work?"), if `segments.length === 0`, show a big primary "Draw the road" button that opens the existing `GisEditor` road-draw flow inline, instead of the current dead "Looks right" button.

### 3. `src/routes/_authenticated/community.$id.tsx` — starting point clarity
- Above the planner card, add a one-line "Start here → Step 1: click your home on the map" hint that fades once a home is picked.
- Collapse the "Edit the list of homes" section by default (already collapsed) but make its trigger the secondary action, not competing with the map.

### 4. No new data, no new APIs
This is pure presentation and interaction on top of the parcels/segments we already load.

## Success check
- Load `/community/<id>` for the 121-home Kalama test community: I see a real plat picture with parcel tiles, at least a placeholder road, and a legend.
- Click a parcel tile → it turns gold, Step 1 marks done, rail advances to Step 2.
- Step 2 with zero roads shows "Draw the road" instead of "Looks right."
- No blank screen, no green-dot grid, no scrolling required to find where to click first.

## Technical notes
Cedar Hollow's `PlatMap` uses hard-coded polygons. For the in-app version I'll keep the same visual primitives (gradients, filter, dashed lane animation, entrance pins) but drive geometry from projected `parcels[].geojson` polygons, falling back to a synthetic tile grid arranged along the projected `segments` linestring (or a horizontal placeholder). Existing `parcelToFeature` / `segmentToFeature` helpers stay.