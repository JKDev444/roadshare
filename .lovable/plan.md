
# RoadShare — Product Spec & Rebuild Plan

Locking the product down before touching code. Anything not in this doc is out of scope until we agree to add it.

---

## 1. What RoadShare is (product truth)

RoadShare helps a group of neighbors on a **shared private road** answer one uncomfortable question together: **"who pays what for road work, and did we all agree?"**

The user:
1. Describes their road (name, homes on it, how long/wide it is).
2. Picks a project (repave, seal-coat, patch, plow, regrade) and a total cost — or lets the app estimate it.
3. Chooses a fair split (equal, by frontage, or by distance driven from the entrance).
4. Sees each household's share on the same picture everyone else sees.
5. Sends neighbors a link. Neighbors vote yes/no. The tally is public.

The picture and the math are the same source of truth so no one argues.

Non-goals (today): collecting money, scheduling contractors, HOA governance beyond this one decision, mobile-native app.

---

## 2. The screen model — full-bleed editable plat

Confirmed: **full-screen stylized plat, Airbnb-style**. `/my-road` becomes the whole app surface.

```text
┌───────────────────────────────────────────────────────────────┐
│  ≡  My Road ▾    Cedar Hollow Ln         👥 8 homes   ⋯      │  ← slim top bar
├────────────────────────────────────┬──────────────────────────┤
│                                    │  Step 3 of 5             │
│                                    │  ─────────               │
│                                    │  How much will it cost?  │
│                                    │                          │
│      [ EDITABLE PLAT FILLS         │  [ inputs ]              │
│        THE ENTIRE LEFT ~65% ]      │                          │
│                                    │  ← Back      Next →      │
│                                    │                          │
│  ┌──────────────────────────────┐  ├──────────────────────────┤
│  │ + Add home  + Add road  ⇄    │  │  Your share: $412/yr    │
│  │ Rotate  Snap  Undo           │  │  [ Ask neighbors ]      │
│  └──────────────────────────────┘  │                          │
└────────────────────────────────────┴──────────────────────────┘
```

- Plat is full-bleed, edge-to-edge, no card chrome.
- Right rail (~360 px) holds the current step + a persistent "your share" summary once cost exists.
- Floating toolbar on the plat: **Add home**, **Add road segment**, **Rotate view**, **Snap to grid**, **Undo/Redo**.
- Top bar: road name (editable inline), home count, and a `⋯` menu (Upload HOA rules, Share, Reset, Sign out).
- Right rail collapses to a bottom sheet on narrow viewports; plat stays full-bleed.

---

## 3. What a user can do on the plat (answers "what do I do now?")

Every one of these is a real interaction, not a mockup. Each one gets an on-canvas affordance AND a right-rail button so users find it either way.

| Job | On-canvas | Right rail |
|---|---|---|
| Rename a home | Double-click the tile | "Rename" in home details |
| Move a home | Drag the tile | Arrow nudges |
| Remove a home | Click → Delete key | "Remove home" |
| Add a home | Click empty space along a road | "+ Add home" button |
| Move a home to the other side of the road | Drag across, or use "flip side" | "Flip side" |
| Change which home is *mine* | Click tile → "This is my home" | Set in Step 1 |
| Draw an extra road (branch, cul-de-sac) | Toolbar "Add road" → click start + end points | "+ Add road segment" |
| Rename a road | Double-click the road label | Road details panel |
| Rotate the whole plat 90° | Toolbar "Rotate" | "Rotate view" |
| Set road length precisely | Click the road → type feet | "Road length" input |
| Set road width | Click the road → pick preset (1-lane 12 ft / 2-lane 20 ft / wide 24 ft) or type | "Road width" input |
| Mark an entrance (where it meets the public road) | Click a road endpoint → "Entrance" | "Entrances" checklist |
| Undo a mistake | ⌘Z / Ctrl+Z | Undo button |
| I don't like the horizontal layout | Rotate 90°, or drag homes freely | "Reset layout" |
| I have two roads that meet in a T | Add second road, drag endpoint onto first road (snaps) | "+ Add road segment" |

