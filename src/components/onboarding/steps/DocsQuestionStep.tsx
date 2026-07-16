import { FileText, HelpCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type DocsAnswer = "yes" | "no" | "unsure";

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
  }> = [
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
      title: "No, Continue Without Documents",
      body: "Add properties and roads another way. Documents can be uploaded later.",
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
          Do you have any documents about the road or community?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These might include a road maintenance agreement, CC&amp;Rs, a declaration, plat,
          easement, amendment, or property list.
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
              className="flex w-full items-start gap-3 rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
            >
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{o.title}</p>
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