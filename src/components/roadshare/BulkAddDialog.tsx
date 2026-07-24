import { useMemo, useState } from "react";
import { X, ClipboardList, FileSpreadsheet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Draft = { address: string; owner?: string; frontageFt?: number };

function parsePastedText(text: string): Draft[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 500)
    .map((address) => ({ address }));
}

function parseCsv(text: string): Draft[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return [];
  const header = lines[0].toLowerCase().split(",").map((s) => s.trim());
  const hasHeader = header.includes("address");
  const rows = hasHeader ? lines.slice(1) : lines;
  const idxAddr = hasHeader ? header.indexOf("address") : 0;
  const idxOwner = hasHeader
    ? header.findIndex((h) => h === "owner" || h === "owner_name" || h === "family")
    : -1;
  const idxFront = hasHeader
    ? header.findIndex((h) => h === "frontage" || h === "frontage_ft" || h === "ft")
    : -1;
  return rows
    .map((row) => {
      const cells = row.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const address = cells[idxAddr] ?? "";
      if (!address) return null;
      const draft: Draft = { address };
      if (idxOwner >= 0 && cells[idxOwner]) draft.owner = cells[idxOwner];
      if (idxFront >= 0 && cells[idxFront]) {
        const n = Number(cells[idxFront]);
        if (Number.isFinite(n) && n > 0) draft.frontageFt = n;
      }
      return draft;
    })
    .filter((d): d is Draft => !!d)
    .slice(0, 500);
}

export function BulkAddDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (drafts: Draft[]) => void;
}) {
  const [mode, setMode] = useState<"paste" | "csv">("paste");
  const [text, setText] = useState("");

  const drafts = useMemo(
    () => (mode === "paste" ? parsePastedText(text) : parseCsv(text)),
    [text, mode],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Add many homes at once</p>
            <h2 className="mt-0.5 font-display text-lg font-bold">Paste or upload — they land in the tray</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 border-b border-border p-3 sm:p-4">
          <button
            type="button"
            onClick={() => setMode("paste")}
            className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors ${
              mode === "paste" ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-accent"
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            <span>
              <span className="block font-semibold">Paste addresses</span>
              <span className="block text-[11px] text-muted-foreground">One per line</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMode("csv")}
            className={`flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-colors ${
              mode === "csv" ? "border-primary bg-primary/10" : "border-border bg-background hover:bg-accent"
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" />
            <span>
              <span className="block font-semibold">CSV rows</span>
              <span className="block text-[11px] text-muted-foreground">address, owner, frontage_ft</span>
            </span>
          </button>
        </div>

        <div className="p-4 sm:p-5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {mode === "paste" ? "One address per line" : "Paste CSV rows"}
          </Label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              mode === "paste"
                ? "101 Cedar Hollow Lane\n103 Cedar Hollow Lane\n105 Cedar Hollow Lane"
                : "address,owner,frontage_ft\n101 Cedar Hollow Lane,The Johnsons,72\n103 Cedar Hollow Lane,,68"
            }
            className="mt-1 h-40 w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
          />
          <p className="mt-2 text-[11px] text-muted-foreground">
            {drafts.length} {drafts.length === 1 ? "home" : "homes"} ready — they'll land in the tray so you can drag each onto a road.
          </p>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border p-4 sm:p-5">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={drafts.length === 0}
            onClick={() => {
              onAdd(drafts);
              setText("");
              onClose();
            }}
          >
            Add {drafts.length || ""} to tray
          </Button>
        </div>
      </div>
    </div>
  );
}