Every empty-state has a helper caption. Example when the plat first loads: *"Drag homes around. Double-click to rename. Use + Add road for a branch."*

---

## 4. Where road measurements come from (the missing step)

You were right — this is the gap. New **Step 2: Confirm your road**, between "Confirm homes" and "Pick your project."

- **Length**: Pre-filled from what we drew (homes × spacing). User can edit as a number ("about 1,240 ft") or by dragging the road endpoints on the plat.
- **Width**: Presets — 1-lane gravel (12 ft), 2-lane (20 ft), wide (24 ft), custom. Default 20 ft.
- **Surface today**: gravel / chip-seal / asphalt / concrete. Feeds cost estimates.
- **Multiple road segments**: each segment carries its own length + width, summed for total pavement area.

Cost math stays: `pavement_area (sqft) × blended $/sqft = total`. The 5 planner steps become:

1. Confirm your homes (which are on the road, which is yours)
2. **Confirm your road (length, width, surface)** ← new, explicit
3. Pick your project (repave / seal / patch / plow / custom)
4. Choose how to split (equal / frontage / distance)
5. Your fair share + Ask neighbors

---

## 5. CC&R / HOA document upload — both places

- **Onboarding**: brings back a 3rd tile "**Upload HOA papers (optional)**" with an honest subtitle: *"We'll try to pull out cost-split rules and voting rules. Most docs don't have this — you can still add your road manually."*
- **Inside the app**: persistent card in the `⋯` menu and on Step 2 rail — "Upload HOA rules." Same parser. If it finds a split method, voting threshold, or road ownership clause, it pre-fills those fields and shows a "we found this in your doc" callout the user can accept or ignore.
- Parsing runs server-side; failure is graceful ("We couldn't find cost-split rules — you can pick one manually").
- We stop pretending the CC&R is a required source of truth. It's a helper.

---

## 6. Full list of "what do I do now?" moments (non-tech user audit)

Every one below gets an explicit answer in the UI — inline help, an empty state, or a coach mark. This is the acceptance checklist for the rebuild.

**On landing at `/my-road` for the first time:**
- "Is this really my road?" → top-bar road name is editable + "This is my home" pin call-out.
- "The layout is horizontal, my road curves." → Rotate button + drag-to-move + "these are diagrams, not to scale" caption.
- "Where's the map?" → "This is a diagram of your road. It's the same picture your neighbors see. No maps needed."
- "One of my neighbors is missing." → "+ Add home" toolbar + right-rail button.
- "A home shouldn't be here." → click → Delete.
- "My road forks / there's a side street." → "+ Add road segment" toolbar.
- "How does it know my road is 1,200 ft?" → Step 2 shows the number and lets them edit it.
- "What's frontage vs distance?" → tooltip + one-line plain English on Step 4.
- "Can I upload my HOA papers?" → yes, `⋯` menu or Step 2 rail.
- "How do I share this with my neighbors?" → Step 5 "Ask my neighbors" copies a link.
- "How do neighbors vote if they don't have an account?" → anonymous vote page (already built at `/vote/$decisionId`).
- "I messed up — how do I start over?" → `⋯` menu → Reset (was easter egg only; now visible).
- "Did I save?" → autosave indicator ("Saved just now") in the top bar.
- "Can I plan more than one project?" → Yes, Step 3 shows a "Projects" chip list; each project has its own share + vote.
- "Nothing is happening when I click Next." → disabled Next buttons show *why* ("Add at least one home first").

---

## 7. Data model (what changes)

Current `roads.state` JSON is a good foundation. Extend it:

