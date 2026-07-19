# Enable external hosting (Vercel) without copying LOVABLE_API_KEY

## Why not just copy it
`LOVABLE_API_KEY` is a Lovable-managed secret. Its value is never displayed in the UI, never returned by any tool, and rotating it does not reveal the new value either. There is no safe "one-time copy" path we can build without breaking that guarantee — so any Vercel deploy has to authenticate to AI/geocoding **without** that specific key.

## Chosen approach
Give the server functions a fallback so they use a user-supplied key when running outside Lovable, and keep using `LOVABLE_API_KEY` transparently when running inside Lovable.

Two secrets you already have full control over on Vercel:
- `MAPBOX_API_KEY` — the Mapbox `sk.` token you already added to Lovable. Copy the same value into Vercel env vars.
- AI: add a direct provider key on Vercel (e.g. `OPENAI_API_KEY` or `GEMINI_API_KEY` — whichever provider we're actually calling). This replaces `LOVABLE_API_KEY` only when running on Vercel.

Supabase env vars (`SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and the `VITE_` ones) also need to be set on Vercel — those values *are* visible in Lovable's Cloud settings, so they're straightforward to copy.

## Steps

1. **Audit which server functions actually need `LOVABLE_API_KEY`.**
   Grep `src/` for `LOVABLE_API_KEY` and list every call site (geocoding via Mapbox proxy? AI Gateway chat? embeddings?). This determines whether we need a provider key at all, or only Mapbox + Supabase.

2. **For each Lovable AI Gateway call site**, add a small helper `getAiClient()` that:
   - If `LOVABLE_API_KEY` is set → use Lovable AI Gateway (current behavior).
   - Else if `OPENAI_API_KEY` (or the relevant provider key) is set → call the provider directly with the AI SDK.
   - Else throw a clear error naming which env var is missing.

3. **For Mapbox calls**, confirm they already read `process.env.MAPBOX_API_KEY` directly (they should — that's a user-managed secret, not the Lovable key). Fix any that hardcode a different name.

4. **Write a `VERCEL_ENV.md`** at the repo root listing every env var Vercel needs, where to get each value, and which are optional. This is the doc you follow when setting up (or re-setting-up) the Vercel project.

5. **Verify on Vercel** by hitting `/dashboard?welcome=true` on the Vercel URL, typing "787 Five Peaks Dr, Kalama, WA" and confirming (a) suggestions appear and (b) no "Can't reach the address lookup" error. Per your standing preference, I won't call this done until that end-to-end check passes on the Vercel URL.

## Technical notes
- Files likely touched: `src/lib/onboarding/geocode.functions.ts`, `src/lib/onboarding/geocode.server.ts`, any `src/lib/ai-gateway.server.ts` helper, and a new `VERCEL_ENV.md`.
- No schema changes, no new tables, no new secrets stored in Lovable.
- The Lovable preview keeps working unchanged because `LOVABLE_API_KEY` is still present there and takes precedence.

## Out of scope
- Exposing or exporting `LOVABLE_API_KEY` itself — not possible.
- Migrating hosting off Vercel.
