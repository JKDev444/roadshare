# RoadShare — Complete Phased Build Plan (All 16 Phases)

The blueprint defines a full commercial SaaS platform. Its own rule (§24) is: build in approved phases, sample Cedar Hollow data first, production-ready architecture throughout, no phase skipped without approval. This document lays out **every phase** end to end so you can approve the whole roadmap, then I build them in order (pausing for a quick go/no-go at each backend milestone).

Legend: 🟢 frontend-only · 🔵 needs Lovable Cloud (DB/auth/storage) · 🟣 needs paid integrations (Stripe, AI, data APIs)

---

## Phase 0 — Discovery & Architecture 🟢
Foundation everything else reuses.
- Design system in `src/styles.css`: Fortune-500 palette, editorial type scale, layered surfaces, cadastral/topographic motifs, the blueprint's motion durations (§6.3) as reusable tokens.
- Shared shell: premium sticky nav (Product, Solutions, Tools, Resources, Pricing, Company, Sign In, "Build a Free Scenario") + mega-footer.
- Typed content model (`src/lib/site/content.ts`) driving product/solution pages so 20+ pages share polished templates.
- Route + data-model map documented for later phases (no premature tables).

## Phase 1 — Premium Public Website 🟢
The marketing ecosystem (§5).
- Routes: `/product` + 9 product sub-pages, `/solutions/:audience` (10 audiences from §3), `/pricing`, `/about`, `/methodology`, `/security`, `/privacy`, `/contact`, `/tools`.
- Each route: own `head()` (title, description, OG, Twitter), semantic HTML, single H1, JSON-LD.
- Content-driven templates so all solution/product pages are consistent and expandable.

## Phase 2 — Public Cedar Hollow Flagship 🟢
- Homepage scroll-driven story (§6.2): hero road network → disagreement scene → parcel selection → live allocation numbers → clause reveal → Pulse themes → Decision Room → report reveal → trust grid → CTA.
- Move current planner to `/tools/cedar-hollow`, keep the engine, wrap in shell with methodology explainer + mocked "share scenario" + lead capture.
- SEO foundation: `robots.txt`, XML sitemap route, breadcrumb + SoftwareApplication schema.

## Phase 3 — Authentication & Application Shell 🔵 ✅ DONE
First backend phase — Lovable Cloud enabled.
- ✅ Email/password + Google sign-in (`/auth`, `/auth/callback`), leaked-password protection on.
- ✅ `profiles` + separate `user_roles` table with `has_role()` security-definer; RLS + GRANTs on all tables.
- ✅ Auto profile + `member` role on signup (trigger). Session-aware public header, sign-out hygiene.
- ✅ `_authenticated` app shell with sidebar, dashboard widgets, working Settings (profile editing).
- ✅ Phase 4/6/10 sections stubbed as in-app "coming soon" so nav is complete.
- Deferred to later phases: onboarding/community-creation wizard, portfolio switcher, team invitations.

## Phase 4 — Community Record & GIS Editor 🔵 ✅ DONE (authed E2E passed)
- ✅ Tables: communities, parcels, road_segments, record_events — each with source, confidence, verification status, effective date; append-only change history. Owner-scoped RLS + GRANTs.
- ✅ Community Record tabs: Overview (stats + plat preview + activity), Property layer (table + add/edit/delete with data-quality fields), Road geometry (GIS editor), Provenance (change-history timeline).
- ✅ Road geometry editor: draw multi-point centerlines, drag vertices, remove points, delete segments, drag parcels to reposition, per-segment surface/responsibility/confidence/verification editing, live length in ft.
- ✅ Sample "Cedar Hollow" seeding, Miro-style design throughout.
- ✅ Auto-confirm signups enabled; GeoJSON export of road geometry; in-editor onboarding walkthrough.
- ✅ Authenticated Playwright pass verified: signup → seed Cedar Hollow → add/edit parcels → draw/edit segments (persist across reload) → provenance logging → GeoJSON export.

