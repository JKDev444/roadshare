import { FileText, HelpCircle, Map as MapIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type DocsAnswer = "yes" | "no" | "unsure" | "map";

/** Step 2. "Do you have any documents about the road or community?" */
export function DocsQuestionStep({
  onAnswer,
  onBack,
}: {
  onAnswer: (a: DocsAnswer) => void;
  onBack: () => void;
}) {
  const opts: Array<{
    id: DocsAnswer;
    icon: React.ComponentType<{ className?: string }>;
    title: string;
    body: string;
    recommended?: boolean;
  }> = [
    {
      id: "map",
      icon: MapIcon,
      title: "Pick your neighbors on a map",
      body: "Fastest for real neighborhoods. We'll show every home near your address — just tap or lasso the ones on your road.",
      recommended: true,
    },
    {
      id: "yes",
      icon: FileText,
      title: "Yes, I Have Documents",
      body:
        "Upload what you have. RoadShare will determine what type of document it is — CC&R, plat, road agreement, easement, or amendment.",
    },
    {
      id: "no",
      icon: X,
      title: "No documents — enter by hand",
      body: "Paste an address list, search, or add lots manually. Documents can be uploaded later.",
    },
    {
      id: "unsure",
      icon: HelpCircle,
      title: "I'm Not Sure",
      body: "We'll help you continue and explain what documents may be useful later.",
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-xl font-semibold">
          How would you like to add your neighborhood?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick the easiest path for you — you can always add documents, homes, or roads later.
        </p>
      </div>

      <div className="space-y-2">
        {opts.map((o) => {
          const Icon = o.icon;
          return (
            <button
              key={o.id}
              type="button"
              onClick={() => onAnswer(o.id)}
              className={
                "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors " +
                (o.recommended
                  ? "border-primary/60 bg-primary/5 hover:border-primary hover:bg-primary/10"
                  : "border-border bg-background hover:border-primary/50 hover:bg-primary/5")
              }
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {o.title}
                  {o.recommended && (
                    <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                      Fastest
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{o.body}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-start pt-1">
        <Button variant="ghost" size="sm" onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}