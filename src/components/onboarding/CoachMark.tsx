import { X, Lightbulb } from "lucide-react";
import type { ReactNode } from "react";

import { useHint } from "@/lib/onboarding/useOnboarding";
import { cn } from "@/lib/utils";

/**
 * A lightweight, dismissible inline hint. Dismissed state is persisted per user
 * (keyed by `id`) via the onboarding table, so it stays closed across devices.
 */
export function CoachMark({
  id,
  title,
  children,
  className,
}: {
  id: string;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const { visible, dismiss } = useHint(id);
  if (!visible) return null;

  return (
    <div
      className={cn(
        "relative flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm",
        className,
      )}
    >
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
        <Lightbulb className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1 pr-5">
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-0.5 text-muted-foreground">{children}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss hint"
        className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}