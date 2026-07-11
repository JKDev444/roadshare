import { cn } from "@/lib/utils";
import { DOC_STATUS, type DocStatus } from "@/lib/documents/api";

const TONE: Record<string, string> = {
  amber: "bg-gold/25 text-gold-foreground",
  blue: "bg-primary/10 text-primary",
  green: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
  red: "bg-destructive/12 text-destructive",
};

export function DocStatusBadge({ value, className }: { value: DocStatus; className?: string }) {
  const s = DOC_STATUS[value];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", TONE[s.tone], className)}>
      {s.label}
    </span>
  );
}
