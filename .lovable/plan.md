# Make the app feel like Cedar Hollow

You're right — and I owe you a straight answer: I did not walk this end-to-end as a first-timer after onboarding. If I had, I would have caught these three things immediately. This plan fixes them and changes how I test so this doesn't happen again.

## What's actually wrong

1. **Dashboard looks "logo-less."** The sidebar only shows at ≥1024 px. In your preview it collapses and the top bar is empty — no logo, no menu button label, nothing that says "you are inside RoadShare." A non-tech user reads that as "wrong page."
2. **"Open my road" drops you into a form, not a map.** The community page shows the 5-step planner (`MyRoadTab`) but the plat picture at the top is hidden whenever a community has more than 120 homes (yours has 121). Without the picture, the steps read like a spreadsheet wizard. Cedar Hollow keeps the plat *always* visible — that's the whole feel you like.
3. **Too much stacked below the planner.** The "Manage homes" table sits directly under the planner on the same screen, so the page looks like a giant form with a hidden road. It should be a separate, quieter panel.

## What I'll change

### 1. Give every in-app screen a real top bar
- Add a persistent header in `AppShell` with the RoadShare logo, community name, and a visible "Menu" button on tablet (not just an icon).
- Show the sidebar as a slide-over under 1024 px so the user never lands on a "chrome-less" screen.

### 2. Make the community page look like Cedar Hollow
- **Always show the plat.** Replace the "> 120 homes → summary card" fallback in `PlatCanvas` with a scaled, zoomable plat that renders every home as a small dot, with the user's home highlighted and a "Zoom to my road" button. No more hiding the picture.
- **Cedar-Hollow layout:** big plat on top, one step-card at a time below (Which home is yours → Which road → Project → Split → Result). Same visual language as `/tools/cedar-hollow` — same card styling, same progress pips, same "Your fair share" reveal.
- **Move "Manage homes" off this screen.** It becomes its own quiet page/tab reachable from the sidebar and from a small "Edit the list of homes" link under the plat, so the main road screen stays focused.

### 3. Onboarding hand-off
- After onboarding, land the user on `/community/$id` (not `/dashboard`) with the plat already drawn and the first step-card ("Which home is yours?") open. The "Welcome back" dashboard becomes what you see on return visits, not the first thing after setup.
- Keep the resume banner and Cedar Hollow "see the sample" link on the dashboard.

### 4. Testing — how I'll actually catch this next time (desktop only)

I will run the full journey on **desktop at 1280 px and 1440 px** (no mobile / no tablet unless you ask). For every screen I'll fill the app out with real inputs so the map is populated with houses and the numbers are real — not empty states.

**Scripted flow, captured screen-by-screen:**
1. Wipe the account with the `roadshare` easter egg → screenshot the fresh dashboard.
2. Onboarding step 1 (Start Choice) → screenshot.
3. Onboarding step 2 (address = `787 Five Peaks Dr, Kalama, WA 98625`, dropdown open) → screenshot.
4. Onboarding step 3 (Find Neighbors — scanning progress, then results checklist populated) → screenshots of both states.
5. Processing → screenshot.
6. Success → screenshot.
7. Landing after onboarding (`/community/$id?tab=roads`) with the **plat drawn and houses visible** → screenshot.
8. Step-card 1 "Which home is yours?" with a home picked → screenshot showing your home highlighted on the plat.
9. Step-card 2 "Which road needs work?" with a road selected → screenshot.
10. Step-card 3 "Project" filled out (`Repave Five Peaks Dr`, `$25,000`) → screenshot.
11. Step-card 4 "Split" with each method (equal, frontage, distance) → 3 screenshots so you can see the plat + numbers change.
12. Step-card 5 "Your fair share" result → screenshot.
13. "Ask my neighbors to vote" → decision created → screenshot of the vote card.
14. Open the public `/vote/$decisionId` in a fresh session, cast a vote → screenshot.
15. Back to the community page showing the vote tally → screenshot.
16. `/dashboard` (return visit, community exists) → screenshot of the 4 tiles.
17. `/documents` → screenshot (empty + after uploading a sample PDF).
18. `/community/$id/homes` (new "Manage homes" page) with the full parcel list + search → screenshot.
19. `/decisions` → screenshot.
20. `/settings` → screenshot.
21. `/tools/cedar-hollow` for a side-by-side comparison → screenshot.

**Rules I'm holding myself to:**
- Every screenshot saved to `/mnt/documents/qa/<date>/` and referenced by number in the write-up.
- I do not answer "was it easy, was it confusing, did you get what you wanted" until all 21 screenshots exist and I've looked at each one.
- If any screen looks confusing or empty of the map/houses, I fix it before writing the report — not after.

## Technical notes

- `src/components/app/AppShell.tsx`: add persistent top header with logo + community switcher; make sidebar a `<Sheet>` under `lg`.
- `src/components/community/PlatCanvas.tsx`: remove the >120-parcel bailout; render as scaled SVG with viewBox fit-to-bounds, dot-per-home at scale, highlight `yourHomeId`, add zoom-in / fit buttons.
- `src/components/community/MyRoadTab.tsx`: reuse Cedar Hollow's card + progress-pip styling (extract shared bits from `src/components/roadshare/Planner.tsx` into a small `StepCards` primitive so both screens stay in sync).
- `src/routes/_authenticated/community.$id.tsx`: split the "Manage homes" table into its own route (`/community/$id/homes`) or a collapsed accordion below the plat.
- `src/components/onboarding/WelcomeWizard.tsx` success step: navigate to `/community/$id?tab=roads&justCreated=1` instead of `/dashboard`.
- Nothing about backend/data changes — this is presentation only.
