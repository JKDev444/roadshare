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

## Phase 4 — Community Record & GIS Editor 🔵
- Tables: communities, properties/parcels, organizations, assets, access points, evidence/provenance — each with source, confidence, verification status, effective date, change history (§2.1).
- Community Record tabs (§8): overview, property layer, org layer, asset layer, provenance.
- Road geometry editor (§9.2): import/draw/split/merge centerlines, correct private-road geometry.

## Phase 5 — Production Project Planner 🔵
- Real projects: costs, contractor bids, named scenarios, funding options, reserves (§9).
- Full allocation engine (§2.5): segment benefit, equal, distance, frontage, base-plus-use, custom, document-defined; one/multiple/assigned/weighted entrances.
- Scenario comparison (§9.6), versioning, shareable evidence packages (§2.8).

## Phase 6 — Document Vault 🔵🟣
- Upload + storage, OCR abstraction, classification, in-app viewer, metadata, permissions (§10).
- Human review workflow states (§10.4), AI outputs stored separately from verified facts.

## Phase 7 — Amendment & Clause Graph 🔵🟣
- Clause extraction + taxonomy (§10.3), effective-date lineage, supersession, conflict + missing-document detection (§2.2, §10.5), human-readable document timeline.

## Phase 8 — Ask My Community (Cited Q&A) 🔵🟣
- Evidence-first answer engine (§2.3, §11): required answer structure with citations, confidence, abstention, high-risk routing (§11.3), professional-escalation packages, answer history. Uses Lovable AI Gateway.

## Phase 9 — Community Pulse 🔵
- Survey builder, household-verified participation, scenario-specific feedback (§12.1).
- Analysis outputs (§12.2) with strict privacy prohibitions (§12.3): no individual scoring/profiling, no sub-threshold subgroup analysis.

## Phase 10 — Decision Rooms 🔵
- Decision workflow + states (§13.1–13.2), evidence assembly, vote/quorum/notice tracking, full audit trail (§13.3), versioned published explanations.

## Phase 11 — Professional Reports & Commerce 🔵🟣
- Report generator for the 8 report types (§4.3, §14), PDF generation + delivery.
- Stripe: subscription plans, credits, usage metering (§16), billing UI.

## Phase 12 — Portfolio & Enterprise 🔵🟣
- Multi-community dashboards, templates, SSO, audit exports, white-label reports, public API + embeddable widgets (§4.4).

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
