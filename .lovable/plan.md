
## Short answer

Yes — 100%. The hero demo already uses your best visual language (`topo-grid` backdrop, thick rounded asphalt, marching-ants dashed lane, pill-shaped parcels in `--color-selected` / `--color-gold`, pulsing entrance pings). The `/my-road` map should adopt that exact look. Right now the interactive map is more "CAD blueprint" than "friendly plat" — this brings the two experiences into one visual family.

Two things stay non-negotiable during the reskin:
1. Every parcel keeps its label (address or `Home N`).
2. Every existing interaction keeps working — drag homes, drag road, endpoint handles, midpoint "+ corner" split, drop-from-tray, tap-to-place, double-click to edit.

## What changes

**Canvas & backdrop**
- Add the `topo-grid` layer (same class as the hero) behind the SVG at ~40–50% opacity so the map reads like a friendly plat, not a whiteboard.
- Rounded outer container, softer shadow, same border treatment as the hero card.

**Roads**
- Asphalt stroke: `--color-map-asphalt`, `stroke-width: 14`, `stroke-linecap: round`, `stroke-linejoin: round` — matches the hero exactly.
- Centerline: dashed `--color-map-lane` at `strokeDasharray="10 10"` with a slow marching-ants animation (`strokeDashoffset` 0 → -40, 2s linear, infinite). This is the single biggest "wow" moment from the hero and it costs nothing.
- Segment name label rendered on a small pill above the midpoint (readable, doesn't fight the animation).

**Parcels (homes)**
- Rounded pills: `width: 44, height: 28, rx: 5` — same shape as the hero.
- Fills use semantic tokens, not the current outlined boxes:
  - Your home → `--color-gold` at 0.9
  - Selected neighbors → `--color-selected` at 0.7
  - Unselected → `--color-selected` at 0.35 (still visible, clearly de-emphasized)
  - Tray / unplaced → stays in the tray as today
- Fade-and-scale entrance on first render (matches hero's staggered `0.3 + i*0.06`).
- Label sits under the pill in the current font, 11px, `--color-foreground` / muted for unselected.
- Interactivity preserved: drag, double-click, shift-click, click-to-select in the walkthrough — the pill is just the visual shell around the same hit target.

**Entrances**
- Replace the current pin with the hero's pulsing dot: solid `--color-primary` circle + expanding ring (`r: 7 → 16`, opacity `0.7 → 0`, 1.8s infinite). Still draggable in the same spots.

**Handles (kept, restyled)**
- Gold endpoint handles → smaller circles with a subtle ring, matching the entrance pulse family.
- Midpoint "+" split handle → same soft primary pill, only visible on segment hover to reduce noise.

**Placing mode (new road, tap-to-place home)**
- Cursor overlay uses the same topo backdrop tint so it feels continuous with the hero, not modal.

## What stays exactly the same

- Data model, all `layout.ts` math, `engine.ts` cost calc, tray drag/drop, autosave, share link, print view.
- Walkthrough sidebar and its 5 steps.
- The share page (`/s/$slug`) — it renders the same Planner, so it inherits the new look automatically.

## Files touched

- `src/components/roadshare/PlatMap.tsx` — the reskin lives almost entirely here: backdrop layer, road stroke tokens, marching-ants motion path, pill parcels, entrance pulse, handle restyle.
- `src/routes/s.$slug.tsx` — no code change; visual inherits from Planner/PlatMap.
- `src/styles.css` — verify `--color-map-asphalt`, `--color-map-lane`, `--color-selected`, `--color-gold`, and `.topo-grid` are defined (the hero already uses them, so they should be); if any is hero-only inline, promote it to a shared token.
- No changes to `layout.ts`, `engine.ts`, `Planner.tsx`, `HomeDetailsDrawer.tsx`, tray, share fn, or DB.

## QA after the reskin

Playwright pass at 1440×900:
1. `/` hero renders as today (regression check on shared tokens).
2. `/welcome` → address → land on `/my-road`.
3. Confirm: topo grid visible, asphalt is rounded, lane dashes march, "your home" pill is gold, neighbors are teal, entrances pulse.
4. Drag a home, drag a road endpoint, split a segment with "+", drop a tray home — every interaction still works.
5. Click "Share", open `/s/<slug>` in a fresh tab — same look, print button works, no interactive chrome.
6. Screenshot every step and attach to the reply.

Then answer the three questions in the same reply:
1. Did the map feel modern and friendly to a non-tech user?
2. Was anything confusing after the reskin?
3. Did you get the result you wanted?

## Open question

The hero's rounded pills don't show the parcel label *inside* them — the label sits under the pill. On the hero that's fine (8 tiles). On `/my-road` with 20–40 homes, under-pill labels can crowd. Do you want:
- (a) Labels under the pill (closest to hero), accepting some crowding on dense roads, or
- (b) Labels inside a slightly taller pill (48×32) so every home reads at a glance?

Default I'll ship if you don't specify: **(b)**, because labeled parcels was a hard requirement earlier.
