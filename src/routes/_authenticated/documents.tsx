import { useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, Loader2, Sparkles, Trash2, Upload, X } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { DocStatusBadge } from "@/components/documents/DocStatusBadge";
import { listCommunities } from "@/lib/community/api";
import {
  DOC_STATUS,
  DOC_TYPES,
  applyClassification,
  deleteDocument,
  docTypeLabel,
  formatBytes,
  listDocuments,
  rejectDocument,
  signedUrl,
  updateDocument,
  uploadDocument,
  verifyDocument,
  type DocStatus,
  type DocType,
  type Document,
} from "@/lib/documents/api";
import { classifyDocument } from "@/lib/documents/classify.functions";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [{ title: "Document Vault — RoadShare" }, { name: "robots", content: "noindex" }] }),
  component: DocumentsPage,
  errorComponent: () => (
    <AppShell><div className="mx-auto max-w-md py-20 text-center text-muted-foreground">The document vault could not be loaded.</div></AppShell>
  ),
});

const STATUS_FILTERS: (DocStatus | "all")[] = ["all", "processing", "needs_review", "verified", "rejected"];

function DocumentsPage() {
  const qc = useQueryClient();
  const [communityId, setCommunityId] = useState<string>("");
  const [filter, setFilter] = useState<DocStatus | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const communities = useQuery({ queryKey: ["communities"], queryFn: listCommunities });
  const effectiveCommunity = communityId || communities.data?.[0]?.id || "";

  const docs = useQuery({
    queryKey: ["documents", effectiveCommunity],
    queryFn: () => listDocuments(effectiveCommunity),
    enabled: !!effectiveCommunity,
  });

  const classify = useServerFn(classifyDocument);

  const upload = useMutation({
    mutationFn: async ({ file, title }: { file: File; title: string }) => {
      const { document, textSample } = await uploadDocument(effectiveCommunity, file, title);
      qc.invalidateQueries({ queryKey: ["documents", effectiveCommunity] });
      try {
        const result = await classify({ data: { title: document.title, mimeType: document.mime_type ?? "", textSample } });
        await applyClassification(document.id, result);
      } catch {
        await updateDocument(document.id, effectiveCommunity, { status: "needs_review" });
      }
      return document;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["documents", effectiveCommunity] }); toast.success("Document uploaded & classified"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = docs.data ?? [];
  const filtered = filter === "all" ? list : list.filter((d) => d.status === filter);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: list.length };
    for (const d of list) c[d.status] = (c[d.status] ?? 0) + 1;
    return c;
  }, [list]);

  const open = list.find((d) => d.id === openId) ?? null;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Document Vault</h1>
            <p className="text-sm text-muted-foreground">Upload deeds, agreements, and amendments. AI suggests a type &amp; summary; you verify before it becomes fact.</p>
          </div>
          {(communities.data?.length ?? 0) > 0 && (
            <div className="w-56">
              <Label className="text-xs text-muted-foreground">Community</Label>
              <Select value={effectiveCommunity} onValueChange={setCommunityId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {communities.data!.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {communities.isLoading ? null : (communities.data?.length ?? 0) === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium">Create a community first</p>
            <p className="text-sm text-muted-foreground">Documents attach to a community record. Add one from the Community Record page.</p>
          </div>
        ) : (
          <>
            <UploadPanel onUpload={(file, title) => upload.mutate({ file, title })} busy={upload.isPending} />

            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s)}
                  className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${filter === s ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
                >
                  {s === "all" ? "All" : DOC_STATUS[s].label} {counts[s] ? <span className="opacity-60">· {counts[s]}</span> : null}
                </button>
              ))}
            </div>

            {docs.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading documents…</p>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
                No documents {filter !== "all" ? `in “${DOC_STATUS[filter].label}”` : "yet"}.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                <table className="w-full table-fixed text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2.5 font-semibold">Document</th>
                      <th className="w-36 px-4 py-2.5 font-semibold">Type</th>
                      <th className="w-32 px-4 py-2.5 font-semibold">Status</th>
                      <th className="w-20 px-4 py-2.5 font-semibold">Size</th>
                      <th className="w-24 px-4 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((d) => (
                      <tr key={d.id} className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-secondary/40" onClick={() => setOpenId(d.id)}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"><FileText className="h-4 w-4" /></span>
                            <div className="min-w-0">
                              <div className="truncate font-semibold">{d.title}</div>
                              {d.ai_summary && <div className="truncate text-xs text-muted-foreground">{d.ai_summary}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span>{docTypeLabel(d.doc_type)}</span>
                          {d.status !== "verified" && d.ai_suggested_type && (
                            <span className="mt-0.5 flex items-center gap-0.5 text-xs text-muted-foreground"><Sparkles className="h-3 w-3" /> {docTypeLabel(d.ai_suggested_type)}?</span>
                          )}
                        </td>
                        <td className="px-4 py-3"><DocStatusBadge value={d.status} /></td>
                        <td className="px-4 py-3 text-muted-foreground">{formatBytes(d.size_bytes)}</td>
                        <td className="px-4 py-3 text-right text-xs font-medium text-primary">Review →</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {open && <DetailPanel key={open.id} doc={open} onClose={() => setOpenId(null)} />}
        </SheetContent>
      </Sheet>
    </AppShell>
  );
}

function UploadPanel({ onUpload, busy }: { onUpload: (file: File, title: string) => void; busy: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [drag, setDrag] = useState(false);

  function pick(f: File | null) {
    if (!f) return;
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
  }

  return (
    <div
      className={`rounded-2xl border-2 border-dashed p-5 transition-colors ${drag ? "border-primary bg-primary/5" : "border-border bg-card"}`}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0] ?? null); }}
    >
      {!file ? (
        <button className="flex w-full flex-col items-center gap-2 py-6 text-center" onClick={() => inputRef.current?.click()}>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Upload className="h-5 w-5" /></span>
          <span className="font-semibold">Drop a file or click to upload</span>
          <span className="text-xs text-muted-foreground">PDF, images, or text — up to 25 MB</span>
        </button>
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="doc-title">Title</Label>
            <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Document title" />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><FileText className="h-3.5 w-3.5" /> {file.name} · {formatBytes(file.size)}
              <button className="ml-1 text-muted-foreground hover:text-destructive" onClick={() => { setFile(null); setTitle(""); }}><X className="h-3.5 w-3.5" /></button>
            </p>
          </div>
          <Button disabled={busy} onClick={() => { onUpload(file, title); setFile(null); setTitle(""); }}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Upload &amp; classify
          </Button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => pick(e.target.files?.[0] ?? null)}
      />
    </div>
  );
}

