# Deploying RoadShare to Vercel

`LOVABLE_API_KEY` is a Lovable-managed secret and **cannot be copied out** of
Lovable. Publishing from Lovable's own hosting is always the simplest path —
every key is injected for you.

If you still want to host on Vercel (or any other platform), the app has
fallbacks so it can run without `LOVABLE_API_KEY`. You supply your own
provider keys instead. Set the variables below in **Vercel → Project →
Settings → Environment Variables** (Production + Preview).

---

## Required

| Variable | Where to get it | Notes |
| --- | --- | --- |
| `SUPABASE_URL` | Lovable → Cloud → Settings (URL) | Same value as `VITE_SUPABASE_URL`. |
| `SUPABASE_PUBLISHABLE_KEY` | Lovable → Cloud → Settings (publishable key) | Same value as `VITE_SUPABASE_PUBLISHABLE_KEY`. |
| `VITE_SUPABASE_URL` | Same as above | Exposed to the browser bundle. |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Same as above | Exposed to the browser bundle. |

That is enough to render the app, sign in, and read/write data through RLS.

---

## Recommended (unlocks AI + map typeahead)

You need **one** AI key and **one** Mapbox key.

### AI (Q&A, document classify, clause extract)

Pick either:

- `OPENAI_API_KEY` — get one at <https://platform.openai.com/api-keys>.
  The app auto-selects `gpt-4o-mini` for fast calls.

(`LOVABLE_API_KEY` would also work, but it can't be exported from Lovable.
`OPENAI_API_KEY` is the intended Vercel path.)

**PDF document extraction** (the "Upload a document" flow) currently requires
`LOVABLE_API_KEY` because it uses Lovable's multimodal PDF pipeline. On
Vercel-only deployments that feature is disabled until we add a direct
OpenAI/Gemini PDF path. Everything else — Q&A, classify, clause extraction —
works with `OPENAI_API_KEY` alone.

### Address search (Mapbox)

- `MAPBOX_ACCESS_TOKEN` — a Mapbox **secret** (`sk.`) token with the
  `search:read` scope. Create one at
  <https://account.mapbox.com/access-tokens/>. Server-side only; **do not**
  expose it to the browser.

Without this the app falls back to the free US Census geocoder, which works
but returns fewer suggestions and no per-keystroke typeahead.

If you also want the client-side map tiles to render on Vercel, keep the
existing `VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN` (a `pk.` token) — that
is a public token and can safely be committed to Vercel env vars.

---

## Not needed on Vercel

- `LOVABLE_API_KEY` — Lovable-managed, cannot be copied out. Not needed once
  the fallbacks above are configured.
- `SUPABASE_SERVICE_ROLE_KEY` / DB password — not available on Lovable Cloud
  and not required by any code path the app ships with.
- `MAPBOX_API_KEY` — that name is the Lovable connector's variable. On Vercel,
  use `MAPBOX_ACCESS_TOKEN` instead.

---

## Verifying the deployment

After deploying, open `/dashboard?welcome=true` and type
`787 Five Peaks Dr, Kalama, WA` in the address field. You should see
suggestions appear as you type (Mapbox) or after a short pause (Census
fallback). If neither works, check the Vercel function logs for
`[geocode] mapbox suggest failed` — that means the Mapbox token is missing
or lacks `search:read`.