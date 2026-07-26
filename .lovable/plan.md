# Make it idiot-proof: tighter drawer + live "Your share" everywhere

You're right on every point. Here's what's actually wrong and the exact fixes I want to ship, ordered by pain.

---

## 1. The Home Details drawer (Attachment 1)

**Problems**
- Horizontal scrollbar because the action row (Remove · Duplicate · Move to tray · Cancel · Save) is wider than the drawer.
- "Move to tray" is jargon. Users don't know what a tray is.
- "Skip from cost math" is jargon.
- Frontage is buried and labeled "optional" — but frontage is THE input that changes someone's share. If they never open the drawer, they never set it. That's a real missing step.
- No live share % / $ inside the drawer, so the user has to close it, scroll, and re-open to see if a change mattered.

**Fix**
- Widen drawer to `max-w-lg` and stack actions in two rows (primary row: Save / Cancel; secondary row: Duplicate / Take off the map / Remove). Kill the scrollbar.
- Rename everywhere:
  - "Move to tray" → **"Take off the map"**
  - "Skip from cost math" → **"Don't count in the split"**
  - "Road frontage in feet (optional)" → **"How much road does this home touch?"** with a slider (10–400 ft, default = auto map estimate) plus a small "Use map estimate" reset link. A slider is faster than typing and shows the range.
- Add a persistent **"Your share preview"** strip pinned to the bottom of the drawer showing this home's `%` and `$/yr` — recalculates as they drag the frontage slider. This is the whole point of the app and it should be right there.

## 2. Frontage collection is a missing step

You're 100% right. Right now frontage comes from a map estimate the user never sees or confirms. Fix:

- In the guided planner (step 3 "Neighbors"), add a **"Confirm road frontage"** micro-step: a compact list of each selected home with a slider (10–400 ft) showing the auto estimate. User can nudge or accept in one tap each. Big "Looks right" button to move on.
- On the map, show the frontage number inside each selected home pill so it's visible without opening the drawer.

## 3. Sliders should update the price live (Attachment 2)

The engine already recomputes on every change — the reason it *feels* dead is the result panel is scrolled off-screen while you're moving the sliders. Fix by making the results **always visible**, not by re-plumbing calc.

## 4. Rebuild the right rail so nothing hides

New layout for the right rail on `/my-road`, top to bottom, no scrolling required to see the answer:

```text
+--------------------------------------------+
|  YOUR SHARE                                |
|  $180 / yr    16.7% of the group           |
|  vs equal split: same                      |
+--------------------------------------------+
|  [ Neighbors sharing (5) ▾ ]  collapsed    |  <- accordion, collapsed by default
+--------------------------------------------+
|  Road width         [—————•———] 20 ft      |  <- sliders live here, big + labeled
|  Plan length        [———•—————] 30 yr      |
|  Surface mix        [ Chip seal ▾ ]        |  <- preset picker instead of 5 rows
|     "Fine-tune mix" link -> opens sheet    |
+--------------------------------------------+
|  Total project  $5,400   ·   $180/yr total |
+--------------------------------------------+
```

Key moves:
- **"Your share" pinned at top**, never scrolls away. Every slider change animates the number.
- **Neighbor list collapses** by default — 5 rows of $180 is noise once you've seen it once.
- **Surface mix becomes a preset picker** (Gravel / Chip seal / 2" asphalt / 3" asphalt / Concrete). 90% of users pick one. Advanced "Fine-tune mix" link opens the existing 5-input sheet only if they want it. This kills the biggest scroll block.
- Width and years stay as sliders but get bigger tracks and live-updating $ next to them (e.g. "20 ft · $180/yr").

## 5. Other sliders / kid-game moves worth adding

- **Home position on road** — instead of "Move earlier / Move later" buttons, one slider "Position along the road" that slides the tile left→right. Instant, obvious.
- **Group size preview** — a slider "What if 2 more neighbors join?" that shows how your share drops. This is a huge "aha" for the negotiation conversation and takes zero extra data.
- **Entrance distance** — already implicit; surface it as a read-only chip on each home pill ("320 ft from entrance") so the "By distance" methodology stops feeling like a black box.

## 6. Ship order

1. Drawer fixes: widen, rename, wrap actions, add live "Your share" strip, frontage as slider. *(smallest, biggest UX win)*
2. Right rail restructure: pin Your Share, collapse neighbor list, add surface-preset picker with advanced sheet.
3. Confirm-frontage micro-step in step 3 of the planner.
4. Position slider replacing Move earlier/later.
5. "What if N more neighbors" slider as a bonus.

## Technical notes

- Drawer lives in `src/components/roadshare/HomeDetailsDrawer.tsx`. Live "Your share" strip reuses `computeAllocation` from `src/lib/roadshare/engine.ts` against a locally-patched homes array so we don't need to plumb dollars in through props.
- Right-rail changes live in `src/components/roadshare/Planner.tsx` (the `RoadsPanel` / results section) and `src/components/roadshare/ResultsPanel.tsx`. Surface presets map to the same `surfaces` object the engine already consumes — no engine changes.
- Frontage confirmation step reuses `HomesTray` styling. Estimate comes from the same `frontage` interval already stored per home.
- No schema changes. No new server functions.

---

Approve this and I'll ship steps 1 + 2 first, screenshot the result, and answer the "would a non-tech user get it?" questions before moving to 3–5.
