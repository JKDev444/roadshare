import { Link } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  HardHat,
  Map as MapIcon,
  MessageSquare,
  Send,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useOnboarding } from "@/lib/onboarding/useOnboarding";
import type { ChecklistProgress } from "@/lib/onboarding/api";
import { cn } from "@/lib/utils";

type Step = {
  key: keyof Omit<ChecklistProgress, "completed" | "total">;
  icon: LucideIcon;
  title: string;
  why: string;
  to: string;
  cta: string;
};

// Primary three tasks — always shown until each is complete.
const PRIMARY: Step[] = [
  {
    key: "parcels",
    icon: Users,
    title: "Confirm the properties",
    why: "Cost calculations use these properties. A quick pass now prevents surprises later.",
    to: "/community",
    cta: "Review properties",
  },
  {
    key: "roads",
    icon: MapIcon,
    title: "Review the road map",
    why: "Drop the starter road lines onto the actual road so distance-based scenarios work.",
    to: "/map",
    cta: "Open map",
  },
  {
    key: "scenario",
    icon: HardHat,
    title: "Build a first scenario",
    why: "See what different cost-sharing rules mean for each property before talking to neighbors.",
    to: "/tools/cedar-hollow",
    cta: "Start a scenario",
  },
];

// Follow-on tasks unlocked once a scenario exists.
const FOLLOWUP: Step[] = [
  {
    key: "report",
    icon: FileText,
    title: "Create a report",
    why: "Export a shareable summary of your scenario for the board or your neighbors.",
    to: "/tools/cedar-hollow",
    cta: "Generate report",
  },
  {
    key: "input",
    icon: Send,
    title: "Invite neighbors",
    why: "Send a link so neighbors can weigh in before a decision is finalized.",
    to: "/community",
    cta: "Invite",
  },
  {
    key: "input",
    icon: MessageSquare,
    title: "Gather feedback",
    why: "Run a short survey or open a decision room to hear from the road group.",
    to: "/community",
    cta: "Open decision room",
  },
];

export function GettingStarted() {
  const { state, progress, update, isLoading } = useOnboarding();
  const [collapsed, setCollapsed] = useState(false);

  if (isLoading || !progress) return null;

  const done = progress.completed;
  const pct = Math.round((done / progress.total) * 100);
  const allDone = done >= progress.total;
  const dismissed = state?.checklist_dismissed ?? false;

  // Once dismissed or fully complete, show a slim reopenable bar.
  if (dismissed || allDone) {
    return (
      <button
        type="button"
        onClick={() => {
          if (dismissed) update({ checklist_dismissed: false });
          setCollapsed(false);
        }}
        className="flex w-full items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40"
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          {allDone ? (
            <Check className="h-4 w-4 text-primary" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
          Getting started
          <span className="text-muted-foreground">
            ({done}/{progress.total})
          </span>
        </span>
        <span className="text-xs text-muted-foreground">
          {allDone ? "All set — reopen" : "Show checklist"}
        </span>
      </button>
    );
  }

  // Choose which trio to show. Until community exists, hide the checklist —
  // the WelcomeWizard is doing that job.
  if (!progress.community) return null;

  const showFollowup = progress.scenario;
  const steps = showFollowup ? FOLLOWUP : PRIMARY;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">
            {showFollowup ? "Next up" : "Getting started"}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {showFollowup
              ? "Now that you have a scenario, share it with your community."
              : "Three quick things to finish setting up your road group."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={collapsed ? "Expand" : "Collapse"}
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Dismiss checklist"
            onClick={() => update({ checklist_dismissed: true })}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <Progress value={pct} className="h-2 flex-1" />
        <span className="text-xs font-medium text-muted-foreground">
          {done}/{progress.total}
        </span>
      </div>

      {!collapsed && (
        <ol className="mt-5 space-y-2">
          {steps.map((step, i) => {
            const complete = progress[step.key];
            const Icon = step.icon;
            return (
              <li
                key={step.key}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 transition-colors",
                  complete ? "border-border bg-muted/40" : "border-border bg-background",
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold",
                    complete
                      ? "bg-primary text-primary-foreground"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {complete ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      complete && "text-muted-foreground line-through",
                    )}
                  >
                    {step.title}
                  </p>
                  {!complete && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{step.why}</p>
                  )}
                </div>
                {!complete && (
                  <Button size="sm" variant="outline" className="shrink-0" asChild>
                    <Link to={step.to}>
                      <Icon className="h-3.5 w-3.5" /> {step.cta}
                    </Link>
                  </Button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}