function DetailPanel({ doc, onClose }: { doc: Document; onClose: () => void }) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["documents", doc.community_id] });
  const [docType, setDocType] = useState<DocType>(doc.doc_type ?? doc.ai_suggested_type ?? "other");
  const [source, setSource] = useState(doc.source ?? "");
  const [effective, setEffective] = useState(doc.effective_date ?? "");
  const [notes, setNotes] = useState(doc.notes ?? "");

  const preview = useQuery({ queryKey: ["doc-url", doc.id], queryFn: () => signedUrl(doc.file_path) });
  const isImage = (doc.mime_type ?? "").startsWith("image/");
  const isPdf = (doc.mime_type ?? "") === "application/pdf";

  const saveMeta = useMutation({
    mutationFn: () => updateDocument(doc.id, doc.community_id, { source: source || null, effective_date: effective || null, notes: notes || null }),
    onSuccess: () => { invalidate(); toast.success("Details saved"); },
    onError: (e: Error) => toast.error(e.message),
  });
  const verify = useMutation({
    mutationFn: () => verifyDocument(doc.id, doc.community_id, docType),
    onSuccess: () => { invalidate(); toast.success("Document verified"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const reject = useMutation({
    mutationFn: () => rejectDocument(doc.id, doc.community_id),
    onSuccess: () => { invalidate(); toast.success("Document rejected"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: () => deleteDocument(doc),
    onSuccess: () => { invalidate(); toast.success("Document deleted"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5 pr-1">
      <div>
        <div className="flex items-center gap-2"><DocStatusBadge value={doc.status} /><span className="text-xs text-muted-foreground">{formatBytes(doc.size_bytes)}</span></div>
        <h2 className="mt-2 font-display text-xl font-bold leading-tight">{doc.title}</h2>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-secondary/30">
        {preview.isLoading ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading preview…</div>
        ) : preview.data && isImage ? (
          <img src={preview.data} alt={doc.title} className="max-h-80 w-full object-contain" />
        ) : preview.data && isPdf ? (
          <iframe src={preview.data} title={doc.title} className="h-96 w-full" />
        ) : (
          <div className="flex h-32 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-6 w-6" />
            {preview.data && <a href={preview.data} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">Open file in new tab</a>}
          </div>
        )}
      </div>

      {doc.ai_suggested_type && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Sparkles className="h-4 w-4" /> AI suggestion (not verified)</div>
          <p className="mt-2 text-sm"><span className="font-medium">Type:</span> {docTypeLabel(doc.ai_suggested_type)} <span className="text-muted-foreground">· {Math.round(Number(doc.ai_confidence ?? 0) * 100)}% confidence</span></p>
          {doc.ai_summary && <p className="mt-1 text-sm text-muted-foreground">{doc.ai_summary}</p>}
        </div>
      )}

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Verified document type</Label>
          <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{DOC_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="d-source">Source</Label><Input id="d-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="County recorder" onBlur={() => saveMeta.mutate()} /></div>
          <div className="space-y-1.5"><Label htmlFor="d-eff">Effective date</Label><Input id="d-eff" type="date" value={effective} onChange={(e) => setEffective(e.target.value)} onBlur={() => saveMeta.mutate()} /></div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="d-notes">Notes</Label><Textarea id="d-notes" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => saveMeta.mutate()} rows={2} /></div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button onClick={() => verify.mutate()} disabled={verify.isPending || doc.status === "verified"}>Verify as fact</Button>
        <Button variant="outline" onClick={() => reject.mutate()} disabled={reject.isPending || doc.status === "rejected"}>Reject</Button>
        <Button variant="ghost" className="ml-auto text-destructive hover:text-destructive" onClick={() => remove.mutate()} disabled={remove.isPending}><Trash2 className="h-4 w-4" /> Delete</Button>
      </div>
    </div>
  );
}
