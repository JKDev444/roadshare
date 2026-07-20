import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AlertTriangle, FileWarning, Loader2, Plus, Scale, Sparkles, Trash2 } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { ConfidenceBadge, VerificationBadge } from "@/components/community/badges";
import { listCommunities } from "@/lib/community/api";
import { listDocuments } from "@/lib/documents/api";
import {
  CLAUSE_CATEGORIES,
  CLAUSE_STATUS,
  categoryLabel,
  createClause,
  deleteClause,
  detectConflicts,
  detectMissing,
  listClauses,
  updateClause,
  type Clause,
  type ClauseCategory,
  type ClauseInput,
  type ClauseStatus,
} from "@/lib/clauses/api";
import { extractClauses } from "@/lib/clauses/extract.functions";

export const Route = createFileRoute("/_authenticated/clauses")({
  head: () => ({ meta: [{ title: "Rules from your documents — RoadShare" }, { name: "robots", content: "noindex" }] }),
  component: ClausesPage,
  errorComponent: () => (
    <AppShell><div className="mx-auto max-w-md py-20 text-center text-muted-foreground">The clause graph could not be loaded.</div></AppShell>
  ),
});

const STATUS_TONE: Record<string, string> = {
  green: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  amber: "bg-gold/25 text-gold-foreground",
  blue: "bg-primary/10 text-primary",
  red: "bg-destructive/12 text-destructive",
};

function StatusBadge({ value }: { value: ClauseStatus }) {
  const s = CLAUSE_STATUS[value];
  return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", STATUS_TONE[s.tone])}>{s.label}</span>;
}

