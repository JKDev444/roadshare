import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2, Download, FileText, Loader2, MapPin, MessageSquare, Route as RouteIcon, ShieldCheck,
} from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import {
  loadPortfolio, sumTotals, exportCommunityArchive, downloadArchive,
} from "@/lib/portfolio/api";

export const Route = createFileRoute("/_authenticated/portfolio")({
  head: () => ({ meta: [{ title: "Portfolio — RoadShare" }, { name: "robots", content: "noindex" }] }),
  component: PortfolioPage,
  errorComponent: () => (
    <AppShell><div className="mx-auto max-w-md py-20 text-center text-muted-foreground">The portfolio could not be loaded.</div></AppShell>
  ),
});

function PortfolioPage() {
  const portfolio = useQuery({ queryKey: ["portfolio"], queryFn: loadPortfolio });
  const totals = portfolio.data ? sumTotals(portfolio.data) : null;

  const exportArchive = useMutation({
    mutationFn: async (communityId: string) => {
      const { filename, json } = await exportCommunityArchive(communityId);
      downloadArchive(filename, json);
    },
    onSuccess: () => toast.success("Audit archive exported"),
    onError: (e: Error) => toast.error(e.message),
  });

  const TOTALS = [
    { label: "Communities", value: totals?.communities ?? 0, icon: Building2 },
    { label: "Homes", value: totals?.parcels ?? 0, icon: MapPin },
    { label: "Roads", value: totals?.roads ?? 0, icon: RouteIcon },
    { label: "Documents", value: totals?.documents ?? 0, icon: FileText },
    { label: "Open decisions", value: totals?.openDecisions ?? 0, icon: MessageSquare },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Portfolio</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every community you're part of, at a glance. Download a full backup of any record any time.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {TOTALS.map((t) => {
            const Icon = t.icon;
            return (
              <div key={t.label} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Icon className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">{t.label}</span>
                </div>
                <p className="mt-2 font-display text-3xl font-bold">{portfolio.isLoading ? "—" : t.value}</p>
              </div>
            );
          })}
        </div>

        {portfolio.isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (portfolio.data?.length ?? 0) === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <Building2 className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium">No communities yet</p>
            <p className="text-sm text-muted-foreground">Create one from the Community Record page to see it here.</p>
            <Button className="mt-4" asChild><Link to="/community">Go to Community Record</Link></Button>
          </div>
        ) : (
          <div className="space-y-4">
            {portfolio.data!.map((m) => {
              const checkedPct = m.parcels > 0 ? Math.round((m.verifiedParcels / m.parcels) * 100) : 0;
              const checkedLabel =
                m.parcels === 0
                  ? null
                  : m.verifiedParcels === 0
                    ? `${m.parcels} ${m.parcels === 1 ? "home" : "homes"} added`
                    : checkedPct === 100
                      ? "All homes double-checked"
                      : `${m.verifiedParcels} of ${m.parcels} homes double-checked`;
              const busy = exportArchive.isPending && exportArchive.variables === m.community.id;
              return (
                <div key={m.community.id} className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <Link
                        to="/community/$id"
                        params={{ id: m.community.id }}
                        className="font-display text-lg font-semibold hover:text-primary"
                      >
                        {m.community.name}
                      </Link>
                      {m.community.region && <p className="text-sm text-muted-foreground">{m.community.region}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {checkedLabel && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                          <ShieldCheck className="h-3.5 w-3.5" /> {checkedLabel}
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={exportArchive.isPending}
                        onClick={() => exportArchive.mutate(m.community.id)}
                      >
                        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export archive
                      </Button>
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
                    {[
                      { l: "Homes", v: m.parcels },
                      { l: "Roads", v: m.roads },
                      { l: "Documents", v: m.documents },
                      { l: "Clauses", v: m.clauses },
                      { l: "Decisions", v: m.decisions },
                      { l: "Surveys", v: m.surveys },
                    ].map((s) => (
                      <div key={s.l} className="rounded-lg bg-muted/40 p-2 text-center">
                        <p className="font-display text-lg font-bold">{s.v}</p>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{s.l}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Exports include the full history of this community as a single file — safe to keep for backup or hand to a professional.
        </p>
      </div>
    </AppShell>
  );
}
