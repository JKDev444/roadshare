import { Link } from "@tanstack/react-router";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Map as MapIcon,
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

const STEPS: Step[] = [
  {
    key: "community",
    icon: Users,
    title: "Create your workspace",
    why: "Upload a CCR/plat, type the basics, or load a sample community.",
    to: "/community",
    cta: "Open community",
  },
  {
    key: "parcels",
    icon: Users,
    title: "Review the lots",
    why: "Confirm the lots or households pulled from the CCR before using them for calculations.",
    to: "/community",
    cta: "Review lots",
  },
  {
    key: "roads",
    icon: MapIcon,
    title: "Review the road map",
    why: "Imported roads start as editable map lines so you can refine the actual geometry.",
    to: "/map",
    cta: "Open map",
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

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold">Getting started</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Start with the minimum: workspace, lots, and roads. Scenarios and reports come after.
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
          {STEPS.map((step, i) => {
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