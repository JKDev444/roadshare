# RoadShare — Developer & Architecture Guide

_Last refreshed: July 2026. Reflects the current shipped state after the "nuke
plan" pass (Mapbox-out-of-app, three-button onboarding, SVG PlatCanvas, real
job polling, neighbor voting, terminology sweep)._

A tour for a new engineer picking up the codebase.

---

## 1. Stack

| Layer | Choice |
| --- | --- |
| Framework | TanStack Start v1 (SSR + server functions) on React 19 |
| Bundler | Vite 7 |
| Routing | TanStack Router, file-based under `src/routes/` |
| Data | TanStack Query wired via router context (`ensureQueryData` in loaders, `useSuspenseQuery` in components) |
| Styling | Tailwind v4 (native `@import` + `@theme` in `src/styles.css`) |
| UI kit | shadcn/ui, Radix, Lucide, Framer Motion |
| In-app plat rendering | **SVG `PlatCanvas`** — no Mapbox in-app |
| Address search | **Mapbox Search Box** with US Census + Nominatim fallbacks |
| Cedar Hollow demo (`/tools/cedar-hollow`) | Leaflet — legacy, self-contained |
| Validation | Zod v4 |
| Backend | Supabase via **Lovable Cloud** — Postgres, Auth, Storage, RLS |
| AI | Lovable AI Gateway (`src/lib/ai-gateway.server.ts`) |
| Host | Vercel (Nitro) or Cloudflare Workers (`nodejs_compat`) |

---

## 2. Routing

File-based under `src/routes/`. **Never** create `src/pages/` or Next/Remix
layout files — the auto-generated `src/routeTree.gen.ts` will conflict.

Root shell: `src/routes/__root.tsx`. Authenticated subtree gate:
`src/routes/_authenticated/route.tsx`. Public webhooks/cron live under
`src/routes/api/public/*` (that prefix bypasses auth on published sites — always
verify the caller inside the handler).

Key routes:

```
/                                marketing home (StoryPath + SecretSauce)
/tools/cedar-hollow              no-signup demo
/auth, /auth/callback            sign-in
/_authenticated/dashboard        Home Hub after sign-in
/_authenticated/community/$id    single-page MyRoadTab + PlatCanvas + VoteCard
/_authenticated/{documents,decisions,settings,...}
```

---

## 3. Server functions

App-internal server code = `createServerFn` from `@tanstack/react-start`, in
`*.functions.ts` files that live in client-safe paths (`src/lib/...`). Helpers
that must never ship to the client end in `.server.ts`.

Protected functions use `requireSupabaseAuth` middleware, and the client-side
companion `attachSupabaseAuth` is registered in `src/start.ts`:

```ts
// src/start.ts
export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware],
}));
```

Never call a `requireSupabaseAuth` server function from a public route's
`loader` — SSR/prerender has no session and it 401s the build. Move the call
into a component (`useServerFn` + `useQuery`) or into an `_authenticated/`
route's loader.

---

## 4. Supabase clients

| Import | Use |
| --- | --- |
| `@/integrations/supabase/client` | Browser only — auth flows, realtime |
| `context.supabase` from `requireSupabaseAuth` | Authed user, RLS applies as them |
| `@/integrations/supabase/client.server` → `supabaseAdmin` | Verified webhooks / admin only — bypasses RLS; import inside handler bodies |

Every new `public.*` table needs: `CREATE TABLE`, then `GRANT` to the right
roles, then `ALTER … ENABLE ROW LEVEL SECURITY`, then policies — in that order,
in the same migration. Roles go in a **separate** `user_roles` table with a
`SECURITY DEFINER` `has_role()` function.

---

## 5. Maps — read this before touching parcels

- **In-app: no Mapbox.** Plats are rendered by `src/components/community/PlatCanvas.tsx`
  as an SVG driven by parcel geometry we already have in the DB. Do not
  re-introduce Mapbox inside `_authenticated/*` — it caused the "horrible map"
  and cost-runaway feedback that started the nuke plan.
- **Address autocomplete:** Mapbox Search Box (server token
  `MAPBOX_ACCESS_TOKEN`) with **US Census Geocoder** and **Nominatim**
  fallbacks so rural US addresses resolve.
- **Parcel discovery** (`src/lib/onboarding/parcels.functions.ts`):
  - Dallas County → DCAD parcel records
  - Everywhere else → OSM building footprints via Overpass
  - Results batch-inserted through `src/lib/community/api.ts`.
- **Cedar Hollow (`/tools/cedar-hollow`)** still uses Leaflet with hardcoded
  fake data. It is intentionally isolated from the in-app planner.

---

## 6. Cost sharing engine

