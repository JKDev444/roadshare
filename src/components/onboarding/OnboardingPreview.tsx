import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardPaste,
  FileBarChart,
  Map as MapIcon,
  MessageSquare,
  PartyPopper,
  Route as RouteIcon,
  Scale,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Station = {
  icon: LucideIcon;
  title: string;
  hint: string;
  milestone: string;
  demo: string;
};

const STATIONS: Station[] = [
  {
    icon: Users,
    title: "Create your community",
    hint: "Pick the fastest starting point. Upload a CCR and AI drafts everything, or type it in.",
    milestone: "Community on the map",
    demo: "Upload CCR / plat PDF · Type it in · Load a sample",
  },
  {
    icon: Users,
    title: "Add the households",
    hint: "Who lives on this road? Parcels drive every fair-share calculation.",
    milestone: "First parcels logged",
    demo: "Paste a spreadsheet · Add one by one",
  },
  {
    icon: MapIcon,
    title: "Map the roads",
    hint: "Click two points and you've got a road. Assign who maintains what.",
    milestone: "Roads on paper",
    demo: "Open the map editor",
  },
  {
    icon: Scale,
    title: "Build a cost scenario",
    hint: "Compare distance, frontage, and equal splits — the numbers write themselves.",
    milestone: "Fair share calculated",
    demo: "Model a resurfacing, grading, or plow project",
  },
  {
    icon: MessageSquare,
    title: "Gather neighbor input",
    hint: "Run a quick survey or open a decision room. Every response is stamped and cited.",
    milestone: "Neighbors invited",
    demo: "Send a survey · Open a decision room",
  },
  {
    icon: FileBarChart,
    title: "Ship your first report",
    hint: "Board-ready. Cited. The kind lenders and county clerks quietly nod at.",
    milestone: "Report shipped",
    demo: "Generate a starter report",
  },
];

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
  const [step, setStep] = useState(0); // 0..STATIONS.length (last = finish)

  function reset() { setStep(0); }

  const isFinish = step >= STATIONS.length;
  const current = STATIONS[Math.min(step, STATIONS.length - 1)];
  const Icon = current.icon;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg">
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
            <RouteIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-sm font-bold tracking-tight leading-none">RoadShare tour</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isFinish ? "All 6 stations complete" : `Step ${step + 1} of ${STATIONS.length}`}
            </p>
          </div>
          <span className="ml-auto rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Preview
          </span>
          <span className="flex gap-1">
            {STATIONS.map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 w-4 rounded-full transition-colors",
                  i < step ? "bg-primary" : i === step && !isFinish ? "bg-primary/60" : "bg-muted",
                )}
              />
            ))}
          </span>
        </div>

        {!isFinish ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display text-xl">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                {current.title}
              </DialogTitle>
              <DialogDescription>{current.hint}</DialogDescription>
            </DialogHeader>

            {step === 0 ? (
              <div className="mt-2 space-y-2">
                <div className="flex items-start gap-3 rounded-xl border-2 border-primary/40 bg-primary/5 p-3">
                  <Wand2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="text-xs">
                    <p className="font-semibold">Upload my CCR or plat PDF <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">Fastest</span></p>
                    <p className="mt-0.5 text-muted-foreground">AI drafts your community, lots, and roads. You review before it saves.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border p-3">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="text-xs">
                    <p className="font-semibold">Type it in myself</p>
                    <p className="mt-0.5 text-muted-foreground">Name it, keep moving.</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Or take a 90-second tour of a finished sample community.
                </div>
              </div>
            ) : step === 1 ? (
              <div className="mt-2 space-y-2">
                <div className="flex items-start gap-3 rounded-xl border-2 border-primary/40 bg-primary/5 p-3 text-xs">
                  <ClipboardPaste className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="font-semibold">Paste a spreadsheet</p>
                    <p className="mt-0.5 text-muted-foreground">Copy owners & addresses. Bulk-added.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-border p-3 text-xs">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">Add them one by one</p>
                    <p className="mt-0.5 text-muted-foreground">Open the community page. The tour waits for you.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-2 rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
                {current.demo}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <Button variant="ghost" onClick={() => (step === 0 ? onOpenChange(false) : setStep((s) => s - 1))}>
                {step === 0 ? "Close" : (<><ArrowLeft className="h-4 w-4" /> Back</>)}
              </Button>
              <Button onClick={() => setStep((s) => s + 1)}>
                {step === STATIONS.length - 1 ? "See finish" : "Continue"} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display text-xl">
                <PartyPopper className="h-5 w-5 text-primary" />
                You did the whole thing 🎉
              </DialogTitle>
              <DialogDescription>
                In the real flow, each of these unlocks with a small confetti burst.
              </DialogDescription>
            </DialogHeader>
            <ol className="mt-2 space-y-2">
              {STATIONS.map((s) => (
                <li key={s.title} className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">{s.milestone}</span>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex items-center justify-between">
              <Button variant="ghost" onClick={() => setStep(STATIONS.length - 1)}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={() => { reset(); onOpenChange(false); }}>
                <CheckCircle2 className="h-4 w-4" /> Finish preview
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}