## Phase 5 — Production Project Planner 🔵 ✅ DONE (authed E2E passed)
- ✅ Projects tied to communities: costs, contingency, reserves, cost breakdown / contractor bids, status (planning/bidding/funded/complete).
- ✅ Allocation engine (§2.5): equal, frontage, area, benefit weight, base-plus-use, custom weights + per-parcel overrides and benefit toggles. Live per-parcel amounts + shares. Allocation CSV export.
- ✅ Authenticated E2E verified: create project → set costs/line items → switch method → allocations compute & persist → CSV export.
- ✅ Distance-from-entrance allocation method with configurable entrance point.
- ✅ Named, versioned scenarios (auto-incrementing versions) with side-by-side A/B comparison showing per-parcel deltas.
- ✅ Shareable evidence package (§2.8): downloadable HTML report with method/assumptions, cost breakdown, and per-parcel allocation.
- ✅ Authenticated E2E re-verified: distance method computes per-parcel amounts, two scenarios saved & compared, evidence package exported.

## Phase 6 — Document Vault 🔵🟣 ✅ DONE (authed E2E passed)
- ✅ Upload to private storage (owner-scoped storage RLS), in-app viewer (image/PDF/text + open-in-tab), metadata (source, effective date, notes), owner-scoped permissions.
- ✅ AI classification via Lovable AI Gateway (suggested type + summary + confidence) stored in separate `ai_*` columns — kept distinct from human-verified facts.
- ✅ Human review workflow (§10.4): processing → needs review → verified / rejected, with verify/reject/delete actions and provenance logging.
- ✅ Authenticated E2E verified: upload deed → AI classified as "deed" (100% conf, accurate summary) → needs review → verify as fact → appears under Verified filter.
- ⏳ Deferred: full OCR for scanned PDFs/images (currently extracts text from text files; hooks in place for an OCR provider in Phase 13 data-integration work).

## Phase 7 — Amendment & Clause Graph 🔵🟣
- ✅ `clauses` table (category taxonomy, status, effective date, supersession self-reference, source/confidence/verification, AI-suggestion columns kept separate from verified facts). Owner-scoped RLS + GRANTs.
- ✅ Clause Graph page: effective-date timeline, category filter, add/edit/verify/delete, supersession lineage (creating a superseding clause auto-marks the older one superseded).
- ✅ AI clause extraction from document text via Lovable AI Gateway (suggested category + summary + confidence → stored as advisory, verify before fact).
- ✅ Conflict detection (multiple active clauses in one category with no supersession chain) and missing-provision detection (§2.2, §10.5).
- ✅ Miro-style design; nav entry added; authenticated render verified (auto-confirm signup → seed Cedar Hollow → Clause Graph shows missing-provisions insight + empty timeline).
- ⏳ Deferred: cross-document conflict scoring beyond same-category heuristic.

## Phase 8 — Ask My Community (Cited Q&A) 🔵🟣 ✅ DONE (authed E2E passed)
- ✅ `qa_answers` table (question, answer, confidence, abstained, high_risk + reason, citations JSON) with owner-scoped RLS + GRANTs and updated-at trigger.
- ✅ Evidence-first answer engine via Lovable AI Gateway: assembles ONLY the community's verified record (community, verified clauses/documents, verified parcels/roads) into numbered evidence; the model must cite every claim with [n] references.
- ✅ Confidence scoring (0–100%), honest abstention when evidence is insufficient (citations required or it abstains), and high-risk routing (legal/financial questions flagged with a professional-review recommendation).
- ✅ Saved answer history per community with citations, delete, suggested prompts, Cmd/Ctrl+Enter submit, and a "not legal advice" disclaimer. Nav entry added; Miro-style design.
- ✅ Authenticated E2E verified: signup → seed Cedar Hollow → ask "who maintains the main road?" → cited answer ("shared [9]") at 100% confidence with Citations section.
- ⏳ Deferred: downloadable professional-escalation package export (hooks in place; ties into Phase 11 report generation).

## Phase 9 — Community Pulse 🔵 ✅ DONE (authed E2E passed)
- ✅ `surveys` + `survey_responses` tables (inline jsonb questions, status draft/open/closed, per-survey privacy threshold, one response per household). Owner-scoped RLS + GRANTs; updated-at trigger.
- ✅ Survey builder (single/multi choice, 1–5 rating, open text), open/close lifecycle that locks questions once live to keep responses comparable.
- ✅ Household-verified participation: responses tie to verified parcels, one per household, with a participation roster (§12.1).
- ✅ Privacy-preserving analysis (§12.2, §12.3): aggregate-only results, NO individual scoring/profiling, open text never quoted, and full result suppression until the household threshold is met (prevents small-n re-identification).
- ✅ Miro-style design; nav entry added; authenticated E2E verified: signup → seed Cedar Hollow → create/open survey (threshold 3) → 1 response shows suppression notice → 3 responses reveal aggregate rating distribution (avg 4.00).
- ⏳ Deferred: scenario-linked surveys tied to specific planner scenarios (ties into Phase 11 reporting).

