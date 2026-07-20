import { useMemo, useState, type ComponentType } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Home as HomeIcon,
  Route as RouteIcon,
  Sparkles,
  Wallet,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { pathLengthFt, type Parcel, type RoadSegment } from "@/lib/community/api";
import { computeCostShare, formatUSD, type CostMethod } from "@/lib/community/costShare";
import { PlatCanvas } from "@/components/community/PlatCanvas";

type Props = {
  parcels: Parcel[];
  segments: RoadSegment[];
  initialProject?: string;
  initialTotal?: number;
  initialMethod?: CostMethod;
  /** Called when the user asks their neighbors to vote. Should create a decision
   *  and typically writes the id back into the URL. Returns the share URL. */
  onAskForVotes?: (input: { projectName: string; total: number; method: CostMethod }) => Promise<string>;
};

type StepId = "home" | "road" | "project" | "split" | "result";

const STEPS: {
  id: StepId;
  n: number;
  title: string;
  short: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { id: "home", n: 1, title: "Which home is yours?", short: "Your home", icon: HomeIcon },
  { id: "road", n: 2, title: "Which road needs work?", short: "The road", icon: RouteIcon },
  { id: "project", n: 3, title: "What's the project?", short: "Project", icon: Wrench },
  { id: "split", n: 4, title: "How should we split the cost?", short: "Split", icon: Wallet },
  { id: "result", n: 5, title: "Your fair share", short: "Result", icon: Sparkles },
];

/**
 * Guided step-card planner for a community. Mirrors the Cedar Hollow demo:
 * plat picture always visible, one card at a time, plat updates live.
 */
export function MyRoadTab({
  parcels,
  segments,
  initialProject,
  initialTotal,
  initialMethod,
  onAskForVotes,
}: Props) {
  const sharedIn = !!(initialProject || initialTotal || initialMethod);
  const [step, setStep] = useState<StepId>(sharedIn ? "home" : "home");
  const [yourHomeId, setYourHomeId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState(initialProject ?? "Repave the shared road");
  const [totalStr, setTotalStr] = useState(
    initialTotal ? String(initialTotal) : "25000",
  );
  const [method, setMethod] = useState<CostMethod>(initialMethod ?? "equal");

  const total = Math.max(0, Number(totalStr.replace(/[^\d.]/g, "")) || 0);
  const roadFeet = useMemo(
    () => segments.reduce((sum, s) => sum + pathLengthFt(s.geometry), 0),
    [segments],
  );
  const result = useMemo(
    () => computeCostShare(parcels, segments, total, method),
    [parcels, segments, total, method],
  );
  const yourRow = useMemo(
    () => result.rows.find((r) => r.parcelId === yourHomeId) ?? null,
    [result.rows, yourHomeId],
  );

  const stepDone: Record<StepId, boolean> = {
    home: !!yourHomeId,
    road: segments.length > 0,
    project: projectName.trim().length > 0 && total > 0,
    split: true,
    result: !!yourHomeId,
  };

  if (parcels.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-primary/30 bg-gradient-to-br from-primary/5 via-card to-fun-3/10 p-8 text-center fun-shadow-sm">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <HomeIcon className="h-6 w-6" />
        </span>
        <h2 className="mt-4 font-display text-xl font-bold">No homes on this road yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Add the homes that share your road below. The step-by-step planner shows up as soon as
          there's at least one home.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {sharedIn && (
        <div className="rounded-2xl border border-primary/40 bg-primary/5 px-4 py-3 text-sm fun-shadow-sm">
          <p className="font-semibold">A neighbor shared a plan with you</p>
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">{projectName}</strong> at{" "}
            <strong className="text-foreground">
              {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(totalStr) || 0)}
            </strong>
            . Pick your home below to see your fair share.
          </p>
        </div>
      )}
      {/* Always-visible road picture */}
      <PlatCanvas
        parcels={parcels}
        segments={segments}
        title="Your road"
        className="fun-shadow-sm"
      />

      {/* Step rail */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl border border-border bg-card/90 p-2 text-xs shadow-sm sm:grid-cols-5">
        {STEPS.map((s) => {
          const active = step === s.id;
          const done = stepDone[s.id];
          const Icon = s.icon;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(s.id)}
              className={cn(
                "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-xl border p-2 text-left transition-colors",
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background/60 hover:bg-accent",
              )}
            >
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                  done && !active
                    ? "bg-selected text-selected-foreground"
                    : active
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {done && !active ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{s.short}</span>
                <span className="block truncate text-muted-foreground">Step {s.n}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Step card */}
      <div className="rounded-2xl border border-border bg-card p-5 fun-shadow-sm">
        <StepCard step={step}>
          {step === "home" && (
            <HomeStep
              parcels={parcels}
              value={yourHomeId}
              onPick={(id) => {
                setYourHomeId(id);
                setStep("road");
              }}
            />
          )}
          {step === "road" && (
            <RoadStep
              roadFeet={roadFeet}
              segmentCount={segments.length}
              onNext={() => setStep("project")}
            />
          )}
          {step === "project" && (
            <ProjectStep
              projectName={projectName}
              setProjectName={setProjectName}
              totalStr={totalStr}
              setTotalStr={setTotalStr}
              onNext={() => setStep("split")}
            />
          )}
          {step === "split" && (
            <SplitStep
              method={method}
              setMethod={setMethod}
              fallback={result.fallback}
              onNext={() => setStep("result")}
            />
          )}
          {step === "result" && (
            <ResultStep
              projectName={projectName}
              total={total}
              method={method}
              rows={result.rows}
              yourRow={yourRow}
              onAskForVotes={onAskForVotes}
            />
          )}
        </StepCard>
      </div>
    </div>
  );
}

function StepCard({ step, children }: { step: StepId; children: React.ReactNode }) {
  const meta = STEPS.find((s) => s.id === step)!;
  const Icon = meta.icon;
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">
            Step {meta.n} of {STEPS.length}
          </p>
          <h2 className="font-display text-xl font-bold tracking-tight">{meta.title}</h2>
        </div>
      </div>
      {children}
    </div>
  );
}

