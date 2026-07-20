import type { Community, Parcel, RoadSegment, RecordEvent } from "@/lib/community/api";
import { pathLengthFt, toPoints } from "@/lib/community/api";
import { listCommunities, listParcels, listSegments, listEvents } from "@/lib/community/api";
import { listClauses, categoryLabel, CLAUSE_STATUS, type Clause } from "@/lib/clauses/api";
import { listDocuments, docTypeLabel, DOC_STATUS, type Document } from "@/lib/documents/api";
import { listSurveys, listResponses, parseQuestions, STATUS_LABEL as SURVEY_STATUS_LABEL, type Survey } from "@/lib/pulse/api";
import { listDecisions, STATUS_LABEL as DECISION_STATUS_LABEL, type Decision } from "@/lib/decisions/api";
import { listProjects, computeAllocations, listAllocations, ALLOCATION_METHODS, STATUS_LABEL as PROJECT_STATUS_LABEL, type Project } from "@/lib/planner/api";

export type ReportType =
  | "dossier"
  | "record"
  | "provisions"
  | "documents"
  | "pulse"
  | "decisions"
  | "projects";

export const REPORT_TYPES: { value: ReportType; label: string; blurb: string }[] = [
  { value: "dossier", label: "Full community backup", blurb: "Everything on record — one file to share with a professional or lender." },
  { value: "record", label: "Community summary", blurb: "Homes, roads, and the change history at a glance." },
  { value: "provisions", label: "Rules from your documents", blurb: "What the paperwork says, in order, by effective date." },
  { value: "documents", label: "Document list", blurb: "Every uploaded document with its type, status, and source." },
  { value: "pulse", label: "Survey results", blurb: "Privacy-preserving survey results and participation." },
  { value: "decisions", label: "Decision history", blurb: "Decisions, outcomes, and the explanation published to neighbors." },
  { value: "projects", label: "Project cost splits", blurb: "Projects with funding targets and each home's share." },
];

