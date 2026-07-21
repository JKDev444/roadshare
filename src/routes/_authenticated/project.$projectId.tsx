import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Download, FileText, GitCompare, Layers, Plus, Trash2, Wallet } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCommunity, listParcels } from "@/lib/community/api";
import {
  ALLOCATION_METHODS,
  computeAllocations,
  createLineItem,
  deleteLineItem,
  getProject,
  listAllocations,
  listLineItems,
  money,
  STATUS_LABEL,
  updateProject,
  upsertAllocation,
  listScenarios,
  saveScenario,
  deleteScenario,
  scenarioSummary,
  buildEvidenceHtml,
  downloadFile,
  type AllocationMethod,
  type ProjectInput,
  type ProjectStatus,
  type Scenario,
} from "@/lib/planner/api";

export const Route = createFileRoute("/_authenticated/project/$projectId")({
  head: () => ({ meta: [{ title: "Project planner — RoadShare" }, { name: "robots", content: "noindex" }] }),
  component: ProjectPlanner,
  errorComponent: () => (
    <AppShell><div className="mx-auto max-w-md py-20 text-center text-muted-foreground">This project could not be loaded.</div></AppShell>
  ),
  notFoundComponent: () => (
    <AppShell><div className="mx-auto max-w-md py-20 text-center text-muted-foreground">Project not found.</div></AppShell>
  ),
});

const STATUSES: ProjectStatus[] = ["planning", "bidding", "funded", "complete"];
const WEIGHTED: AllocationMethod[] = ["segment_benefit", "base_plus_use", "custom"];

