import { AlertTriangle, RotateCcw, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OnboardingJobRow } from "@/lib/onboarding/jobs.functions";

/** Post-processing failure screen (§7). Never shows raw provider errors. */
export function FailureStep({
  job,
  onRetry,
  onReplace,
  onContinueWithout,
  onSaveForLater,
}: {
  job: OnboardingJobRow;
  onRetry: () => void;
  onReplace: () => void;
  onContinueWithout: () => void;
  onSaveForLater: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold">We couldn't finish the review</h2>
          <p className="text-xs text-muted-foreground">Nothing has been saved. You can try again below.</p>
        </div>
      </div>

      <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
        <p className="font-medium">
          {job.filenames.length > 0 ? `File: ${job.filenames.join(", ")}` : "No files"}
        </p>
        <p className="mt-1 text-muted-foreground">
          {job.error_message ?? "The document couldn't be read. Try another file, or continue without documents."}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onSaveForLater}>Save document for later review</Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" onClick={onContinueWithout}>
            <X className="h-3.5 w-3.5" /> Continue without documents
          </Button>
          <Button variant="outline" size="sm" onClick={onReplace}>
            <Upload className="h-3.5 w-3.5" /> Replace file
          </Button>
          <Button size="sm" onClick={onRetry}>
            <RotateCcw className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
      </div>
    </div>
  );
}