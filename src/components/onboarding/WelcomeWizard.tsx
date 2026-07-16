import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  PartyPopper,
  Pencil,
  Route as RouteIcon,
  Sparkles,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CcrImportStep } from "./CcrImportStep";
import { Confetti } from "./Confetti";
import { useOnboarding } from "@/lib/onboarding/useOnboarding";
import { applyCcrDraft } from "@/lib/onboarding/api";
import { buildManualCcrDraft, type CcrDraft } from "@/lib/onboarding/ccrDraft";

type Path = "choose" | "upload" | "manual" | "sample";

const SAMPLE_DRAFT: CcrDraft = {
  community: {
    name: "Cedar Hollow Road Group",
    region: "Larimer County, CO",
    description: "12-lot private road community with a shared gravel lane and cul-de-sac.",
  },
  lots: Array.from({ length: 12 }).map((_, i) => ({
    label: `Lot ${i + 1}`,
    owner_name: null,
    address: null,
    area_sqft: null,
    frontage_ft: null,
  })),
  roads: [
    { name: "Cedar Hollow Lane", responsibility: "shared", surface: "gravel" },
    { name: "Aspen Court", responsibility: "shared", surface: "gravel" },
  ],
  maintenance_summary:
    "All 12 lot owners share the cost of grading and snow removal equally.",
  assessment_formula: "Equal 1/12 share per lot",
};

/** New-user setup gate. Opens automatically until the user has a community,
 *  or until they explicitly skip. Three focused steps: pick path → review → done. */
export function WelcomeWizard() {
  const { state, progress, update, isUpdating } = useOnboarding();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const hasCommunity = progress?.community ?? false;
  const skipped = state?.wizard_skipped ?? false;
  const completed = state?.wizard_completed ?? false;

  const shouldOpen = !!state && !hasCommunity && !skipped && !completed;
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const open = openOverride ?? shouldOpen;

  const [path, setPath] = useState<Path>("choose");
  const [applying, setApplying] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [finished, setFinished] = useState<{ name: string; id: string } | null>(null);

  function close(markSkip = false) {
    setOpenOverride(false);
    if (markSkip && !completed) update({ wizard_skipped: true });
    setTimeout(() => {
      setPath("choose");
      setFinished(null);
    }, 200);
  }

  async function handleApply(draft: CcrDraft) {
    if (applying) return;
    setApplying(true);
    try {
      const community = await applyCcrDraft(draft);
      await qc.invalidateQueries({ queryKey: ["onboarding", "progress"] });
      await qc.invalidateQueries({ queryKey: ["dashboard", "stats"] });
      update({ wizard_completed: true, wizard_skipped: false });
      setCelebrate(true);
      setFinished({ name: community.name, id: community.id });
      toast.success(`${community.name} is ready 🎉`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setApplying(false);
    }
  }

  const step = finished ? 3 : path === "choose" ? 1 : 2;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? setOpenOverride(true) : close(false))}>
      <DialogContent className="max-w-lg overflow-hidden">
        <Confetti show={celebrate} />
        <div className="mb-3 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
            <RouteIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="font-display text-sm font-bold leading-none tracking-tight">
              Set up your community
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {finished ? "You're all set" : `Step ${step} of 3`}
            </p>
          </div>
          <span className="ml-auto flex gap-1">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 w-6 rounded-full transition-colors",
                  i < step ? "bg-primary" : i === step ? "bg-primary/60" : "bg-muted",
                )}
              />
            ))}
          </span>
        </div>

        {finished ? (
          <FinishedView
            name={finished.name}
            onOpen={() => {
              close(false);
              void navigate({ to: "/community/$id", params: { id: finished.id }, search: { tab: "roads" } });
            }}
            onDashboard={() => close(false)}
          />
        ) : path === "choose" ? (
          <ChoosePath
            onPick={setPath}
            onSkip={() => close(true)}
          />
        ) : path === "upload" ? (
          <Section
            title="Upload your CCR or plat"
            hint="AI drafts your community, lots, and roads. You review everything before it saves."
            onBack={() => setPath("choose")}
          >
            <CcrImportStep
              onApply={handleApply}
              onCancel={() => setPath("choose")}
              applying={applying}
              autoOpen
            />
          </Section>
        ) : path === "sample" ? (
          <Section
            title="Use the Cedar Hollow sample"
            hint="A 12-lot private-road community with placeholder roads. Great for a quick spin — you can delete it later."
            onBack={() => setPath("choose")}
          >
            <SamplePreview />
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setPath("choose")} disabled={applying}>
                Back
              </Button>
              <Button size="sm" onClick={() => handleApply(SAMPLE_DRAFT)} disabled={applying}>
                {applying && <Loader2 className="h-4 w-4 animate-spin" />}
                Create sample community <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Section>
        ) : (
          <Section
            title="Type it in yourself"
            hint="Name your road group and (optionally) list your lots and roads. You can flesh things out later."
            onBack={() => setPath("choose")}
          >
            <ManualForm
              onSubmit={handleApply}
              onCancel={() => setPath("choose")}
              applying={applying || isUpdating}
            />
          </Section>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChoosePath({ onPick, onSkip }: { onPick: (p: Path) => void; onSkip: () => void }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-xl">Let's build your starter workspace</DialogTitle>
        <DialogDescription>
          Upload your CCR/plat if you have it. I’ll draft the lots and roads, then you approve before anything saves.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-3 space-y-2">
        <button
          type="button"
          onClick={() => onPick("upload")}
          className="flex w-full items-start gap-3 rounded-xl border-2 border-primary/40 bg-primary/5 p-3 text-left transition-colors hover:border-primary hover:bg-primary/10"
        >
          <Wand2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-semibold">
              Upload my CCR or plat PDF
              <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                Fastest
              </span>
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Best path: AI reads the document and builds a reviewable starter map and lot list.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onPick("manual")}
          className="flex w-full items-start gap-3 rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-primary/40"
        >
          <Pencil className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Type it in myself</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Use this if you do not have a CCR handy. Lots and roads can be added now or later.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onPick("sample")}
          className="flex w-full items-start gap-3 rounded-xl border border-dashed border-border p-3 text-left transition-colors hover:border-primary/40"
        >
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">Try the Cedar Hollow sample</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              A finished 12-lot workspace for exploring the app without entering your own data.
            </p>
          </div>
        </button>
      </div>

      <div className="mt-4 flex items-center justify-end">
        <Button variant="ghost" size="sm" onClick={onSkip}>
          I'll do this later
        </Button>
      </div>
    </>
  );
}

