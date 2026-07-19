# Plan: Nationwide address search, non-tech sidebar, real neighbor invites, marketing polish

Big picture: fix the four things that made Kalama fail and made the app feel confusing to a non-tech user, and finish the marketing site so it reads professional + fun edge to edge.

## 1. Airbnb-quality address search (fixes Kalama and every other town)

**Root cause:** we're using OpenStreetMap's Nominatim as the primary geocoder. It rate-limits, has weak coverage in small towns, and doesn't return per-keystroke suggestions the way big-app search does. That's why "787 Five Peaks Dr, Kalama, WA" never appeared.

**Fix:** switch to **Mapbox Search Box API** (the same tech class that Airbnb/Zillow use) as primary, keep Nominatim as free fallback only.

- New server function `searchAddress(query, sessionToken)` calls Mapbox Search Box `/suggest` and `/retrieve` — session tokens make it billed as one search regardless of keystrokes (free tier: 100k/mo).
- Client-side debounced (150ms) hook `useAddressSuggest` returns suggestions as user types.
- Dropdown renders full formatted address, city, state — user clicks one → we already have `{lng, lat, city, state, zip, address}` — no re-geocoding.
- Pass coordinates directly into the Map step so it opens centered on the exact house even in rural areas with no OSM buildings.
- Rural fallback: when 0 building footprints exist within 300m, switch the map to "Drop pins for each home" mode with a friendly one-liner: "We couldn't find home outlines here — tap the map to add homes yourself."

## 2. Sidebar redesign for a non-tech homeowner

Current: 11 items, gray icons, jargon (Clause Graph, Community Pulse).

New primary nav (5 items, colored icons, plain English):
- **Home** (indigo house icon) — dashboard
- **My Road** (teal map icon) — map, roads, homes
- **Neighbors** (amber people icon) — invites + Ask + Pulse combined
- **Documents** (violet doc icon) — was Documents + Clause Graph
- **Decisions** (rose gavel icon) — was Decision Rooms + votes

Under a collapsible **More** group: Reports, Settings.

- Each item gets a subtle colored icon background (soft tint of the accent) — playful without being childish.
- "Ask My Community" and "Community Pulse" are folded into the Neighbors hub, not top-level.

## 3. Real neighbor system (Owner + Voters, email + magic link)

New concept: every community has exactly one **Owner** (creator) and any number of **Voters**.

**DB (one migration):**
- `community_members` table: `community_id`, `user_id` (nullable until they sign in), `email`, `role` ('owner' | 'voter'), `invited_at`, `joined_at`, `status`.
- `community_invites` table: `community_id`, `email`, `token`, `expires_at`, `invited_by`.
- RLS: owner can insert/delete members of their own community; voters can only read their own row + community metadata; nobody but owner can edit roads/homes/projects/documents.
- `has_community_role(community_id, role)` security-definer function.

**Invite flow:**
- Owner opens Neighbors → "Invite neighbors" → paste emails (one per line, or CSV) → we send each a branded magic-link email via Lovable Emails (scaffold auth email templates in same round).
- Recipient clicks link → signed in → auto-joined to community as Voter → lands on Neighbors page with a "Welcome" banner.
- Owner sees a live roster: Pending / Joined, resend, revoke.

**Voter permissions (enforced in RLS + UI):**
- ✅ View community, map, docs, plan, allocations.
- ✅ Answer surveys (Community Pulse).
- ✅ Ask/answer in "Ask My Community".
- ✅ Vote in Decision Rooms.
- ❌ Cannot edit roads, homes, projects, allocations, or invite others.

**Empty-state fixes:**
- Ask/Pulse now show real value with 0 voters: "You're the only member so far. Invite your neighbors to unlock voting and surveys." with a big **Invite neighbors** CTA.

## 4. Marketing site polish (all pages)

Design system for the whole marketing site:
- Straight horizontal dashed road as the recurring motif (not curved) — replace the curvy "How it works" SVG.
- One consistent icon set (Lucide, rounded, colored fills on soft tinted circles).
- Photography: 3–5 lifestyle photos (rural road, neighbors on porch, mailbox) from Unsplash via lovable-assets — replaces flat colored blocks.
- No card walls: at most one card section per page.
- Playful accents (Sparkles, small illustrations) but professional type + spacing.

Per-page work:

**/** (home)
- Straighten the "How it works" road (currently curved).
- Keep StoryPath, SecretSauce, personas, CTA.

**/product**
- Kill the "1" and "2" numbered blocks that look unfinished.
- Replace with a 4-chapter zigzag walkthrough (Map → Split → Decide → Report).
- Rework "What we're building next" — most of that is built. Rename to "What's already inside" and list the actual features (Ask My Community, Pulse, Decision Rooms, Clause Graph) with short plain-English blurbs.

**/solutions/private-road-communities**
- Full rebuild to match the new visual system: hero with straight road + houses, 3 pain-points, 3 outcomes, one lifestyle photo, single CTA.

**/solutions/*** (other solutions pages)
- Same treatment: hero, pains, outcomes, one photo, CTA. No card walls.

**/about**
- Warmer copy, one team/mission photo, drop redundant sections.

**/methodology**
- Keep the house-share diagram; add a straight-road version alongside; tighten copy.

**/pricing**
- Reformat plan comparison as a clean table (not stacked cards). Add one FAQ block.

## 5. Verification (before I say done)

- Playwright end-to-end: sign up → onboarding with Kalama address → address dropdown shows suggestions → pick one → map centers on Kalama → finish onboarding → land in community.
- Send myself a test invite as Owner → open magic link in a second browser context → confirm Voter lands on Neighbors page and cannot edit map (RLS blocks the write).
- Screenshot every marketing page at 1280 and 393 to confirm consistency.
- Report back honestly against your three questions (easy for non-tech? got what they wanted? fun design?) — no "done" without evidence.

## Technical section (safe to skip)

- Mapbox Search Box API called from `src/lib/onboarding/geocode.functions.ts` — sk token via connector gateway, session tokens generated client-side.
- Nominatim kept as a `try/catch` fallback if Mapbox returns 0 results (unlikely).
- Sidebar in `src/components/AppSidebar.tsx` — colored icon tokens added to `src/styles.css` (`--nav-home`, `--nav-road`, etc.).
- Auth emails scaffolded via `email_domain--scaffold_auth_email_templates` (magic link template branded).
- Two migrations: `community_members` + `community_invites` with GRANTs, RLS, and `has_community_role()` security-definer.
- New server fns: `inviteNeighbors`, `acceptInvite`, `listMembers`, `revokeInvite`.
- `_authenticated/community.$id.*` write paths gated behind `has_community_role(id, 'owner')` on the server; UI hides edit buttons for voters.
- Marketing pages: no data changes, pure presentation edits under `src/routes/` and `src/components/site/`.

## Order of build

1. Mapbox Search Box + fix Kalama (unblocks onboarding).
2. Community members schema + invite flow + magic-link email.
3. Sidebar redesign.
4. Marketing polish pass across all pages.
5. Full Playwright verification + honest Q&A report.