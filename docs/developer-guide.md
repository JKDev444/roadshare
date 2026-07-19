# RoadShare — Developer & Architecture Guide

A tour for a new engineer picking up the codebase.

---

## 1. Stack at a glance

| Layer | Choice |
| --- | --- |
| Framework | TanStack Start v1 (SSR + server functions) on React 19 |
| Bundler | Vite 7 |
| Routing | TanStack Router, file-based, under `src/routes/` |
| Data fetching | TanStack Query, integrated via router context |
| Styling | Tailwind v4 (native `@import` + `@theme` in `src/styles.css`) |
| UI kit | shadcn/ui, Radix primitives, Lucide icons, Framer Motion |
| Map | Mapbox GL JS + `mapbox-gl-draw` (freehand mode) |
| Legacy map (Cedar Hollow planner) | Leaflet + Leaflet.draw |
| Validation | Zod v4 |
| Backend | Supabase via Lovable Cloud — Postgres, Auth, Storage, RLS |
| AI | Lovable AI Gateway (primary), OpenAI direct (Vercel fallback) |
| Package manager | Bun |

---

## 2. Runtime targets

Two hosts are supported:

### Lovable Publish (default)

Cloudflare Workers via nitro. All secrets — `LOVABLE_API_KEY`, `MAPBOX_API_KEY`, Supabase URL/keys, Mapbox public token — are injected by the platform. Zero manual env config.

### Vercel

`vite.config.ts` switches to the `vercel` nitro preset when `process.env.VERCEL` is set. `vercel.json` at the root pins `buildCommand`/`installCommand`. See `VERCEL_ENV.md` for the exact 5 env vars a fresh Vercel deploy needs. Because `LOVABLE_API_KEY` cannot leave Lovable, the AI and geocoding layers fall back to direct provider keys (`OPENAI_API_KEY`, `MAPBOX_ACCESS_TOKEN`).

---

## 3. Routing map

`src/routes/` is the source of truth; `src/routeTree.gen.ts` is auto-generated — **never edit it by hand**.

| Path pattern | Purpose |
| --- | --- |
| `__root.tsx` | HTML shell, global providers, head metadata |
| `_authenticated/*` | Gated subtree — auth middleware redirects to `/auth` if signed out |
| `_authenticated/dashboard.tsx`, `.../community.$id.tsx`, etc. | The app |
| `index.tsx`, `about.tsx`, `pricing.tsx`, `solutions.$audience.tsx` | Marketing site |
| `tools/cedar-hollow.tsx` | Public sandbox |
| `api/public/*` (future) | Webhooks / cron endpoints, external callers only |

Do **not** introduce `src/pages/` — that's a different framework's convention.

---

## 4. Server functions vs. server routes

App-internal server logic uses `createServerFn` from `@tanstack/react-start`. Files ending in `.functions.ts` are safe to import from client components.

| Server function | Auth | Notes |
| --- | --- | --- |
| `geocode.functions.ts` — `suggestAddresses`, `retrieveAddress` | **Public** | Address lookup is not user-scoped. Adding `requireSupabaseAuth` here was the Vercel 401 bug — do not re-add it. |
| `parcels.functions.ts` | **Public** | Same reason. |
| `osm.functions.ts` | **Public** | Overpass building/road detection. |
| `dcad.functions.ts` | **Public** | Dallas County GIS shortcut. |
| `classify.functions.ts`, `extract.functions.ts`, `ask.functions.ts`, `jobs.functions.ts` | Authenticated | User-scoped document + Q&A work. Uses `requireSupabaseAuth` and reads/writes as the signed-in user. |

Webhooks and cron would live under `src/routes/api/public/*` as `createFileRoute` server blocks — that prefix bypasses the auth wall on published sites, so every such handler must verify its own signature.

---

## 5. AI layer

`src/lib/ai-gateway.server.ts` picks the right provider at runtime:

1. If `LOVABLE_API_KEY` is present → route through the Lovable AI Gateway.
2. Else if `OPENAI_API_KEY` is present → hit OpenAI directly via `@ai-sdk/openai-compatible`.
3. Else → throw a clear "no AI provider configured" error.

`src/lib/ai-chat.server.ts` is the shared chat completion helper. Model choices:

| Task | Model |
| --- | --- |
| Document classification | `gpt-4o-mini` (cheap, fast) |
| Q&A / assistant | `gpt-4o-mini` |
| PDF clause extraction | `gpt-4o` (higher recall needed) |

---

## 6. Geocoding pipeline