function Section({
  title,
  hint,
  onBack,
  children,
}: {
  title: string;
  hint: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-display text-xl">{title}</DialogTitle>
        <DialogDescription>{hint}</DialogDescription>
      </DialogHeader>
      <div className="mt-3">{children}</div>
      <div className="mt-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Choose a different way
        </Button>
      </div>
    </>
  );
}

function ManualForm({
  onSubmit,
  onCancel,
  applying,
}: {
  onSubmit: (draft: CcrDraft) => void | Promise<void>;
  onCancel: () => void;
  applying?: boolean;
}) {
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [description, setDescription] = useState("");
  const [lotText, setLotText] = useState("");
  const [roadText, setRoadText] = useState("");

  const canSubmit = name.trim().length > 1;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="m-name" className="text-xs">
          Community name <span className="text-destructive">*</span>
        </Label>
        <Input
          id="m-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Cedar Hollow Road Group"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="m-region" className="text-xs">Region (optional)</Label>
        <Input
          id="m-region"
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          placeholder="e.g. Larimer County, CO"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="m-desc" className="text-xs">One-line description (optional)</Label>
        <Textarea
          id="m-desc"
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="A quick sentence about your road group"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="m-lots" className="text-xs">Lots (optional)</Label>
          <Textarea
            id="m-lots"
            rows={3}
            value={lotText}
            onChange={(e) => setLotText(e.target.value)}
            placeholder={"One per line\nLot 1\nLot 2\nLot 3"}
          />
          <p className="text-[11px] text-muted-foreground">One label per line or comma-separated.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="m-roads" className="text-xs">Roads (optional)</Label>
          <Textarea
            id="m-roads"
            rows={3}
            value={roadText}
            onChange={(e) => setRoadText(e.target.value)}
            placeholder={"One per line\nCedar Hollow Ln\nAspen Ct"}
          />
          <p className="text-[11px] text-muted-foreground">You'll draw the actual paths in the map editor.</p>
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={applying}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!canSubmit || applying}
          onClick={() =>
            onSubmit(
              buildManualCcrDraft({ name, region, description, lotText, roadText }),
            )
          }
        >
          {applying && <Loader2 className="h-4 w-4 animate-spin" />}
          Create my community <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function SamplePreview() {
  const summary = useMemo(
    () => ({
      lots: SAMPLE_DRAFT.lots.length,
      roads: SAMPLE_DRAFT.roads.length,
    }),
    [],
  );
  return (
    <div className="space-y-2 text-xs">
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <p className="font-semibold text-foreground">{SAMPLE_DRAFT.community.name}</p>
        <p className="mt-0.5 text-muted-foreground">{SAMPLE_DRAFT.community.region}</p>
        <p className="mt-1 text-muted-foreground">{SAMPLE_DRAFT.community.description}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <SampleStat label="Lots" value={summary.lots} />
        <SampleStat label="Roads" value={summary.roads} />
      </div>
      <p className="rounded-lg bg-muted/50 p-2 text-muted-foreground">
        <strong className="text-foreground">Who maintains what: </strong>
        {SAMPLE_DRAFT.maintenance_summary}
      </p>
    </div>
  );
}

function SampleStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-xl font-semibold">{value}</p>
    </div>
  );
}

function FinishedView({
  name,
  onOpen,
  onDashboard,
}: {
  name: string;
  onOpen: () => void;
  onDashboard: () => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 font-display text-xl">
          <PartyPopper className="h-5 w-5 text-primary" />
          {name} is on the map 🎉
        </DialogTitle>
        <DialogDescription>
          Your starter workspace is ready. Next, review the imported roads and lots before building scenarios.
        </DialogDescription>
      </DialogHeader>
      <ul className="mt-3 space-y-2 text-sm">
        <NextItem title="Review the road map" note="Imported roads start as editable lines marked Needs review." />
        <NextItem title="Confirm the lot list" note="Check labels, addresses, and owners before cost calculations." />
        <NextItem title="Build a scenario later" note="Scenarios, neighbor input, and reports are next actions, not onboarding blockers." />
      </ul>
      <div className="mt-4 flex items-center justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDashboard}>
          Back to dashboard
        </Button>
        <Button size="sm" onClick={onOpen}>
          Open GIS review <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}

function NextItem({ title, note }: { title: string; note: string }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 p-3">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>
      </div>
    </li>
  );
}