import { cn } from "@/lib/utils";
import type { Confidence, Verification } from "@/lib/community/api";

const CONF: Record<Confidence, { label: string; cls: string }> = {
  high: { label: "High confidence", cls: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300" },
  medium: { label: "Medium", cls: "bg-gold/25 text-gold-foreground" },
  low: { label: "Low", cls: "bg-orange-500/15 text-orange-700 dark:text-orange-300" },
};

const VER: Record<Verification, { label: string; cls: string; dot: string }> = {
  verified: { label: "Confirmed", cls: "bg-primary/10 text-primary", dot: "bg-primary" },
  unverified: { label: "Needs review", cls: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/60" },
  disputed: { label: "Disputed", cls: "bg-destructive/12 text-destructive", dot: "bg-destructive" },
};

export function ConfidenceBadge({ value, className }: { value: Confidence; className?: string }) {
  const c = CONF[value];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", c.cls, className)}>
      {c.label}
    </span>
  );
}

export function VerificationBadge({ value, className }: { value: Verification; className?: string }) {
  const v = VER[value];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", v.cls, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", v.dot)} />
      {v.label}
    </span>
  );
}