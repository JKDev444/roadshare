# RoadShare — User Workflow Guide

_Last refreshed: July 2026 — reflects the current shipped app._

A plain-language walkthrough for homeowners, HOA boards, and neighbors sharing
a private road. If a screen you see doesn't match this doc, this doc is wrong —
please open an issue.

---

## 1. What RoadShare is

RoadShare helps a group of neighbors who share a private road agree on **who
pays what, and why**. You describe your community (upload the HOA papers, type
an address, or add homes by hand), and RoadShare turns that into a fair yearly
cost share plus a shared place to vote on decisions.

No spreadsheets. No arguing about whose driveway is longer. Everyone sees the
same plat and the same math.

---

## 2. Who uses RoadShare

| Role | What they do |
| --- | --- |
| Homeowner | Sign in, see their share, vote on shared decisions. |
| Road lead / HOA board | Create the community, add neighbors, propose projects, upload the HOA rules. |
| Curious visitor | Try the Cedar Hollow demo at `/tools/cedar-hollow` — no sign-up. |

---

## 3. Language we use in the UI

We deliberately avoid technical/legal jargon in the product itself. When you
write UI copy or docs, use the left column.

| Say this | Not this |
| --- | --- |
| Homes | Parcels / lots / properties |
| HOA rules | CC&Rs (in UI — the term is fine in help docs) |
| Needs a human check | Low AI confidence |
| My road | Workspace / project |
| Ask my neighbors to vote | Create a decision |

---

## 4. The happy path, screen by screen

### 4.1 Landing → sign in
`/` is the marketing site with the `StoryPath` narrative and the "Fair Share"
calculator (`SecretSauce`). "Get started" leads to `/auth`. A brand-new visitor
can also try `/tools/cedar-hollow` first with no account.

### 4.2 Dashboard "Home Hub" (`/dashboard`)
First screen after sign-in. Greeting uses the capitalized first name. Two
primary CTAs:

- **Open my road** — jumps into `/community/$id` when the user already has one.
- **Create community** — opens the onboarding wizard.

### 4.3 Onboarding — Step 1: how do you want to start?
Component: `StartChoiceStep`. Three big, playful choice cards. Pick one:

1. **Upload your HOA papers** (CC&Rs / plat / road agreement PDF)
2. **Type your address** (we find neighbors near you)
3. **Add homes by hand** (paste a list, or add lot by lot)

There is no "Back" on Step 1. "Skip for now" and "See sample" are secondary.

### 4.4 Step 2a — CC&R upload path
`UploadStep` accepts a PDF. `ProcessingStep` then polls the real job row every
2 seconds and shows an 8-stage checklist driven by `stage_index`, `progress`,
and `status` in the database — no fake timers. If parsing fails, `FailureStep`
offers a clean fallback to the address or manual paths.

### 4.5 Step 2b — Address path
`BasicInfoStep` uses **Mapbox Search Box** for autocomplete, with **US Census
Geocoder** and **Nominatim** as fallbacks so rural addresses (e.g.
`787 Five Peaks Dr, Kalama, WA 98625`) still resolve. Once confirmed, we call
`parcels.functions.ts`:

- Dallas County → DCAD parcel records
- Everywhere else → OpenStreetMap building footprints

Batch insert into `community_parcels` (via `lib/community/api.ts`) so a
neighborhood of ~200 homes lands in ~1–2 seconds.

### 4.6 Step 2c — Manual path
Paste one address per line, or add rows one at a time. Same batch insert. Good
fallback for communities where the automatic lookups return sparse data.

### 4.7 Step 3 — Community created
`SuccessSummaryStep` + `Confetti` + `WelcomeBanner`. Shows the community name,
home count, and a single primary CTA into `/community/$id`.

### 4.8 Inside the community (`/community/$id`)
A single-page `MyRoadTab` with five guided step cards and an SVG **PlatCanvas**
(no Mapbox in-app — the plat is drawn from parcel geometry we already have).

```
  Step 1  Confirm your homes
  Step 2  Pick your project (repave, seal, patch…)
  Step 3  Enter the total cost
  Step 4  Choose how to split it (equal / distance / frontage)
  Step 5  Your fair share  →  Ask my neighbors to vote
```

"Your fair share" is a per-household card. The **Ask my neighbors to vote**
button generates a share URL that carries `project`, `total`, `method`, and
`decision` params.

### 4.9 Neighbor voting
When a neighbor opens the share URL, the `VoteCard` (in
`src/components/community/VoteCard.tsx`) renders above the planner. They pick
their household, hit 👍 or 👎, and optionally leave a comment. Votes are stored
in `decision_votes` and reuse the existing `decisions` schema — no new tables
for the vote round trip.

> ⚠️ Known limitation: `/community/$id` is under `_authenticated`, so a share
> recipient has to sign in first. Anonymous voting is on the Phase 3 list.

### 4.10 Sidebar
Kept intentionally small: **Home**, **My Road**, **Settings**. Everything else
(clauses, documents, decisions, pulse, ask) is reachable from inside the
community, not the top-level nav.

---

## 5. Escape hatches

### 5.1 The `roadshare` easter egg
Type `roadshare` anywhere on an authenticated page. Wipes the current user's
communities and wizard flags and drops you back at the start of onboarding.
Used constantly by QA and support.

### 5.2 `?welcome=1`
Appending `?welcome=1` to any authed route re-opens the onboarding wizard
without wiping data. Handy for testing copy changes.

### 5.3 Cedar Hollow demo
`/tools/cedar-hollow` is the no-signup sandbox. Same math engine, cosmetic
fake dataset. Use it in sales conversations and screenshots.

---

## 6. What's intentionally NOT here yet

- Anonymous neighbor voting (link recipient must sign in today).
- Real invite emails — sharing is copy-a-link only.
- Pricing / checkout — `/pricing` exists as a marketing page, not wired.
- Account/community deletion from the settings UI.
- Mobile-native tuning beyond what Tailwind gives us.

See `.lovable/plan.md` for the current phased plan to close these.