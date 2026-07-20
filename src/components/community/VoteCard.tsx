import { useMemo, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
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
import type { Decision, DecisionVote } from "@/lib/decisions/api";
import { parseOptions, tally } from "@/lib/decisions/api";
import type { Parcel } from "@/lib/community/api";

type Props = {
  decision: Decision;
  votes: DecisionVote[];
  parcels: Parcel[];
  onVote: (household: string, choice: string, comment?: string) => Promise<void>;
};

/**
 * Neighbor-facing vote card rendered above the planner when the URL includes
 * a ?decision=<id>. Simple 👍 / 👎 (+ optional comment) reusing the decisions
 * schema. Lives in the same route as the planner so a shared link opens both.
 */
export function VoteCard({ decision, votes, parcels, onVote }: Props) {
  const options = useMemo(() => parseOptions(decision.options), [decision.options]);
  const [household, setHousehold] = useState<string>(
    parcels[0]?.label ?? "Neighbor",
  );
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const t = tally(decision, votes);
  const yes = t.tallies[0];
  const no = t.tallies[1];
  const myVote = votes.find((v) => v.household_label === household);

  async function submit(choice: string) {
    setBusy(choice);
    try {
      await onVote(household, choice, comment);
      toast.success(myVote ? "Vote updated" : "Vote recorded");
      setComment("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't record vote");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-2xl border border-primary/40 bg-gradient-to-br from-primary/10 via-card to-fun-3/10 p-5 fun-shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-primary">
        Your neighbors are voting
      </p>
      <h2 className="mt-1 font-display text-xl font-bold tracking-tight">
        {decision.title}
      </h2>
      {decision.question && (
        <p className="mt-1 text-sm text-muted-foreground">{decision.question}</p>
      )}

      <div className="mt-4 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            👍 Yes
          </p>
          <p className="mt-1 font-display text-2xl font-bold">{yes?.count ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-background p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            👎 Not yet
          </p>
          <p className="mt-1 font-display text-2xl font-bold">{no?.count ?? 0}</p>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {t.totalVotes} of {parcels.length || "?"} homes voted · needs {decision.quorum} to
        count
      </p>

      {parcels.length > 0 && (
        <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <Select value={household} onValueChange={setHousehold}>
            <SelectTrigger>
              <SelectValue placeholder="Which home is yours?" />
            </SelectTrigger>
            <SelectContent>
              {parcels.map((p) => (
                <SelectItem key={p.id} value={p.label}>
                  {p.label}
                  {p.address ? ` — ${p.address}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => options[0] && submit(options[0])}
            disabled={!options[0] || busy !== null}
            variant={myVote?.choice === options[0] ? "default" : "outline"}
          >
            <ThumbsUp className="h-4 w-4" /> Yes
          </Button>
          <Button
            onClick={() => options[1] && submit(options[1])}
            disabled={!options[1] || busy !== null}
            variant={myVote?.choice === options[1] ? "default" : "outline"}
          >
            <ThumbsDown className="h-4 w-4" /> Not yet
          </Button>
          <Input
            className="sm:col-span-3"
            placeholder="Optional — leave a short note for your neighbors"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
          />
        </div>
      )}

      {votes.length > 0 && (
        <ul className="mt-4 space-y-2 text-xs">
          {votes.slice(0, 5).map((v) => (
            <li key={v.id} className="flex items-start gap-2">
              <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">
                {v.household_label}
              </span>
              <span className="text-muted-foreground">
                {v.choice}
                {v.comment ? ` — “${v.comment}”` : ""}
              </span>
            </li>
          ))}
          {votes.length > 5 && (
            <li className="text-muted-foreground">and {votes.length - 5} more…</li>
          )}
        </ul>
      )}
    </div>
  );
}