```
user keystroke
   ↓
suggestAddresses()  ── Mapbox Search Box (suggest + retrieve, session token)
   ↓  on failure/timeout
US Census Geocoder (free, unlimited, US only)
   ↓
toTitleCase()  ── Census returns ALL CAPS
   ↓
dropdown
```

We used to use Nominatim (OSM). It failed for rural addresses like Kalama, WA and rate-limits aggressively. Do not reintroduce it.

---

## 7. Parcel pipeline

```
lat/lng OR drawn polygon
   ↓
In Dallas County?  ── DCAD GIS returns real parcel polygons
   ↓  everywhere else
OSM Overpass building footprints (timeout 8s)
   ↓  0 results
status = "empty" → UI prompts user to lasso
   ↓
batch insert via src/lib/community/api.ts (down from 40s to ~1.4s)
```

No provider will give us US-wide parcel polygons for free, so OSM buildings + user-drawn lasso is the plan of record.

---

## 8. Onboarding state machine

Lives in `src/lib/onboarding/useOnboarding.ts`. Steps:

`Welcome → BasicInfo → MapPick → DocsQuestion → (Upload | NoDocs) → ReviewWorkspace → SuccessSummary`

Handy handles:

- `?welcome=1` on `/dashboard` re-triggers the wizard.
- Typing `roadshare` anywhere (hook: `useOnboardingResetEasterEgg`) wipes `onboarded_at` flags and pushes to step 1.
- `MapPickStepImpl.tsx` splits its render effects: one repaints the parcel colors on selection change, one calls `fitBounds` **only when the parcel list identity changes** — that's what stops the "click a home → zoom out" bug.

---

## 9. Data model (high level)

```
auth.users
   ↓ trigger handle_new_user()
public.profiles ── 1:1 with auth user
public.user_roles ── (user_id, role enum)     ← roles NEVER on profiles

public.communities ── (id, name, owner_id)
public.parcels     ── (id, community_id, address, geometry, headline)
public.documents   ── (id, community_id, storage_path, doc_type)
public.clauses     ── (id, document_id, kind, text)
public.decisions   ── (id, community_id, title, status)
public.votes       ── (id, decision_id, user_id, choice)
```

Every RLS policy that checks admin status calls `public.has_role(auth.uid(), 'admin')` — a `SECURITY DEFINER` function that reads `user_roles`. This is intentional and documented in the security memory; do not revoke it or move roles onto `profiles`.

---

## 10. Front-end architecture

- `src/components/app/AppShell.tsx` — post-login shell. Nav is intentionally 5 items: Home, My Road, Neighbors, Documents, Decisions. "Ask my community" and "Community pulse" are hidden until invites ship.
- Design tokens live in `src/styles.css` (`@theme`). No hardcoded colors in components — always go through tokens or shadcn variants.
- `src/components/site/*` is the marketing site. `StoryPath` replaced the old card grid; `SecretSauce` is the interactive Fair Share calculator on the home page.

---

## 11. Marketing site

- Home = one long narrative (`StoryPath`) + `SecretSauce`. No hero-plus-features-grid.
- Subpages under `/solutions/$audience` and `/product/$slug` use editorial chapters, not pill-shaped filter buttons.
- Every route sets its own `head()` — never inherits home's title/description.

---

## 12. Deployment

**Lovable:** click Publish. Done.

**Vercel:** merge to `main`, Vercel picks up `vercel.json`, `vite.config.ts` sees `process.env.VERCEL=1` and switches nitro to the `vercel` preset. You must have the 5 env vars from `VERCEL_ENV.md` set. Verify at `/dashboard?welcome=true` by typing a rural address — you should see Mapbox suggestions with no error toast.

---

## 13. Known limitations & follow-ups

- OSM building coverage is thin in some rural areas — lasso is the fallback.
- Vercel Hobby caps serverless functions at 10s; if long Overpass calls come back, add `functions.maxDuration: 60` in `vercel.json`.
- No realtime updates yet (Supabase Realtime is available; not wired).
- Invites, "Ask my community," and "Community pulse" are stubbed out of the nav.
- No native mobile app — the site is responsive and works well on phones, but there's no wrapper.

---

## 14. Running locally

```
bun install
bun dev
# open http://localhost:8080
```

QA shortcuts:

- `/dashboard?welcome=1` — force the onboarding wizard.
- Type `roadshare` on any signed-in page — reset your account.
- `/tools/cedar-hollow` — the public sandbox, no auth.

Typecheck: `bunx tsgo --noEmit`.

---

*Last updated: July 2026.*