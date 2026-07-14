import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Sparkles, Upload, FileText, ArrowRight } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { extractCcr } from "@/lib/onboarding/extractCcr.functions";
import type { CcrDraft } from "@/lib/onboarding/extractCcr.functions";

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result ?? ""));
    fr.onerror = () => reject(new Error("Could not read file"));
    fr.readAsDataURL(file);
  });
}

/**
 * Upload → AI extract → review UI. The parent hands us `onApply(draft)`.
 * We never write to the DB ourselves.
 */
export function CcrImportStep({
  onApply,
  onCancel,
  applying,
}: {
  onApply: (draft: CcrDraft) => void | Promise<void>;
  onCancel: () => void;
  applying?: boolean;
}) {
  const extract = useServerFn(extractCcr);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<CcrDraft | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("PDF is over 10MB. Try a smaller export.");
      return;
    }
    if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please upload a PDF.");
      return;
    }
    setBusy(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await extract({ data: { filename: file.name, dataUrl } });
      if (!result.community.name && result.lots.length === 0) {
        toast.error("Couldn't read that PDF. Try another file or type it in manually.");
        return;
      }
      setDraft(result);
      toast.success("Draft ready — take a look below.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Extraction failed");
    } finally {
      setBusy(false);
    }
  }

  if (!draft) {
    return (
      <div className="space-y-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-8 text-center transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-sm font-medium">Reading your PDF…</p>
              <p className="text-xs text-muted-foreground">This takes ~20 seconds.</p>
            </>
          ) : (
            <>
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Upload className="h-5 w-5" />
              </span>
              <p className="text-sm font-semibold">Drop your CCR or plat PDF here</p>
              <p className="text-xs text-muted-foreground">
                I'll read it and draft your community, lots, and roads for you.
              </p>
            </>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Powered by Lovable AI
          </span>
          <button
            type="button"
            onClick={onCancel}
            className="text-xs underline-offset-4 hover:underline"
          >
            No PDF? Type it in instead
          </button>
        </div>
      </div>
    );
  }

  return <DraftReview draft={draft} onChange={setDraft} onApply={onApply} onCancel={() => setDraft(null)} applying={applying} />;
}

function DraftReview({
  draft,
  onChange,
  onApply,
  onCancel,
  applying,
}: {
  draft: CcrDraft;
  onChange: (d: CcrDraft) => void;
  onApply: (d: CcrDraft) => void | Promise<void>;
  onCancel: () => void;
  applying?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-xs text-primary">
        <FileText className="h-3.5 w-3.5" />
        <span>I read your CCR so you don't have to. Fix anything wrong, then apply.</span>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="d-name" className="text-xs">Community name</Label>
        <Input
          id="d-name"
          value={draft.community.name}
          onChange={(e) => onChange({ ...draft, community: { ...draft.community, name: e.target.value } })}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label htmlFor="d-region" className="text-xs">Region</Label>
          <Input
            id="d-region"
            value={draft.community.region ?? ""}
            onChange={(e) => onChange({ ...draft, community: { ...draft.community, region: e.target.value || null } })}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Assessment formula</Label>
          <Input
            value={draft.assessment_formula ?? ""}
            onChange={(e) => onChange({ ...draft, assessment_formula: e.target.value || null })}
            placeholder="e.g. 1/47th per lot"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="d-desc" className="text-xs">Description</Label>
        <Textarea
          id="d-desc"
          rows={2}
          value={draft.community.description ?? ""}
          onChange={(e) => onChange({ ...draft, community: { ...draft.community, description: e.target.value || null } })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 pt-1">
        <SummaryCard label="Lots found" value={draft.lots.length} />
        <SummaryCard label="Roads found" value={draft.roads.length} />
      </div>

      {draft.lots.length > 0 && (
        <details className="rounded-lg border border-border bg-background p-2 text-xs">
          <summary className="cursor-pointer select-none px-1 font-medium">
            Preview lots ({draft.lots.length})
          </summary>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto px-1">
            {draft.lots.slice(0, 60).map((l, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-muted-foreground">
                <span className="font-mono text-foreground">{l.label}</span>
                <span className="truncate">{l.owner_name ?? l.address ?? "—"}</span>
              </li>
            ))}
            {draft.lots.length > 60 && (
              <li className="text-center text-muted-foreground">+{draft.lots.length - 60} more</li>
            )}
          </ul>
        </details>
      )}

      {draft.roads.length > 0 && (
        <details className="rounded-lg border border-border bg-background p-2 text-xs">
          <summary className="cursor-pointer select-none px-1 font-medium">
            Preview roads ({draft.roads.length})
          </summary>
          <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto px-1">
            {draft.roads.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-2 text-muted-foreground">
                <span className="text-foreground">{r.name}</span>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">{r.responsibility}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {draft.maintenance_summary && (
        <p className="rounded-lg bg-muted/50 p-2 text-xs text-muted-foreground">
          <strong className="text-foreground">Who maintains what: </strong>
          {draft.maintenance_summary}
        </p>
      )}

      <div className="flex items-center justify-between pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={applying}>
          Try another file
        </Button>
        <Button size="sm" onClick={() => onApply(draft)} disabled={applying || !draft.community.name.trim()}>
          {applying && <Loader2 className="h-4 w-4 animate-spin" />}
          Looks right, create everything <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-xl font-semibold">{value}</p>
    </div>
  );
}