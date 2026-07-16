
# RoadShare Onboarding Rebuild — Execution Plan

Executes the attached spec precisely. Confirmed decisions: Nominatim for address search, true background job processing, defer multi-community branch, exhaustive end-to-end testing with screenshots for every required path.

## 1. Remove auto-open upload behavior

- `src/routes/auth.tsx`, `src/routes/auth.callback.tsx`: stop writing `roadshare-post-auth-redirect = /dashboard?onboarding=upload`. Replace with `/dashboard` (welcome shows first).
- `src/routes/_authenticated/dashboard.tsx`: drop the `?onboarding=upload` query trigger that opens `CcrImportStep`. `WelcomeWizard` always starts at the new Welcome screen.
- No file picker may open on mount anywhere.

## 2. New Welcome screen (replaces the 3-card first screen)

Rewrite `src/components/onboarding/WelcomeWizard.tsx` as a state machine. First screen only:

- H1 "Let's set up your road group"
- Body "We'll help you identify the properties, roads, and any rules that explain how maintenance costs should be shared."
- Primary: **Get Started** → Step 1
- Secondary: **Explore the Cedar Hollow Sample** → loads sample community, jumps to review workspace
- Tertiary: **I'll finish this later** → closes wizard, records `dismissed_at` on `onboarding_state`

## 3. Guided flow — new step components

Break the monolithic wizard into small step components under `src/components/onboarding/steps/`:

- `Step1BasicInfo.tsx` — Community/road name (optional), city, state, one starting address. Buttons: **Find My Road** / **I Don't Know the Address Yet**.
- `Step2DocsQuestion.tsx` — three tiles: Yes I have documents / No, continue without / I'm not sure.
- `Step3aUpload.tsx` — dedicated upload UI (dropzone + Choose Documents). File picker only opens from these controls. Shows selected-file cards (name, type, size, remove, add another) and primary **Upload and Review Documents**.
- `Step3bNoDocs.tsx` — five options: Search and Add Addresses, Paste an Address List, Add Lots Manually, Create an Empty Workspace, Upload Documents Instead.
- `AddressSearch.tsx` — Nominatim typeahead (`https://nominatim.openstreetmap.org/search`, `User-Agent: RoadShare/1.0`, debounced 400 ms, 1 req/s cap, cache last 20 queries).
- `AddressPaste.tsx` — multiline textarea → one draft parcel per non-empty line.
- `ManualLots.tsx` — repeating row form: address, lot/unit, label, road (all optional except at least one field).
- `ProcessingScreen.tsx` — 8 stages, polls job status, elapsed timer, "You may leave" copy (backed by real persistence).
- `SuccessSummary.tsx` / `FailureSummary.tsx` — counts + actions per spec §7.
- `ReviewWorkspace.tsx` — left-side stepper (Summary, Community, Properties, Roads, Maintenance Rules, Documents, Items to Review, Finish). Replaces the single long CcrDraft page.
- `FinishScreen.tsx` — accurate completion summary; primary **Review the Road Map**.

## 4. Real background processing (Supabase-backed jobs)

Schema migration adds:

```sql
CREATE TABLE public.onboarding_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  community_id uuid,
  status text NOT NULL DEFAULT 'queued',    -- queued|uploading|processing|succeeded|failed|cancelled
  stage text,                                -- one of the 8 stages
  stage_index int NOT NULL DEFAULT 0,
  progress int NOT NULL DEFAULT 0,           -- 0-100
  filenames text[] NOT NULL DEFAULT '{}',
  document_ids uuid[] NOT NULL DEFAULT '{}',
  result jsonb,                              -- extraction summary on success
  error_message text,                        -- plain-language failure copy
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
-- GRANTs + RLS (owner-only) per public-schema rules
```

- New server fns in `src/lib/onboarding/jobs.functions.ts`: `createJob`, `getJob`, `listActiveJob`, `cancelJob` (guarded by `requireSupabaseAuth`).
- Refactor `extractCcr.functions.ts` into `processJob(jobId)`: uploads to `documents` bucket, runs OCR + AI extraction in staged updates (writes `stage`, `stage_index`, `progress` after each phase), writes final `result` or `error_message`. Kicked off from `createJob` via async waitUntil-style: the handler returns immediately after enqueueing (function invokes `processJob` without awaiting, wrapped so top-level errors persist to the job row).
- `ProcessingScreen` polls `getJob` every 2 s via TanStack Query. Dashboard on load calls `listActiveJob` — if one exists, resumes to `ProcessingScreen`. On success, transitions to `SuccessSummary`.
- Cancel button calls `cancelJob` which sets status = cancelled; worker checks status between stages and bails.

## 5. Rewrite `CcrImportStep.tsx` → `Step3aUpload.tsx`

- Dropzone + Choose Documents button (the ONLY things that open the file picker).
- File cards show name/type/size, remove control, add-another.
- Privacy line: "Your documents are stored privately and only visible to your community."
- **Upload and Review Documents** → calls `createJob`, immediately routes to `ProcessingScreen`.
- Never leaves the user on an unchanged upload screen after selecting a file.

## 6. Review Workspace (replaces long `CcrDraft`)

