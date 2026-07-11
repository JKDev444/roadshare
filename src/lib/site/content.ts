// Typed content model driving RoadShare's public marketing pages.
// Sample-data first; every entity is production-replaceable without route changes.

export interface NavItem {
  label: string;
  to: string;
}

export const PRIMARY_NAV: NavItem[] = [
  { label: "Product", to: "/product" },
  { label: "Solutions", to: "/solutions/private-road-communities" },
  { label: "Tools", to: "/tools" },
  { label: "Pricing", to: "/pricing" },
  { label: "Company", to: "/about" },
];

export type ProductStatus = "live" | "preview" | "planned";

export interface Product {
  slug: string;
  name: string;
  tagline: string;
  summary: string;
  eyebrow: string;
  features: { title: string; body: string }[];
  status: ProductStatus;
}

export const PRODUCTS: Product[] = [
  {
    slug: "road-project-planning",
    name: "Road Project Planning",
    eyebrow: "The wedge",
    tagline: "Plan private-road and shared-asset projects on a real map.",
    summary:
      "Select project scope on the parcel map, set surfaces and costs, and see fair per-household allocation update live.",
    features: [
      { title: "Map-first scope", body: "Choose the exact segments a project covers directly on the plat map." },
      { title: "Live cost flow", body: "Blended surface rates, road width, and funding horizon recalculate instantly." },
      { title: "Shareable scenarios", body: "Send a link that shows the map, assumptions, and methodology." },
    ],
    status: "live",
  },
  {
    slug: "allocation-methods",
    name: "Allocation Methods",
    eyebrow: "Fairness engine",
    tagline: "Compare distance, frontage, equal, and document-defined splits.",
    summary:
      "The Road Network Responsibility Engine calculates along-road — not straight-line — responsibility, with support for one or many entrances.",
    features: [
      { title: "Along-road distance", body: "Routes through junctions, not as the crow flies." },
      { title: "Many methodologies", body: "Distance, frontage, equal, base-plus-use, and custom schedules." },
      { title: "Entrance-aware", body: "Single, multiple, assigned, weighted, or nearest entrance." },
    ],
    status: "live",
  },
  {
    slug: "community-record",
    name: "Community Record",
    eyebrow: "Data foundation",
    tagline: "One canonical record for every community and road group.",
    summary:
      "Links properties, organizations, roads, access points, documents, and decisions — each fact tracked with source, confidence, and effective date.",
    features: [
      { title: "Property & road layers", body: "Parcels, access points, assigned entrances, and shared assets." },
      { title: "Provenance on every fact", body: "Source, confidence, verification status, and change history." },
      { title: "HOA & non-HOA", body: "Supports private-road groups and formal associations alike." },
    ],
    status: "planned",
  },
  {
    slug: "document-intelligence",
    name: "Document Intelligence",
    eyebrow: "Vault + graph",
    tagline: "Understand amendments, effective dates, and missing exhibits.",
    summary:
      "A Document Vault and amendment graph that knows when a clause was effective, what replaced it, and where a document is incomplete.",
    features: [
      { title: "Clause timeline", body: "Human-readable lineage across restatements and amendments." },
      { title: "Missing-document detection", body: "Flags referenced exhibits and amendments that aren't uploaded." },
      { title: "Verified vs. extracted", body: "AI output stays separate from human-verified facts." },
    ],
    status: "planned",
  },
  {
    slug: "ask-my-community",
    name: "Ask My Community",
    eyebrow: "Cited Q&A",
    tagline: "Answers grounded in your documents and maintained legal sources.",
    summary:
      "Every material answer cites the exact document, section, page, jurisdiction, and effective date — and abstains when the record is incomplete.",
    features: [
      { title: "Evidence-first", body: "Plain answer, citations, confidence, and next action every time." },
      { title: "Risk routing", body: "Sensitive topics route to professional review, not false certainty." },
      { title: "Community isolation", body: "Each community's data stays walled off from others." },
    ],
    status: "planned",
  },
  {
    slug: "community-pulse",
    name: "Community Pulse",
    eyebrow: "Resident input",
    tagline: "Feedback tied to a specific project, scenario, or vote.",
    summary:
      "Surveys and issue analysis with strict privacy protections — no individual scoring, profiling, or sub-threshold subgroup analysis.",
    features: [
      { title: "Scenario-specific", body: "Feedback attaches to the exact decision it concerns." },
      { title: "Consensus & concerns", body: "Support, participation, top concerns, and change over time." },
      { title: "Privacy by design", body: "No troublemaker labels, no protected-characteristic inference." },
    ],
    status: "planned",
  },
  {
    slug: "decision-rooms",
    name: "Decision Rooms",
    eyebrow: "Governance",
    tagline: "Turn a problem into a defensible, documented decision.",
    summary:
      "Assemble scope, scenarios, clauses, bids, and feedback; track notice, quorum, and votes; publish a versioned explanation.",
    features: [
      { title: "Evidence assembly", body: "Everything that informed the decision in one place." },
      { title: "Full audit trail", body: "Who changed what, when, and why — never overwritten." },
      { title: "Versioned explanations", body: "A permanent record for future boards and buyers." },
    ],
    status: "planned",
  },
  {
    slug: "reports",
    name: "Professional Reports",
    eyebrow: "Deliverables",
    tagline: "Board-ready reports for owners, agents, title, lenders, and counsel.",
    summary:
      "Generate structured, cited reports — from project plans to road-agreement readiness scans and buyer briefs.",
    features: [
      { title: "Eight report types", body: "Project, readiness, buyer brief, completeness, and more." },
      { title: "Locked & versioned", body: "Reports can be replaced without losing history." },
      { title: "Shareable packages", body: "Private or public explanation links." },
    ],
    status: "planned",
  },
  {
    slug: "community-lookup",
    name: "Community Lookup",
    eyebrow: "Discovery",
    tagline: "Match an address to its association and road group.",
    summary:
      "Address-to-community matching that improves as communities contribute corrections.",
    features: [
      { title: "Address matching", body: "Find the association and private-road agreement for a parcel." },
      { title: "Completeness signal", body: "See what documentation is known and what's missing." },
      { title: "Correction loop", body: "Community corrections improve lookup quality over time." },
    ],
    status: "planned",
  },
];

