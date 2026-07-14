import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardPaste,
  FileBarChart,
  Loader2,
  Map as MapIcon,
  MessageSquare,
  PartyPopper,
  Route as RouteIcon,
  Scale,
  Sparkles,
  Users,
  Wand2,
  X,
} from "lucide-react";

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
import { createCommunity, listCommunities, seedCedarHollow } from "@/lib/community/api";
import { applyCcrDraft, bulkCreateParcels } from "@/lib/onboarding/api";
import { parseParcelCsv } from "@/lib/onboarding/csvParcels";
import { useOnboarding } from "@/lib/onboarding/useOnboarding";
import type { ChecklistProgress } from "@/lib/onboarding/api";
import type { CcrDraft } from "@/lib/onboarding/extractCcr.functions";
import { cn } from "@/lib/utils";
import { CcrImportStep } from "./CcrImportStep";
import { Confetti } from "./Confetti";

const STATIONS = [
  { key: "community" as const, icon: Users, title: "Create your community", milestone: "Community on the map" },
  { key: "parcels" as const, icon: Users, title: "Add the households", milestone: "First parcels logged" },
  { key: "roads" as const, icon: MapIcon, title: "Map the roads", milestone: "Roads on paper" },
  { key: "scenario" as const, icon: Scale, title: "Build a cost scenario", milestone: "Fair share calculated" },
  { key: "input" as const, icon: MessageSquare, title: "Gather neighbor input", milestone: "Neighbors invited" },
  { key: "report" as const, icon: FileBarChart, title: "Ship a report", milestone: "Report shipped" },
];

const MIN_KEY = "roadshare-wizard-minimized";

export function WelcomeWizard() {
  const { state, progress, isLoading, updateAsync } = useOnboarding();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [minimized, setMinimized] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return sessionStorage.getItem(MIN_KEY) === "1";
  });
  const [closing, setClosing] = useState(false);
  const [celebrateFor, setCelebrateFor] = useState<string | null>(null);
  const lastCompleted = useRef(0);

  // Auto-celebrate every time the completed count ticks up.
  useEffect(() => {
    if (!progress) return;
    if (progress.completed > lastCompleted.current && lastCompleted.current > 0) {
      const done = STATIONS.find((s) => progress[s.key] && !prevKeyDone(progress, s.key));
      setCelebrateFor(done?.milestone ?? "Nice work!");
      setTimeout(() => setCelebrateFor(null), 2200);
    }
    lastCompleted.current = progress.completed;
  }, [progress]);

  const currentIdx = useMemo(() => {
    if (!progress) return 0;
    for (let i = 0; i < STATIONS.length; i++) {
      if (!progress[STATIONS[i].key]) return i;
    }
    return STATIONS.length; // all done
  }, [progress]);

  const allDone = progress ? progress.completed === progress.total : false;
  const dismissed = !state || state.wizard_completed || state.wizard_skipped;
  const showDialog = !closing && !isLoading && !dismissed && !minimized;

  function minimize() {
    sessionStorage.setItem(MIN_KEY, "1");
    setMinimized(true);
  }
  function restore() {
    sessionStorage.removeItem(MIN_KEY);
    setMinimized(false);
  }
  async function skipForever() {
    setClosing(true);
    await updateAsync({ wizard_skipped: true });
  }
  async function finish() {
    setClosing(true);
    await updateAsync({ wizard_completed: true });
    toast.success("🎉 Onboarding done. Welcome aboard.");
  }

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["communities"] });
    qc.invalidateQueries({ queryKey: ["onboarding", "progress"] });
    qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
  }

  return (
    <>
      <Dialog open={showDialog} onOpenChange={(v) => { if (!v) minimize(); }}>
        <DialogContent className="relative max-w-lg overflow-visible">
          <Confetti show={!!celebrateFor} />
          <WizardHeader currentIdx={currentIdx} onMinimize={minimize} onSkip={skipForever} />

          {celebrateFor && (
            <div className="mb-2 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-primary">
              <PartyPopper className="h-4 w-4" />
              <span className="font-medium">{celebrateFor}.</span>
              <span className="text-primary/70">
                {progress ? `${progress.completed} of ${progress.total} done.` : ""}
              </span>
            </div>
          )}

          {allDone ? (
            <FinishStation onFinish={finish} />
          ) : (
            <StationRenderer
              stationKey={STATIONS[currentIdx].key}
              progress={progress}
              onCommunityCreated={(cid) => {
                invalidate();
                toast.success("Community on the map ✨");
                navigate({ to: "/community/$id", params: { id: cid }, search: { tab: "overview" } });
                minimize();
              }}
              onCcrApplied={(cid) => {
                invalidate();
                toast.success("CCR imported — check what we drafted!");
                navigate({ to: "/community/$id", params: { id: cid }, search: { tab: "overview" } });
                minimize();
              }}
              onParcelsAdded={() => { invalidate(); }}
              onOpenPage={(to) => { minimize(); void navigate({ to } as never); }}
            />
          )}
        </DialogContent>
      </Dialog>

      {!dismissed && minimized && progress && (
        <button
          type="button"
          onClick={restore}
          className="fixed bottom-4 right-4 z-40 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg transition-transform hover:scale-105"
        >
          <Sparkles className="h-4 w-4" />
          Resume tour · {progress.completed}/{progress.total}
        </button>
      )}
    </>
  );
}