function ProjectPlanner() {
  const { projectId } = Route.useParams();
  const qc = useQueryClient();

  const project = useQuery({ queryKey: ["project", projectId], queryFn: () => getProject(projectId) });
  const p = project.data;
  const communityId = p?.community_id;

  const community = useQuery({ queryKey: ["community", communityId], queryFn: () => getCommunity(communityId!), enabled: !!communityId });
  const parcels = useQuery({ queryKey: ["parcels", communityId], queryFn: () => listParcels(communityId!), enabled: !!communityId });
  const items = useQuery({ queryKey: ["line-items", projectId], queryFn: () => listLineItems(projectId) });
  const allocations = useQuery({ queryKey: ["allocations", projectId], queryFn: () => listAllocations(projectId) });

  const result = useMemo(() => {
    if (!p) return null;
    return computeAllocations(p, parcels.data ?? [], allocations.data ?? []);
  }, [p, parcels.data, allocations.data]);

  const saveProject = useMutation({
    mutationFn: (input: ProjectInput) => updateProject(projectId, communityId!, input, { silent: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["project", projectId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!p) {
    return <AppShell><div className="mx-auto max-w-6xl py-20 text-center text-muted-foreground">Loading…</div></AppShell>;
  }

  const lineTotal = (items.data ?? []).reduce((s, i) => s + Number(i.amount), 0);

  function exportCsv() {
    if (!result) return;
    const header = ["Parcel", "Owner", "Benefits", "Weight", "Amount", "Share %"];
    const lines = result.rows.map((r) => [
      r.parcel.label,
      r.parcel.owner_name ?? "",
      r.benefits ? "yes" : "no",
      String(r.weight),
      Math.round(r.amount).toString(),
      (r.share * 100).toFixed(1),
    ]);
    const csv = [header, ...lines].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${p!.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-allocations.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success("Allocation CSV exported");
  }

  function exportEvidence() {
    if (!result) return;
    const html = buildEvidenceHtml({
      communityName: community.data?.name ?? "Community",
      project: p!,
      lineItems: items.data ?? [],
      result,
    });
    downloadFile(`${p!.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-evidence.html`, html, "text/html");
    toast.success("Evidence package exported");
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div>
          <Link to="/community/$id" params={{ id: p.community_id }} search={{ tab: "home" }} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {community.data?.name ?? "Community"}
          </Link>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{p.name}</h1>
              {p.description && <p className="text-sm text-muted-foreground">{p.description}</p>}
            </div>
            <Select value={p.status} onValueChange={(v) => saveProject.mutate({ status: v as ProjectStatus })}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Funding target" value={money(result?.target ?? 0)} tone="primary" />
          <Stat label="Allocated" value={money(result?.allocated ?? 0)} />
          <Stat label="Line-item total" value={money(lineTotal)} />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
          <div className="space-y-6">
            <CostCard project={p} lineTotal={lineTotal} onSave={(i) => saveProject.mutate(i)} />
            <LineItemsCard projectId={projectId} />
            <MethodCard project={p} onSave={(i) => saveProject.mutate(i)} />
          </div>

          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold">Cost allocation</h3>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={exportCsv} disabled={!result || result.rows.length === 0}>
                  <Download className="h-4 w-4" /> CSV
                </Button>
                <Button size="sm" variant="outline" onClick={exportEvidence} disabled={!result || result.rows.length === 0}>
                  <FileText className="h-4 w-4" /> Evidence package
                </Button>
              </div>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{ALLOCATION_METHODS.find((m) => m.value === p.allocation_method)?.blurb}</p>
            <AllocationTable
              projectId={projectId}
              method={p.allocation_method}
              rows={result?.rows ?? []}
            />
            {result && (
              <ScenariosCard
                projectId={projectId}
                communityId={communityId!}
                project={p}
                result={result}
              />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "primary" }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone === "primary" ? "bg-primary/10 text-primary" : "bg-secondary text-secondary-foreground"}`}><Wallet className="h-4 w-4" /></span>
      <p className="mt-3 font-display text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function CostCard({ project, lineTotal, onSave }: { project: { total_cost: number; contingency_pct: number; reserve_target: number }; lineTotal: number; onSave: (i: ProjectInput) => void }) {
  const [total, setTotal] = useState(String(project.total_cost));
  const [cont, setCont] = useState(String(project.contingency_pct));
  const [reserve, setReserve] = useState(String(project.reserve_target));

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-display text-base font-semibold">Costs &amp; funding</h3>
      <div className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="p-total">Total cost ($)</Label>
            {lineTotal > 0 && <button className="text-xs font-medium text-primary hover:underline" onClick={() => { setTotal(String(lineTotal)); onSave({ total_cost: lineTotal }); }}>Use line items ({money(lineTotal)})</button>}
          </div>
          <Input id="p-total" type="number" value={total} onChange={(e) => setTotal(e.target.value)} onBlur={() => onSave({ total_cost: Number(total) || 0 })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="p-cont">Contingency (%)</Label><Input id="p-cont" type="number" value={cont} onChange={(e) => setCont(e.target.value)} onBlur={() => onSave({ contingency_pct: Number(cont) || 0 })} /></div>
          <div className="space-y-1.5"><Label htmlFor="p-reserve">Reserve ($)</Label><Input id="p-reserve" type="number" value={reserve} onChange={(e) => setReserve(e.target.value)} onBlur={() => onSave({ reserve_target: Number(reserve) || 0 })} /></div>
        </div>
      </div>
    </div>
  );
}

function LineItemsCard({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { data: items } = useQuery({ queryKey: ["line-items", projectId], queryFn: () => listLineItems(projectId) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["line-items", projectId] });
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");

  const add = useMutation({
    mutationFn: () => createLineItem(projectId, { label: label.trim(), amount: Number(amount) || 0 }),
    onSuccess: () => { invalidate(); setLabel(""); setAmount(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({ mutationFn: (lid: string) => deleteLineItem(lid), onSuccess: invalidate, onError: (e: Error) => toast.error(e.message) });

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-display text-base font-semibold">Cost breakdown &amp; bids</h3>
      <ul className="mt-4 space-y-2">
        {(items ?? []).map((i) => (
          <li key={i.id} className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm">
            <span className="font-medium">{i.label}</span>
            <span className="flex items-center gap-3">
              <span className="text-muted-foreground">{money(Number(i.amount))}</span>
              <button onClick={() => del.mutate(i.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
            </span>
          </li>
        ))}
        {(items ?? []).length === 0 && <li className="text-sm text-muted-foreground">No line items yet.</li>}
      </ul>
      <div className="mt-3 flex gap-2">
        <Input placeholder="Item (e.g. Paving bid)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <Input type="number" placeholder="$" className="w-28" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Button size="icon" aria-label="Add line item" onClick={() => add.mutate()} disabled={!label.trim() || add.isPending}><Plus className="h-4 w-4" /></Button>
      </div>
    </div>
  );
}

function MethodCard({ project, onSave }: { project: { allocation_method: AllocationMethod; base_amount: number; entrance_x: number | null; entrance_y: number | null }; onSave: (i: ProjectInput) => void }) {
  const [base, setBase] = useState(String(project.base_amount));
  const [ex, setEx] = useState(project.entrance_x != null ? String(project.entrance_x) : "50");
  const [ey, setEy] = useState(project.entrance_y != null ? String(project.entrance_y) : "92");
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <h3 className="font-display text-base font-semibold">Allocation method</h3>
      <div className="mt-4 space-y-4">
        <Select value={project.allocation_method} onValueChange={(v) => onSave({ allocation_method: v as AllocationMethod })}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{ALLOCATION_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
        </Select>
        {project.allocation_method === "base_plus_use" && (
          <div className="space-y-1.5"><Label htmlFor="p-base">Base amount per parcel ($)</Label><Input id="p-base" type="number" value={base} onChange={(e) => setBase(e.target.value)} onBlur={() => onSave({ base_amount: Number(base) || 0 })} /></div>
        )}
        {project.allocation_method === "distance" && (
          <div className="space-y-1.5">
            <Label>Entrance location (map units 0–100)</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input aria-label="Entrance X" type="number" value={ex} onChange={(e) => setEx(e.target.value)} onBlur={() => onSave({ entrance_x: Number(ex) || 0 })} placeholder="X" />
              <Input aria-label="Entrance Y" type="number" value={ey} onChange={(e) => setEy(e.target.value)} onBlur={() => onSave({ entrance_y: Number(ey) || 0 })} placeholder="Y" />
            </div>
            <p className="text-xs text-muted-foreground">Cost rises with distance from this point. Defaults to the bottom-center entrance.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function AllocationTable({ projectId, method, rows }: { projectId: string; method: AllocationMethod; rows: ReturnType<typeof computeAllocations>["rows"] }) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: ({ parcelId, input }: { parcelId: string; input: { weight?: number; override_amount?: number | null; benefits?: boolean } }) => upsertAllocation(projectId, parcelId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["allocations", projectId] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const showWeight = WEIGHTED.includes(method);
  const showOverride = method === "custom";

  if (rows.length === 0) return <p className="mt-6 text-sm text-muted-foreground">Add parcels to this community to allocate costs.</p>;

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2 font-semibold">Home</th>
            <th className="px-3 py-2 font-semibold">Benefits</th>
            {showWeight && <th className="px-3 py-2 font-semibold">Weight</th>}
            {showOverride && <th className="px-3 py-2 font-semibold">Override $</th>}
            <th className="px-3 py-2 text-right font-semibold">Amount</th>
            <th className="px-3 py-2 text-right font-semibold">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.parcel.id} className="border-b border-border/60 last:border-0">
              <td className="px-3 py-2">
                <div className="font-semibold">{r.parcel.label}</div>
                <div className="text-xs text-muted-foreground">{r.parcel.owner_name ?? "—"}</div>
              </td>
              <td className="px-3 py-2">
                <Switch checked={r.benefits} onCheckedChange={(v) => save.mutate({ parcelId: r.parcel.id, input: { benefits: v } })} />
              </td>
              {showWeight && (
                <td className="px-3 py-2">
                  <Input type="number" defaultValue={String(r.weight)} className="h-8 w-20" onBlur={(e) => save.mutate({ parcelId: r.parcel.id, input: { weight: Number(e.target.value) || 0 } })} />
                </td>
              )}
              {showOverride && (
                <td className="px-3 py-2">
                  <Input type="number" defaultValue={r.override != null ? String(r.override) : ""} placeholder="—" className="h-8 w-24" onBlur={(e) => save.mutate({ parcelId: r.parcel.id, input: { override_amount: e.target.value === "" ? null : Number(e.target.value) } })} />
                </td>
              )}
              <td className="px-3 py-2 text-right font-semibold">{r.benefits ? money(r.amount) : "—"}</td>
              <td className="px-3 py-2 text-right text-muted-foreground">{r.benefits ? `${(r.share * 100).toFixed(1)}%` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
function ScenariosCard({
  projectId,
  communityId,
  project,
  result,
}: {
  projectId: string;
  communityId: string;
  project: import("@/lib/planner/api").Project;
  result: ReturnType<typeof computeAllocations>;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [compare, setCompare] = useState<[string | null, string | null]>([null, null]);
  const { data: scenarios } = useQuery({ queryKey: ["scenarios", projectId], queryFn: () => listScenarios(projectId) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["scenarios", projectId] });

  const save = useMutation({
    mutationFn: () => saveScenario(communityId, projectId, name, project, result),
    onSuccess: () => { invalidate(); setName(""); toast.success("Scenario saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteScenario(id),
    onSuccess: () => { invalidate(); setCompare([null, null]); },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = scenarios ?? [];
  const [aId, bId] = compare;
  const a = list.find((s) => s.id === aId) ?? null;
  const b = list.find((s) => s.id === bId) ?? null;

  return (
    <div className="mt-6 rounded-xl border border-border bg-secondary/30 p-4">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-primary" />
        <h4 className="font-display text-sm font-semibold">Scenarios &amp; comparison</h4>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">Save the current setup as a named, versioned snapshot, then compare any two side by side.</p>

      <div className="mt-3 flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Scenario name (e.g. Frontage v2)" className="h-9" />
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}><Plus className="h-4 w-4" /> Save</Button>
      </div>

      {list.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">No saved scenarios yet.</p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {list.map((s) => (
            <li key={s.id} className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-medium text-muted-foreground">v{s.version}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{s.name}</span>
              <span className="text-xs text-muted-foreground">{money(scenarioSummary(s).allocated)}</span>
              <button
                className={`rounded px-1.5 py-0.5 text-xs font-medium ${aId === s.id ? "bg-primary text-primary-foreground" : "text-primary hover:underline"}`}
                onClick={() => setCompare([aId === s.id ? null : s.id, bId])}
              >A</button>
              <button
                className={`rounded px-1.5 py-0.5 text-xs font-medium ${bId === s.id ? "bg-primary text-primary-foreground" : "text-primary hover:underline"}`}
                onClick={() => setCompare([aId, bId === s.id ? null : s.id])}
              >B</button>
              <button aria-label="Delete scenario" className="text-muted-foreground hover:text-destructive" onClick={() => del.mutate(s.id)}><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      )}

      {a && b && <ScenarioCompare a={a} b={b} />}
    </div>
  );
}

function ScenarioCompare({ a, b }: { a: Scenario; b: Scenario }) {
  const sa = scenarioSummary(a);
  const sb = scenarioSummary(b);
  const parcels = new Map<string, { label: string; owner: string | null; a: number; b: number }>();
  for (const r of sa.rows) parcels.set(r.parcel_id, { label: r.label, owner: r.owner, a: r.benefits ? r.amount : 0, b: 0 });
  for (const r of sb.rows) {
    const e = parcels.get(r.parcel_id) ?? { label: r.label, owner: r.owner, a: 0, b: 0 };
    e.b = r.benefits ? r.amount : 0;
    parcels.set(r.parcel_id, e);
  }
  return (
    <div className="mt-4 rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <GitCompare className="h-4 w-4 text-primary" /> {a.name} (A) vs {b.name} (B)
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-2 py-1.5 font-semibold">Home</th>
              <th className="px-2 py-1.5 text-right font-semibold">A</th>
              <th className="px-2 py-1.5 text-right font-semibold">B</th>
              <th className="px-2 py-1.5 text-right font-semibold">Δ</th>
            </tr>
          </thead>
          <tbody>
            {[...parcels.values()].map((r, i) => {
              const d = r.b - r.a;
              return (
                <tr key={i} className="border-b border-border/60 last:border-0">
                  <td className="px-2 py-1.5"><span className="font-medium">{r.label}</span></td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground">{money(r.a)}</td>
                  <td className="px-2 py-1.5 text-right text-muted-foreground">{money(r.b)}</td>
                  <td className={`px-2 py-1.5 text-right font-semibold ${d > 0 ? "text-destructive" : d < 0 ? "text-primary" : "text-muted-foreground"}`}>{d > 0 ? "+" : ""}{money(d)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-semibold">
              <td className="px-2 py-1.5">Total</td>
              <td className="px-2 py-1.5 text-right">{money(sa.allocated)}</td>
              <td className="px-2 py-1.5 text-right">{money(sb.allocated)}</td>
              <td className="px-2 py-1.5 text-right">{money(sb.allocated - sa.allocated)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
