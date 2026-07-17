import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, ArrowRight, HardHat, Plus, Trash2 } from "lucide-react";

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
  createProject,
  deleteProject,
  fundingTarget,
  listProjects,
  money,
  STATUS_LABEL,
} from "@/lib/planner/api";
import { checkScenarioReadiness } from "@/lib/onboarding/readiness";

const STATUS_TONE: Record<string, string> = {
  planning: "bg-secondary text-secondary-foreground",
  bidding: "bg-primary/10 text-primary",
  funded: "bg-emerald-500/10 text-emerald-600",
  complete: "bg-muted text-muted-foreground",
};

export function ProjectsTab({ communityId }: { communityId: string }) {
  const qc = useQueryClient();
  const { data: projects, isLoading } = useQuery({ queryKey: ["projects", communityId], queryFn: () => listProjects(communityId) });
  const { data: readiness } = useQuery({
    queryKey: ["scenario-readiness", communityId],
    queryFn: () => checkScenarioReadiness(communityId),
  });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["projects", communityId] });
    qc.invalidateQueries({ queryKey: ["events", communityId] });
    qc.invalidateQueries({ queryKey: ["scenario-readiness", communityId] });
  };
  const del = useMutation({
    mutationFn: (p: { id: string; name: string }) => deleteProject(p.id, communityId, p.name),
    onSuccess: () => { invalidate(); toast.success("Project removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {readiness && !readiness.ok && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Finish setup before creating a scenario</p>
            <ul className="mt-1 list-disc pl-4 text-xs opacity-90">
              {readiness.reasons.map((r) => <li key={r}>{r}</li>)}
            </ul>
          </div>
        </div>
      )}
      {readiness && readiness.ok && readiness.unresolved > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2 text-xs text-amber-800 dark:text-amber-200">
          {readiness.unresolved} propert{readiness.unresolved === 1 ? "y" : "ies"} still need an address or confirmation before you publish an allocation.
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{projects?.length ?? 0} project{(projects?.length ?? 0) === 1 ? "" : "s"}</p>
        <NewProjectDialog communityId={communityId} onSaved={invalidate} disabled={!readiness?.ok} disabledReason={readiness?.reasons?.[0]} />
      </div>
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">{[0, 1].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl border border-border bg-card" />)}</div>
      ) : projects && projects.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {projects.map((p) => (
            <div key={p.id} className="group flex flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><HardHat className="h-5 w-5" /></span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_TONE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
              </div>
              <h3 className="mt-4 font-display text-lg font-semibold">{p.name}</h3>
              {p.description && <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{p.description}</p>}
              <p className="mt-3 text-sm"><span className="font-display text-xl font-bold">{money(fundingTarget(p))}</span> <span className="text-muted-foreground">to fund</span></p>
              <div className="mt-4 flex items-center justify-between">
                <Button size="sm" asChild>
                  <Link to="/project/$projectId" params={{ projectId: p.id }}>
                    Open planner <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {p.name}?</AlertDialogTitle>
                      <AlertDialogDescription>This removes the project, its cost items, and allocation settings.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => del.mutate({ id: p.id, name: p.name })}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><HardHat className="h-7 w-7" /></span>
          <h2 className="mt-5 font-display text-xl font-bold">Plan your first project</h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">Add a road project, enter costs and bids, then split the total across parcels with the allocation engine.</p>
          <div className="mt-6"><NewProjectDialog communityId={communityId} onSaved={invalidate} disabled={!readiness?.ok} disabledReason={readiness?.reasons?.[0]} /></div>
        </div>
      )}
    </div>
  );
}

function NewProjectDialog({ communityId, onSaved, disabled, disabledReason }: { communityId: string; onSaved: () => void; disabled?: boolean; disabledReason?: string }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const create = useMutation({
    mutationFn: () => createProject(communityId, { name: name.trim(), description: description.trim() || undefined }),
    onSuccess: () => { onSaved(); toast.success("Project created"); setOpen(false); setName(""); setDescription(""); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled} title={disabled ? disabledReason : undefined}><Plus className="h-4 w-4" /> New project</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Name the work. You'll add costs and choose how to split them next.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5"><Label htmlFor="p-name">Name</Label><Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 2026 resurfacing" /></div>
          <div className="space-y-1.5"><Label htmlFor="p-desc">Description</Label><Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>{create.isPending ? "Creating…" : "Create project"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}