function HomeStep({
  parcels,
  value,
  onPick,
}: {
  parcels: Parcel[];
  value: string | null;
  onPick: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Pick which home is yours. We'll highlight it on the road picture and show your fair share at
        the end.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {parcels.map((p) => {
          const active = p.id === value;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onPick(p.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-xl border p-3 text-left transition-colors",
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background hover:border-primary/50 hover:bg-primary/5",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{p.label}</span>
                  {p.address && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {p.address}
                    </span>
                  )}
                </span>
                {active ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RoadStep({
  roadFeet,
  segmentCount,
  onNext,
}: {
  roadFeet: number;
  segmentCount: number;
  onNext: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        The road picture above shows the stretch of road you'll split. If it doesn't match, add or
        edit the road below the planner.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <div className="text-xs text-muted-foreground">Stretches of road</div>
          <div className="mt-1 font-display text-2xl font-bold">{segmentCount}</div>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 p-3">
          <div className="text-xs text-muted-foreground">About how long</div>
          <div className="mt-1 font-display text-2xl font-bold">
            {roadFeet > 0 ? `${Math.round(roadFeet).toLocaleString()} ft` : "—"}
          </div>
        </div>
      </div>
      <Button className="w-full" onClick={onNext}>
        Looks right <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ProjectStep({
  projectName,
  setProjectName,
  totalStr,
  setTotalStr,
  onNext,
}: {
  projectName: string;
  setProjectName: (v: string) => void;
  totalStr: string;
  setTotalStr: (v: string) => void;
  onNext: () => void;
}) {
  const total = Math.max(0, Number(totalStr.replace(/[^\d.]/g, "")) || 0);
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Give the project a plain-language name and a rough total cost. You can change either later.
      </p>
      <div className="space-y-1.5">
        <Label htmlFor="project-name">What are you fixing?</Label>
        <Input
          id="project-name"
          value={projectName}
          onChange={(e) => setProjectName(e.target.value)}
          placeholder="e.g. Repave the road, patch the potholes, add a speed bump"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="project-total">About how much will it cost?</Label>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold">$</span>
          <Input
            id="project-total"
            inputMode="numeric"
            value={totalStr}
            onChange={(e) => setTotalStr(e.target.value)}
            className="font-display text-lg font-bold"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          A ballpark works — you can update it after you get a quote.
        </p>
      </div>
      <Button
        className="w-full"
        onClick={onNext}
        disabled={!projectName.trim() || total <= 0}
      >
        Choose how to split <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function SplitStep({
  method,
  setMethod,
  fallback,
  onNext,
}: {
  method: CostMethod;
  setMethod: (m: CostMethod) => void;
  fallback: "equal" | null;
  onNext: () => void;
}) {
  const methods: { id: CostMethod; label: string; blurb: string }[] = [
    { id: "equal", label: "Split evenly", blurb: "Every home pays the same." },
    {
      id: "frontage",
      label: "By feet of road in front",
      blurb: "Homes with more road along them pay more.",
    },
    {
      id: "distance",
      label: "By distance from the entrance",
      blurb: "Homes farther down the road pay more.",
    },
  ];
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Three fair ways to split the cost. You can try each one and see how the numbers change.
      </p>
      <div className="grid gap-2">
        {methods.map((m) => {
          const active = method === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={cn(
                "flex w-full items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors",
                active
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:border-primary/40",
              )}
            >
              <span className="min-w-0">
                <span className="block font-semibold">{m.label}</span>
                <span className="block text-xs text-muted-foreground">{m.blurb}</span>
              </span>
              {active && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          );
        })}
      </div>
      {fallback === "equal" && method !== "equal" && (
        <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
          We don't have enough data for that split yet, so we're using even shares. Add{" "}
          {method === "frontage"
            ? "feet of road in front of each home"
            : "the shared road and home locations"}{" "}
          to unlock it.
        </p>
      )}
      <Button className="w-full" onClick={onNext}>
        See the fair share <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}

function ResultStep({
  projectName,
  total,
  method,
  rows,
  yourRow,
  onAskForVotes,
}: {
  projectName: string;
  total: number;
  method: CostMethod;
  rows: ReturnType<typeof computeCostShare>["rows"];
  yourRow: ReturnType<typeof computeCostShare>["rows"][number] | null;
  onAskForVotes?: (input: { projectName: string; total: number; method: CostMethod }) => Promise<string>;
}) {
  const methodLabel: Record<CostMethod, string> = {
    equal: "even shares",
    frontage: "by feet of road in front",
    distance: "by distance from the entrance",
  };

  const [asking, setAsking] = useState(false);

  async function copyLink() {
    if (typeof window === "undefined") return;
    const base = window.location.href.split("?")[0];
    const params = new URLSearchParams({
      project: projectName,
      total: String(total),
      method,
    });
    const url = `${base}?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied — paste it in a text or email to your neighbors");
    } catch {
      toast.error("Couldn't copy — long-press the address bar instead");
    }
  }

  async function askForVotes() {
    if (!onAskForVotes) return;
    setAsking(true);
    try {
      const url = await onAskForVotes({ projectName, total, method });
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Vote link copied — text or email it to your neighbors");
      } catch {
        toast.success("Vote is open — copy the link from the top of the page");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open the vote");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Here's the split for <strong className="text-foreground">{projectName}</strong> at{" "}
        <strong className="text-foreground">{formatUSD(total)}</strong>, {methodLabel[method]}.
      </p>

      {yourRow && (
        <div className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card to-fun-3/10 p-5 fun-shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Your fair share</p>
          <p className="mt-1 font-display text-4xl font-bold tracking-tight">
            {formatUSD(yourRow.amount)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {(yourRow.share * 100).toFixed(1)}% of {formatUSD(total)} · {yourRow.label}
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card fun-shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-semibold">Home</th>
              <th className="px-4 py-3 font-semibold">Share</th>
              <th className="px-4 py-3 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const isYou = yourRow?.parcelId === r.parcelId;
              return (
                <tr
                  key={r.parcelId}
                  className={cn(
                    "border-b border-border/60 last:border-0",
                    isYou && "bg-primary/5",
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="font-semibold">
                      {r.label}
                      {isYou && (
                        <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                          You
                        </span>
                      )}
                    </div>
                    {r.address && (
                      <div className="text-xs text-muted-foreground">{r.address}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {(r.share * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right font-semibold">{formatUSD(r.amount)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-muted/40 text-sm font-semibold">
              <td className="px-4 py-3">Total</td>
              <td className="px-4 py-3 text-muted-foreground">100%</td>
              <td className="px-4 py-3 text-right">{formatUSD(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        {onAskForVotes && (
          <Button className="flex-1" onClick={askForVotes} disabled={asking}>
            <Sparkles className="h-4 w-4" />{" "}
            {asking ? "Opening the vote…" : "Ask my neighbors to vote"}
          </Button>
        )}
        <Button
          variant={onAskForVotes ? "outline" : "default"}
          className="flex-1"
          onClick={copyLink}
        >
          <Copy className="h-4 w-4" /> Just copy the plan link
        </Button>
      </div>
    </div>
  );
}
