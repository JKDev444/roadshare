import { ROAD_TEMPLATES, type RoadTemplate } from "@/lib/roadshare/layout";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

function TemplateThumb({ template }: { template: RoadTemplate }) {
  return (
    <svg viewBox="0 0 900 620" className="h-24 w-full rounded-lg bg-[color-mix(in_oklch,var(--color-map-land-top)_60%,white)]">
      {template.segments.map((s) => {
        const g = s.geometry!;
        return (
          <g key={s.id}>
            <line x1={g.ax} y1={g.ay} x2={g.bx} y2={g.by} stroke="#2b2f36" strokeWidth={26} strokeLinecap="round" />
            <line x1={g.ax} y1={g.ay} x2={g.bx} y2={g.by} stroke="#f7d24a" strokeWidth={2} strokeDasharray="14 12" />
          </g>
        );
      })}
    </svg>
  );
}

export function TemplatePicker({
  onPick,
  onSkip,
}: {
  onPick: (t: RoadTemplate) => void;
  onSkip: () => void;
}) {
  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-background/85 backdrop-blur">
      <div className="mx-4 w-full max-w-3xl rounded-3xl border border-border bg-card p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Pick a starting shape</p>
            <h2 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
              What does your road look like?
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">
              Start with a shape close to yours. You can drag the road, change lengths, and add more later.
            </p>
          </div>
          <button
            type="button"
            onClick={onSkip}
            aria-label="Skip"
            className="rounded-full p-2 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {ROAD_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onPick(t)}
              className="group flex flex-col rounded-2xl border border-border bg-background p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md"
            >
              <TemplateThumb template={t} />
              <span className="mt-3 block font-display text-sm font-bold">{t.name}</span>
              <span className="text-xs text-muted-foreground">{t.short}</span>
            </button>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Skip — I'll draw it myself
          </Button>
        </div>
      </div>
    </div>
  );
}