function prevKeyDone(p: ChecklistProgress, key: keyof ChecklistProgress): boolean {
  // Best-effort marker: we only need something truthy per key.
  return !!p[key];
}

function WizardHeader({
  currentIdx,
  onMinimize,
  onSkip,
}: {
  currentIdx: number;
  onMinimize: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
        <RouteIcon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="font-display text-sm font-bold tracking-tight leading-none">RoadShare tour</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Step {Math.min(currentIdx + 1, STATIONS.length)} of {STATIONS.length}
        </p>
      </div>
      <span className="ml-auto flex gap-1">
        {STATIONS.map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 w-4 rounded-full transition-colors",
              i < currentIdx ? "bg-primary" : i === currentIdx ? "bg-primary/60" : "bg-muted",
            )}
          />
        ))}
      </span>
      <button
        type="button"
        onClick={onMinimize}
        className="rounded-md p-1 text-muted-foreground hover:bg-muted"
        aria-label="Minimize tour"
        title="I'll come back later"
      >
        <X className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={onSkip}
        className="text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
        title="Skip onboarding for good"
      >
        Skip
      </button>
    </div>
  );
}

/* ---------- station renderers ---------- */

type StationCommon = {
  onCommunityCreated: (id: string) => void;
  onCcrApplied: (id: string) => void;
  onParcelsAdded: () => void;
  onOpenPage: (to: "/community" | "/map" | "/decisions" | "/reports" | "/portfolio") => void;
  progress?: ChecklistProgress;
};

function StationRenderer({ stationKey, ...rest }: StationCommon & { stationKey: (typeof STATIONS)[number]["key"] }) {
  switch (stationKey) {
    case "community": return <CommunityStation {...rest} />;
    case "parcels":   return <ParcelsStation {...rest} />;
    case "roads":     return <RoadsStation {...rest} />;
    case "scenario":  return <ScenarioStation {...rest} />;
    case "input":     return <InputStation {...rest} />;
    case "report":    return <ReportStation {...rest} />;
  }
}

function StationShell({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <DialogHeader className="mb-2">
        <DialogTitle className="font-display text-xl">{title}</DialogTitle>
        <DialogDescription>{hint}</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">{children}</div>
    </>
  );
}

/* --- 1. Community --- */

function CommunityStation({ onCommunityCreated, onCcrApplied }: StationCommon) {
  const [mode, setMode] = useState<"choice" | "ccr" | "form">("choice");
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: () =>
      createCommunity({ name: name.trim(), region: region.trim() || undefined, description: description.trim() || undefined }),
    onSuccess: (c) => onCommunityCreated(c.id),
    onError: (e: Error) => toast.error(e.message),
  });

  const seed = useMutation({
    mutationFn: seedCedarHollow,
    onSuccess: (c) => onCommunityCreated(c.id),
    onError: (e: Error) => toast.error(e.message),
  });

  const apply = useMutation({
    mutationFn: (d: CcrDraft) => applyCcrDraft(d),
    onSuccess: (c) => onCcrApplied(c.id),
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = create.isPending || seed.isPending || apply.isPending;

  if (mode === "ccr") {
    return (
      <StationShell
        title="Upload your CCR or plat"
        hint="I'll read it and draft your community, lots, and roads — you review before anything's saved."
      >
        <CcrImportStep
          onApply={async (d) => { await apply.mutateAsync(d); }}
          onCancel={() => setMode("choice")}
          applying={apply.isPending}
        />
      </StationShell>
    );
  }

  if (mode === "form") {
    return (
      <StationShell title="Name your community" hint="You can rename it anytime. Two seconds.">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="w-name">Community name</Label>
            <Input id="w-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cedar Hollow Road" autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="w-region">Region</Label>
              <Input id="w-region" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="County, State" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="w-desc">Short note</Label>
              <Input id="w-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <Button variant="ghost" size="sm" onClick={() => setMode("choice")} disabled={busy}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button size="sm" onClick={() => create.mutate()} disabled={busy || !name.trim()}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              Create it
            </Button>
          </div>
        </div>
      </StationShell>
    );
  }

  return (
    <StationShell
      title="Let's put your community on the map"
      hint="Pick the fastest starting point. You can always add more later."
    >
      <button
        type="button"
        onClick={() => setMode("ccr")}
        disabled={busy}
        className="flex w-full items-start gap-3 rounded-xl border-2 border-primary/40 bg-primary/5 p-4 text-left transition-colors hover:border-primary hover:bg-primary/10 disabled:opacity-60"
      >
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Wand2 className="h-4 w-4" />
        </span>
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            Upload my CCR or plat PDF
            <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">✨ Fastest</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            AI reads your document and drafts your community, lots, and roads. You review before it saves.
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => setMode("form")}
        disabled={busy}
        className="flex w-full items-start gap-3 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-primary/40 disabled:opacity-60"
      >
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Users className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">Type it in myself</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            No PDF handy? Just name your community and we'll walk you through the rest.
          </p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => seed.mutate()}
        disabled={busy}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-60"
      >
        {seed.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}
        Take a 90-second tour of a finished sample community (Cedar Hollow)
      </button>
    </StationShell>
  );
}

