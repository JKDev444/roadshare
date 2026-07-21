import { ArrowRight, CheckCircle2, HelpCircle, MinusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CcrDraft } from "@/lib/onboarding/ccrDraft";

type Row = { label: string; state: "found" | "missing" | "possible"; count?: number };

function rowsFor(draft: CcrDraft): Row[] {
  const m = draft.meta ?? {};
  return [
    { label: "Community name", state: m.community_found ? "found" : "missing" },
    { label: "Region", state: m.region_found ? "found" : "missing" },
    {
      label: `${m.lot_refs_found ?? draft.lots.length} homes`,
      state: (m.lot_refs_found ?? draft.lots.length) > 0 ? "found" : "missing",
    },
    {
      label: `${m.addresses_found ?? 0} street addresses`,
      state: (m.addresses_found ?? 0) > 0 ? "found" : "missing",
    },
    {
      label: `${m.roads_found ?? draft.roads.length} road names`,
      state: (m.roads_found ?? draft.roads.length) > 0 ? "found" : "missing",
    },
    { label: "Maintenance responsibility", state: m.maintenance_found ? "found" : "missing" },
    { label: "Cost-sharing formula", state: m.formula_found ? "possible" : "missing" },
    { label: "Property map", state: "missing" },
  ];
}

function unresolvedCount(draft: CcrDraft): number {
  const m = draft.meta ?? {};
  let n = 0;
  if (!m.community_found) n++;
  if ((m.addresses_found ?? 0) < (m.lot_refs_found ?? 0)) n++;
  if (m.formula_found) n++; // possible-match items need confirmation
  if ((m.missing_exhibits ?? []).length > 0) n++;
  return n;
}

/** Post-processing success screen (§7 + §9). */
export function SuccessSummaryStep({
  draft,
  filenames,
  onReviewImportant,
  onReviewAll,
  onUploadAnother,
  onSaveForLater,
}: {
  draft: CcrDraft;
  filenames: string[];
  onReviewImportant: () => void;
  onReviewAll: () => void;
  onUploadAnother: () => void;
  onSaveForLater: () => void;
}) {
  const rows = rowsFor(draft);
  const needsAttention = unresolvedCount(draft);
  const missingExhibits = draft.meta?.missing_exhibits ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold">Your document review is ready</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Processed {filenames.length} document{filenames.length === 1 ? "" : "s"}: {filenames.join(", ")}
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold">Here's what we found</p>
        <ul className="space-y-1.5">
          {rows.map((r) => (
            <li key={r.label} className="flex items-center gap-2 text-sm">
              {r.state === "found" ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
              ) : r.state === "possible" ? (
                <HelpCircle className="h-4 w-4 shrink-0 text-amber-500" />
              ) : (
                <MinusCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span className="flex-1">{r.label}</span>
              <span className="text-xs text-muted-foreground">
                {r.state === "found" ? "Found" : r.state === "possible" ? "Possible match" : "Not found"}
              </span>
            </li>
          ))}
          {missingExhibits.map((ex) => (
            <li key={ex} className="flex items-center gap-2 text-sm">
              <MinusCircle className="h-4 w-4 shrink-0 text-amber-500" />
              <span className="flex-1">{ex}</span>
              <span className="text-xs text-muted-foreground">Missing exhibit</span>
            </li>
          ))}
        </ul>
      </div>

      {needsAttention > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-foreground">
          <p className="font-medium">We need your help with {needsAttention} item{needsAttention === 1 ? "" : "s"}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Nothing has been finalized. You'll confirm each item before it's used.
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onSaveForLater}>Save and Return Later</Button>
          <Button variant="ghost" size="sm" onClick={onUploadAnother}>Upload Another Document</Button>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onReviewAll}>Review Everything</Button>
          <Button size="sm" onClick={needsAttention > 0 ? onReviewImportant : onReviewAll}>
            {needsAttention > 0 ? "Review Important Items" : "Review What We Found"}{" "}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}