`src/lib/community/costShare.ts` implements three allocation methods:

- **Equal split** — total ÷ homes
- **Distance** — weighted by distance from the road entry
- **Frontage** — weighted by parcel road frontage

Rendered inside `MyRoadTab` Step 4 → Step 5 ("Your fair share").

---

## 7. Decisions & neighbor voting

- `src/lib/decisions/api.ts` — CRUD + `parseOptions` + `tally`.
- `decisions` and `decision_votes` tables (already exist, do not duplicate).
- Share URL shape (generated at Step 5 of `MyRoadTab`):

  ```
  /community/<id>?project=<slug>&total=<cents>&method=<equal|distance|frontage>&decision=<uuid>
  ```

- Recipient sees `VoteCard` (`src/components/community/VoteCard.tsx`) above the
  planner. Picks a household, casts 👍/👎, optional comment. Reuses the
  existing schema.
- **Open item:** `/community/$id` is under `_authenticated`, so today the
  recipient must sign in first. Phase 3 will decide between "anonymous vote on
  a public route + rate limit" or "magic-link invite".

---

## 8. Onboarding jobs

`src/lib/onboarding/jobs.functions.ts` owns background work (CC&R parse,
parcel discovery). It writes real progress to the DB (`stage_index`,
`progress`, `status`). `ProcessingStep` polls `getJob` every 2s and renders the
8-stage checklist off that state — never optimistic timers.

---

## 9. AI

Lovable AI Gateway via `src/lib/ai-gateway.server.ts`. Used by clause
extraction (`src/lib/clauses/extract.functions.ts`) and Q&A
(`src/lib/qa/ask.functions.ts`). Do not add third-party AI keys unless the
user has explicitly requested a specific provider.

---

## 10. Environment variables

| Var | Where | Purpose |
| --- | --- | --- |
| `MAPBOX_ACCESS_TOKEN` | server | Search Box + geocoding |
| `LOVABLE_API_KEY` | server | AI Gateway |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID` | build-time | Supabase client (auto-generated — do not edit) |

Vercel-specific setup lives in `VERCEL_ENV.md`. `.env` for Supabase is
auto-generated — never hand-edit it.

---

## 11. Server runtime notes

Worker runtime with `nodejs_compat`. Do **not** use `child_process`, `sharp`,
`canvas`, `puppeteer`, or `fs.watch` in server code — they either stub or crash
at runtime. See `server-runtime` knowledge card if you hit
`[unenv] X is not implemented yet!`.

---

## 12. Testing & QA

- Playwright scripts under `/tmp/browser/<slug>/` — headless Chromium is
  preinstalled. Set `viewport={"width": 1280, "height": 1800}` and never use
  `full_page=True`.
- Use the **`roadshare` easter egg** to reset a signed-in test account between
  runs — cheaper than re-provisioning.
- Managed Supabase session env vars are injected into the sandbox — see the
  browser-use knowledge card for how to restore both the localStorage token
  and the `@supabase/ssr` cookies before navigation.

---

## 13. Key files map

```
src/
  routes/
    __root.tsx                     app shell — head/meta, Outlet, providers
    index.tsx                      marketing home
    tools.cedar-hollow.tsx         no-signup demo (Leaflet, isolated)
    _authenticated/
      route.tsx                    auth gate
      dashboard.tsx                Home Hub
      community.$id.tsx            single-page planner + VoteCard
  components/
    onboarding/
      WelcomeWizard.tsx            wizard shell
      steps/StartChoiceStep.tsx    three-button Step 1
      steps/{Upload,Processing,NoDocs,BasicInfo,Review,SuccessSummary,Failure}Step.tsx
    community/
      MyRoadTab.tsx                5-step guided planner
      PlatCanvas.tsx               SVG plat renderer
      VoteCard.tsx                 neighbor vote UI
    app/
      AppShell.tsx                 sidebar (Home / My Road / Settings)
      useOnboardingResetEasterEgg.tsx   'roadshare' easter egg
  lib/
    community/{api.ts,costShare.ts}
    decisions/api.ts
    onboarding/{jobs,parcels,geocode,dcad,osm}.functions.ts
    onboarding/geocode.server.ts   Census + Nominatim fallbacks
    ai-gateway.server.ts           Lovable AI Gateway
  integrations/supabase/           auto-generated — do not hand-edit
  start.ts                         TanStack Start config (middleware wiring)
```

---

## 14. Where to look next

- `.lovable/plan.md` — current phased plan (docs → regression → blockers →
  legal/billing → publish).
- `docs/CHANGELOG.md` — the "nuke plan" delta from the previous architecture.
- `docs/user-workflow.md` — the user-facing walkthrough this doc's structure
  intentionally mirrors.