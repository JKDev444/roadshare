import { useState } from "react";
import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Home, Loader2, Route as RouteIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createMyRoad } from "@/lib/roadshare/road.functions";

export const Route = createFileRoute("/_authenticated/welcome")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Name your road — RoadShare" },
      { name: "description", content: "Start your private road plan in one step." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: WelcomePage,
});

function WelcomePage() {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const create = useServerFn(createMyRoad);
  const navigate = useNavigate();
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await create({ data: { name: name || "My road" } });
      await router.invalidate();
      navigate({ to: "/my-road" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create your road.");
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-16 topo-grid">
      <div className="mx-auto max-w-lg">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-sm">
            <RouteIcon className="h-5 w-5" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">RoadShare</span>
        </div>

        <div className="rounded-3xl border border-border/70 bg-card p-8 shadow-xl">
          <div className="mb-6 flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Home className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Step 1 of 1</p>
              <h1 className="font-display text-2xl font-bold tracking-tight">Give your road a name</h1>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            That's it — just a friendly name so you can find it later. You'll pick your home and neighbors on the next screen, one tap at a time.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="road-name">Road name</Label>
              <Input
                id="road-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Cedar Hollow Lane"
                maxLength={80}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">Skip it and we'll call it "My road" for now.</p>
            </div>
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Open my road <ArrowRight className="h-4 w-4" /></>}
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}