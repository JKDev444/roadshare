import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  CalendarClock,
  Check,
  FileText,
  Gavel,
  ListChecks,
  Plus,
  ScrollText,
  Send,
  ShieldCheck,
  Trash2,
  Vote,
} from "lucide-react";

import { AppShell } from "@/components/app/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { listCommunities, listParcels } from "@/lib/community/api";
import {
  castVote,
  createDecision,
  deleteDecision,
  deleteVote,
  EVIDENCE_KIND_LABEL,
  listDecisions,
  listVotes,
  newEvidence,
  parseEvidence,
  parseOptions,
  publishRationale,
  setDecisionStatus,
  STATUS_FLOW,
  STATUS_LABEL,
  tally,
  updateDecision,
  type Decision,
  type DecisionStatus,
  type EvidenceItem,
} from "@/lib/decisions/api";

export const Route = createFileRoute("/_authenticated/decisions")({
  head: () => ({ meta: [{ title: "Decision Rooms — RoadShare" }, { name: "robots", content: "noindex" }] }),
  component: DecisionsPage,
  errorComponent: () => (
    <AppShell>
      <div className="mx-auto max-w-md py-20 text-center text-muted-foreground">Decision Rooms could not be loaded.</div>
    </AppShell>
  ),
});

function statusTone(s: DecisionStatus) {
  switch (s) {
    case "voting":
      return "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    case "decided":
      return "text-primary bg-primary/10 border-primary/30";
    case "discussion":
      return "text-gold-foreground bg-gold/10 border-gold/30";
    case "withdrawn":
      return "text-destructive bg-destructive/10 border-destructive/30";
    default:
      return "text-muted-foreground bg-muted border-border";
  }
}

