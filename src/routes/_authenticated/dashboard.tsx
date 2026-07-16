import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  FileText,
  HardHat,
  Map as MapIcon,
  Users,
} from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { displayName, useSession } from "@/lib/auth/useSession";
import { Button } from "@/components/ui/button";
import { WelcomeWizard } from "@/components/onboarding/WelcomeWizard";
import { GettingStarted } from "@/components/onboarding/GettingStarted";
import { getDashboardStats } from "@/lib/onboarding/api";

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: (search: Record<string, unknown>) => ({
    onboarding: search.onboarding === "upload" ? "upload" : undefined,
  }),
  head: () => ({ meta: [{ title: "Dashboard — RoadShare" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

const QUICK = [
  {
    to: "/map",
    title: "Review GIS & roads",
    body: "Open your imported road map, drag starter lines into place, and confirm responsibility.",
    icon: MapIcon,
  },
  {
    to: "/community",
    title: "Review lots",
    body: "Confirm parcels, owners, and source confidence before using them in calculations.",
    icon: Users,
  },
  {
    to: "/tools/cedar-hollow",
    title: "Build a cost scenario",
    body: "Once the starter map looks right, compare equal, distance, and frontage splits.",
    icon: HardHat,
  },
  {
    to: "/documents",
    title: "Document vault",
    body: "Store deeds, agreements, and amendments with classification and review.",
    icon: FileText,
  },
] as const;

function Dashboard() {
  const { onboarding } = Route.useSearch();
  const { user } = useSession();
  const name = displayName(user).split(" ")[0];

  const { data: stats } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: getDashboardStats,
  });

  const cards = [
    {
      label: "Active scenarios",
      value: stats?.scenarios ?? 0,
      hint: (stats?.scenarios ?? 0) > 0 ? "cost models built" : "none yet",
    },
    {
      label: "Community records",
      value: stats?.parcels ?? 0,
      hint: "parcels tracked",
    },
    {
      label: "Documents",
      value: stats?.documents ?? 0,
      hint: (stats?.documents ?? 0) > 0 ? "in the vault" : "awaiting upload",
    },
    {
      label: "Open decisions",
      value: stats?.openDecisions ?? 0,
      hint: (stats?.openDecisions ?? 0) > 0 ? "active rooms" : "no active rooms",
    },
  ];

  return (
    <AppShell>
      <WelcomeWizard initialPath={onboarding === "upload" ? "upload" : undefined} />
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome back{name ? `, ${name}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your community governance workspace. Here's where things stand.
          </p>
        </div>

        <GettingStarted />

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {cards.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {s.label}
              </p>
              <p className="mt-2 font-display text-3xl font-bold">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.hint}</p>
            </div>
          ))}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Quick actions
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {QUICK.map((q) => {
              const Icon = q.icon;
              return (
                <Link
                  key={q.to}
                  to={q.to}
                  className="group flex items-start gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/40"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 font-medium">
                      {q.title}
                      <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">{q.body}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {(stats?.scenarios ?? 0) === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center">
            <p className="text-sm text-muted-foreground">
              Want to see a finished example first? Explore the Cedar Hollow sample scenario.
            </p>
            <Button className="mt-3" variant="outline" asChild>
              <Link to="/tools/cedar-hollow">Open Cedar Hollow sample</Link>
            </Button>
          </div>
        )}
      </div>
    </AppShell>
  );
}