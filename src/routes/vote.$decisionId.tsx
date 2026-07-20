import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ThumbsDown, ThumbsUp, Sparkles, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getPublicVoteContext,
  castAnonymousVote,
  type PublicVoteContext,
} from "@/lib/vote/public.functions";

export const Route = createFileRoute("/vote/$decisionId")({
  head: () => ({
    meta: [
      { title: "Vote on your road — RoadShare" },
      { name: "robots", content: "noindex" },
      {
        name: "description",
        content:
          "Your neighbor asked you to weigh in on a shared road project. Vote yes or not yet — no sign-in required.",
      },
    ],
  }),
  component: PublicVotePage,
});

function PublicVotePage() {
  const { decisionId } = Route.useParams();
  const qc = useQueryClient();
  const fetchCtx = useServerFn(getPublicVoteContext);
  const submitVote = useServerFn(castAnonymousVote);

  const ctx = useQuery({
    queryKey: ["public-vote", decisionId],
    queryFn: () => fetchCtx({ data: { decisionId } }),
    retry: false,
  });

  if (ctx.isLoading) {
    return <Shell><p className="text-sm text-muted-foreground">Loading…</p></Shell>;
  }
  if (ctx.error || !ctx.data) {
    return (
      <Shell>
        <h1 className="font-display text-2xl font-bold">This vote link isn't valid</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been removed by the person who shared it. Ask them for a fresh link.
        </p>
        <Link to="/" className="mt-6 inline-block text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="mr-1 inline h-4 w-4" /> Back to RoadShare
        </Link>
      </Shell>
    );
  }

  return (
    <Shell>
      <VoteBody
        ctx={ctx.data}
        onVote={async (household, choice, comment) => {
          await submitVote({ data: { decisionId, householdLabel: household, choice, comment } });
          await qc.invalidateQueries({ queryKey: ["public-vote", decisionId] });
        }}
      />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-fun-1/20 via-background to-fun-3/20 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
        >
          <Sparkles className="h-3.5 w-3.5 text-primary" /> RoadShare
        </Link>
        <div className="mt-4 rounded-3xl border border-border bg-card p-6 fun-shadow-sm sm:p-8">
          {children}
        </div>
      </div>
    </div>
  );
}

function VoteBody({
  ctx,
  onVote,
}: {
  ctx: PublicVoteContext;
  onVote: (household: string, choice: string, comment?: string) => Promise<void>;
}) {
  const { decision, community, parcels, votes } = ctx;
  const options = decision.options.length ? decision.options : ["👍 Yes, let's do it", "👎 Not yet"];
  const yesCount = votes.filter((v) => v.choice === options[0]).length;
  const noCount = votes.filter((v) => v.choice === options[1]).length;

  const householdChoices = useMemo(() => {
    const list = parcels.map((p) => ({
      value: p.label,
      label: p.address ? `${p.label} — ${p.address}` : p.label,
    }));
    return [...list, { value: "__other__", label: "My home isn't listed" }];
  }, [parcels]);

  const [household, setHousehold] = useState<string>(householdChoices[0]?.value ?? "__other__");
  const [customName, setCustomName] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const effectiveHousehold =
    household === "__other__" ? customName.trim() || "A neighbor" : household;
  const myVote = votes.find((v) => v.household_label === effectiveHousehold);

  async function submit(choice: string) {
    if (household === "__other__" && !customName.trim()) {
      toast.error("Add your name or home so your neighbors know who voted.");
      return;
    }
    setBusy(choice);
    try {
      await onVote(effectiveHousehold, choice, comment);
      toast.success(myVote ? "Vote updated" : "Thanks — your vote is in!");
      setComment("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't record vote");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <p className="text-xs font-bold uppercase tracking-wider text-primary">
        {community.name}
      </p>
      <h1 className="mt-1 font-display text-2xl font-bold tracking-tight sm:text-3xl">
        {decision.title}
      </h1>
      {decision.question && (
        <p className="mt-2 text-sm text-muted-foreground">{decision.question}</p>
      )}

      <div className="mt-5 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">👍 Yes</p>
          <p className="mt-1 font-display text-3xl font-bold">{yesCount}</p>
        </div>
        <div className="rounded-2xl border border-border bg-background p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">👎 Not yet</p>
          <p className="mt-1 font-display text-3xl font-bold">{noCount}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {votes.length} of {parcels.length || "?"} homes voted · needs {decision.quorum} to count
      </p>

      <div className="mt-6 space-y-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Which home is yours?
          </label>
          <Select value={household} onValueChange={setHousehold}>
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Pick your home" />
            </SelectTrigger>
            <SelectContent>
              {householdChoices.map((h) => (
                <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {household === "__other__" && (
            <Input
              className="mt-2"
              placeholder="Your name or home (so your neighbors know who voted)"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
            />
          )}
        </div>

        <Input
          placeholder="Optional — leave a short note for your neighbors"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-2">
          <Button
            size="lg"
            onClick={() => submit(options[0])}
            disabled={busy !== null}
            variant={myVote?.choice === options[0] ? "default" : "outline"}
          >
            <ThumbsUp className="h-4 w-4" /> Yes
          </Button>
          <Button
            size="lg"
            onClick={() => submit(options[1])}
            disabled={busy !== null}
            variant={myVote?.choice === options[1] ? "default" : "outline"}
          >
            <ThumbsDown className="h-4 w-4" /> Not yet
          </Button>
        </div>
      </div>

      {votes.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Your neighbors so far
          </p>
          <ul className="mt-2 space-y-2 text-sm">
            {votes.slice(0, 8).map((v) => (
              <li key={v.id} className="flex items-start gap-2">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                  {v.household_label}
                </span>
                <span className="text-muted-foreground">
                  {v.choice}
                  {v.comment ? ` — “${v.comment}”` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        No sign-in needed. Powered by RoadShare — a fair way for neighbors to share the cost of a private road.
      </p>
    </>
  );
}
