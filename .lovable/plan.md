## What's off today

Looked through `src/routes/index.tsx`, `product.index.tsx`, `about.tsx`, `pricing.tsx`, `methodology.tsx`, and the shared `SiteLayout` / `primitives.tsx`. The pattern that repeats across almost every page:

- Homepage has **two card grids back-to-back** (Story = 6 cards, Products = 6 cards).
- Subpage tiles get repeated on the homepage as **small pill links** at the bottom — the "Solutions" audience row. Non-tech users have no way to tell those pills are the primary way into subpages.
- The "secret sauce" — **fairly splitting road costs by how far each home actually drives on the road** — is only a single line in the hero. Nothing else on the site shows or celebrates it.
- Subpages (`/product`, `/about`, etc.) lean on the same card grid formula, which makes the whole site feel like one giant card wall.

## What I'll do

### 1. Homepage — one card section, not three

Keep exactly **one** card grid (the Products section — that one earns cards because each item is a real destination). Everything else becomes its own shape:

- **Story section → horizontal numbered storyline.** Six labeled steps (Map → Allocate → Documents → Community → Decide → Report) laid out along a connecting road line with numbered dots, not tiles. Reads left-to-right like a journey. On mobile it stacks as a vertical timeline. This gives the page a narrative spine instead of a second card wall.
- **Solutions pill row → "Who uses RoadShare"** paragraph-style band with 3–4 named personas as inline text callouts + one clear "See who it's for →" button that opens a proper list page. Kills the confusing tiny pill soup at the bottom.

### 2. New "Secret sauce" spotlight section

Add a dedicated section between Story and Products called something like **"The fair-share formula"**:

- Left side: short plain-English pitch — "Every home pays for the road they actually use. Drive past 3 homes to reach yours? You pay a share on that stretch. Neighbors closer to the entrance pay less."
- Right side: an interactive miniature — a small map with 4 homes, a hovering slider that moves a "your house" pin, and the dollar amount for each neighbor updating live. Uses the existing `HeroMap`-style SVG animation, no new libraries.
- Below: three little proof stat chips ("Distance-based • Frontage-based • Equal split — you pick") to show flexibility without becoming another card grid.

This is the section that finally makes the secret sauce loud.

### 3. Site-wide polish for "fun + non-technical"

- **Language pass.** Rewrite headings and card copy in the voice we've been using in-app ("homes", "your road", "your share") instead of governance jargon ("parcels", "obligations", "allocation methods").
- **Playful accents.** Reuse the in-app `fun-1/2/3` gradient tokens for the secret-sauce section, the CTA, and page heroes so the marketing site matches the wizard's personality.
- **Motion moment.** One animated pin/road stroke on the hero and one live-updating number in the secret-sauce section. Nothing more — motion should feel like a wink, not a rave.

### 4. Subpage cleanup (same principles)

- `/product` — remove the redundant "audience pills at the bottom" pattern where it repeats; anchor each product with a small illustrative graphic instead of a card.
- `/about`, `/methodology`, `/pricing` — replace stacked info-card grids with the existing `ContentPage` prose layout (already in `primitives.tsx`) so the whole site doesn't feel identical.
- `SiteFooter` / `SiteHeader` — verify the top nav (Product / Solutions / Pricing / About) is clearly labeled and matches what the pill row used to point at, so nothing is lost.

## Technical notes

- New storyline component: `src/components/site/StoryPath.tsx` (SVG road line + numbered stops, `framer-motion` reveal already in the project).
- New secret-sauce component: `src/components/site/SecretSauce.tsx` — reuses the SVG language from `HeroMap` in `src/routes/index.tsx`.
- Content lives in `src/lib/site/content.ts` (already the source of truth for PRODUCTS/SOLUTIONS) — extend with a `PERSONAS` short list and a `FORMULA_HOMES` demo dataset.
- No new dependencies; keeps `framer-motion` + Tailwind + shadcn only.
- Preserve all existing route heads (titles, descriptions, og tags) — copy edits only, no metadata regressions.

## Out of scope

- No changes to authenticated app pages.
- No new backend, database, or Cloud changes.
- Not touching `/tools/cedar-hollow` — that stays as the live demo target.

## Suggested build order

1. Storyline component + drop into homepage (replaces first card grid).
2. Secret-sauce section + drop into homepage.
3. Kill the pill row, replace with the "Who uses RoadShare" band.
4. Copy pass across homepage + subpages.
5. Subpage card-grid cleanup on `/product`, `/about`, `/methodology`.
6. Playwright pass: capture each marketing page at desktop + mobile, confirm no card-heaviness regressions and that the secret sauce is visible above the fold on `/`.

Want me to also run the visual-direction ritual (palette / type / layout picks + 3 rendered previews of the new homepage) before I start building, or go straight into implementation from this plan?