```ts
type RoadState = {
  roadName: string;
  homes: Home[];                          // existing
  segments: RoadSegment[];                // NEW — replaces implicit single road
  entrances: EntranceId[];                // existing
  measurements: {
    surface: "gravel" | "chip" | "asphalt" | "concrete";
    // per-segment width + length live on the segment itself
  };
  projects: Project[];                    // NEW — was inline planner state
  activeProjectId: string;
  ccrDoc?: { fileId: string; parsed?: CcrHints };  // NEW
  layoutOverrides: { homeId: string; x: number; y: number; side: "n" | "s" }[]; // drag positions
  rotation: 0 | 90 | 180 | 270;
};

type RoadSegment = { id; from: PointRef; to: PointRef; lengthFt: number; widthFt: number; name?: string };
type Project = { id; name; surfaces; fundingPeriod; methodology; decisionId? };
```

New Supabase surface:
- `documents` bucket already exists — reuse for CC&R PDFs.
- New `ccr_parses` table (jobId, roadId, status, extracted JSON, error) so parsing is async and non-blocking.
- `decisions` + `decision_votes` unchanged.

---

## 8. Rebuild phases (small, shippable, testable)

Each phase ends with a Playwright pass + the 3 UX questions answered.

**Phase A — Full-bleed shell (no new features)**
- New `/my-road` layout: full-bleed plat left, sticky right rail, floating toolbar, editable road-name top bar.
- Move existing 5-step planner into the right rail unchanged.
- Goal: same features, new shape. Ship, verify nothing broke.

**Phase B — Editable plat**
- Draggable homes with snap-to-side + snap-to-spacing.
- Click-to-add / delete home on empty road span.
- Inline rename (double-click).
- Rotate view (90° increments) — pure transform, no data change.
- Undo/redo stack (in-memory + persisted via existing autosave).

**Phase C — Multi-segment roads**
- Add road segment tool: click start point, click end point, snaps to existing segment or grid.
- Per-segment length + width editors on segment click.
- Rebuild `engine.ts` to sum pavement area across segments.
- Layout algorithm: place homes along their segment; the T-intersection lays out naturally.

**Phase D — Confirm your road (new Step 2)**
- Inserts between homes-confirm and project-picker.
- Length prefilled from segments, editable. Width preset chips. Surface selector.
- Right-rail step; also click-a-segment shortcut on the plat.

**Phase E — CC&R upload (both surfaces)**
- Onboarding: 3rd tile restored.
- In-app: `⋯` menu + Step 2 rail card.
- Async parse via server function; results appear as accept/ignore callouts on relevant steps.
- Graceful "nothing usable found" copy.

**Phase F — Answer-every-question polish**
- Empty-state captions on every plat state.
- Disabled-button reasons.
- Autosave indicator.
- Visible Reset in `⋯` menu (easter egg stays).
- Coach mark on first `/my-road` visit: one bubble, dismissible, points at the toolbar.

**Phase G — QA + docs**
- Full Playwright walkthrough for all three onboarding paths → plat editing → project → vote → share link.
- Screenshots at every step, saved under `/tmp/browser/spec-qa/`.
- Update `docs/user-workflow.md` and `docs/developer-guide.md` to match the new shape.
- Answer the three questions per phase, in writing.

---

## 9. What we're intentionally NOT doing

- No real map tiles in-app. Confirmed.
- No Mapbox drawing tools in-app.
- No account/community deletion UI beyond Reset.
- No invite emails; sharing stays a copy-a-link.
- No pricing/checkout wiring.
- No mobile-native app.

---

## 10. How we avoid re-doing this again

- This doc is the contract. If a request contradicts it, we amend the doc first, then code.
- Every phase ends with a written answer to your three questions and screenshots you can review.
- No phase starts until the previous one is signed off.
- `docs/user-workflow.md` gets updated in the same PR as the code that changes user flow — never after.

---

**Approve this and I'll start with Phase A. Or tell me which sections need edits and I'll revise before any code is touched.**
