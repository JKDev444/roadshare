import { FileUp, Pencil, Route as RouteIcon, Sparkles, Wand2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * A read-only, self-contained walkthrough of the new-user onboarding wizard.
 * It never touches the database or auth — purely for previewing the flow.
 */
export function OnboardingPreview({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
            <RouteIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-sm font-bold tracking-tight leading-none">RoadShare setup</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              First-run workspace builder
            </p>
          </div>
        </div>

        <DialogHeader>
          <DialogTitle className="font-display text-xl">One simple first step</DialogTitle>
          <DialogDescription>
            After sign-in, RoadShare helps you create the minimum useful workspace. Advanced tools wait until setup is saved.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-2">
          <div className="flex items-start gap-3 rounded-xl border-2 border-primary/40 bg-primary/5 p-3">
            <Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="text-xs">
              <p className="font-semibold">Upload CCR or plat PDF</p>
              <p className="mt-0.5 text-muted-foreground">AI drafts lots, roads, and maintenance rules for review.</p>
              <span className="mt-2 inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
                <FileUp className="h-3 w-3" /> Real upload appears after sign-in
              </span>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-border p-3">
            <Pencil className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="text-xs">
              <p className="font-semibold">Or type the basics</p>
              <p className="mt-0.5 text-muted-foreground">Community name first. Lots and roads can be refined later.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Or create a sample workspace to explore without entering your own data.
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Got it</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}