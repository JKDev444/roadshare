import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/ask")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard" });
  },
  component: () => null,
});

const SUGGESTIONS = [
  "Who is responsible for maintaining the main road?",
  "How are road maintenance costs shared between parcels?",
  "What does the record say about access rights?",
  "Which provisions govern amendments to the agreement?",
];

function AskPage() {
  const qc = useQueryClient();
  const [communityId, setCommunityId] = useState("");
  const [question, setQuestion] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const communities = useQuery({ queryKey: ["communities"], queryFn: listCommunities });
  const cid = communityId || communities.data?.[0]?.id || "";

  const history = useQuery({ queryKey: ["qa-answers", cid], queryFn: () => listAnswers(cid), enabled: !!cid });
  const ask = useServerFn(askCommunity);

  const askMut = useMutation({
    mutationFn: async (q: string) => {
      const evidence = await buildEvidence(cid);
      const result = await ask({ data: { question: q, evidence } });
      await saveAnswer(cid, q, result);
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["qa-answers", cid] });
      setQuestion("");
      inputRef.current?.focus();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteAnswer(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["qa-answers", cid] }); toast.success("Answer removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const answers = history.data ?? [];
  const busy = askMut.isPending;

  function submit() {
    const q = question.trim();
    if (!q || busy || !cid) return;
    askMut.mutate(q);
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Ask My Community</h1>
            <p className="text-sm text-muted-foreground">Evidence-first answers drawn only from your verified record — always cited, with confidence scoring, and honest abstention when the record can't say.</p>
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
            <MessageSquareQuote className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="mt-3 font-medium">Create a community first</p>
            <p className="text-sm text-muted-foreground">Answers are built from a community's verified record. Add one from the Community Record page.</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-border bg-card p-4">
              <Label htmlFor="q" className="text-xs text-muted-foreground">Your question</Label>
              <Textarea
                id="q"
                ref={inputRef}
                rows={3}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit(); }}
                placeholder="Ask anything about this community's roads, costs, or governing provisions…"
                className="mt-1.5"
              />
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => setQuestion(s)} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground">{s}</button>
                  ))}
                </div>
                <Button onClick={submit} disabled={busy || !question.trim()}>
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Ask
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Answers are advisory and cite only your verified record — not legal advice.</p>
            </div>

            {busy && (
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Searching the verified record and composing a cited answer…
              </div>
            )}

            {history.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading answer history…</p>
            ) : answers.length === 0 && !busy ? (
              <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
                No questions yet. Ask one above — every answer is saved with its citations.
              </div>
            ) : (
              <div className="space-y-4">
                {answers.map((a) => <AnswerCard key={a.id} answer={a} onDelete={() => del.mutate(a.id)} />)}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}

function AnswerCard({ answer, onDelete }: { answer: QaAnswer; onDelete: () => void }) {
  const citations = useMemo(() => parseCitations(answer.citations), [answer.citations]);
  const conf = confidenceLabel(Number(answer.confidence));
  const tone = conf.tone === "green" ? "text-emerald-600 dark:text-emerald-400" : conf.tone === "amber" ? "text-gold-foreground" : "text-destructive";

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="font-display font-semibold leading-snug">{answer.question}</p>
        <button onClick={onDelete} className="shrink-0 text-muted-foreground transition-colors hover:text-destructive" aria-label="Delete answer"><Trash2 className="h-4 w-4" /></button>
      </div>

      {answer.abstained ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-gold/40 bg-gold/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-gold-foreground" />
          <div><span className="font-semibold text-gold-foreground">Not enough evidence to answer. </span><span className="text-muted-foreground">{answer.answer}</span></div>
        </div>
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{answer.answer}</p>
      )}

      {answer.high_risk && (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div><span className="font-semibold text-destructive">High-risk — professional review recommended. </span><span className="text-muted-foreground">{answer.risk_reason ?? "This question may have legal or financial consequences; consult a qualified professional."}</span></div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!answer.abstained && (
          <span className={cn("inline-flex items-center gap-1 text-xs font-semibold", tone)}>
            <Sparkles className="h-3 w-3" /> {conf.label} · {Math.round(Number(answer.confidence) * 100)}%
          </span>
        )}
      </div>

      {citations.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Citations</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {citations.map((c) => (
              <li key={c.ref} className="flex gap-2">
                <span className="font-semibold text-primary">[{c.ref}]</span> <span>{c.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}