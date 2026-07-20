## Where we actually stand

Verified against the code right now (`rg`/`ls` this turn):

| # | Item | Status |
|---|------|--------|
| 1 | Three-button "Create your community" | Done — `StartChoiceStep.tsx` present, wired in `WelcomeWizard` |
| 2 | CC&R upload real progress | Done — `ProcessingStep` polls `getJob` every 2s off real DB `stage_index` / `progress` / `status` (confirmed last turn, no optimistic timers) |
| 3 | Guided step-cards in community | Done — `MyRoadTab` has `StepCard` + 5-step flow |
| 4 | Results & sharing | **Partial** — "Your fair share" card done; "Copy link" now embeds `project`/`total`/`method` in URL and neighbor view banners it; **but** no neighbor Vote screen (👍/👎 + comment) reusing `decisions` yet |
| 5 | Cedar Hollow shares planner components | **Not done** — `tools.cedar-hollow.tsx` does not import `PlatCanvas` or `StepCard`; it still renders its own UI |
| 6 | Terminology sweep | **Partial** — still visible: `ProvenancePopover` on `/community/$id`, `ConfidenceBadge`/`VerificationBadge` + "AI confidence" on `/clauses`, "provenance/confidence" copy on `/security`, `provenance: "sample"/"entered"` literals in `WelcomeWizard` sample data |
| 7 | Phase E regression (3 paths + scale + audit questions) | **Not done as evidence-backed sweep** — pieces have been tested ad-hoc, no consolidated pass/fail per path with screenshots |

So: honestly, 3 of 7 are fully complete, 2 are partial, 2 are open.

## Plan to finish

### A. Complete item 4 — neighbor Vote screen
- Add a `plan` decision kind (or reuse the existing shape) so a "Copy link" URL can also open a Vote view under `/community/$id?vote=1` for signed-in neighbors.
- New `VoteCard` component: shows project name, total, method, your fair share, and a 👍 / 👎 + optional comment box; writes to existing `decision_votes` table.
- Empty state when no active plan; result summary once ≥1 vote exists.

### B. Complete item 5 — Cedar Hollow uses the real planner
- Refactor `tools.cedar-hollow.tsx` to render `<PlatCanvas>` + the same `MyRoadTab` step-card flow against a hardcoded in-memory Cedar Hollow dataset (no DB writes).
- If `MyRoadTab` needs decoupling from DB-shaped types, extract minimal props; do not create a separate `src/components/planner/*` tree just for filename cosmetics.

### C. Finish item 6 — terminology sweep
User-facing copy only, code identifiers untouched:
- `/community/$id`: replace `ProvenancePopover` label "History" trigger stays, but drop "Provenance" heading + rename internal-facing copy; remove `Confidence` badge column if surfaced.
- `/clauses`: remove `ConfidenceBadge`/`VerificationBadge` from the UI or hide behind an "advanced" toggle; drop "AI confidence %" strings.
- `/security` marketing page: rewrite "Provenance and history" / "confidence" sentences into plain language ("Every fact shows where it came from and when", "AI answers cite the document").
- `WelcomeWizard` sample data: keep the literal `provenance: "sample"` values (they're required by the DB schema) — only rewrite any user-visible text derived from them.

### D. Phase E — evidence-backed regression
Run headless Playwright against localhost, one reset per path via the `roadshare` easter egg. For each path capture:
1. Screenshot at "community created"
2. Screenshot at Step 5 "Your fair share"
3. Screenshot after opening the copied share URL in a fresh context (Path A only)
4. Four-question audit answers

Paths:
- **A · CC&R upload** — use a small public HOA CC&R PDF (pick one, cache under `/tmp/browser/samples/`); confirm the 8-step checklist advances on real DB state and lands on a populated community.
- **B · Address (rural)** — `787 Five Peaks Dr, Kalama, WA 98625` end-to-end.
- **C · Manual entry** — paste 5 addresses.
- **Scale** — separate script that seeds a 500-home fixture straight into the DB for one community and loads `/community/$id` to confirm `PlatCanvas` pan/zoom stays responsive.

Report is a single message with a pass/fail line per item plus the four audit answers.

### Phasing
1. A + C together (both are contained edits) → typecheck.
2. B (bigger refactor of Cedar Hollow) → typecheck.
3. D last, only after 1 + 2 are in.

### Out of scope (unchanged)
Mobile-only tuning, real invite emails, other marketing pages, DB migrations beyond what item A needs (likely none — reuse `decisions` + `decision_votes`).