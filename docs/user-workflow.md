| **Invited neighbor** | Join an existing community by link, confirm their home, vote. |
| **Curious visitor** | Try the **Cedar Hollow** sandbox on the marketing site — no sign-up needed. |

---

## 3. First-time onboarding, step by step

When you sign in for the first time you'll see a **Welcome** card. Click **Get started**.

1. **Your address.** Start typing. Suggestions appear from Mapbox (and the US Census as a backup). Rural addresses work — we tested Kalama, WA. If your address isn't in the dropdown, you can still type it in full and click **Continue**.
2. **Pick my neighborhood on a map.** A map opens centered on your address.
   - **Tap a home** to add or remove it.
   - **Lasso** — drag a loop around your whole community. We auto-detect the roads inside.
   - **Select all** grabs every nearby home in view.
   - **Reset** starts over.
3. **Review your homes.** You'll see a count like *"8 selected of 207 nearby homes"* and a list. Fix anything wrong.
4. **Name your community.** e.g. *"Cedar Hollow HOA"*.
5. **Documents (optional).** Upload your CC&Rs, HOA rules, or a recent road invoice as PDFs. RoadShare classifies them and pulls out clauses like assessment rules or quorum.
6. **You're in.** Confetti, a welcome banner with your community stats, and clear next-step buttons.

**Skip for now** on any step drops you into the dashboard where you can come back later.

**Reset it all:** on any page after sign-in, type the word `roadshare` (yes, just start typing — it's a hidden shortcut). You'll be sent back to step 1 with a fresh onboarding.

---

## 4. The dashboard

After onboarding you land on **Home**. The **Welcome banner** shows:

- Your community name and how many homes are in it.
- The next 2–3 things worth doing (upload rules, invite a neighbor, propose a decision).

Left-side navigation is intentionally short:

- **Home** — overview.
- **My Road** — the map, road segments, and cost math.
- **Neighbors** — everyone in the community.
- **Documents** — every PDF you've uploaded, plus extracted clauses.
- **Decisions** — proposals, votes, and results.

---

## 5. Adding neighbors after onboarding

Go to **Neighbors → Add**. Three paths:

1. **Lasso the map again** — same tool as onboarding.
2. **Type an address** — Mapbox autocomplete, one at a time.
3. **Paste a list** — one address per line. We geocode each and add them in a batch.

---

## 6. Documents

**Documents → Upload PDF.** Drag in your file. RoadShare:

1. Detects what it is (HOA rules, CC&Rs, minutes, invoice).
2. Extracts clauses like *"Assessments are due January 1"* or *"Quorum is 60%"*.
3. Files them under your community so anyone with access can search them later.

You can rename, re-classify, or delete anything you upload.

---

## 7. Decisions

**Decisions → Propose.** Give it a title (*"Repave the east segment"*), a description, and optionally a dollar amount. Neighbors vote yes / no / abstain. When quorum is met the decision closes automatically and is logged in the timeline.

---

## 8. The Fair Share calculator

Three ways to split cost:

| Method | When it's fairest |
| --- | --- |
| **By distance from the entrance** | The home at the end of the road drives the whole road. It's fair for them to pay more of the far segments. |
| **By road frontage** | Big lots with lots of road touching their property pay more. |
| **Equal per home** | Simple. Fair when every home uses the road the same way. |

The Cedar Hollow sandbox lets you flip between all three on a real map and see who pays more or less under each.

---

## 9. The Cedar Hollow sandbox

`roadshare-iota.vercel.app/tools/cedar-hollow` — no sign-up. Cedar Hollow is a made-up neighborhood we use for teaching. The math is real; the neighbors aren't. Sign up to run the same thing on your own road.

---

## 10. FAQ / troubleshooting

**The map is blank.** Wait 5 seconds — we're pulling home outlines from OpenStreetMap. If it stays blank, tap **Lasso** and draw around your community; that path always works.

**My address isn't in the dropdown.** Just finish typing it and click **Continue**. Rural addresses sometimes take a moment to appear.

**Only 2 homes came back from my community of 100+.** That was an old bug — parcels used to come from Dallas County only. Now they come from OpenStreetMap everywhere. If you still see this, lasso the whole neighborhood and we'll pick up every building inside.

**Clicking a home zooms the map out.** Fixed — the map now only re-frames when you first load or re-lasso, never on a single click.

**I want to start over.** Type `roadshare` on any signed-in page.

**I invited a neighbor but they don't see the community.** Invites are still coming — for now, ask them to sign up with the same email you used, then reach out and we'll link them.

---

*Last updated: July 2026.*