/* --- 2. Parcels --- */

function ParcelsStation({ onParcelsAdded, onOpenPage }: StationCommon) {
  const [mode, setMode] = useState<"choice" | "csv">("choice");
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);

  async function importCsv() {
    const parsed = parseParcelCsv(csv);
    if (parsed.length === 0) {
      toast.error("Couldn't find any rows. First row should be headers like: label, owner, address");
      return;
    }
    setBusy(true);
    try {
      const communities = await listCommunities();
      const target = communities[0];
      if (!target) {
        toast.error("No community found. Create one first.");
        return;
      }
      const n = await bulkCreateParcels(target.id, parsed);
      toast.success(`Added ${n} parcels 🎉`);
      onParcelsAdded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "csv") {
    return (
      <StationShell title="Paste your parcel list" hint="Copy a spreadsheet, paste it here. First row = headers.">
        <Textarea
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
          rows={8}
          className="font-mono text-xs"
          placeholder={"label,owner,address,area_sqft,frontage_ft\n101,M. Alvarez,101 Cedar Hollow Ln,43560,120\n102,R. Chen,102 Cedar Hollow Ln,41000,110"}
        />
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setMode("choice")} disabled={busy}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button size="sm" onClick={importCsv} disabled={busy || !csv.trim()}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Add them all
          </Button>
        </div>
      </StationShell>
    );
  }

  return (
    <StationShell
      title="Add the households"
      hint="Who lives on this road? Parcels drive every fair-share calculation."
    >
      <button
        type="button"
        onClick={() => setMode("csv")}
        className="flex w-full items-start gap-3 rounded-xl border-2 border-primary/40 bg-primary/5 p-4 text-left transition-colors hover:border-primary hover:bg-primary/10"
      >
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <ClipboardPaste className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">Paste a spreadsheet</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Copy owners & addresses from any sheet. We'll bulk-add them.
          </p>
        </div>
      </button>
      <button
        type="button"
        onClick={() => onOpenPage("/community")}
        className="flex w-full items-start gap-3 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-primary/40"
      >
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          <Users className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold">Add them one by one</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Open the community page — I'll leave the tour open so you can pop back.
          </p>
        </div>
      </button>
    </StationShell>
  );
}

/* --- 3. Roads --- */

function RoadsStation({ onOpenPage }: StationCommon) {
  return (
    <StationShell
      title="Draw the roads"
      hint="Click two points and you've got a road. That's it. Really."
    >
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MapIcon className="h-4 w-4 text-primary" />
          Open the map editor
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Every road you draw gets a length, a surface, and a maintenance responsibility. That's
          what makes the cost split fair.
        </p>
      </div>
      <Button className="w-full" onClick={() => onOpenPage("/map")}>
        Open map <ArrowRight className="h-4 w-4" />
      </Button>
    </StationShell>
  );
}

/* --- 4. Scenario --- */

function ScenarioStation({ onOpenPage }: StationCommon) {
  return (
    <StationShell
      title="Build a cost scenario"
      hint="Now the magic: compare distance, frontage, and equal splits — the numbers write themselves."
    >
      <div className="rounded-xl border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
        A scenario models a real project — resurfacing, grading, plow contract — and shows what
        each household would pay under different fair-share rules.
      </div>
      <Button className="w-full" onClick={() => onOpenPage("/portfolio")}>
        Open scenarios <ArrowRight className="h-4 w-4" />
      </Button>
    </StationShell>
  );
}

/* --- 5. Input --- */

function InputStation({ onOpenPage }: StationCommon) {
  return (
    <StationShell
      title="Bring the neighbors in"
      hint="Run a quick survey or open a decision room. Every response is stamped and cited."
    >
      <Button className="w-full" onClick={() => onOpenPage("/decisions")}>
        Open decisions <ArrowRight className="h-4 w-4" />
      </Button>
    </StationShell>
  );
}

/* --- 6. Report --- */

function ReportStation({ onOpenPage }: StationCommon) {
  return (
    <StationShell
      title="Ship your first report"
      hint="Board-ready. Cited. The kind lenders and county clerks quietly nod at."
    >
      <Button className="w-full" onClick={() => onOpenPage("/reports")}>
        Open reports <ArrowRight className="h-4 w-4" />
      </Button>
    </StationShell>
  );
}

/* --- final --- */

function FinishStation({ onFinish }: { onFinish: () => void }) {
  return (
    <StationShell title="You did the whole thing 🎉" hint="Every station is checked off. Nice work.">
      <ol className="space-y-2">
        {STATIONS.map((s) => (
          <li key={s.key} className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
            <CheckCircle2 className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{s.milestone}</span>
          </li>
        ))}
      </ol>
      <Button className="w-full" onClick={onFinish}>
        Finish onboarding
      </Button>
    </StationShell>
  );
}