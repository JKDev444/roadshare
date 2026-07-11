import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  FileText,
  Map as MapIcon,
  MessageSquare,
  Users,
} from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { displayName, useSession } from "@/lib/auth/useSession";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — RoadShare" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

const STATS = [
  { label: "Active scenarios", value: "1", hint: "Cedar Hollow Road" },
  { label: "Community records", value: "14", hint: "parcels tracked" },
  { label: "Documents", value: "0", hint: "awaiting upload" },
  { label: "Open decisions", value: "0", hint: "no active rooms" },
];

const QUICK = [
  {
    to: "/tools/cedar-hollow",
    title: "Build a cost scenario",
    body: "Model road-cost allocation across the neighborhood with multiple methodologies.",
    icon: MapIcon,
  },
  {
    to: "/community",
    title: "Community record",
    body: "Track parcels, owners, and source confidence in one shared ledger.",
    icon: Users,
  },
  {
    to: "/documents",
    title: "Document vault",
    body: "Store deeds, agreements, and amendments with classification and review.",
    icon: FileText,
  },
  {
    to: "/decisions",
    title: "Decision rooms",
    body: "Run evidence-backed votes with quorum tracking and an audit trail.",
    icon: MessageSquare,
  },
] as const;

function Dashboard() {
  const { user } = useSession();
  const name = displayName(user).split(" ")[0];

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Welcome back{name ? `, ${name}` : ""}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your community governance workspace. Here's where things stand.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {STATS.map((s) => (
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

        <div className="rounded-xl border border-dashed border-border bg-card/50 p-6 text-center">
          <p className="text-sm text-muted-foreground">
            The Cedar Hollow flagship scenario is ready to explore.
          </p>
          <Button className="mt-3" asChild>
            <Link to="/tools/cedar-hollow">Open Cedar Hollow</Link>
          </Button>
        </div>
      </div>
    </AppShell>
  );
}