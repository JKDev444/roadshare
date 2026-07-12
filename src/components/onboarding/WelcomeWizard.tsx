import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  FileBarChart,
  Loader2,
  Map as MapIcon,
  MessageSquare,
  Route as RouteIcon,
  Scale,
  Sparkles,
  Users,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createCommunity, seedCedarHollow } from "@/lib/community/api";
import { useOnboarding } from "@/lib/onboarding/useOnboarding";
import { cn } from "@/lib/utils";

const WORKFLOW = [
  { icon: Users, title: "Community & households", body: "Record the road group and every parcel that shares it." },
  { icon: MapIcon, title: "Map the roads", body: "Draw centerlines and assign maintenance responsibility." },
  { icon: Scale, title: "Allocate costs fairly", body: "Compare distance, frontage, and equal splits with live numbers." },
  { icon: MessageSquare, title: "Gather input & decide", body: "Run surveys and evidence-backed decision rooms." },
  { icon: FileBarChart, title: "Deliver a report", body: "Board-ready, cited reports for owners and lenders." },
];

export function WelcomeWizard() {
  const { state, isLoading, updateAsync } = useOnboarding();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [description, setDescription] = useState("");
  const [closing, setClosing] = useState(false);

  const open =
    !closing &&
    !isLoading &&
    !!state &&
    !state.wizard_completed &&
    !state.wizard_skipped;

  const createMut = useMutation({
    mutationFn: () =>
      createCommunity({
        name: name.trim(),
        region: region.trim() || undefined,
        description: description.trim() || undefined,
      }),
    onSuccess: async (community) => {
      qc.invalidateQueries({ queryKey: ["communities"] });
      qc.invalidateQueries({ queryKey: ["onboarding", "progress"] });
      await updateAsync({ wizard_completed: true });
      toast.success("Community created");
      setClosing(true);
      navigate({ to: "/community/$id", params: { id: community.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const seedMut = useMutation({
    mutationFn: seedCedarHollow,
    onSuccess: async (community) => {
      qc.invalidateQueries({ queryKey: ["communities"] });
      qc.invalidateQueries({ queryKey: ["onboarding", "progress"] });
      await updateAsync({ wizard_completed: true });
      toast.success("Cedar Hollow sample loaded");
      setClosing(true);
      navigate({ to: "/community/$id", params: { id: community.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const busy = createMut.isPending || seedMut.isPending;

  async function skip() {
    setClosing(true);
    await updateAsync({ wizard_skipped: true });
  }

  async function finish() {
    setClosing(true);
    await updateAsync({ wizard_completed: true });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) skip();
      }}
    >
      <DialogContent className="max-w-lg">
        <div className="mb-1 flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
            <RouteIcon className="h-4 w-4" />
          </span>
          <span className="font-display text-base font-bold tracking-tight">RoadShare</span>
          <span className="ml-auto flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-1.5 w-6 rounded-full transition-colors",
                  i <= step ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </span>
        </div>

        {step === 0 && (
          <>
            <DialogHeader>
              <DialogTitle>Welcome to RoadShare</DialogTitle>
              <DialogDescription>
                RoadShare turns a messy shared-road problem into a fair, documented decision.
                Here's the whole workflow, start to finish.
              </DialogDescription>
            </DialogHeader>
            <ol className="mt-2 space-y-2.5">
              {WORKFLOW.map((w) => (
                <li key={w.title} className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <w.icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{w.title}</p>
                    <p className="text-xs text-muted-foreground">{w.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <DialogFooter className="mt-4 flex-row justify-between sm:justify-between">
              <Button variant="ghost" onClick={skip} disabled={busy}>
                Skip for now
              </Button>
              <Button onClick={() => setStep(1)}>
                Get started <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 1 && (
          <>
            <DialogHeader>
              <DialogTitle>Create your first community</DialogTitle>
              <DialogDescription>
                Name the road group. You'll add parcels and map roads next.
              </DialogDescription>
            </DialogHeader>
            <div className="mt-1 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="w-name">Community name</Label>
                <Input
                  id="w-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Cedar Hollow Road"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="w-region">Region (optional)</Label>
                <Input
                  id="w-region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="County, State"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="w-desc">Description (optional)</Label>
                <Textarea
                  id="w-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="A short note about this road group."
                />
              </div>
              <button
                type="button"
                onClick={() => seedMut.mutate()}
                disabled={busy}
                className="flex w-full items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-60"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Not ready? Load the Cedar Hollow sample instead to explore a fully populated
                community.
              </button>
            </div>
            <DialogFooter className="mt-4 flex-row justify-between sm:justify-between">
              <Button variant="ghost" onClick={() => setStep(0)} disabled={busy}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep(2)} disabled={busy || !name.trim()}>
                Continue <ArrowRight className="h-4 w-4" />
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 2 && (
          <>
            <DialogHeader>
              <DialogTitle>You're all set</DialogTitle>
              <DialogDescription>
                We'll create "{name.trim() || "your community"}" and take you straight to its
                record. A checklist on your dashboard tracks the rest.
              </DialogDescription>
            </DialogHeader>
            <ol className="mt-2 space-y-2.5">
              {WORKFLOW.map((w, i) => (
                <li key={w.title} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <p className="text-sm">{w.title}</p>
                </li>
              ))}
            </ol>
            <DialogFooter className="mt-4 flex-row justify-between sm:justify-between">
              <Button variant="ghost" onClick={() => setStep(1)} disabled={busy}>
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={finish} disabled={busy}>
                  Explore on my own
                </Button>
                <Button onClick={() => createMut.mutate()} disabled={busy || !name.trim()}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create community
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}