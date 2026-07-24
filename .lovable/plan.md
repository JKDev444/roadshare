
# `/my-road` full-flow rebuild: layout, editing, and sharing

Combines the earlier plan (templates, home tray, snap-safe layout, walkthrough consolidation) with the new decisions on per-home editing, bulk entry, and share output.

## 1. Start with a template, not a blank canvas

First landing on `/my-road` (no custom segments yet) shows a full-screen picker: **"Which shape looks most like your road?"** with 6 illustrated cards:

Straight · L-shape · T-intersection · Cross · Cul-de-sac · Loop

Footer link: "None of these — I'll draw it myself."

Picking one drops the multi-segment geometry in, pre-named ("Main St", "Side St"), and pushes homes into the tray. Also reachable from the toolbar any time as a **Templates** button.

## 2. Homes tray — nothing can float loose

Bottom-docked **"Homes to place"** tray. Every home is a card ("Home 1", "123 Oak St", …).

- Drag a card onto the map → nearest segment highlights, ghost lot previews landing spot (perpendicular, on the cursor's side). Drop → snaps to that spot on that segment.
- Drag a placed home off all roads → returns to the tray instead of orphaning.
- **Auto-arrange** per segment: one-click even spacing.
- Tray counter: "3 of 8 homes placed."

Data change: `Home.position` becomes `{ segmentId, along: 0..1, side: "left" | "right" } | null`. `null` = in the tray. Legacy `{x, y}` rows are projected onto their nearest segment on first read and rewritten on next save.

## 3. Home details drawer (new)

Clicking any home tile on the map opens a right-side drawer. Same drawer for "your home" and neighbors.

Fields, saved on blur:

- Address (single-line, geocode suggestions optional later)
- Owner / label ("The Johnsons")
- Frontage in feet — pre-filled from tile width, editable to override
- Segment (dropdown of roads on the map)
- Corner lot toggle — when on, adds a second segment picker so this home fronts two roads
- Skip from the math toggle — for vacant lots, common areas, HOA-owned

Drawer footer: "Move back to tray" and "Delete home."

## 4. Bulk entry into the tray

Two entry points on the tray:

- **Paste addresses** — textarea, one address per line, each becomes a card in the tray.
- **Upload CSV** — columns: `address, owner_name, frontage_ft, segment_name` (all optional except address). Rows without a matching segment name land in the tray unassigned. Show a preview table before import.

Both live behind a small "+ Add many at once" button on the tray so we don't overwhelm the default view.

## 5. Road-shape editing (custom, when templates don't fit)

Polyline drawing, made effortless:

- "Draw a road" → crosshair cursor + banner: "Click to add a corner. Double-click or Enter to finish. Esc to cancel."
- **Angle snap to 45° / 90°**, **endpoint snap** to existing roads (creates real intersections).
- Each straight run between corners is its own segment (per-leg length/width editable).
- **Midpoint "+ corner" handle** on any segment turns a straight road into an L without redraw.
- Segment click → small floating toolbar: rename, length, width, cost/ft override, delete.

## 6. Fold "Change the details" into the walkthrough

The mystery panel goes away. Its four settings move into the step where they make sense:

| Setting | New home |
|---|---|
| Split method (distance / frontage / equal) | Step 3 — "How should everyone chip in?" as three big cards with plain-English helpers |
| Road width | Already Step 2 — keep |
| Surface mix (% gravel vs asphalt + cost/ft) | New Step 4.5 — "What's the road made of?" with two sliders |
| Funding period (years) | Step 5 — inline "Spread over ___ years" next to the yearly dollar figure |

## 7. Share the finished plan

Two exports from the Review step:

- **Share link** — public read-only URL renders the map, home list with each share, and totals. No sign-in to view. Backed by a new `shares` row (`road_id`, `share_token`, `expires_at nullable`, `revoked_at`) with a `TO anon` SELECT policy scoped by token. Server function generates the token, revokes, and lists a road's active shares. Public loader fetches by token via a server publishable client.
- **Download PDF** — printable one-pager: header (road name + date), the plat map as SVG, split table (home · segment · frontage · yearly share · lifetime share), totals footer. Generated client-side to keep it simple (no server rendering needed).

## 8. Broader audit items included in this plan

- **Progress chip** on re-entry: "6 of 8 homes have addresses · 2 segments need a length" with click-to-jump.
- **Frontage label** on each home tile ("42 ft") so the math is visible.
- **Validation warnings** surfaced in the rail: homes not on a road, segments with 0 length, frontage exceeding segment length, no split method chosen.
- **Undo/redo widened** to cover segment edits, address changes, template application, tray moves — not just home drags.
- **Empty state on return** — small "Welcome back. Pick up where you left off?" banner linking to the first unresolved step.

## Deferred (explicitly out of scope for this cycle)

- Neighbor self-edit / collaboration — single-owner model per your call.
- Curved (bezier) roads — templates cover common shapes.
- Auto-detecting streets and parcels from an address.
- Napkin-stroke drawing.
- Mobile touch gesture pass (works on desktop first).

## Files touched

- `src/lib/roadshare/layout.ts` — new `Home.position` shape, `snapHomeToSegment` helper, `ROAD_TEMPLATES` data, per-home `ownerLabel`, `frontageFtOverride`, `secondSegmentId`, `skipFromMath` fields.
- `src/components/roadshare/PlatMap.tsx` — home tray, drag/ghost preview, midpoint corner handles, angle + endpoint snap, segment mini-toolbar, per-tile frontage label.
- `src/components/roadshare/TemplatePicker.tsx` (new) — full-screen picker + toolbar popover.
- `src/components/roadshare/HomeDetailsDrawer.tsx` (new) — right-side drawer with all per-home fields.
- `src/components/roadshare/BulkAddDialog.tsx` (new) — paste + CSV import.
- `src/components/roadshare/Planner.tsx` — remove "Change the details" panel, move split method into Step 3 as cards, insert Surface-mix mini-step, add funding-period input to Step 5, progress chip, validation surface.
- `src/components/roadshare/SharePanel.tsx` (new) — link + PDF actions in Step 5.
- `src/lib/roadshare/pdf.ts` (new) — client-side PDF export (jsPDF + SVG serialization).
- `src/lib/roadshare/share.functions.ts` (new) — `createShare`, `revokeShare`, `listShares` server functions.
- `src/routes/share.$token.tsx` (new) — public read-only view.
- `src/routes/_authenticated/my-road.tsx` — first-visit template gate, new handlers (`handleApplyTemplate`, `handleReturnHomeToTray`, `handleAutoArrangeSegment`, `handleEditHome`, `handleBulkAdd`, `handleCreateShare`).
- One migration for the new `road_shares` table (with GRANT + RLS: owner full access, anon SELECT scoped by token).

## Migration sketch

```sql
CREATE TABLE public.road_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  road_id uuid NOT NULL REFERENCES public.roads(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  revoked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.road_shares TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.road_shares TO authenticated;
GRANT ALL ON public.road_shares TO service_role;
ALTER TABLE public.road_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages shares" ON public.road_shares FOR ALL
  TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Anon can look up by token" ON public.road_shares FOR SELECT
  TO anon USING (revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()));
```

The public `roads` read for the share view is done server-side via `supabaseAdmin` after verifying an active `road_shares.token` — no `TO anon` grant needed on `roads`.