## Phase 10 — Decision Rooms 🔵 ✅ DONE (authed E2E passed)
- ✅ `decisions` + `decision_votes` tables (workflow status draft/discussion/voting/decided/withdrawn, ballot options, quorum, assembled evidence jsonb, notice date, recorded outcome, versioned published explanation). Owner-scoped RLS + GRANTs; updated-at trigger.
- ✅ Decision workflow tracker (§13.1): draft → discussion → voting → decided, with withdraw/reopen; options + quorum lock once voting starts to keep the ballot fair.
- ✅ Evidence assembly (§13.2): attach verified clauses/documents/scenarios/survey results/records as an auditable basis for the outcome.
- ✅ Vote/quorum/notice tracking: one vote per verified household, live tally with quorum gate, auto-stamped notice date when voting opens; outcome only recordable once quorum is met.
- ✅ Versioned published explanation (§13.3) and full audit trail — every state change and publish logged to the community record.
- ✅ Miro-style design; nav entry already present; authenticated E2E verified: signup → seed Cedar Hollow → create decision → advance to voting → two household Approve votes meet quorum 2 → record outcome "Approve" → publish explanation v1.

## Phase 11 — Professional Reports & Commerce 🔵🟣 ✅ REPORTS DONE (authed E2E passed)
- ✅ Report generator (`/reports`) covering 7 report types: full community dossier, community record summary, governing provisions, document vault index, Community Pulse, decision record, and cost-share projects.
- ✅ Each report assembles the community's live record into a polished, print-ready HTML document (browser Print → Save as PDF), with Download + Preview actions, community switcher, and privacy-preserving Pulse aggregation carried through.
- ✅ Authenticated E2E verified: signup → seed Cedar Hollow → generate dossier → renders parcels, road geometry, change history, and all sections with real data.
- ⏳ Deferred (needs Stripe): subscription plans, credits, usage metering (§16), billing UI — skipped per request to finish the app first.

## Phase 12 — Portfolio & Enterprise 🔵🟣 ✅ CORE DONE
- ✅ Multi-community Portfolio dashboard (`/portfolio`): portfolio-wide totals (communities, parcels, roads, documents, open decisions) + per-community metric cards (parcels, roads, documents, clauses, decisions, surveys) with verified-parcel percentage.
- ✅ Auditable per-community archive export: complete owner-scoped JSON archive (`roadshare.audit.v1`) covering every record table incl. project children via project_id, preserving append-only history — for backup, migration, or professional review.
- ✅ Nav entry added; owner-scoped via existing RLS (no new tables). Typecheck clean.
- ⏳ Deferred (need paid/enterprise services): SSO, white-label report theming, public API + embeddable widgets (§4.4).

## Phase 13 — Live Data Integrations 🟣
- Replace sample data: parcel/geocoding, road data, cost/bid normalization, OCR provider, legal-source maintenance (§13). Architecture from earlier phases swaps sources without rebuild.

## Phase 14 — SEO Content Engine 🟢🔵
- State-law hubs, county recorder guides, glossary, original research, case studies, sample reports (§4.1, §20), editorial/corrections workflow, sitemap index by content type.

## Phase 15 — Marketplace & Professional Network 🔵🟣
- Attorney review, engineering, mediation, title/lending partnerships; connects escalation packages to reviewers (§15).

---

## How we'll execute
1. Phases run in order. I build 0→2 immediately (all frontend, no accounts) since they need no approvals.
2. At Phase 3 I enable Lovable Cloud (accounts, database) — I'll confirm before flipping it on.
3. Phases 6–8, 11–13, 15 need paid services (AI Gateway, Stripe, data APIs) — I'll flag cost/keys before each.
4. Every phase: production-ready schema + RLS, sample Cedar Hollow data, responsive + accessible + error states, then a Playwright verification pass. I report what changed, what stays mocked, and what to review (§24.1).

## Guardrails baked in throughout
- Not a calculator, not a generic HOA dashboard, not a generic template (§25).
- RLS before production data; AI outputs separated from verified facts; explicit public/private visibility; history never overwritten (§17).
- Premium Framer/Webflow-quality motion, reduced-motion + mobile-lightened, Core Web Vitals protected (§6).

Approve this and I'll start building Phase 0–2 right away.
