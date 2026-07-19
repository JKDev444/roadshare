import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  FileText,
  Home as HomeIcon,
  Route as RouteIcon,
  Users,
  Vote,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { listDocuments } from "@/lib/documents/api";
import { listDecisions } from "@/lib/decisions/api";
import {
  pathLengthFt,
  type Community,
  type Parcel,
  type RecordEvent,
  type RoadSegment,
} from "@/lib/community/api";

type Props = {
  communityId: string;
  community: Community | null;
  parcels: Parcel[];
  segments: RoadSegment[];
  events: RecordEvent[];
  onGoToRoads: () => void;
  onGoToHomes: () => void;
};

/**
 * Community Home — the calm, guided dashboard shown after onboarding.
 *
 * Sections, in order:
 *   1. Setup checklist (5 plain-language steps + progress)
 *   2. Community summary cards
 *   3. Recent activity (collapsible, demoted during initial setup)
 */
export function CommunityHomeTab({
  communityId,
  community,
  parcels,
  segments,
  events,
  onGoToRoads,
  onGoToHomes,
}: Props) {
  const documents = useQuery({
    queryKey: ["documents", communityId],
    queryFn: () => listDocuments(communityId),
  });
  const decisions = useQuery({
    queryKey: ["decisions", communityId],
    queryFn: () => listDecisions(communityId),
  });

  const docCount = documents.data?.length ?? 0;
  const openDecisionCount =
    decisions.data?.filter((d) => d.status === "open" || d.status === "draft").length ?? 0;
  const roadFeet = segments.reduce((sum, s) => sum + pathLengthFt(s.geometry), 0);
  const confirmedHomes = parcels.filter((p) => p.verification === "verified").length;

  const steps: Step[] = [
    {
      id: "review-homes",
      title: "Review the homes RoadShare found",
      description:
        parcels.length === 0
          ? "No homes added yet — start by picking your neighbors on the map."
          : `${parcels.length} home${parcels.length === 1 ? "" : "s"} to confirm. Fix anything wrong.`,
      complete: parcels.length > 0 && confirmedHomes === parcels.length && parcels.length > 0,
      action: {
        label: parcels.length === 0 ? "Add Homes" : "Review Homes",
        onClick: onGoToHomes,
      },
    },
    {
      id: "confirm-road",
      title: "Confirm the shared road",
      description:
        segments.length === 0
          ? "No road drawn yet. Trace your shared road on the map — takes about 15 seconds."
          : `${segments.length} road segment${segments.length === 1 ? "" : "s"} on the map, about ${roadFeet.toLocaleString()} feet total.`,
      complete: segments.length > 0,
      action: { label: segments.length === 0 ? "Draw Road" : "Review My Road", onClick: onGoToRoads },
    },
    {
      id: "choose-split",
      title: "Choose how expenses should be divided",
      description:
        "Pick a fair-share method: distance from the entrance, road frontage, or equal per home.",
      complete: false,
      action: { label: "Set Cost Sharing", onClick: onGoToRoads },
    },
    {
      id: "invite-neighbors",
      title: "Invite your neighbors",
      description:
        "Add the homeowners so they can confirm their home and vote on shared decisions.",
      complete: false,
      action: { label: "Invite Neighbors", onClick: onGoToHomes },
    },
    {
      id: "upload-rules",
      title: "Upload any road rules or invoices",
      description:
        docCount === 0
          ? "Add CC&Rs, HOA rules, road agreements, or a recent road invoice."
          : `${docCount} document${docCount === 1 ? "" : "s"} uploaded. Add more anytime.`,
      complete: docCount > 0,
      link: { to: "/documents" as const, label: docCount === 0 ? "Upload Documents" : "View Documents" },
    },
  ];

  const completedCount = steps.filter((s) => s.complete).length;
  const allComplete = completedCount === steps.length;

  return (
    <div className="space-y-6">
      {/* Header + primary CTA */}
      <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-fun-2/5 to-fun-3/10 p-5 fun-shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Community Home
            </p>
            <h2 className="mt-1 font-display text-xl font-bold tracking-tight sm:text-2xl">
              {allComplete
                ? "Your community is fully set up"
                : "Your community has been created."}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {allComplete
                ? "Everything on the setup list is done. You can always come back to make changes."
                : "Finish the steps below to get everyone ready."}
            </p>
          </div>
          {!allComplete ? (
            <Button
              size="lg"
              onClick={() => {
                const firstOpen = steps.find((s) => !s.complete);
                if (firstOpen?.action) firstOpen.action.onClick();
                else if (firstOpen?.link) {
                  // fall through to the Link element in the checklist
                }
              }}
            >
              Continue Setup
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button asChild size="lg" variant="outline">
              <Link to="/community">All set — invite your neighbors</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Setup checklist */}
      <section aria-labelledby="setup-heading" className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h3 id="setup-heading" className="font-display text-lg font-semibold">
            Finish setting up your community
          </h3>
          <p className="text-xs font-medium text-muted-foreground">
            {completedCount} of {steps.length} steps complete
          </p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${(completedCount / steps.length) * 100}%` }}
          />
        </div>

        <ul className="space-y-2">
          {steps.map((step, i) => (
            <li
              key={step.id}
              className={cn(
                "rounded-2xl border bg-card p-4 fun-shadow-sm sm:flex sm:items-center sm:gap-4",
                step.complete ? "border-primary/25 bg-primary/5" : "border-border",
              )}
            >
              <span
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                  step.complete
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
                )}
                aria-hidden
              >
                {step.complete ? <CheckCircle2 className="h-5 w-5" /> : <span>{i + 1}</span>}
              </span>
              <div className="mt-2 min-w-0 flex-1 sm:mt-0">
                <p className={cn("font-semibold", step.complete && "text-muted-foreground line-through")}>
                  {step.title}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{step.description}</p>
              </div>
              <div className="mt-3 sm:mt-0">
                {step.complete ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                    <CheckCircle2 className="h-4 w-4" /> Done
                  </span>
                ) : step.link ? (
                  <Button asChild variant="outline" size="sm">
                    <Link to={step.link.to}>{step.link.label}</Link>
                  </Button>
                ) : step.action ? (
                  <Button variant="outline" size="sm" onClick={step.action.onClick}>
                    {step.action.label}
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Community summary cards */}
      <section aria-labelledby="summary-heading" className="space-y-3">
        <h3 id="summary-heading" className="font-display text-lg font-semibold">
          Community summary
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <SummaryCard
            icon={HomeIcon}
            tint="bg-indigo-500/12 text-indigo-600 dark:text-indigo-400"
            headline={
              parcels.length === 0
                ? "No homes yet"
                : `${parcels.length} home${parcels.length === 1 ? "" : "s"} found`
            }
            body={
              parcels.length === 0
                ? "Add the homes that share your road so everyone shows up in Fair Share and voting."
                : "Review the homes included in this community and correct anything that is missing."
            }
            actionLabel="Review Homes"
            onAction={onGoToHomes}
          />
          <SummaryCard
            icon={RouteIcon}
            tint="bg-teal-500/12 text-teal-600 dark:text-teal-400"
            headline={
              segments.length === 0
                ? "No shared road drawn yet"
                : `${segments.length} road need${segments.length === 1 ? "s" : ""} confirmation`
            }
            body={
              segments.length === 0
                ? "Trace the road you all share so RoadShare can measure it and split maintenance fairly."
                : `RoadShare detected approximately ${roadFeet.toLocaleString()} feet of possible shared roadway.`
            }
            actionLabel="Review My Road"
            onAction={onGoToRoads}
          />
          <SummaryCard
            icon={FileText}
            tint="bg-violet-500/12 text-violet-600 dark:text-violet-400"
            headline={
              docCount === 0
                ? "No documents uploaded"
                : `${docCount} document${docCount === 1 ? "" : "s"} uploaded`
            }
            body="Add CC&Rs, road agreements, invoices, or HOA rules so everyone works from the same source of truth."
            actionLabel="Upload Documents"
            linkTo="/documents"
          />
          <SummaryCard
            icon={Vote}
            tint="bg-rose-500/12 text-rose-600 dark:text-rose-400"
            headline={
              openDecisionCount === 0
                ? "No active decisions"
                : `${openDecisionCount} decision${openDecisionCount === 1 ? "" : "s"} open for voting`
            }
            body="Create a proposal when the community needs to vote on road work or expenses."
            actionLabel="View Decisions"
            linkTo="/decisions"
          />
        </div>
      </section>

      {/* Recent activity (collapsed by default) */}
      <RecentActivity events={events} />

      {/* Neighbors quick link — implied 5-item nav companion */}
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-4 text-sm text-muted-foreground sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-500">
            <Users className="h-4 w-4" />
          </span>
          <p>
            Want to add or invite neighbors? Open the Neighbors workspace to manage everyone in one place.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="mt-3 sm:mt-0">
          <Link to="/community">Open Neighbors</Link>
        </Button>
      </div>
    </div>
  );
}

type Step = {
  id: string;
  title: string;
  description: string;
  complete: boolean;
  action?: { label: string; onClick: () => void };
  link?: { to: "/documents" | "/decisions" | "/community"; label: string };
};

function SummaryCard({
  icon: Icon,
  tint,
  headline,
  body,
  actionLabel,
  onAction,
  linkTo,
}: {
  icon: typeof HomeIcon;
  tint: string;
  headline: string;
  body: string;
  actionLabel: string;
  onAction?: () => void;
  linkTo?: "/documents" | "/decisions" | "/community";
}) {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-4 fun-shadow-sm">
      <div className="flex items-start gap-3">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tint)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{headline}</p>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        </div>
      </div>
      <div className="mt-3 self-end">
        {linkTo ? (
          <Button asChild variant="outline" size="sm">
            <Link to={linkTo}>{actionLabel}</Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}

function RecentActivity({ events }: { events: RecordEvent[] }) {
  const [open, setOpen] = useState(false);
  const recent = events.slice(0, 8);
  return (
    <section
      aria-label="Recent activity"
      className="rounded-2xl border border-border bg-card/60"
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-500/12 text-slate-600 dark:text-slate-400">
            <Circle className="h-4 w-4" />
          </span>
          <span>
            <p className="text-sm font-semibold">Recent activity</p>
            <p className="text-xs text-muted-foreground">
              {recent.length === 0
                ? "No changes yet — every edit will show up here."
                : `Last change: ${new Date(recent[0].created_at).toLocaleString()}`}
            </p>
          </span>
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && (
        <ol className="space-y-3 border-t border-border px-4 py-3">
          {recent.length === 0 ? (
            <li className="text-sm text-muted-foreground">Nothing to show yet.</li>
          ) : (
            recent.map((e) => (
              <li key={e.id} className="relative pl-4">
                <span className="absolute left-0 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                <p className="text-xs">
                  <span className="font-semibold capitalize">{e.entity_type}</span>{" "}
                  {e.entity_label && (
                    <span className="text-muted-foreground">&ldquo;{e.entity_label}&rdquo;</span>
                  )}{" "}
                  <span className="font-medium text-primary">{e.action}</span>
                </p>
                {e.note && <p className="text-[11px] text-muted-foreground">{e.note}</p>}
                <p className="text-[11px] text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()}
                </p>
              </li>
            ))
          )}
        </ol>
      )}
    </section>
  );
}