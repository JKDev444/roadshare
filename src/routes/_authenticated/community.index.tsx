import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowRight, MapPinned, Plus, Sparkles, Trash2 } from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  createCommunity,
  deleteCommunity,
  listCommunities,
  seedCedarHollow,
} from "@/lib/community/api";
import { CoachMark } from "@/components/onboarding/CoachMark";

export const Route = createFileRoute("/_authenticated/community/")({
  head: () => ({ meta: [{ title: "Community Record — RoadShare" }, { name: "robots", content: "noindex" }] }),
  component: CommunityIndex,
});

function CommunityIndex() {
  const qc = useQueryClient();
  const { data: communities, isLoading } = useQuery({
    queryKey: ["communities"],
    queryFn: listCommunities,
  });

  const seed = useMutation({
    mutationFn: seedCedarHollow,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["communities"] });
      toast.success("Cedar Hollow sample community added");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteCommunity(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["communities"] });
      toast.success("Community deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">My road</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your shared road, the homes on it, and the projects you're planning together.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <CreateCommunityDialog />
          </div>
        </header>

        <CoachMark id="community-index" title="This is the heart of RoadShare">
          Create your road group, then open it to add the homes and the road you share.
          Every fair-share estimate comes from what you record here.
        </CoachMark>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-40 animate-pulse rounded-2xl border border-border bg-card" />
            ))}
          </div>
        ) : communities && communities.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {communities.map((c) => (
              <div
                key={c.id}
                className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-1 hover:shadow-md"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <MapPinned className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold">{c.name}</h3>
                {c.region && <p className="text-xs font-medium text-muted-foreground">{c.region}</p>}
                {c.description && (
                  <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">{c.description}</p>
                )}
                <div className="mt-4 flex items-center justify-between">
                  <Button size="sm" asChild>
                    <Link to="/community/$id" params={{ id: c.id }}>
                      Open record <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete {c.name}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This permanently removes the road group and all its homes, roads, and history.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => del.mutate(c.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <MapPinned className="h-7 w-7" />
            </span>
            <h2 className="mt-5 font-display text-xl font-bold">Start with the Cedar Hollow sample</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              See a fully mapped neighborhood with homes, road, and shares — then create your own when you're ready.
            </p>
            <div className="mt-6 flex flex-col items-center gap-2">
              <Button size="lg" onClick={() => seed.mutate()} disabled={seed.isPending}>
                <Sparkles className="h-4 w-4" /> {seed.isPending ? "Adding…" : "Load Cedar Hollow sample"}
              </Button>
              <CreateCommunityDialog variant="outline" />
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function CreateCommunityDialog({ variant = "default" }: { variant?: "default" | "outline" }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [region, setRegion] = useState("");
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: () => createCommunity({ name: name.trim(), region: region.trim() || undefined, description: description.trim() || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["communities"] });
      toast.success("Community created");
      setOpen(false);
      setName(""); setRegion(""); setDescription("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant}>
          <Plus className="h-4 w-4" /> New community
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New community record</DialogTitle>
          <DialogDescription>Name the road group. You can add homes and the road next.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">Name</Label>
            <Input id="c-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Cedar Hollow Road" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-region">Region</Label>
            <Input id="c-region" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="County, State" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-desc">Description</Label>
            <Textarea id="c-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>
            {create.isPending ? "Creating…" : "Create record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}