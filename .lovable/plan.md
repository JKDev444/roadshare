# Guided Onboarding for RoadShare

## The problem (workflow audit)

A brand-new user signs in and lands on `/dashboard` — a wall of empty stat cards ("0 documents", "0 decisions") and an 11-item sidebar (Dashboard, Portfolio, Community Record, GIS & Roads, Documents, Clause Graph, Ask My Community, Community Pulse, Decision Rooms, Reports, Settings). Nothing explains where to start, what these mean, or that almost every screen stays empty until a **community** exists with **parcels** and **roads**. The core loop — *create community → add parcels/roads → build a cost scenario → gather input → decide → report* — is invisible. There's no welcome, no first step, no sense of progress.

We'll fix this with three coordinated layers, all driven by real per-user progress.

## What we'll build

### 1. First-run welcome wizard (modal, on first dashboard visit)
A 3-step overlay that appears once for a new user:
- **Step 1 — Welcome:** what RoadShare does, the 6-stage workflow in plain language.
- **Step 2 — Create your first community:** inline name/region/description form (reuses existing `createCommunity`). This is the primary "get to value" action. A secondary "Load the Cedar Hollow sample instead" link stays available for people who'd rather explore.
- **Step 3 — What's next:** short map of the sidebar grouped by stage, and a "Go to my community" button.

Dismissible/skippable at any point; skipping still leaves the checklist visible so users can return.

### 2. Persistent "Getting Started" checklist (dashboard)
A progress card at the top of `/dashboard` showing a live checklist with a completion bar:
1. Create a community record ✓ when they have ≥1 community
2. Add parcels (households) ✓ when any community has parcels
3. Map the roads ✓ when any community has road segments
4. Build a cost scenario ✓ when a project/scenario exists
5. Gather community input ✓ when a survey or decision exists
6. Generate a report ✓ when a report/decision record exists

Each item links straight to the right screen and shows a one-line "why this matters". The card auto-collapses to a slim "Getting started (5/6)" bar once dismissed or fully complete, and can be reopened.

### 3. Coach-mark hints on key screens
Lightweight, dismissible inline callouts (not blocking popovers) on the first visit to Community Record, GIS & Roads, and the Cedar Hollow planner — each explaining the one action to take on that screen. Dismissed state is remembered per user.

## Data model (per-user persistence)

New table `public.onboarding_state`, one row per user:
- `user_id` (PK, references auth.users)
- `wizard_completed` boolean
- `wizard_skipped` boolean
- `checklist_dismissed` boolean
- `dismissed_hints` text[] (which coach-marks were closed)
- standard `created_at` / `updated_at`

RLS: users read/write only their own row (`auth.uid() = user_id`). Grants to `authenticated` + `service_role`. An `updated_at` trigger. Checklist *completion* is derived live from existing tables (communities, parcels, road_segments, projects, decisions/surveys, reports) — we only persist wizard/dismissal flags, so progress can never drift out of sync with real data.

## Implementation outline

**Backend**
- Migration: create `onboarding_state` with grants, RLS, trigger.

**Data layer**
- `src/lib/onboarding/api.ts` — get/create the user's onboarding row, update flags; plus a `getChecklistProgress()` that counts existing communities/parcels/segments/projects/decisions/reports in a few lightweight queries.
- `src/lib/onboarding/useOnboarding.ts` — React Query hook exposing state + progress + mutations.

**UI**
- `src/components/onboarding/WelcomeWizard.tsx` — the 3-step modal.
- `src/components/onboarding/GettingStarted.tsx` — the dashboard checklist card.
- `src/components/onboarding/CoachMark.tsx` — reusable dismissible inline hint.
- Wire `WelcomeWizard` + `GettingStarted` into `src/routes/_authenticated/dashboard.tsx`.
- Add `CoachMark` to `community.index.tsx`, `map.tsx`, and `tools.cedar-hollow.tsx`.
- Optional: a persistent "Getting started" entry at the top of the sidebar in `AppShell.tsx` that links back to the dashboard checklist.

**Reuse**
- Community creation reuses existing `createCommunity` / seed logic.
- Styling uses existing design tokens and shadcn Dialog/Card/Button/Progress components — no new visual language.

## Verification
Run an automated Playwright pass: sign up fresh → wizard appears → create a community in the wizard → land on dashboard with checklist showing item 1 complete → add a parcel and confirm item 2 checks off → dismiss a coach-mark and reload to confirm it stays dismissed (per-user persistence) → confirm wizard does not reappear on next login.

## Out of scope
No Stripe/payments (per your earlier note). No changes to the core allocation engine or existing feature behavior — this is purely additive guidance.