export interface Solution {
  slug: string;
  audience: string;
  headline: string;
  value: string;
  outcomes: string[];
}

export const SOLUTIONS: Solution[] = [
  {
    slug: "private-road-communities",
    audience: "Private-road communities",
    headline: "Organize neighbors around a fair, shared road plan.",
    value:
      "Map shared roads, compare fair allocation methods, gather neighbors, and build a maintenance plan everyone can see.",
    outcomes: ["Map the shared road network", "Compare allocation methods", "Rally neighbors with a shared link"],
  },
  {
    slug: "self-managed-hoa-boards",
    audience: "Self-managed HOA boards",
    headline: "Run projects and explain decisions with confidence.",
    value:
      "Organize documents, understand procedures, plan assessments, explain projects, and onboard new directors.",
    outcomes: ["Plan assessments transparently", "Onboard new directors fast", "Document defensible decisions"],
  },
  {
    slug: "homeowners",
    audience: "Homeowners",
    headline: "Understand what you owe and why.",
    value:
      "Understand obligations, ask cited questions, compare costs, participate in feedback, and review decisions.",
    outcomes: ["See your fair share", "Ask cited questions", "Weigh in on projects"],
  },
  {
    slug: "management-companies",
    audience: "Management companies",
    headline: "Standardize research and reporting across a portfolio.",
    value:
      "Standardize research, project planning, reports, board onboarding, and resident responses across every community.",
    outcomes: ["One workflow per portfolio", "Consistent board reporting", "Faster resident responses"],
  },
  {
    slug: "real-estate",
    audience: "Real estate professionals",
    headline: "Give buyers a clear community and road brief.",
    value: "Provide a buyer-facing community and private-road brief that answers questions before they become problems.",
    outcomes: ["Buyer-ready community brief", "Surface road obligations", "Reduce closing surprises"],
  },
  {
    slug: "title-companies",
    audience: "Title companies",
    headline: "Spot associations, agreements, and gaps early.",
    value: "Identify associations, road agreements, recording information, and missing documentation.",
    outcomes: ["Identify the association", "Locate road agreements", "Flag missing records"],
  },
  {
    slug: "lenders",
    audience: "Lenders",
    headline: "Check private-road agreements for expected language.",
    value:
      "Review whether a private-road agreement appears to contain expected responsibility and remedy language.",
    outcomes: ["Readiness scan", "Responsibility language check", "Remedy language check"],
  },
  {
    slug: "attorneys",
    audience: "Attorneys",
    headline: "Receive a structured evidence package.",
    value: "Receive a structured evidence package, clause timeline, questions, and scenario record.",
    outcomes: ["Clause timeline", "Structured evidence", "Open questions surfaced"],
  },
  {
    slug: "mediators",
    audience: "Mediators",
    headline: "See the disputed facts and the governing evidence.",
    value: "See the disputed facts, governing evidence, proposed options, and feedback history.",
    outcomes: ["Disputed facts mapped", "Governing evidence linked", "Options with feedback"],
  },
  {
    slug: "engineers-contractors",
    audience: "Engineers & contractors",
    headline: "Get exact segments, quantities, and assumptions.",
    value: "Receive exact project segments, quantities, assumptions, and normalized bid comparison.",
    outcomes: ["Exact segment quantities", "Clear assumptions", "Normalized bid comparison"],
  },
];

export interface FooterGroup {
  title: string;
  links: NavItem[];
}

export const FOOTER_GROUPS: FooterGroup[] = [
  {
    title: "Product",
    links: [
      { label: "Overview", to: "/product" },
      { label: "Road Project Planning", to: "/product/road-project-planning" },
      { label: "Allocation Methods", to: "/product/allocation-methods" },
      { label: "Community Record", to: "/product/community-record" },
      { label: "Document Intelligence", to: "/product/document-intelligence" },
    ],
  },
  {
    title: "Solutions",
    links: [
      { label: "Private-road communities", to: "/solutions/private-road-communities" },
      { label: "HOA boards", to: "/solutions/self-managed-hoa-boards" },
      { label: "Homeowners", to: "/solutions/homeowners" },
      { label: "Management companies", to: "/solutions/management-companies" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Tools", to: "/tools" },
      { label: "Cedar Hollow demo", to: "/tools/cedar-hollow" },
      { label: "Methodology", to: "/methodology" },
      { label: "Pricing", to: "/pricing" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Security", to: "/security" },
      { label: "Privacy", to: "/privacy" },
      { label: "Contact", to: "/contact" },
    ],
  },
];

export const SITE = {
  name: "RoadShare",
  tagline: "Community governance intelligence",
  description:
    "RoadShare connects the map, the properties, the documents, the law, the numbers, and the people — so community decisions are easier to understand and harder to dispute.",
  url: "https://roadshare.app",
};