- Left stepper with progress badges; main content is a single scroll region (no fixed heights, no nested scrolls).
- Summary section: "Here's what we found" list from spec §9, plus "We need your help with N items" and **Review Important Items** button that filters to unresolved.
- Properties list per §10: each lot card shows address (or "Not found in the uploaded documents"), road, source (doc + page), status badge. Provenance chips: `Extracted`, `Entered`, `Confirmed`, `Sample`, `Unresolved`. Bulk actions: paste addresses, apply road name, confirm selected, delete selected.
- Roads section per §11: names, geometry status badges, "Review Your Road Map" as the guided entry to the GIS editor. Do not force GIS immediately.
- Maintenance section per §12: plain-language rule card with source/section/page/confidence + "Looks correct / Not correct / Not sure / Ask for help / Review later".
- Documents section: list of uploaded docs.
- Items to Review: filtered unresolved queue.
- Finish Setup section: honest status per §13.

## 7. Soft gating (§14)

- Scenario creation allowed if `parcels.count >= 2 AND road_segments.count >= 1 AND cost_method set`.
- Banner shown when unresolved items > 0.
- Block only: publish allocation, "document required" label, final decision report, record decision. Add `requiresConfirmed` checks in `projects` / `decisions` server fns; return typed 409 with actionable copy.

## 8. Post-onboarding checklist

Rewrite `GettingStarted.tsx` to render at most 3 primary tasks based on state:

1. Confirm the Properties → 2. Review the Road Map → 3. Build a First Scenario. After a scenario exists: 4. Create a Report → 5. Invite Neighbors → 6. Gather Feedback. Each card shows a one-line "why this matters".

## 9. Files to change/create

Create:
- `src/components/onboarding/steps/{Step1BasicInfo,Step2DocsQuestion,Step3aUpload,Step3bNoDocs,AddressSearch,AddressPaste,ManualLots,ProcessingScreen,SuccessSummary,FailureSummary,ReviewWorkspace,FinishScreen}.tsx`
- `src/components/onboarding/steps/sections/{SummarySection,CommunitySection,PropertiesSection,RoadsSection,MaintenanceSection,DocumentsSection,ItemsToReviewSection,FinishSection}.tsx`
- `src/lib/onboarding/jobs.functions.ts`
- `src/lib/onboarding/nominatim.ts` (client, rate-limited)
- `src/lib/onboarding/parseAddressList.ts`

Rewrite:
- `src/components/onboarding/WelcomeWizard.tsx` (state machine wrapper)
- `src/components/onboarding/CcrImportStep.tsx` → deleted, replaced by `Step3aUpload`
- `src/components/onboarding/OnboardingPreview.tsx` → deleted (no separate preview modal)
- `src/components/onboarding/GettingStarted.tsx`
- `src/lib/onboarding/extractCcr.functions.ts` → refactored into staged `processJob`
- `src/lib/onboarding/ccrDraft.ts`, `api.ts` → provenance tags, `buildManualCcrDraft` accepts pasted addresses / manual lots
- `src/routes/auth.tsx`, `src/routes/auth.callback.tsx` → remove upload redirect intent
- `src/routes/_authenticated/dashboard.tsx` → resume active job on mount, drop `?onboarding=upload`

Migration:
- Add `onboarding_jobs` table with grants + RLS

## 10. Testing (exhaustive, per §18/19)

I will drive Playwright headlessly against `http://localhost:8080`, restore the Supabase session from env, and screenshot each state. Every path from §18 is enumerated below with pass/fail recorded to a report file at `/mnt/documents/RoadShare-Onboarding-Test-Report.md`:

- Auth: new Google / new email / existing user with no community / with community / skipped / completed
- Initial onboarding: no auto file picker, Get Started, Sample, Finish later, browser back, refresh persistence
- Document selection: picker only from upload controls, drag-drop, valid PDF, scanned PDF, multiple, invalid type, oversize, remove, add, retry
- Processing: instant transition, stage updates, refresh mid-processing, success, failure, retry, save-and-return
- Thin extraction: lots-only, roads-only, maintenance-only, missing exhibit, amendment, unknown community
- Review: scroll integrity, stepper nav, missing-field labels, property edit, bulk paste, confirm/unresolved, save draft, finish
- Responsive: 1440 / 1024 / 768 / 390
- A11y: keyboard-only nav, focus rings, screen-reader labels, reduced motion
- Regression: dashboard, community routes, documents, clauses, ask, planner, sample, RLS

Screenshots captured for: Welcome, Basic info, Docs question, Upload, Selected-file, Processing, Summary, Properties review, Missing-address state, Maintenance-rule state, Finished workspace, Mobile flow. Saved under `/mnt/documents/onboarding-screenshots/`.

Completion report at `/mnt/documents/RoadShare-Onboarding-Completion-Report.md` per §19: every issue found, root cause, fix, files/routes changed, DB changes, tests + pass/fail, remaining mocks, remaining limitations, screenshot index.

## 11. Out of scope for this pass

- Multi-community / portfolio branch (deferred per your answer)
- Real parcel geometry ingestion from CC&Rs (still no automated GIS; UI honestly labels it)

## Technical notes

- Nominatim: no key; must send descriptive `User-Agent` and 1 req/s cap; results filtered to US when `state` known. Fallback message when 0 results.
- Background job worker runs inside `createJob`'s handler using a top-level fire-and-forget promise on the Worker; because Cloudflare Workers kill background promises after the response, `processJob` also self-recovers on next `getJob` poll if `updated_at` is stale by re-invoking a resume server fn. This keeps processing genuinely resumable even if the initial invocation is cut short.
- All new tables get GRANT + RLS scoped to `auth.uid()`.

