import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Home as HomeIcon,
  Route as RouteIcon,
  MapPin,
  Sparkles,
  Vote,
} from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { displayName, useSession } from "@/lib/auth/useSession";
import { Button } from "@/components/ui/button";
import { WelcomeWizard } from "@/components/onboarding/WelcomeWizard";
import { getDashboardStats } from "@/lib/onboarding/api";
import { cn } from "@/lib/utils";
import { loadResumeState, resumeStepLabel } from "@/lib/onboarding/resumeState";
import { useEffect, useState } from "react";
import type { ResumeState } from "@/lib/onboarding/resumeState";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — RoadShare" }, { name: "robots", content: "noindex" }],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    welcome:
      s.welcome === "1" || s.welcome === "true" || s.welcome === 1 || s.welcome === true
        ? true
        : undefined,
  }),
  component: Dashboard,
});

function Dashboard() {
  const { user } = useSession();
  const rawName = displayName(user).split(" ")[0];
  const name = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : "";
  const { welcome } = Route.useSearch();

  const { data: stats } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: getDashboardStats,
  });

  const hasCommunity = !!stats?.latestCommunityId;
  const communityId = stats?.latestCommunityId ?? "";
  const parcelCount = stats?.parcels ?? 0;
  const docCount = stats?.documents ?? 0;
  const openDecisions = stats?.openDecisions ?? 0;

  const [resume, setResume] = useState<ResumeState | null>(null);
  useEffect(() => {
    setResume(loadResumeState(user?.id));
  }, [user?.id]);
  const showResume = !hasCommunity && !!resume && !welcome;

  return (
    <AppShell>
      <WelcomeWizard forceOpen={welcome} />
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Resume banner — user paused mid-setup */}
        {showResume && resume && (
          <div className="rounded-3xl border border-fun-2/30 bg-gradient-to-br from-fun-2/15 via-primary/5 to-fun-3/15 p-5 fun-shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-primary">
                  Pick up where you left off
                </p>
                <h2 className="mt-0.5 font-display text-xl font-bold">
                  You were {resumeStepLabel(resume.step)}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  We saved your progress. Jump back in and we'll take you right to the same
                  step.
                </p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button asChild size="sm">
                <Link to="/dashboard" search={{ welcome: true }}>
                  Continue setup <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <span className="text-[11px] text-muted-foreground">
                Only takes a few more minutes.
              </span>
            </div>
          </div>
        )}

        {/* Hero greeting */}
        <div className="rounded-3xl border border-primary/30 bg-gradient-to-br from-primary/10 via-fun-2/5 to-fun-3/10 p-6 fun-shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Home</p>
          <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome back{name ? `, ${name}` : ""}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {hasCommunity ? (
              <>
                Pick up where you left off in{" "}
                <span className="font-semibold text-foreground">{stats?.latestCommunity}</span>.
              </>
            ) : (
              "RoadShare helps you and your neighbors figure out a fair way to share road costs. Let's set up your road."
            )}
          </p>
          <div className="mt-4">
            {hasCommunity ? (
              <Button asChild size="lg">
                <Link to="/community/$id" params={{ id: communityId }} search={{ tab: "roads" }}>
                  Open my road
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link to="/dashboard" search={{ welcome: true }}>
                  {resume ? "Resume setup" : "Let's start with your road"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Snapshot tiles — only when a community exists */}
        {hasCommunity && (
          <section aria-labelledby="snapshot" className="space-y-3">
            <h2 id="snapshot" className="font-display text-lg font-semibold">
              Your community at a glance
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <Tile
                icon={HomeIcon}
                tint="bg-indigo-500/12 text-indigo-600 dark:text-indigo-400"
                title={
                  parcelCount === 0
                    ? "No homes yet"
                    : `${parcelCount} home${parcelCount === 1 ? "" : "s"}`
                }
                body={
                  parcelCount === 0
                    ? "Add the homes that share your road so everyone gets a fair share."
                    : parcelCount >= 50
                      ? `Everyone on your road, ready to review. Use the search box to jump to yours.`
                      : "Review who lives on the road and confirm the details."
                }
                to={{
                  path: "/community/$id" as const,
                  params: { id: communityId },
                  search: { tab: "homes" as const },
                }}
                cta="Review Homes"
              />
              <Tile
                icon={RouteIcon}
                tint="bg-teal-500/12 text-teal-600 dark:text-teal-400"
                title="Your shared road"
                body="Trace, tweak, and confirm the road everyone shares."
                to={{
                  path: "/community/$id" as const,
                  params: { id: communityId },
                  search: { tab: "roads" as const },
                }}
                cta="Review My Road"
              />
              <Tile
                icon={FileText}
                tint="bg-violet-500/12 text-violet-600 dark:text-violet-400"
                title={
                  docCount === 0
                    ? "No documents yet"
                    : `${docCount} document${docCount === 1 ? "" : "s"}`
                }
                body="Keep HOA rules, road agreements, and invoices in one place."
                to={{ path: "/documents" as const }}
                cta="Open Documents"
              />
              <Tile
                icon={Vote}
                tint="bg-rose-500/12 text-rose-600 dark:text-rose-400"
                title={
                  openDecisions === 0
                    ? "No active decisions"
                    : `${openDecisions} decision${openDecisions === 1 ? "" : "s"} open`
                }
                body="Start a proposal when the community needs to vote."
                to={{ path: "/decisions" as const }}
                cta="Open Decisions"
              />
            </div>
          </section>
        )}

        {/* Empty-state helper */}
        {!hasCommunity && (
          <>
            {/* Value-prop walkthrough so users know what RoadShare will do */}
            <section aria-labelledby="what-we-do" className="space-y-3">
              <h2 id="what-we-do" className="font-display text-lg font-semibold">
                Here's what we'll do together
              </h2>
              <div className="grid gap-3 sm:grid-cols-3">
                <StepCard
                  icon={MapPin}
                  tint="bg-primary/12 text-primary"
                  title="Find your homes"
                  body="Type your address and we'll try to find every home on your road automatically."
                />
                <StepCard
                  icon={RouteIcon}
                  tint="bg-fun-2/15 text-fun-2-foreground"
                  title="Draw the road"
                  body="Confirm the road everyone shares — the piece maintenance costs cover."
                />
                <StepCard
                  icon={Vote}
                  tint="bg-fun-3/15 text-fun-3-foreground"
                  title="Share fair costs"
                  body="Send neighbors a link to vote on a fair share for the next repair."
                />
              </div>
            </section>

            <div className="rounded-2xl border border-dashed border-border bg-card/60 p-6 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <p className="mt-3 font-semibold">Want to see a finished example first?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Cedar Hollow is a sandbox neighborhood you can explore without setting
                anything up.
              </p>
              <Button asChild variant="outline" className="mt-3">
                <Link to="/tools/cedar-hollow">See the Cedar Hollow sample</Link>
              </Button>
            </div>
          </>
        )}

        {hasCommunity && (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-4 text-center text-sm text-muted-foreground">
            Curious what a finished road looks like?{" "}
            <Link
              to="/tools/cedar-hollow"
              className="font-medium text-primary underline-offset-2 hover:underline"
            >
              Peek at the Cedar Hollow sample →
            </Link>
          </div>
        )}
      </div>
    </AppShell>
  );
}

type TileTo =
  | { path: "/community/$id"; params: { id: string }; search: { tab: "roads" | "homes" } }
  | { path: "/documents" }
  | { path: "/decisions" };

function StepCard({
  icon: Icon,
  tint,
  title,
  body,
}: {
  icon: typeof HomeIcon;
  tint: string;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 fun-shadow-sm">
      <span
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg",
          tint,
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function Tile({
  icon: Icon,
  tint,
  title,
  body,
  to,
  cta,
}: {
  icon: typeof HomeIcon;
  tint: string;
  title: string;
  body: string;
  to: TileTo;
  cta: string;
}) {
  const link =
    to.path === "/community/$id" ? (
      <Link to={to.path} params={to.params} search={to.search}>
        {cta}
      </Link>
    ) : (
      <Link to={to.path}>{cta}</Link>
    );
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-4 fun-shadow-sm">
      <div className="flex items-start gap-3">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tint)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{body}</p>
        </div>
      </div>
      <div className="mt-3 self-end">
        <Button asChild variant="outline" size="sm">
          {link}
        </Button>
      </div>
    </div>
  );
}
