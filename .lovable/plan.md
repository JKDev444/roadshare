## Goal

Free the right rail so the "Your estimated share" hero can breathe. Move the list-management panels ("Homes on this road", "Roads") into compact buttons in the existing top toolbar. Each button opens a popover with the same list + add/rename/delete/reassign actions that live there today.

## Toolbar changes (top-left floating pill, `PlatToolbar`)

New order, left → right:

```text
[+ Add home]  [🏠 Homes (6) ▾]  [+ Add road]  [🛣 Roads (2) ▾]  [✨ Space evenly]  [↻ Reset]  |  [↶] [↷]
```

- **Homes (N)** — `Home` icon + count. Click opens a popover containing today's `HomesPanel` (list of homes with rename, delete, "assign to road" dropdown, and an inline "+ Add" that mirrors "Add home").
- **Roads (N)** — `Route` icon + count. Click opens a popover containing today's `RoadsPanel` (rename, delete, length input, width, Straighten / Extend actions).
- Existing **Add home** and **Add road** buttons stay — one-tap adds are still the fastest path; the new buttons are for managing the list.
- Divider between action buttons and undo/redo for visual grouping.

## Right rail changes

- Remove `<HomesPanel>` and `<RoadsPanel>` from the rail entirely.
- Rail now shows only: the sticky **Your estimated share** hero, the two sliders (Road width, Plan over years), and the Total-project-cost input. Same content, more vertical room, no double scrollbar.

## Popover behavior

- Use existing shadcn `Popover` (already in the project). Anchor to each toolbar button, `align="start"`, `sideOffset={8}`.
- Max height ~70vh with internal scroll so long lists don't push the map.
- Popover closes on outside click / Esc. Editing a home name or reassigning a road keeps it open.
- On viewports < 640px the popover renders as a bottom sheet (`Sheet` component) so it doesn't clip off-screen.

## "What else could go up there?"

Recommended additions, in priority order:

1. **Space evenly** — already exists in the toolbar today but sits in a separate strip above the map; fold it into the same pill so all map actions live in one place.
2. **Reset layout** (↻) — the existing "reset positions" action, moved into the pill.
3. **Fit to screen** (⤢) — one-click zoom-to-content; helpful once users drag things off-canvas.
4. **Legend / labels toggle** (👁) — show/hide the frontage-ft labels on each home; power users like it, first-timers find it noisy.

Everything except items 1 and 2 is optional — I'll implement 1 and 2 by default and hold 3–4 unless you want them now.

## Files touched

- `src/components/roadshare/Planner.tsx` — extend `PlatToolbar` with two new popover buttons that receive the same props `HomesPanel` / `RoadsPanel` already accept; delete the two panels from the right-rail `<aside>`; keep them mounted only inside the popovers so no logic is duplicated.
- No other files change. No data model, no server functions, no persistence changes.

## Out of scope

- No visual redesign of the panels themselves (same rows, same actions).
- No change to onboarding — this only affects the main editor (`/my-road`).
