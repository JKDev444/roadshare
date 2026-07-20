import { MapPin, PenLine, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export type StartChoice = "docs" | "address" | "manual";

/**
 * Step 1: three equal, playful ways to start setting up a road group.
 * Replaces the old address-first form. Matches Cedar Hollow's tone.
 */
export function StartChoiceStep({
  onPick,
  onSample,
  onLater,
}: {
  onPick: (choice: StartChoice) => void;
  onSample?: () => void;
  onLater?: () => void;
}) {
  return (
    <div className="space-y-5">
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-fun-2/10 to-fun-3/15 px-4 py-4">
        <div className="pointer-events-none absolute right-4 top-2 opacity-40">
          <Sparkles className="h-4 w-4 text-fun-3-foreground animate-pulse" />
        </div>
        <div className="relative">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-background/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
            Step 1 of 2
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold tracking-tight">
            Let's find your road
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Pick whatever's easiest — you can add your HOA papers later.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ChoiceCard
          icon={<MapPin className="h-6 w-6" />}
          title="Type your address"
          sub="We find every home near you."
          hint="Fastest for most roads"
          accent="from-fun-2/20 to-fun-2/5 text-fun-2-foreground"
          onClick={() => onPick("address")}
        />
        <ChoiceCard
          icon={<PenLine className="h-6 w-6" />}
          title="Add homes by hand"
          sub="Paste addresses or add lots one by one."
          hint="Works for any community"
          accent="from-fun-3/20 to-fun-3/5 text-fun-3-foreground"
          onClick={() => onPick("manual")}
        />
      </div>

      <p className="rounded-xl border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Have a CC&R or HOA PDF? You'll upload it after we build your map — that's when we pull out the cost-share formula and maintenance rules.
      </p>

      <div className="flex items-center justify-end gap-2 pt-1 text-xs">
        <div className="flex items-center gap-1">
          {onSample && (
            <Button variant="ghost" size="sm" onClick={onSample}>
              <Sparkles className="h-3.5 w-3.5" /> See sample
            </Button>
          )}
          {onLater && (
            <Button variant="ghost" size="sm" onClick={onLater}>
              Skip for now
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({
  icon,
  title,
  sub,
  hint,
  accent,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  hint: string;
  accent: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex h-full flex-col items-start gap-2 rounded-2xl border border-border bg-background p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
    >
      <span
        className={`inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${accent}`}
      >
        {icon}
      </span>
      <span className="mt-1 font-display text-base font-bold leading-tight text-foreground">
        {title}
      </span>
      <span className="text-xs text-muted-foreground">{sub}</span>
      <span className="mt-auto inline-flex items-center gap-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-primary/80">
        {hint}
        <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}