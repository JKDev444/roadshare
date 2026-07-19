import { ArrowRight, CheckCircle2, FileText, Home as HomeIcon, MapPin, Route as RouteIcon, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Post-onboarding success screen — shown after a community is created.
 * Matches the "Your RoadShare Community Is Ready" spec: plain-language
 * stats, one primary CTA into Community Home, and secondary CTAs into the
 * other setup workflows.
 */
export function CommunityReadyStep({
  communityName,
  region,
  homeCount,
  roadCount,
  roadFeet,
  documentCount,
  onGoHome,
  onReviewRoad,
  onUploadDocuments,
  onAddNeighbors,
}: {
  communityName: string;
  region: string | null;
  homeCount: number;
  roadCount: number;
  roadFeet: number;
  documentCount: number;
  onGoHome: () => void;
  onReviewRoad: () => void;
  onUploadDocuments: () => void;
  onAddNeighbors: () => void;
}) {
  const rows = [
    {
      icon: HomeIcon,
      label: `${homeCount} home${homeCount === 1 ? "" : "s"}`,
      tint: "bg-indigo-500/12 text-indigo-600 dark:text-indigo-400",
    },
    {
      icon: RouteIcon,
      label:
        roadCount === 0
          ? "No shared road detected yet"
          : `${roadCount} possible shared road${roadCount === 1 ? "" : "s"}`,
      tint: "bg-teal-500/12 text-teal-600 dark:text-teal-400",
    },
    {
      icon: MapPin,
      label:
        roadFeet > 0
          ? `Approximately ${roadFeet.toLocaleString()} feet of roadway`
          : "Road length still to be measured",
      tint: "bg-amber-500/12 text-amber-600 dark:text-amber-500",
    },
    {
      icon: FileText,
      label: `${documentCount} uploaded document${documentCount === 1 ? "" : "s"}`,
      tint: "bg-violet-500/12 text-violet-600 dark:text-violet-400",
    },
  ];

  return (
    <div className="space-y-5 py-1">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md">
          <CheckCircle2 className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-bold leading-tight tracking-tight">
            Your RoadShare community is ready
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{communityName}</span>
            {region ? (
              <>
                {" "}has been created in{" "}
                <span className="font-semibold text-foreground">{region}</span>.
              </>
            ) : (
              " has been created."
            )}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 fun-shadow-sm">
        <p className="text-sm font-semibold">Here's what we found</p>
        <ul className="mt-3 space-y-2">
          {rows.map((r) => {
            const Icon = r.icon;
            return (
              <li key={r.label} className="flex items-center gap-3 text-sm">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${r.tint}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1 font-medium text-foreground">{r.label}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-muted-foreground">
          Next, review what we found and finish setting up your community.
        </p>
      </div>

      <div className="space-y-3">
        <Button size="lg" className="w-full" onClick={onGoHome}>
          Go to Community Home
          <ArrowRight className="h-4 w-4" />
        </Button>
        <div className="grid gap-2 sm:grid-cols-3">
          <Button variant="outline" size="sm" onClick={onReviewRoad}>
            <RouteIcon className="h-4 w-4" /> Review My Road
          </Button>
          <Button variant="outline" size="sm" onClick={onUploadDocuments}>
            <FileText className="h-4 w-4" /> Upload Documents
          </Button>
          <Button variant="outline" size="sm" onClick={onAddNeighbors}>
            <Users className="h-4 w-4" /> Add Neighbors
          </Button>
        </div>
      </div>
    </div>
  );
}