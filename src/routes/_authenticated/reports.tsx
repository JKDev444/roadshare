import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Download, ExternalLink, FileBarChart, Loader2 } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { listCommunities } from "@/lib/community/api";
import { updateOnboardingState } from "@/lib/onboarding/api";
import {
  REPORT_TYPES,
  assembleReportData,
  buildReportHtml,
  downloadReport,
  openReport,
  type ReportType,
} from "@/lib/reports/api";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — RoadShare" }, { name: "robots", content: "noindex" }] }),
  component: ReportsPage,
  errorComponent: () => (
    <AppShell><div className="mx-auto max-w-md py-20 text-center text-muted-foreground">Reports could not be loaded.</div></AppShell>
  ),
});

function ReportsPage() {
  const [communityId, setCommunityId] = useState("");
  const [selected, setSelected] = useState<ReportType>("dossier");

  const communities = useQuery({ queryKey: ["communities"], queryFn: listCommunities });
  const cid = communityId || communities.data?.[0]?.id || "";

  const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const generate = useMutation({
    mutationFn: async ({ type, action }: { type: ReportType; action: "download" | "open" }) => {
      const data = await assembleReportData(cid, type);
      const html = buildReportHtml(type, data);
      if (action === "open") openReport(html);
      else downloadReport(`${slug(data.community.name)}-${type}.html`, html);
    },
    onSuccess: () => {
      // Mark the final onboarding step complete once a report is produced.
      updateOnboardingState({ report_generated: true }).catch(() => {});
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busyType = generate.isPending ? generate.variables?.type : undefined;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Reports</h1>
            <p className="text-sm text-muted-foreground">Print-ready summaries you can share at a meeting, hand to a neighbor, or send to a lender or attorney.</p>
          </div>
          {(communities.data?.length ?? 0) > 0 && (
            <div className="w-52">
              <Label className="text-xs text-muted-foreground">Community</Label>
              <Select value={cid} onValueChange={setCommunityId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{communities.data!.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>

        {communities.isLoading ? null : (communities.data?.length ?? 0) === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
            <FileBarChart className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium">Create a community first</p>
            <p className="text-sm text-muted-foreground">Reports are built from a community's record. Add one from the Community Record page.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {REPORT_TYPES.map((r) => {
              const isBusy = busyType === r.value;
              const active = selected === r.value;
              return (
                <div
                  key={r.value}
                  onClick={() => setSelected(r.value)}
                  className={cn(
                    "flex cursor-pointer flex-col rounded-2xl border bg-card p-5 transition-colors",
                    active ? "border-primary ring-1 ring-primary/30" : "border-border hover:border-primary/40",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-primary/10 p-2 text-primary"><FileBarChart className="h-5 w-5" /></div>
                    <div>
                      <p className="font-display font-semibold leading-snug">{r.label}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{r.blurb}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      disabled={generate.isPending}
                      onClick={(e) => { e.stopPropagation(); generate.mutate({ type: r.value, action: "download" }); }}
                    >
                      {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={generate.isPending}
                      onClick={(e) => { e.stopPropagation(); generate.mutate({ type: r.value, action: "open" }); }}
                    >
                      <ExternalLink className="h-4 w-4" /> Preview
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-muted-foreground">Reports open in your browser — use Print → Save as PDF to share. Numbers reflect what's in your record right now, and are for discussion, not legal advice.</p>
      </div>
    </AppShell>
  );
}