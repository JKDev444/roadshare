
## Goal

Fix the confusing post-onboarding experience so a non-technical homeowner can go from "sign in" to "our shared road with a cost split, ready to send to neighbors" without hitting jargon, hidden panels, or dead ends. Then I actually walk that flow end-to-end as a first-time user who has never seen this tool and report back honestly.

---

## 1. Easter egg = true fresh start

Today `roadshare` only clears wizard flags — the old community, homes, and road stay, so onboarding isn't really fresh.

- `useOnboardingResetEasterEgg` will list the user's communities and delete each one (existing `deleteCommunity` cascades to parcels, segments, documents, decisions).
- Then clear onboarding flags and route to `/dashboard?welcome=true`.
- Wrap it in a confirm toast ("Delete everything and restart? Yes / Cancel") so it can't fire by accident.

## 2. Dashboard button label + destination

"Go to Community Home" reads as a jump to "Neighbors" because the destination screen is dense.

- Rename the CTA to **"Open my road"**, point at `/community/$id?tab=roads` (map + cost).
- Delete the standalone "Community Home" tab (see §3). Old `?tab=home` links normalize to `roads`.

## 3. Collapse Community Home + My Road into one simple page

Today: `CommunityHomeTab` (hero + Continue Setup + 5-step checklist + 4 summary cards + Recent Activity + dashed Neighbors card) AND `MyRoadTab` (Overview / Homes & Access / Cost Sharing sub-tabs + hidden detailed map + callouts). Five sections doing overlapping jobs, plus a nested sub-nav.

Replace both with **one** vertical page at `?tab=roads`:

```text
┌─ Your shared road ─────────────────────────────┐
│  [ big simple map: homes as dots, road line ]  │
│  8 homes · ~1,240 ft of road                   │
├────────────────────────────────────────────────┤
│  Split $ [ 10,000 ] using [ Equal ▾ ]          │
│  → Each home pays $1,250                       │
│  [ See the breakdown ]  (expands a table)      │
├────────────────────────────────────────────────┤
│  Next: 2 things left                           │
│   • Draw your road          [Draw]             │
│   • Invite your neighbors   [Invite]           │
└────────────────────────────────────────────────┘
```

- No sub-tabs, no "hidden detailed map", no accordion of instructions.
- Home list becomes a "See the breakdown" expander inside the cost card.
- Recent activity and the dashed Neighbors card leave this page.

## 4. Kill jargon on the Homes tab

The list labels every home "Needs review" via `VerificationBadge` — meaningless to a homeowner.

- Remove verification and confidence badges from the list view.
- Show a single small yellow dot + tooltip "Missing address" only when `address` is empty.
- Column headers: "Home" / "Address" / actions. Drop "Confidence".
- Empty state: "No homes yet — pick your neighbors on the map." + one button.

## 5. Kill jargon on Road details (the screenshot you sent)

Users don't know what Surface, Maintenance responsibility, Source, Confidence, or "Needs review" mean.

- New "Road details" dialog is 3 fields only: **Name**, **Notes** (free text — replaces Surface / Source / Maintenance responsibility), and length shown read-only.
- Remove Confidence and Verification dropdowns from the UI entirely. Existing DB columns stay (nothing to migrate); we just stop reading/writing them in the dialog.
- Save button copy: **"Save road"** (not "Save segment" — homeowners don't call it a segment).
- Same jargon sweep on the Home edit dialog: keep Label, Address, Frontage (with the label "Feet of road touching this property"). Drop Confidence / Verification controls.

## 6. Simpler basemap in-app

Switch the in-app map (editor + roads page) from Mapbox Streets to `mapbox://styles/mapbox/light-v11` — minimal grey basemap, thin road lines, no POI noise. Homes = solid indigo dots, road = thick teal line. Keep Streets only in onboarding lasso where the user needs to recognize their neighborhood. One `MAP_STYLE` constant in `src/lib/mapbox.ts`.

## 7. Then I test end-to-end as a brand-new user (desktop only)

Ground rule for me: I have never used RoadShare. I don't know what a parcel, segment, frontage, or confidence score is. If a label doesn't tell me what to do, I flag it.

1. Trigger easter egg → confirm the account is actually wiped → land on `?welcome=true`.
2. Onboarding: address → lasso → name → skip documents → success screen.
3. New single-page road view loads with one obvious next step.
4. Guided 3-step draw of the road.
5. Confirm homes; fix one blank address and verify the yellow dot disappears.
6. Open Road details — check the dialog only has Name + Notes.
7. Set cost = $10,000, flip Equal / Frontage / Distance, expand the breakdown.
8. Upload one PDF into Documents.
9. Propose one decision.

Then I answer honestly, in a first-time-user voice: was it easy? Anything confusing or out of place? Did I get the result I wanted (a cost share I could send to neighbors)? Was it fun?

## Technical notes (skim-safe)

- `useOnboardingResetEasterEgg.tsx` uses a new `deleteAllCommunities()` helper in `src/lib/community/api.ts` (iterates `listCommunities()` + existing `deleteCommunity(id)`).
- `CommunityHomeTab.tsx` deleted; `MyRoadTab` collapses from `Tabs` to a plain vertical layout; `computeCostShare` reused unchanged.
- `community.$id.tsx`: default tab `roads`; `normalizeTab("home") → "roads"`.
- Road details dialog and Home edit dialog: strip Confidence / Verification / Surface / Source / Maintenance form controls. Keep the underlying DB columns untouched.
- `VerificationBadge` / `ConfidenceBadge` uses removed from list views (files stay in repo, unused).
- `MAP_STYLE` constant read by `CommunityMapEditorImpl` and the roads-page map. `MapPickStepImpl` keeps Streets.

## Out of scope

- Mobile testing this pass.
- Real invite emails.
- Marketing site changes.
- Cedar Hollow demo.
- Any DB migration — this pass is purely UI/UX + easter-egg cleanup.
