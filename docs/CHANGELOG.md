# RoadShare — Changelog

## July 2026 — the "nuke plan" pass

Non-tech-user feedback surfaced two dominant complaints: the in-app Mapbox
editor felt hostile, and the vocabulary (parcels, workspace, provenance,
confidence) read as jargon. This pass rebuilt the affected surfaces.

### Removed
- **Mapbox from the in-app experience.** All authenticated routes now render
  plats via a new SVG `PlatCanvas`. Mapbox is retained only as an address
  autocomplete source (Search Box) with US Census + Nominatim fallbacks.
- **Optimistic timers** in the CC&R processing step. `ProcessingStep` now polls
  real DB job state every 2s (`stage_index`, `progress`, `status`).
- **Jargon in the UI.** "Parcels/lots/properties" → "homes". "CC&Rs" → "HOA
  rules". "AI confidence %" → "Needs a human check". "Workspace" → "My road".
- **Sidebar clutter.** `AppShell` sidebar is now Home / My Road / Settings —
  Ask, Pulse, Clauses, Documents, and Decisions are reachable inside the
  community instead.

### Added
- **Three-button onboarding Step 1** (`StartChoiceStep`): Upload HOA papers,
  Type your address, Add homes by hand. Playful gradient cards, no "Back" on
  Step 1.
- **Nationwide parcel discovery**: DCAD in Dallas, OSM building footprints
  everywhere else, batch-inserted so a ~200-home neighborhood lands in
  ~1–2 seconds.
- **Rural geocoding** via US Census Geocoder + Nominatim fallbacks so
  addresses like `787 Five Peaks Dr, Kalama, WA 98625` resolve.
- **Neighbor voting**: `VoteCard` renders above the planner when the URL
  carries `?decision=<id>`. Reuses `decisions` + `decision_votes`; no new
  tables.
- **Share URLs** at Step 5 of `MyRoadTab` carrying `project`, `total`,
  `method`, and `decision`.
- **`roadshare` easter egg** — typing `roadshare` on any authenticated page
  wipes the current user's communities and wizard flags and restarts
  onboarding. Used by QA and support.
- **`?welcome=1`** re-opens the wizard without wiping data.
- **Marketing rewrite**: `StoryPath` narrative + `SecretSauce` calculator on
  `/`, plain-language `/security` page.

### Fixed
- Dashboard greeting now capitalizes the first letter of the user's name.
- Empty state and layout conflicts between the wizard modal and dashboard
  CTAs behind it.
- Cedar Hollow demo (`/tools/cedar-hollow`) rebuilt as a 4-step progressive
  walkthrough with hero + conversational copy.

### Known open items (see `.lovable/plan.md`)
- Anonymous / magic-link voting for share-link recipients.
- Evidence-backed regression pass across all three onboarding paths + 500-home
  scale check.
- CC&R upload accuracy end-to-end against a real HOA PDF.
- Empty-state deadends on `/documents` and `/decisions`.
- Pricing/checkout, ToS/Privacy, account deletion path.