function esc(s: unknown): string {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
function money(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d.getTime()) ? esc(s) : d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export type ProjectBundle = { project: Project; result: ReturnType<typeof computeAllocations> };

export type ReportData = {
  community: Community;
  parcels: Parcel[];
  segments: RoadSegment[];
  events: RecordEvent[];
  clauses: Clause[];
  documents: Document[];
  surveys: { survey: Survey; responseCount: number; households: number }[];
  decisions: Decision[];
  projects: ProjectBundle[];
};

/** Assemble every record for a community. Only pulls what the report needs. */
export async function assembleReportData(communityId: string, type: ReportType): Promise<ReportData> {
  const community = (await listCommunities()).find((c) => c.id === communityId);
  if (!community) throw new Error("Community not found");

  const need = (t: ReportType) => type === "dossier" || type === t;
  const [parcels, segments] = await Promise.all([listParcels(communityId), listSegments(communityId)]);

  const events = need("record") ? await listEvents(communityId) : [];
  const clauses = need("provisions") ? await listClauses(communityId) : [];
  const documents = need("documents") ? await listDocuments(communityId) : [];

  let surveys: ReportData["surveys"] = [];
  if (need("pulse")) {
    const list = await listSurveys(communityId);
    surveys = await Promise.all(
      list.map(async (survey) => {
        const responses = await listResponses(survey.id);
        const households = new Set(responses.map((r) => r.household_label ?? r.id)).size;
        return { survey, responseCount: responses.length, households };
      }),
    );
  }

  const decisions = need("decisions") ? await listDecisions(communityId) : [];

  let projects: ProjectBundle[] = [];
  if (need("projects")) {
    const list = await listProjects(communityId);
    projects = await Promise.all(
      list.map(async (project) => {
        const allocations = await listAllocations(project.id);
        const result = computeAllocations(project, parcels, allocations);
        return { project, result };
      }),
    );
  }

  return { community, parcels, segments, events, clauses, documents, surveys, decisions, projects };
}

const STYLES = `
:root{color-scheme:light}
*{box-sizing:border-box}
body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;max-width:880px;margin:0 auto;padding:48px 28px;line-height:1.55}
header{border-bottom:2px solid #0f172a;padding-bottom:16px;margin-bottom:8px}
.pill{display:inline-block;background:#eef2ff;color:#4338ca;border-radius:999px;padding:3px 12px;font-size:12px;font-weight:600}
h1{font-size:28px;margin:10px 0 4px}
h2{font-size:17px;margin:34px 0 10px;border-bottom:1px solid #e2e8f0;padding-bottom:6px}
h3{font-size:14px;margin:20px 0 6px}
p{margin:6px 0}.muted{color:#64748b}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:12px}
.card{border:1px solid #e2e8f0;border-radius:12px;padding:12px}.card span{color:#64748b;font-size:12px}.card b{display:block;font-size:20px;margin-top:2px}
table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eef2f6;vertical-align:top}
th{font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#64748b}
.r{text-align:right}
.tag{display:inline-block;border-radius:6px;padding:1px 7px;font-size:11px;font-weight:600;background:#f1f5f9;color:#475569}
.tag.green{background:#dcfce7;color:#166534}.tag.amber{background:#fef3c7;color:#92400e}.tag.red{background:#fee2e2;color:#991b1b}.tag.blue{background:#dbeafe;color:#1e40af}
footer{margin-top:40px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8}
@media print{body{padding:0}h2{page-break-after:avoid}table{page-break-inside:auto}tr{page-break-inside:avoid}}
`;

function statusTag(label: string, tone: "green" | "amber" | "blue" | "red" | "default" = "default"): string {
  return `<span class="tag ${tone === "default" ? "" : tone}">${esc(label)}</span>`;
}

function sectionRecord(d: ReportData): string {
  const parcelRows = d.parcels
    .map(
      (p) => `<tr><td>${esc(p.label)}</td><td>${esc(p.owner_name ?? "—")}</td><td class="r">${p.area_sqft ? Number(p.area_sqft).toLocaleString() : "—"}</td><td class="r">${p.frontage_ft ? Number(p.frontage_ft).toLocaleString() : "—"}</td><td>${statusTag(esc(p.verification ?? "unverified"), p.verification === "verified" ? "green" : "amber")}</td></tr>`,
    )
    .join("");
  const segRows = d.segments
    .map(
      (s) => `<tr><td>${esc(s.name ?? "Segment")}</td><td>${esc(s.surface ?? "—")}</td><td>${esc(s.responsibility ?? "—")}</td><td class="r">${Math.round(pathLengthFt(toPoints(s.geometry))).toLocaleString()} ft</td></tr>`,
    )
    .join("");
  return `<h2>Community record</h2>
<div class="grid">
<div class="card"><span>Parcels</span><b>${d.parcels.length}</b></div>
<div class="card"><span>Road segments</span><b>${d.segments.length}</b></div>
<div class="card"><span>Verified parcels</span><b>${d.parcels.filter((p) => p.verification === "verified").length}</b></div>
</div>
<h3>Parcels</h3>
<table><thead><tr><th>Lot</th><th>Owner</th><th class="r">Area (sqft)</th><th class="r">Frontage (ft)</th><th>Status</th></tr></thead><tbody>${parcelRows || '<tr><td colspan="5" class="muted">No parcels recorded.</td></tr>'}</tbody></table>
<h3>Road geometry</h3>
<table><thead><tr><th>Segment</th><th>Surface</th><th>Responsibility</th><th class="r">Length</th></tr></thead><tbody>${segRows || '<tr><td colspan="4" class="muted">No road segments recorded.</td></tr>'}</tbody></table>
${d.events.length ? `<h3>Recent change history</h3><table><thead><tr><th>Date</th><th>Entity</th><th>Action</th></tr></thead><tbody>${d.events.slice(0, 20).map((e) => `<tr><td>${fmtDate(e.created_at)}</td><td>${esc(e.entity_label ?? e.entity_type)}</td><td>${esc(e.action)}</td></tr>`).join("")}</tbody></table>` : ""}`;
}

function sectionProvisions(d: ReportData): string {
  const rows = d.clauses
    .map((c) => {
      const st = CLAUSE_STATUS[c.status];
      return `<tr><td>${fmtDate(c.effective_date)}</td><td>${esc(c.title)}</td><td>${esc(categoryLabel(c.category))}</td><td>${statusTag(st.label, st.tone)}</td><td>${statusTag(esc(c.verification ?? "unverified"), c.verification === "verified" ? "green" : "amber")}</td></tr>`;
    })
    .join("");
  return `<h2>Governing provisions</h2>
<p class="muted">${d.clauses.length} clause${d.clauses.length === 1 ? "" : "s"} on record, ordered by effective date.</p>
<table><thead><tr><th>Effective</th><th>Title</th><th>Category</th><th>Status</th><th>Verification</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="muted">No clauses recorded.</td></tr>'}</tbody></table>`;
}

function sectionDocuments(d: ReportData): string {
  const rows = d.documents
    .map((doc) => {
      const st = DOC_STATUS[doc.status];
      return `<tr><td>${esc(doc.title ?? "Document")}</td><td>${esc(docTypeLabel(doc.doc_type))}</td><td>${statusTag(st.label, st.tone)}</td><td>${fmtDate(doc.effective_date)}</td><td>${esc(doc.source ?? "—")}</td></tr>`;
    })
    .join("");
  return `<h2>Document vault</h2>
<p class="muted">${d.documents.length} document${d.documents.length === 1 ? "" : "s"} on file.</p>
<table><thead><tr><th>Title</th><th>Type</th><th>Status</th><th>Effective</th><th>Source</th></tr></thead><tbody>${rows || '<tr><td colspan="5" class="muted">No documents on file.</td></tr>'}</tbody></table>`;
}

function sectionPulse(d: ReportData): string {
  const rows = d.surveys
    .map(
      (s) =>
        `<tr><td>${esc(s.survey.title)}</td><td>${statusTag(SURVEY_STATUS_LABEL[s.survey.status])}</td><td class="r">${parseQuestions(s.survey.questions).length}</td><td class="r">${s.households}</td></tr>`,
    )
    .join("");
  return `<h2>Community Pulse</h2>
<p class="muted">Aggregate participation only. Individual responses and open-text answers are never disclosed to protect households.</p>
<table><thead><tr><th>Survey</th><th>Status</th><th class="r">Questions</th><th class="r">Households</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">No surveys recorded.</td></tr>'}</tbody></table>`;
}

function sectionDecisions(d: ReportData): string {
  const rows = d.decisions
    .map(
      (dec) =>
        `<tr><td>${esc(dec.title)}</td><td>${statusTag(DECISION_STATUS_LABEL[dec.status], dec.status === "decided" ? "green" : dec.status === "withdrawn" ? "red" : "blue")}</td><td>${esc(dec.outcome ?? "—")}</td><td>${fmtDate(dec.notice_date)}</td></tr>`,
    )
    .join("");
  const published = d.decisions.filter((dec) => dec.rationale);
  const explanations = published
    .map((dec) => `<h3>${esc(dec.title)} <span class="muted">— explanation v${dec.rationale_version}</span></h3><p>${esc(dec.rationale)}</p>`)
    .join("");
  return `<h2>Decision record</h2>
<table><thead><tr><th>Decision</th><th>Status</th><th>Outcome</th><th>Notice date</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">No decisions recorded.</td></tr>'}</tbody></table>
${explanations ? `<h3 style="margin-top:24px">Published explanations</h3>${explanations}` : ""}`;
}

function sectionProjects(d: ReportData): string {
  return `<h2>Cost-share projects</h2>
${
    d.projects.length === 0
      ? '<p class="muted">No projects recorded.</p>'
      : d.projects
          .map(({ project, result }) => {
            const method = ALLOCATION_METHODS.find((m) => m.value === project.allocation_method);
            const alloc = result.rows
              .map(
                (r) =>
                  `<tr><td>${esc(r.parcel.label)}</td><td>${esc(r.parcel.owner_name ?? "—")}</td><td>${r.benefits ? "Yes" : "No"}</td><td class="r">${r.benefits ? money(r.amount) : "—"}</td><td class="r">${r.benefits ? (r.share * 100).toFixed(1) + "%" : "—"}</td></tr>`,
              )
              .join("");
            return `<h3>${esc(project.name)} <span class="muted">— ${esc(PROJECT_STATUS_LABEL[project.status])}</span></h3>
<div class="grid">
<div class="card"><span>Funding target</span><b>${money(result.target)}</b></div>
<div class="card"><span>Allocated</span><b>${money(result.allocated)}</b></div>
<div class="card"><span>Method</span><b style="font-size:15px">${esc(method?.label ?? project.allocation_method)}</b></div>
</div>
<table><thead><tr><th>Lot</th><th>Owner</th><th>Benefits</th><th class="r">Amount</th><th class="r">Share</th></tr></thead><tbody>${alloc || '<tr><td colspan="5" class="muted">No allocation yet.</td></tr>'}</tbody></table>`;
          })
          .join("")
  }`;
}

export function buildReportHtml(type: ReportType, d: ReportData): string {
  const meta = REPORT_TYPES.find((r) => r.value === type)!;
  const sections: string[] = [];
  const add = (t: ReportType, fn: (d: ReportData) => string) => {
    if (type === "dossier" || type === t) sections.push(fn(d));
  };
  add("record", sectionRecord);
  add("provisions", sectionProvisions);
  add("documents", sectionDocuments);
  add("projects", sectionProjects);
  add("pulse", sectionPulse);
  add("decisions", sectionDecisions);

  const generated = new Date().toLocaleString("en-US");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(d.community.name)} — ${esc(meta.label)}</title>
<style>${STYLES}</style></head><body>
<header>
<span class="pill">${esc(meta.label)}</span>
<h1>${esc(d.community.name)}</h1>
<p class="muted">${esc(d.community.region ?? "")}${d.community.description ? " · " + esc(d.community.description) : ""}</p>
</header>
${sections.join("\n")}
<footer>Generated ${esc(generated)} · RoadShare. This report reflects the records on file at generation time and is for community discussion — not a legal, financial, or engineering assessment.</footer>
</body></html>`;
}

export function downloadReport(filename: string, html: string) {
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function openReport(html: string) {
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}