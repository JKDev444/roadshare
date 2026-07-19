# Make Vercel deploy this project the same way MedFleetIQ works

## Why MedFleetIQ works and RoadShare doesn't

Both projects use the same stack. The only difference is **build configuration** — MedFleetIQ tells Vercel how to build a TanStack Start app, and this project doesn't. Without it, Vercel deploys only static files and every server function 404s (that's the "Can't reach the address lookup" toast).

## What I'll change (code only)

**1. `vite.config.ts`** — add the Vercel nitro branch (mirrors MedFleetIQ):

```ts
const isVercel = !!process.env.VERCEL;

export default defineConfig({
  tanstackStart: { server: { entry: "server" } },
  nitro: isVercel
    ? {
        preset: "vercel",
        output: {
          dir: ".vercel/output",
          serverDir: ".vercel/output/functions/__server.func",
          publicDir: ".vercel/output/static",
        },
      }
    : undefined,
});
```

**2. `vercel.json`** at project root:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "vite build",
  "installCommand": "bun install"
}
```

The `isVercel` branch only activates when Vercel builds, so Lovable's preview is unchanged.

## What you need to add in Vercel (env vars)

You already have `OPENAI_API_KEY` and `MAPBOX_ACCESS_TOKEN`. Add these 5 more — **all are safe/public values from your project `.env`**, not the restricted service role key:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://hhywlytenppyqgyhrlfz.supabase.co` |
| `SUPABASE_URL` | `https://hhywlytenppyqgyhrlfz.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_OkMaAjvlpVpo6TD8eZic4Q_RKQL_l2U` |
| `SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_OkMaAjvlpVpo6TD8eZic4Q_RKQL_l2U` |
| `VITE_LOVABLE_CONNECTOR_MAPBOX_PUBLIC_TOKEN` | `pk.eyJ1Ijoic2p2aWRzIiwiYSI6ImNtcnA5eHh0cDBobWsyeG9qbnRvNjdmajMifQ.sJXwOBqsDeIbUOTi6-oC5A` |

**Ignore `SUPABASE_SERVICE_ROLE_KEY`.** It was on my earlier list but the onboarding / address lookup / community creation flows don't need it. It's the one key you can't get, and you don't need it.

## Order of operations

1. I add the two files above.
2. You add the 5 env vars in Vercel.
3. Vercel auto-redeploys (or you trigger a redeploy).
4. I run Playwright against `https://roadshare-iota.vercel.app/dashboard?welcome=true`, type `787 Five Peaks Dr, Kalama, WA`, and confirm the Mapbox dropdown returns suggestions with no error toast. Only then do I report success.
