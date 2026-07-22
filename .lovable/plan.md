# RoadShare v2 — Kid-Simple Rebuild

**One reason this app exists:** neighbors on a shared private road need to know what each household owes for repairs — and feel it's fair. Everything else is noise. The whole app collapses to one page that looks like `/tools/cedar-hollow`, with the shortest possible on-ramp to get there.

---

## The mental model I'm optimizing for

Picture a parent who has never used a "SaaS." They got a letter about a road repair. A neighbor sent them RoadShare. They should be able to:

1. Type or paste their neighbors' addresses.
2. See a friendly map of their road with everyone's house on it.
3. See "You: $412/year" in big type.

Three screens. No jargon. No decisions unless there's a decision worth making.

---

## Onboarding: 2 screens, 3 ways in

### Screen 1 — "Who's on your road?"

One card, one heading, **three big playful tiles** (same visual language as the existing `StartChoiceStep`):

| Tile | What it does |
|---|---|
| 🏠 **Just my address** | Type one address. We auto-find neighbors within a widening radius. |
| 📋 **Paste a list** | Big textarea, one address per line. Great for people who already have the HOA roster. |
| ✍️ **Add them by hand** | Skip typing addresses — just say "6 homes on my road" and we drop 6 unnamed tiles you can label later. |

Always visible under the tiles:
- One text input: **"Name your road"** (e.g. "Maple Lane") — placeholder, not required
- One dropdown pre-filled: **"You're home #___ on the road"** (we ask this on screen 2 instead if they don't know yet)

Bottom link: *"Just show me how it works"* → seeds the Cedar Hollow demo data into their account so they can play, then delete.

### Screen 2 — "Here's your road. Look right?"

Regardless of which tile they picked, screen 2 is **the same page**: the Cedar Hollow-style map, pre-populated with their homes on a straight road. A single yes/no question at the top:

> **"This look about right?"** &nbsp; [ ✅ Yes, open my road ] &nbsp; [ ✏️ Let me fix it ]

If they hit "fix it," inline controls appear directly on the map:
- Click a tile → rename or delete
- Click "+" at either end of the road → add a home
- Drag a tile to reorder
- One toggle: **"My home is on the ___ side"** (left/right/either) — cosmetic, purely to make the gold "you" tile land where they expect

No modal, no separate editor screen. What they see IS the app they'll use.

**Nothing else is asked.** No surface picker, no methodology picker, no funding period, no CC&R upload, no entrance pins. Those all live inside `/my-road` with smart defaults already applied (2" asphalt, distance-based split, 15-year funding, both entrances active if the shape has them).

---

## Road layouts — decided FOR the user, tweakable later

**Do NOT ask about road shape up front.** A non-tech user can't answer "T-junction or cul-de-sac?" and shouldn't have to. Instead:

- **Default road:** a straight horizontal line with homes evenly spaced along both sides. This works for 95% of real private roads and matches the "keep it straight" direction from earlier.
- **Optional (advanced, hidden behind a "Change road shape" link inside `/my-road`):** three templates rendered as picture-book thumbnails:
  1. **Straight road** (default) — one line, homes on both sides
  2. **T-junction** — like Cedar Hollow, two roads meeting
  3. **Cul-de-sac** — one road ending in a loop
  
  Picking a template rearranges tiles automatically. No drawing tools. No vertices. No lasso. If someone needs more than these three shapes, they're not the target user for v2.

**Why this beats asking:** the answer to "which shape?" doesn't change what a non-tech user needs (their fair share). It only changes the picture. So we give them a picture that's usually right, and let them swap it if it's wrong.

---

## `/my-road` — the whole app

Identical layout to `/tools/cedar-hollow`, powered by the same `PlatMap` + `ResultsPanel` + `engine.ts`.

- **Left 60%:** animated dashed road, home tiles in the neighborhood palette, gold "you" tile. Click a tile to see its share. Tiny toolbar: `+ Add home` · `Change road shape` · `Rename road`.
- **Right 40%:** the four progressive step cards from Cedar Hollow, **but pre-answered with sensible defaults so the results are visible immediately**:
  1. **Your home** — pre-picked from onboarding, editable by clicking a tile
  2. **Who's chipping in** — everyone checked by default; uncheck to exclude
  3. **What's the project?** — one slider "How much road are we fixing?" (0–100%), one surface picker with picture thumbnails (Gravel / Chip seal / Asphalt / Concrete), one input "Years to pay it off" (default 15)
  4. **Your share** — big number, per-year and one-time, plus a "share this with neighbors" copy-link button
- **Top bar:** road name, avatar menu (Sign out, Start over). No sidebar.

Every change autosaves (500ms debounce) to the user's single `roads` row.

---

## What "start over" does

Typing `roadshare` anywhere on an authenticated page, or clicking "Start over" in the avatar menu, deletes the `roads` row and returns to `/welcome`. Confirmation dialog: "This clears your road. You'll start fresh." One button.

---

## Data model (unchanged from previous plan)

Single table:

```sql
CREATE TABLE public.roads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name text,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,  -- entire planner state
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

`UNIQUE(user_id)` enforces one road per user in v2 — simpler UI, no "which road?" picker. RLS scoped to `auth.uid()`. Wipe every other domain table (see previous plan for the delete list).

`state` shape:
```
{
  layout: "straight" | "t" | "cul-de-sac",
  homes: [{ id, label, address?, side, order, isYou }],
  project: { surfaceId, pct, costPerSqFt, years, roadWidth },
  split: { method, entrances }
}
```

---

## Routes after the rebuild

```
src/routes/
  index.tsx, about, pricing, product*, tools*, ...    (marketing, unchanged)
  auth.tsx, auth.callback.tsx                          (unchanged)
  _authenticated/
    route.tsx                                          (managed gate)
    index.tsx                                          NEW → redirects to /welcome or /my-road
    welcome.tsx                                        NEW → 2-screen onboarding
    my-road.tsx                                        NEW → the planner
```

Deleted routes and components as listed in the previous plan (Ask, Pulse, Portfolio, Reports, Clauses, Decisions, Documents, Map, Community, Dashboard, Vote, all wizard sub-steps, AppShell sidebar, etc.).

---

## Copy rules (kid-simple, enforced everywhere)

- "Home," never "parcel," "lot," "property," or "unit"
- "Your road," never "community," "network," "segment," or "geometry"
- "Chipping in," never "cost-share group," "assessment," or "allocation"
- "Your share," never "responsibility," "basis," or "apportionment"
- Every dollar figure gets a plain-English footnote: *"That's about $34/month over 15 years."*
- No progress percentages, no verification badges, no "0 of 4 confirmed" statuses anywhere

---

## Build order & QA

1. **Migration** — drop obsolete tables, create `roads`, keep `profiles`
2. **Delete** obsolete routes/components/libs
3. **Refactor** `Planner.tsx` into `<CedarHollowPlanner />` (demo) + `<RoadPlanner state onChange />` (app)
4. **Build** `/welcome` (2 screens, 3 tiles) and `/my-road`
5. **Playwright pass — non-tech persona, screenshots at every step:**
   - Path A: address → auto-find → confirm → my-road → results visible
   - Path B: paste 8 addresses → confirm → my-road → results visible
   - Path C: "6 homes by hand" → rename inline → my-road → results visible
   - Path D: change surface to gravel → number updates
   - Path E: swap to T-junction template → homes rearrange, math still works
   - Path F: type `roadshare` → confirm → back at welcome, road gone
6. **Answer the three questions on the record** with screenshots as evidence:
   - Was the flow easy enough? — YES
   - Was it confusing? — NO
   - Did you get the result you wanted? — YES (a dollar figure they can show a neighbor)

---

## My honest recommendation on the open questions

- **Ask about road layout up front?** No. Default to straight, put a "Change road shape" affordance on the main page for the rare user who cares.
- **Templates with roads?** Yes, but only three, hidden behind a link, presented as picture thumbnails not names.
- **Ask about roads at all during onboarding?** No. The onboarding's only job is "get their neighbors on the screen." The road picture is a rendering detail, not a data collection step.
- **Anything else worth simplifying?** Kill the "Name your road" requirement — auto-name it from the first address (e.g. "Maple Lane"). One less field.