function DecisionsPage() {
  const [communityId, setCommunityId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const communities = useQuery({ queryKey: ["communities"], queryFn: listCommunities });
  const cid = communityId || communities.data?.[0]?.id || "";

  const decisions = useQuery({ queryKey: ["decisions", cid], queryFn: () => listDecisions(cid), enabled: !!cid });

  const selected = useMemo(
    () => decisions.data?.find((d) => d.id === selectedId) ?? decisions.data?.[0] ?? null,
    [decisions.data, selectedId],
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Decision Rooms</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Run evidence-backed decisions with a clear workflow, quorum and notice tracking, one vote per household, and a versioned published explanation. Every step is recorded in the community's audit trail.
            </p>
          </div>
          {(communities.data?.length ?? 0) > 0 && (
            <div className="w-52">
              <Label className="text-xs text-muted-foreground">Community</Label>
              <Select value={cid} onValueChange={(v) => { setCommunityId(v); setSelectedId(null); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{communities.data!.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>

        {communities.isLoading ? null : (communities.data?.length ?? 0) === 0 ? (
          <EmptyState icon={Gavel} title="Create a community first" body="Decisions belong to a community. Add one from the Community Record page." />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <DecisionList
              communityId={cid}
              decisions={decisions.data ?? []}
              loading={decisions.isLoading}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
            />
            {selected ? (
              <DecisionDetail key={selected.id} decision={selected} communityId={cid} />
            ) : (
              <EmptyState icon={Vote} title="No decision selected" body="Create a decision to begin assembling evidence and collecting votes." />
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function EmptyState({ icon: Icon, title, body }: { icon: typeof Gavel; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <Icon className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function DecisionList({
  communityId,
  decisions,
  loading,
  selectedId,
  onSelect,
}: {
  communityId: string;
  decisions: Decision[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Decisions</h2>
        <CreateDecisionDialog communityId={communityId} onCreated={onSelect} />
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : decisions.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No decisions yet.</p>
      ) : (
        <div className="space-y-2">
          {decisions.map((d) => {
            const active = d.id === selectedId;
            return (
              <button
                key={d.id}
                onClick={() => onSelect(d.id)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-colors",
                  active ? "border-primary/50 bg-primary/5" : "border-border bg-card hover:border-primary/30",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{d.title}</span>
                  <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase", statusTone(d.status))}>{STATUS_LABEL[d.status]}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{parseOptions(d.options).length} options · quorum {d.quorum}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateDecisionDialog({ communityId, onCreated }: { communityId: string; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [question, setQuestion] = useState("");

  const mut = useMutation({
    mutationFn: () => createDecision(communityId, { title: title.trim(), question: question.trim() || undefined }),
    onSuccess: (d) => {
      qc.invalidateQueries({ queryKey: ["decisions", communityId] });
      setOpen(false);
      setTitle("");
      setQuestion("");
      onCreated(d.id);
      toast.success("Decision created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="h-4 w-4" /> New</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New decision</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="dtitle" className="text-xs text-muted-foreground">Title</Label>
            <Input id="dtitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Repave Cedar Hollow Ln" />
          </div>
          <div>
            <Label htmlFor="dq" className="text-xs text-muted-foreground">Question (optional)</Label>
            <Textarea id="dq" rows={2} value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Should the community fund the 2026 repaving project?" />
          </div>
          <Button className="w-full" disabled={!title.trim() || mut.isPending} onClick={() => mut.mutate()}>Create decision</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function WorkflowTracker({ status }: { status: DecisionStatus }) {
  if (status === "withdrawn") {
    return <span className="text-xs font-semibold uppercase text-destructive">Withdrawn</span>;
  }
  const currentIdx = STATUS_FLOW.indexOf(status);
  return (
    <div className="flex items-center gap-1.5">
      {STATUS_FLOW.map((s, i) => {
        const done = i <= currentIdx;
        return (
          <div key={s} className="flex items-center gap-1.5">
            <span
              className={cn(
                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase",
                done ? statusTone(s) : "border-border bg-muted text-muted-foreground",
              )}
            >
              {done && i < currentIdx && <Check className="h-3 w-3" />} {STATUS_LABEL[s]}
            </span>
            {i < STATUS_FLOW.length - 1 && <span className="h-px w-3 bg-border" />}
          </div>
        );
      })}
    </div>
  );
}

function DecisionDetail({ decision, communityId }: { decision: Decision; communityId: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
        <div className="min-w-0">
          <h2 className="font-display text-xl font-bold">{decision.title}</h2>
          {decision.question && <p className="mt-1 text-sm text-muted-foreground">{decision.question}</p>}
          <div className="mt-3"><WorkflowTracker status={decision.status} /></div>
        </div>
        <StatusControls decision={decision} communityId={communityId} />
      </div>
      <Tabs defaultValue={decision.status === "voting" ? "vote" : decision.status === "decided" ? "explanation" : "setup"} className="p-5">
        <TabsList className="flex-wrap">
          <TabsTrigger value="setup"><ListChecks className="h-4 w-4" /> Setup</TabsTrigger>
          <TabsTrigger value="evidence"><FileText className="h-4 w-4" /> Evidence</TabsTrigger>
          <TabsTrigger value="vote"><Vote className="h-4 w-4" /> Vote</TabsTrigger>
          <TabsTrigger value="explanation"><ScrollText className="h-4 w-4" /> Explanation</TabsTrigger>
        </TabsList>
        <TabsContent value="setup" className="pt-4"><SetupTab decision={decision} communityId={communityId} /></TabsContent>
        <TabsContent value="evidence" className="pt-4"><EvidenceTab decision={decision} communityId={communityId} /></TabsContent>
        <TabsContent value="vote" className="pt-4"><VoteTab decision={decision} communityId={communityId} /></TabsContent>
        <TabsContent value="explanation" className="pt-4"><ExplanationTab decision={decision} communityId={communityId} /></TabsContent>
      </Tabs>
    </div>
  );
}

function StatusControls({ decision, communityId }: { decision: Decision; communityId: string }) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["decisions", communityId] });

  const votes = useQuery({ queryKey: ["decision-votes", decision.id], queryFn: () => listVotes(decision.id) });
  const result = useMemo(() => tally(decision, votes.data ?? []), [decision, votes.data]);

  const advance = useMutation({
    mutationFn: (status: DecisionStatus) =>
      setDecisionStatus(decision, status, status === "decided" ? { outcome: result.tie ? "Tie — no majority" : result.leader } : undefined),
    onSuccess: () => { invalidate(); toast.success("Status updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: () => deleteDecision(decision.id, communityId, decision.title),
    onSuccess: () => { invalidate(); toast.success("Decision deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const optionsReady = parseOptions(decision.options).length >= 2;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {decision.status === "draft" && (
        <Button size="sm" onClick={() => advance.mutate("discussion")}>Open discussion</Button>
      )}
      {decision.status === "discussion" && (
        <Button size="sm" disabled={!optionsReady} onClick={() => advance.mutate("voting")}>Start voting</Button>
      )}
      {decision.status === "voting" && (
        <Button size="sm" disabled={!result.quorumMet} onClick={() => advance.mutate("decided")}>
          Record outcome
        </Button>
      )}
      {(decision.status === "draft" || decision.status === "discussion" || decision.status === "voting") && (
        <Button size="sm" variant="outline" className="text-muted-foreground" onClick={() => advance.mutate("withdrawn")}>Withdraw</Button>
      )}
      {decision.status === "withdrawn" && (
        <Button size="sm" variant="outline" onClick={() => advance.mutate("draft")}>Reopen</Button>
      )}
      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => del.mutate()} aria-label="Delete decision"><Trash2 className="h-4 w-4" /></Button>
    </div>
  );
}

function SetupTab({ decision, communityId }: { decision: Decision; communityId: string }) {
  const qc = useQueryClient();
  const locked = decision.status !== "draft" && decision.status !== "discussion";
  const [description, setDescription] = useState(decision.description ?? "");
  const [options, setOptions] = useState<string[]>(parseOptions(decision.options).length ? parseOptions(decision.options) : ["Approve", "Reject"]);
  const [quorum, setQuorum] = useState(decision.quorum);

  const votingLocked = decision.status === "voting" || decision.status === "decided";

  const save = useMutation({
    mutationFn: () =>
      updateDecision(decision.id, communityId, {
        description: description.trim() || null,
        options: options.map((o) => o.trim()).filter(Boolean),
        quorum,
      }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["decisions", communityId] }); toast.success("Decision saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {locked && (
        <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          Voting has started, so ballot options and quorum are locked to keep the vote fair. You can still update the background description.
        </div>
      )}
      <div>
        <Label htmlFor="ddesc" className="text-xs text-muted-foreground">Background & context</Label>
        <Textarea id="ddesc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Summarize the situation households are deciding on." />
      </div>

      <div>
        <Label className="text-xs text-muted-foreground">Ballot options</Label>
        <div className="mt-2 space-y-2">
          {options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input value={opt} disabled={votingLocked} onChange={(e) => setOptions((o) => o.map((x, k) => (k === i ? e.target.value : x)))} placeholder={`Option ${i + 1}`} />
              {!votingLocked && (
                <button className="text-muted-foreground hover:text-destructive" onClick={() => setOptions((o) => o.filter((_, k) => k !== i))} aria-label="Remove option"><Trash2 className="h-4 w-4" /></button>
              )}
            </div>
          ))}
          {!votingLocked && (
            <Button size="sm" variant="ghost" onClick={() => setOptions((o) => [...o, ""])}><Plus className="h-4 w-4" /> Add option</Button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-muted/20 p-4">
        <div>
          <Label htmlFor="quorum" className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Quorum (households)</Label>
          <Input id="quorum" type="number" min={1} disabled={votingLocked} className="mt-1 w-24" value={quorum} onChange={(e) => setQuorum(Math.max(1, Number(e.target.value) || 1))} />
        </div>
        <p className="flex-1 text-xs text-muted-foreground">A minimum of this many households must vote before the outcome can be recorded.</p>
      </div>

      <Button onClick={() => save.mutate()} disabled={save.isPending || options.filter((o) => o.trim()).length < 2}>Save decision</Button>
    </div>
  );
}

function EvidenceTab({ decision, communityId }: { decision: Decision; communityId: string }) {
  const qc = useQueryClient();
  const [items, setItems] = useState<EvidenceItem[]>(parseEvidence(decision.evidence));

  const save = useMutation({
    mutationFn: () => updateDecision(decision.id, communityId, { evidence: items.filter((i) => i.label.trim()) }, { silent: true }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["decisions", communityId] }); toast.success("Evidence saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  function patch(id: string, up: Partial<EvidenceItem>) {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...up } : x)));
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Attach the verified record this decision rests on — clauses, documents, planner scenarios, and survey results — so the outcome is auditable and defensible.
      </p>
      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No evidence attached yet.</p>
      ) : (
        <div className="space-y-2">
          {items.map((it) => (
            <div key={it.id} className="rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Select value={it.kind} onValueChange={(v) => patch(it.id, { kind: v as EvidenceItem["kind"] })}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>{(Object.keys(EVIDENCE_KIND_LABEL) as EvidenceItem["kind"][]).map((k) => <SelectItem key={k} value={k}>{EVIDENCE_KIND_LABEL[k]}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="flex-1 min-w-40" value={it.label} onChange={(e) => patch(it.id, { label: e.target.value })} placeholder="Label (e.g. Cost-sharing clause §4)" />
                <button className="text-muted-foreground hover:text-destructive" onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))} aria-label="Remove evidence"><Trash2 className="h-4 w-4" /></button>
              </div>
              <Input className="mt-2" value={it.detail ?? ""} onChange={(e) => patch(it.id, { detail: e.target.value })} placeholder="Optional note / reference" />
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setItems((xs) => [...xs, newEvidence("clause")])}><Plus className="h-4 w-4" /> Add evidence</Button>
        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>Save evidence</Button>
      </div>
    </div>
  );
}

function VoteTab({ decision, communityId }: { decision: Decision; communityId: string }) {
  const qc = useQueryClient();
  const options = useMemo(() => parseOptions(decision.options), [decision.options]);
  const [household, setHousehold] = useState("");
  const [choice, setChoice] = useState("");
  const [comment, setComment] = useState("");

  const parcels = useQuery({ queryKey: ["parcels", communityId], queryFn: () => listParcels(communityId), enabled: !!communityId });
  const votes = useQuery({ queryKey: ["decision-votes", decision.id], queryFn: () => listVotes(decision.id) });
  const result = useMemo(() => tally(decision, votes.data ?? []), [decision, votes.data]);

  const voted = new Set((votes.data ?? []).map((v) => v.household_label));

  const submit = useMutation({
    mutationFn: () => castVote(decision, household.trim(), choice, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["decision-votes", decision.id] });
      setChoice("");
      setComment("");
      setHousehold("");
      toast.success("Vote recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteVote(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["decision-votes", decision.id] }); toast.success("Vote removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const votingOpen = decision.status === "voting";

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold">Cast a household vote</h3>
          {!votingOpen ? (
            <p className="mt-2 text-sm text-muted-foreground">Voting is {STATUS_LABEL[decision.status].toLowerCase()}. Start voting from the header to collect ballots.</p>
          ) : (
            <div className="mt-3 space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Household</Label>
                <Select value={household} onValueChange={setHousehold}>
                  <SelectTrigger><SelectValue placeholder="Select verified household" /></SelectTrigger>
                  <SelectContent>
                    {(parcels.data ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.label} disabled={voted.has(p.label)}>
                        {p.label}{p.owner_name ? ` · ${p.owner_name}` : ""}{voted.has(p.label) ? " (voted)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Choice</Label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {options.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setChoice(opt)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-sm transition-colors",
                        choice === opt ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40",
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="vc" className="text-xs text-muted-foreground">Comment (optional)</Label>
                <Textarea id="vc" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
              </div>
              <Button className="w-full" disabled={!household || !choice || submit.isPending} onClick={() => submit.mutate()}>
                <Send className="h-4 w-4" /> Record vote
              </Button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold">Ballots ({votes.data?.length ?? 0})</h3>
          {(votes.data?.length ?? 0) === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No votes yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {votes.data!.map((v) => (
                <li key={v.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-2 text-sm">
                  <div className="min-w-0">
                    <span className="font-medium">{v.household_label}</span> — {v.choice}
                    {v.comment && <p className="text-xs text-muted-foreground">{v.comment}</p>}
                  </div>
                  <button className="text-muted-foreground hover:text-destructive" onClick={() => del.mutate(v.id)} aria-label="Remove vote"><Trash2 className="h-4 w-4" /></button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Tally</h3>
            <span className={cn("flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase", result.quorumMet ? statusTone("voting") : "border-border bg-muted text-muted-foreground")}>
              <CalendarClock className="h-3 w-3" /> {result.totalVotes}/{result.quorum} quorum
            </span>
          </div>
          <div className="mt-3 space-y-3">
            {result.tallies.map((t) => (
              <div key={t.option}>
                <div className="flex items-center justify-between text-sm">
                  <span>{t.option}</span>
                  <span className="text-muted-foreground">{t.count} · {t.pct}%</span>
                </div>
                <Progress className="mt-1" value={t.pct} />
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg bg-muted/40 p-3 text-sm">
            {!result.quorumMet ? (
              <span className="text-muted-foreground">Quorum not yet met — {result.quorum - result.totalVotes} more household(s) needed.</span>
            ) : result.tie ? (
              <span className="text-gold-foreground">Quorum met, but the vote is tied.</span>
            ) : (
              <span className="text-emerald-600 dark:text-emerald-400">Quorum met — leading: <strong>{result.leader}</strong>.</span>
            )}
          </div>
          {decision.notice_date && (
            <p className="mt-2 text-xs text-muted-foreground">Notice given {decision.notice_date}.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function ExplanationTab({ decision, communityId }: { decision: Decision; communityId: string }) {
  const qc = useQueryClient();
  const [rationale, setRationale] = useState(decision.rationale ?? "");
  const { data: readiness } = useQuery({
    queryKey: ["scenario-readiness", communityId],
    queryFn: () => import("@/lib/onboarding/readiness").then((m) => m.checkScenarioReadiness(communityId)),
  });
  const blockedByUnresolved = (readiness?.unresolved ?? 0) > 0;

  const publish = useMutation({
    mutationFn: () => publishRationale(decision, rationale.trim()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["decisions", communityId] }); toast.success("Explanation published"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {blockedByUnresolved && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
          <span>
            Resolve the {readiness?.unresolved} property record{readiness?.unresolved === 1 ? "" : "s"} still missing an address before publishing this decision — the report should not cite unconfirmed properties.
          </span>
          <Button asChild size="sm" variant="outline">
            <Link to="/community/$id" params={{ id: communityId }} search={{ tab: "properties" }}>
              Review properties
            </Link>
          </Button>
        </div>
      )}
      {decision.status === "decided" && decision.outcome && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-xs font-semibold uppercase text-primary">Recorded outcome</p>
          <p className="mt-1 text-lg font-semibold">{decision.outcome}</p>
          {decision.decided_at && <p className="text-xs text-muted-foreground">Decided {new Date(decision.decided_at).toLocaleDateString()}</p>}
        </div>
      )}
      <div>
        <div className="flex items-center justify-between">
          <Label htmlFor="rat" className="text-xs text-muted-foreground">Published explanation</Label>
          {decision.rationale_version > 0 && <span className="text-xs text-muted-foreground">v{decision.rationale_version}</span>}
        </div>
        <Textarea id="rat" rows={6} className="mt-1" value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="Explain what was decided, why, and which evidence supported it. This becomes the community's official, versioned record." />
      </div>
      <Button onClick={() => publish.mutate()} disabled={publish.isPending || !rationale.trim() || blockedByUnresolved} title={blockedByUnresolved ? "Resolve unconfirmed properties first" : undefined}>
        <ScrollText className="h-4 w-4" /> {decision.rationale_version > 0 ? "Publish new version" : "Publish explanation"}
      </Button>
    </div>
  );
}
