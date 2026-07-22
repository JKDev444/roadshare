import { useState } from "react";
import { createFileRoute, useNavigate, useRouter, redirect } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { AppHeader } from "@/components/roadshare/AppHeader";
import { DocumentsPanel } from "@/components/roadshare/DocumentsPanel";
import { getMyRoad, resetMyRoad } from "@/lib/roadshare/road.functions";

export const Route = createFileRoute("/_authenticated/documents")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Documents — RoadShare" },
      { name: "description", content: "HOA rules, agreements, and other documents for your road." },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    const road = await getMyRoad();
    if (!road) throw redirect({ to: "/welcome" });
    return { road };
  },
  loader: ({ context }) => context.road,
  component: DocumentsPage,
});

function DocumentsPage() {
  const road = Route.useLoaderData();
  const navigate = useNavigate();
  const router = useRouter();
  const reset = useServerFn(resetMyRoad);
  const [busy, setBusy] = useState(false);

  async function doReset() {
    setBusy(true);
    try {
      await reset();
      toast.success("Reset. Start fresh below.");
      await router.invalidate();
      navigate({ to: "/welcome" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed.");
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader roadName={road.name ?? "My road"} active="documents" onReset={doReset} busy={busy} />
      <main className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold tracking-tight">Documents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload HOA rules, road-maintenance agreements, and anything else your neighbors should see.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <DocumentsPanel />
        </div>
      </main>
    </div>
  );
}