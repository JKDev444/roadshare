## Answers to your questions first

**Should CC&R upload come before "Who's on your road?"**
Yes — as an *optional* Step 2 (between naming and homes). Rationale: CC&Rs sometimes list homes, frontage, or include a plat, so if we ask first we can pre-fill the next step. But the vast majority of users won't have a PDF handy, so it must be one-tap skippable — never a wall.

**Should we skip "Who's on your road?" entirely if the doc has everything?**
No — keep it, always. Two reasons:
1. We can't reliably parse a scanned CC&R into structured homes/frontage today (that's an AI extraction feature for later). Even when we can, the user needs to **confirm** what we found.
2. Removing the step for some users and not others makes the onboarding unpredictable. Better: always show it, but pre-fill it from the doc when possible so it feels like a review, not data entry.

**Should users be able to set frontage per home in onboarding (or skip / use defaults)?**
Not in onboarding — it would slow the fastest path. Instead:
- Onboarding always uses a smart default frontage (road length ÷ homes, rounded to 5 ft) so the map + cost split work immediately.
- Frontage editing already lives in the Home Details drawer on `/my-road`. We surface it better with a one-tap "Adjust frontages" quick action so users who care can tune everything in one place after landing.

---

## The plan

### 1. New optional Step 2: "Got any documents?"
Insert between "Name your road" and "Who's on your road?". Three big friendly tiles:

- **Upload CC&Rs / plat / agreement** — file picker, saves to the existing `documents` bucket under the user's folder. Multiple files OK. Shows uploaded chips with remove buttons.
- **I'll add them later** — skips instantly.
- **I don't have any** — skips instantly.

Screen shows: "These help your neighbors trust the plan later. Totally optional — skip if you don't have them." Files uploaded here get moved into the road's document list on finish (same `documents/{userId}/` path the DocumentsPanel already reads).

Progress becomes "Step 2 of 3" → "Step 3 of 3". Back/forward preserved.

### 2. Smart-default frontage everywhere
In `welcome.tsx`'s `finish()`, after `autoArrangeHomes`, compute `defaultFrontage = round((segment length in ft) / homes.length / 5) * 5`, clamped to [15, 120], and set it on every home that doesn't already have one. Users land on a map where every home has a sensible pill label and the cost split works.

### 3. Post-onboarding: make frontage easy to tune (no forced step)
On `/my-road`:
- Add a subtle "Adjust frontages" button in the right rail near the results. Opens the existing Home Details drawer pre-focused on the frontage slider, with prev/next arrows so a user can walk all homes in <30 seconds.
- Keep the existing double-click-to-edit path.

### 4. Foreshadow the "AI reads your CC&R" feature (no build yet)
On the documents step, add a small badge: "Coming soon: we'll read your CC&Rs and suggest homes + frontage automatically." Sets expectation without over-promising.

---

## Technical details

- **New screen state**: `type Screen = "name" | "docs" | "homes"`. Wire Back on `homes` to go to `docs`, Back on `docs` to go to `name`.
- **Uploads**: reuse `supabase.storage.from("documents").upload("${userId}/${Date.now()}_${safeName}", file)` — same conventions as `DocumentsPanel.tsx`. Track uploaded file paths in local state; nothing else needed since the DocumentsPanel lists everything under `${userId}/`.
- **Default frontage**: implement `defaultFrontageFor(segment, homeCount)` in `src/lib/roadshare/layout.ts` and apply in `welcome.tsx#finish()`. Type: extend `Home` if `frontage` isn't already there (check existing type — if it exists, just fill it in).
- **Skip semantics**: "later" and "don't have any" both call `setScreen("homes")` with no state change; only Upload actually persists files.
- **"Adjust frontages" quick action** in `Planner.tsx` right rail: opens `HomeDetailsDrawer` with the first home; drawer already has slider — add small `←` / `→` chevrons to step through homes.
- **No schema changes** — `documents` bucket + `roads` table are unchanged.

---

## Out of scope (call out, don't build now)
- Auto-parsing CC&R PDFs for homes/frontage (needs OCR + LLM pipeline).
- Detecting a plat map image inside a PDF and importing geometry.
Both are strong future features; the "Coming soon" badge sets the stage.
