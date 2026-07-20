
# Finish the v3 plan — the 7 missed items

This is the delta between `.lovable/plan.md` (v3) and what's actually in the code today. No new direction — just finishing what was already agreed.

## What's still outstanding

### 1. Three-button "Create your community" screen (plan §1)
**Today:** `BasicInfoStep` leads with a big address field; docs and manual are in a tiny "Or another way" strip.
**Do:** Replace Step 1 with a chooser that has three equal, playful cards:
- 📄 Upload your HOA papers → existing `DocsQuestionStep` / `UploadStep` flow
- 📍 Type your address → focused address-only screen (autocomplete + community name only)
- ✍️ Add homes manually → existing `NoDocsStep`

New file `StartChoiceStep.tsx`. `BasicInfoStep` becomes `AddressLookupStep` (address field + community name + Continue, nothing else). `WelcomeWizard` machine gets a `start` step before `basic`. Each sub-screen has a "← Change how I start" link.

### 2. CC&R upload — real progress, not fake timers (plan §1)
**Today:** The 8-step checklist advances on optimistic client timers in `ProcessingStep.tsx`; the pipeline can stall silently.
**Do:**
- Add `current_step`, `error`, `retryable` fields to the job row and expose them from `jobs.functions.ts`.
- Drive the checklist off real job events (poll every 1.5s or subscribe).
- Per-step 60s timeout that surfaces a red "This step took too long — retry" state with a per-file retry button.
- Keep the visual — user liked it.

### 3. Guided step-cards inside the community (plan §3)
**Today:** `MyRoadTab` is a scrollable overview with a `PlatCanvas` and detail cards. Not the step-card walkthrough the plan calls for.
**Do:** Replace `/community/$id` body with a single-page planner styled like `/tools/cedar-hollow`:
```
[Plat picture — always visible]
Step 1 · Which home is yours? →
Step 2 · Which road needs work? →
Step 3 · What's the project? →
Step 4 · How should we split the cost? →
Step 5 · Your fair share ✓
```
One card at a time; plat updates live; cost split via existing `costShare.ts` (equal / by frontage / by distance).

### 4. Results & sharing (plan §4)
**Today:** No shareable results view.
**Do:** Build the "Your fair share" card and share screen:
- Big card per home: address, dollar amount, share %.
- "Send to neighbors" — copy link (email invite is out of scope per plan).
- Neighbor decisions collapse into a single Vote screen (👍 / 👎 + comment) reusing existing `decisions` schema.

### 5. Cedar Hollow demo shares components with the app (plan §5)
**Today:** `Planner.tsx` renders its own 4-step UI; it doesn't share `PlatCanvas` or the step-card components with `/community/$id`.
**Do:** Extract the step-card + plat components into `src/components/planner/*` and use the same components from both `/tools/cedar-hollow` and the in-app community view. Cedar Hollow becomes a preview of the real thing.

### 6. Terminology sweep (plan §7)
**Today:** "plat", "frontage", "segment", "provenance", "confidence", "needs review", "parcel" still appear in `PlatCanvas`, `MyRoadTab`, `GisEditor`, `badges.tsx`, and elsewhere.
**Do:** Global rename in user-facing copy only (code identifiers stay):
- plat → road picture
- frontage → feet of road in front of your house
- segment → stretch of road
- provenance / confidence / needs review → drop entirely
- parcel → home

Grep pass on `src/components/**` and `src/routes/**`; leave `src/lib/**` variable names alone.

### 7. Phase E — end-to-end regression as a low-tech user
Run after 1–6 are in place. Use the "roadshare" easter egg to reset the account each time.
- **Path A — CC&R upload:** use a public sample HOA CC&R PDF (I'll source one). Confirm the 8-step checklist reflects real progress, no stall, homes populate, road picture renders.
- **Path B — Address (rural):** `787 Five Peaks Dr, Kalama, WA 98625`. Confirm autocomplete returns the address, homes populate, road picture renders.
- **Path C — Manual entry:** paste 5 addresses. Confirm homes populate, road picture renders.
- **Scale test:** load a 500-home fixture into `PlatCanvas` (headless script, not through onboarding) and confirm pan/zoom stays responsive.
- After each path, answer the four audit questions in the report:
  1. Was the flow easy enough for a non-tech user?
  2. Did anything on the screens confuse me or seem out of place?
  3. Was it confusing?
  4. Did I get the result I wanted?

Nothing is marked done until the regression evidence (screenshots + a short pass/fail line per item) is in the reply.

## Phasing

- **Phase 1 — Onboarding (items 1 + 2).** Ships the three-button screen and the honest CC&R progress. Regression paths A, B, C stop at "community created".
- **Phase 2 — In-app experience (items 3 + 5 + 6).** Guided step-cards, shared with Cedar Hollow, terminology cleaned. Regression continues through the planner to "Your fair share".
- **Phase 3 — Results & sharing (item 4).** Vote screen + share link. Full end-to-end run.
- **Phase 4 — Scale + final audit (item 7).** 500-home fixture and the four-question report.

## Out of scope (unchanged from v3)

- Mobile tuning
- Real invite email sending
- Marketing pages other than `/tools/cedar-hollow`
- DB migrations beyond the three new job fields in item 2
