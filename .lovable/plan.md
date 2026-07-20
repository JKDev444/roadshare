
## Phase 1 — Documentation refresh (this is the primary ask)

### 1a. `docs/user-workflow.md` — rewrite to match current app
- Sign in → Dashboard "Home Hub" ("Open my road" / "Create community")
- **Onboarding wizard, Step 1 = three playful choice cards** (`StartChoiceStep`):
  - Upload HOA papers → `ProcessingStep` real DB polling (8-stage, no fake timers)
  - Type your address → Mapbox Search Box + US Census + Nominatim fallback (rural works, e.g. Kalama WA)
  - Add homes by hand → paste list or one-by-one
- Step 2 review → Step 3 community created (Confetti + WelcomeBanner)
- Inside community: single-page `MyRoadTab` with 5 guided step cards + SVG `PlatCanvas`
- "Your fair share" card + "Ask my neighbors to vote" → share URL `?decision=…` opens `VoteCard` (👍/👎, comment, reuses `decisions` + `decision_votes`)
- Sidebar: Home / My Road / Settings only
- Easter egg: type `roadshare` → wipes projects + wizard flags, restarts onboarding
- Terminology conventions: "homes", "HOA rules", "Needs a human check"
- Cedar Hollow demo at `/tools/cedar-hollow` as the no-signup try-it
- "First-time user, screen by screen" walkthrough section

### 1b. `docs/developer-guide.md` — rewrite to match current architecture
- Stack: TanStack Start v1, React 19, Vite 7, Tailwind v4, shadcn, Lovable Cloud (Supabase) with RLS + `has_role`
- Routing: file-based `src/routes/`, `_authenticated/` gate, `__root.tsx` shell; no `src/pages/`
- Server functions: `createServerFn` in `*.functions.ts`, `requireSupabaseAuth` + `attachSupabaseAuth` in `src/start.ts`; public webhooks under `src/routes/api/public/*`
- Maps: Mapbox removed in-app; SVG `PlatCanvas` renders plats. Mapbox Search Box used only for address autocomplete, with Census + Nominatim fallbacks
- Parcels: `parcels.functions.ts` → DCAD in Dallas, OSM footprints elsewhere; batch insert in `lib/community/api.ts`
- Cost sharing: `lib/community/costShare.ts` (distance / frontage / equal)
- Decisions & voting: `lib/decisions/api.ts`, `VoteCard`, `decision_votes`, share URL params
- Onboarding jobs: `jobs.functions.ts` real DB `stage_index`/`progress`/`status`, polled 2s
- AI: Lovable AI Gateway (`ai-gateway.server.ts`)
- Env: `MAPBOX_ACCESS_TOKEN`, `LOVABLE_API_KEY`, Supabase publishable key; see `VERCEL_ENV.md`
- Testing: Playwright under `/tmp/browser/`, `roadshare` easter egg for resets
- Key-files map so a new dev can navigate

### 1c. `docs/CHANGELOG.md` (new)
Short summary of the "nuke plan" pass: Mapbox removed in-app, three-button onboarding, PlatCanvas, real job polling, neighbor voting, terminology sweep, easter-egg reset, marketing rewrite.

### 1d. `.lovable/plan.md`
Mark items 1–6 done; carry Phase E regression as the open evidence-backed sweep.

## Phase 2 — Evidence-backed regression pass (Phase E from `.lovable/plan.md`)

Playwright, headless, `roadshare` reset between paths. Screenshots kept under `/tmp/browser/`, results summarized into `docs/qa/phase-e-report.md`.

For each of the three onboarding paths capture:
1. "Community created" screen
2. Step 5 "Your fair share"
3. Share URL opened in a fresh context (Path A only)
4. Four audit answers (easy? confusing? out of place? got the result I wanted?)

Paths:
- **A — CC&R upload**: cache one small public HOA CC&R PDF under `/tmp/browser/samples/`; confirm the 8-step checklist advances on real DB state and the resulting community is populated.
- **B — Address (rural)**: `787 Five Peaks Dr, Kalama, WA 98625` end-to-end.
- **C — Manual entry**: paste 5 addresses.
- **Scale**: separate script seeds a 500-home fixture straight into the DB and loads `/community/$id` to confirm `PlatCanvas` pan/zoom stays responsive.

Do not update the docs' "verified working" claims until this phase's report exists.

## Phase 3 — Launch blockers found in Phase 2

Fix only what Phase 2 proves is broken. Expected candidates based on current state:
- CC&R upload accuracy on a real PDF (biggest single risk — button #1's promise)
- Neighbor vote link for a signed-out neighbor: today `/community/$id` is under `_authenticated`, so a share recipient hits `/auth` first. Decide: allow anonymous vote (public route + rate limit) or add a lightweight magic-link invite. Pick one, implement.
- Empty-state deadends on `/dashboard`, `/documents`, `/decisions` — every "you need a community" message must have a working CTA to create one.
- Auth polish: Google sign-in configured, confirmation copy, name capitalization already fixed but verify across all greetings.

## Phase 4 — Responsible-adult launch checklist

- Pricing page tied to a real plan (free beta or paid) — currently `/pricing` exists but not wired to checkout
- ToS + Privacy tied to a real legal entity
- User-visible data-deletion path (settings → delete my account/community)
- `og:image` per leaf route where a meaningful image exists (methodology, security, tools/cedar-hollow); leave root without one so hosting injects the screenshot
- Security scan (`security--run_security_scan`) and address anything critical before publish

## Phase 5 — Publish

- `publish_settings--update_visibility` if the user wants public
- `preview_ui--publish`
- Post-publish: verify live URL loads, `roadshare` easter egg works against prod, share-link round trip against prod

## Launch-readiness verdict (my honest take, unchanged)

Not quite MVP-launchable yet. Genuinely ready: onboarding across 3 paths, single-page planner, fair-share + neighbor vote round trip, easter-egg reset for QA/support. Not ready: no evidence-backed regression report yet, CC&R upload accuracy unverified against a real PDF, vote link assumes recipient already has an account, some empty states still dead-end, no pricing/ToS/deletion path wired.

If "launch" means **private beta with 3–5 friendly HOAs I hand-hold**, ship after Phase 2. If "launch" means **public sign-ups**, Phases 2–4 are the gate.

## Order of execution
Phase 1 (docs) → Phase 2 (regression pass) → Phase 3 (fixes proven by Phase 2) → Phase 4 (legal/billing/polish) → Phase 5 (publish). Phases 1 and 2 can run in parallel if desired; Phase 3 must wait for Phase 2's report.