function fmtDate(d: string | null): string {
  if (!d) return "No date";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function ClausesPage() {
  const qc = useQueryClient();
  const [communityId, setCommunityId] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<ClauseCategory | "all">("all");
  const [editing, setEditing] = useState<Clause | "new" | null>(null);

  const communities = useQuery({ queryKey: ["communities"], queryFn: listCommunities });
  const cid = communityId || communities.data?.[0]?.id || "";

  const clausesQ = useQuery({ queryKey: ["clauses", cid], queryFn: () => listClauses(cid), enabled: !!cid });
  const docsQ = useQuery({ queryKey: ["documents", cid], queryFn: () => listDocuments(cid), enabled: !!cid });
  const extract = useServerFn(extractClauses);

  const clauses = clausesQ.data ?? [];
  const conflicts = useMemo(() => detectConflicts(clauses), [clauses]);
  const missing = useMemo(() => detectMissing(clauses), [clauses]);

  const filtered = categoryFilter === "all" ? clauses : clauses.filter((c) => c.category === categoryFilter);
  const conflictIds = useMemo(() => new Set(conflicts.flatMap((c) => c.clauses.map((x) => x.id))), [conflicts]);

  const extractMut = useMutation({
    mutationFn: async (docId: string) => {
      const doc = (docsQ.data ?? []).find((d) => d.id === docId);
      if (!doc) throw new Error("Document not found");
      if (!doc.extracted_text) throw new Error("No extracted text on this document. Upload a text-readable file.");
      const found = await extract({ data: { title: doc.title, text: doc.extracted_text } });
      if (found.length === 0) throw new Error("No clauses detected in this document.");
      for (const c of found) {
        await createClause(cid, {
          document_id: doc.id,
          title: c.title,
          clause_text: c.clause_text,
          category: c.category,
          status: "proposed",
          source: `Extracted from “${doc.title}”`,
          confidence: c.confidence >= 0.75 ? "high" : c.confidence >= 0.4 ? "medium" : "low",
          verification: "unverified",
          ai_suggested_category: c.category,
          ai_summary: c.summary,
          ai_confidence: c.confidence,
        });
      }
      return found.length;
    },
    onSuccess: (n) => { qc.invalidateQueries({ queryKey: ["clauses", cid] }); toast.success(`Extracted ${n} clause${n === 1 ? "" : "s"} — review & verify each.`); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Rules from your documents</h1>
            <p className="text-sm text-muted-foreground">The rules we found in your uploaded documents, in plain order — with conflicts and gaps flagged so nothing surprises you later.</p>
          </div>
          <div className="flex items-end gap-2">
            {(communities.data?.length ?? 0) > 0 && (
              <div className="w-52">
                <Label className="text-xs text-muted-foreground">Community</Label>
                <Select value={cid} onValueChange={setCommunityId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{communities.data!.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {cid && <Button onClick={() => setEditing("new")}><Plus className="h-4 w-4" /> Add clause</Button>}
          </div>
        </div>

        {communities.isLoading ? null : (communities.data?.length ?? 0) === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Scale className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium">Create a community first</p>
            <p className="text-sm text-muted-foreground">Clauses attach to a community record. Add one from the Community Record page.</p>
          </div>
        ) : (
          <>
            {/* Extract from document */}
            <ExtractRow docs={docsQ.data ?? []} busy={extractMut.isPending} onExtract={(id) => extractMut.mutate(id)} />

            {/* Insights */}
            {(conflicts.length > 0 || missing.length > 0) && (
              <div className="grid gap-3 sm:grid-cols-2">
                {conflicts.length > 0 && (
                  <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4">
                    <div className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="h-4 w-4" /> {conflicts.length} potential conflict{conflicts.length === 1 ? "" : "s"}</div>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {conflicts.map((c) => <li key={c.category}><span className="font-medium text-foreground">{categoryLabel(c.category)}:</span> {c.reason}</li>)}
                    </ul>
                  </div>
                )}
                {missing.length > 0 && (
                  <div className="rounded-2xl border border-gold/40 bg-gold/10 p-4">
                    <div className="flex items-center gap-2 font-semibold text-gold-foreground"><FileWarning className="h-4 w-4" /> Missing provisions</div>
                    <p className="mt-2 text-sm text-muted-foreground">No clause covers: {missing.map((m) => categoryLabel(m)).join(", ")}. Consider adding or locating these documents.</p>
                  </div>
                )}
              </div>
            )}

            {/* Category filter */}
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setCategoryFilter("all")} className={cn("rounded-full border px-3 py-1 text-sm font-medium transition-colors", categoryFilter === "all" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>All · {clauses.length}</button>
              {CLAUSE_CATEGORIES.filter((cat) => clauses.some((c) => c.category === cat.value)).map((cat) => (
                <button key={cat.value} onClick={() => setCategoryFilter(cat.value)} className={cn("rounded-full border px-3 py-1 text-sm font-medium transition-colors", categoryFilter === cat.value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground")}>{cat.label}</button>
              ))}
            </div>

            {/* Timeline */}
            {clausesQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading clauses…</p>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
                No clauses {categoryFilter !== "all" ? "in this category" : "yet"}. Add one manually or extract from a document above.
              </div>
            ) : (
              <ol className="relative space-y-4 border-l border-border pl-6">
                {filtered.map((c) => {
                  const flagged = conflictIds.has(c.id) && c.status === "active";
                  return (
                    <li key={c.id} className="relative">
                      <span className={cn("absolute -left-[27px] top-1.5 h-3 w-3 rounded-full ring-4 ring-background", c.status === "active" ? "bg-primary" : c.status === "proposed" ? "bg-muted-foreground" : "bg-border")} />
                      <button onClick={() => setEditing(c)} className={cn("w-full rounded-2xl border bg-card p-4 text-left transition-colors hover:border-primary/40", flagged ? "border-destructive/40" : "border-border")}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">{fmtDate(c.effective_date)}</span>
                          <StatusBadge value={c.status} />
                          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">{categoryLabel(c.category)}</span>
                          {flagged && <span className="inline-flex items-center gap-1 rounded-full bg-destructive/12 px-2 py-0.5 text-xs font-semibold text-destructive"><AlertTriangle className="h-3 w-3" /> Conflict</span>}
                        </div>
                        <div className="mt-1.5 font-semibold">{c.title}</div>
                        {c.clause_text && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.clause_text}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {c.supersedes_id && <span className="text-xs text-muted-foreground">Supersedes an earlier clause</span>}
                          {c.verification !== "verified" && <span className="text-xs text-muted-foreground">Needs a human check</span>}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ol>
            )}
          </>
        )}
      </div>

      <ClauseEditor
        open={editing !== null}
        clause={editing === "new" ? null : editing}
        communityId={cid}
        allClauses={clauses}
        docs={docsQ.data ?? []}
        onClose={() => setEditing(null)}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["clauses", cid] }); setEditing(null); }}
      />
    </AppShell>
  );
}

function ExtractRow({ docs, busy, onExtract }: { docs: { id: string; title: string; extracted_text: string | null }[]; busy: boolean; onExtract: (id: string) => void }) {
  const [docId, setDocId] = useState("");
  const usable = docs.filter((d) => (d.extracted_text ?? "").trim().length > 0);
  if (usable.length === 0) return null;
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex-1 space-y-1.5">
        <Label className="text-xs text-muted-foreground">Extract clauses from a document</Label>
        <Select value={docId} onValueChange={setDocId}>
          <SelectTrigger><SelectValue placeholder="Choose a document…" /></SelectTrigger>
          <SelectContent>{usable.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <Button disabled={!docId || busy} onClick={() => onExtract(docId)}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Extract clauses
      </Button>
    </div>
  );
}

function ClauseEditor({
  open, clause, communityId, allClauses, docs, onClose, onSaved,
}: {
  open: boolean;
  clause: Clause | null;
  communityId: string;
  allClauses: Clause[];
  docs: { id: string; title: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ClauseInput>({});
  const [seededId, setSeededId] = useState<string | "new" | null>(null);

  // Seed the form once per opened clause.
  const key = clause?.id ?? "new";
  if (open && seededId !== key) {
    setForm(
      clause
        ? {
            title: clause.title,
            clause_text: clause.clause_text,
            category: clause.category,
            status: clause.status,
            effective_date: clause.effective_date,
            document_id: clause.document_id,
            supersedes_id: clause.supersedes_id,
            source: clause.source,
            confidence: clause.confidence,
            verification: clause.verification,
          }
        : { category: "other", status: "active", confidence: "medium", verification: "unverified" },
    );
    setSeededId(key);
  }

  const save = useMutation({
    mutationFn: async () => {
      if (clause) return updateClause(clause.id, communityId, form);
      return createClause(communityId, form);
    },
    onSuccess: () => { toast.success(clause ? "Clause updated" : "Clause added"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const verify = useMutation({
    mutationFn: () => updateClause(clause!.id, communityId, { verification: "verified", status: clause!.status === "proposed" ? "active" : clause!.status }, "verified"),
    onSuccess: () => { toast.success("Clause verified as fact"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteClause(clause!),
    onSuccess: () => { toast.success("Clause removed"); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const supersedeOptions = allClauses.filter((c) => c.id !== clause?.id);

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) { onClose(); setSeededId(null); } }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{clause ? "Edit clause" : "Add clause"}</SheetTitle>
          <SheetDescription>Record a governing provision. AI suggestions stay separate until you verify them.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {clause?.ai_summary && clause.verification === "unverified" && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
              <div className="flex items-center gap-1.5 font-semibold text-primary"><Sparkles className="h-3.5 w-3.5" /> AI suggestion</div>
              <p className="mt-1 text-muted-foreground">{clause.ai_summary}</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={form.title ?? ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Shared maintenance cost split" />
          </div>
          <div className="space-y-1.5">
            <Label>Provision text</Label>
            <Textarea rows={5} value={form.clause_text ?? ""} onChange={(e) => setForm((f) => ({ ...f, clause_text: e.target.value }))} placeholder="Paste or type the exact provision…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={form.category ?? "other"} onValueChange={(v) => setForm((f) => ({ ...f, category: v as ClauseCategory }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{CLAUSE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status ?? "active"} onValueChange={(v) => setForm((f) => ({ ...f, status: v as ClauseStatus }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(CLAUSE_STATUS) as ClauseStatus[]).map((s) => <SelectItem key={s} value={s}>{CLAUSE_STATUS[s].label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Effective date</Label>
              <Input type="date" value={form.effective_date ?? ""} onChange={(e) => setForm((f) => ({ ...f, effective_date: e.target.value || null }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Source document</Label>
              <Select value={form.document_id ?? "none"} onValueChange={(v) => setForm((f) => ({ ...f, document_id: v === "none" ? null : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {docs.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Supersedes (earlier clause)</Label>
            <Select value={form.supersedes_id ?? "none"} onValueChange={(v) => setForm((f) => ({ ...f, supersedes_id: v === "none" ? null : v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {supersedeOptions.map((c) => <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Confidence</Label>
              <Select value={form.confidence ?? "medium"} onValueChange={(v) => setForm((f) => ({ ...f, confidence: v as Clause["confidence"] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Source note</Label>
              <Input value={form.source ?? ""} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} placeholder="e.g. 2019 amendment §3" />
            </div>
          </div>
        </div>

        <SheetFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <div className="flex gap-2">
            {clause && (
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => remove.mutate()} disabled={remove.isPending}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            {clause && clause.verification !== "verified" && (
              <Button variant="outline" onClick={() => verify.mutate()} disabled={verify.isPending}>Verify as fact</Button>
            )}
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}