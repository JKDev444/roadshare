import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BarChart3,
  Check,
  ClipboardList,
  Lock,
  Plus,
  Send,
  ShieldCheck,
  Trash2,
  Users,
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
  analyze,
  createSurvey,
  deleteResponse,
  deleteSurvey,
  KIND_LABEL,
  listResponses,
  listSurveys,
  newQuestion,
  parseQuestions,
  STATUS_LABEL,
  submitResponse,
  updateSurvey,
  type AnswerMap,
  type QuestionKind,
  type Survey,
  type SurveyQuestion,
  type SurveyStatus,
} from "@/lib/pulse/api";

export const Route = createFileRoute("/_authenticated/pulse")({
  head: () => ({ meta: [{ title: "Community Pulse — RoadShare" }, { name: "robots", content: "noindex" }] }),
  component: PulsePage,
  errorComponent: () => (
    <AppShell><div className="mx-auto max-w-md py-20 text-center text-muted-foreground">Community Pulse could not be loaded.</div></AppShell>
  ),
});

function statusTone(s: SurveyStatus) {
  return s === "open"
    ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
    : s === "closed"
      ? "text-muted-foreground bg-muted border-border"
      : "text-gold-foreground bg-gold/10 border-gold/30";
}

function PulsePage() {
  const [communityId, setCommunityId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const communities = useQuery({ queryKey: ["communities"], queryFn: listCommunities });
  const cid = communityId || communities.data?.[0]?.id || "";

  const surveys = useQuery({ queryKey: ["surveys", cid], queryFn: () => listSurveys(cid), enabled: !!cid });

  const selected = useMemo(
    () => surveys.data?.find((s) => s.id === selectedId) ?? surveys.data?.[0] ?? null,
    [surveys.data, selectedId],
  );

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Community Pulse</h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              Build surveys, collect household-verified participation, and read aggregate results. Individuals are never scored or profiled, and results stay hidden until enough households respond.
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
          <EmptyState icon={ClipboardList} title="Create a community first" body="Surveys belong to a community. Add one from the Community Record page." />
        ) : (
          <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
            <SurveyList
              communityId={cid}
              surveys={surveys.data ?? []}
              loading={surveys.isLoading}
              selectedId={selected?.id ?? null}
              onSelect={setSelectedId}
            />
            {selected ? (
              <SurveyDetail key={selected.id} survey={selected} communityId={cid} />
            ) : (
              <EmptyState icon={BarChart3} title="No survey selected" body="Create a survey to start gathering community feedback." />
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function EmptyState({ icon: Icon, title, body }: { icon: typeof ClipboardList; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
      <Icon className="mx-auto h-8 w-8 text-muted-foreground" />
      <p className="mt-3 font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function SurveyList({
  communityId,
  surveys,
  loading,
  selectedId,
  onSelect,
}: {
  communityId: string;
  surveys: Survey[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Surveys</h2>
        <CreateSurveyDialog communityId={communityId} onCreated={onSelect} />
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : surveys.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">No surveys yet.</p>
      ) : (
        <div className="space-y-2">
          {surveys.map((s) => {
            const active = s.id === selectedId;
            return (
              <button
                key={s.id}
                onClick={() => onSelect(s.id)}
                className={cn(
                  "w-full rounded-xl border p-3 text-left transition-colors",
                  active ? "border-primary/50 bg-primary/5" : "border-border bg-card hover:border-primary/30",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-medium">{s.title}</span>
                  <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase", statusTone(s.status))}>{STATUS_LABEL[s.status]}</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{parseQuestions(s.questions).length} question(s)</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CreateSurveyDialog({ communityId, onCreated }: { communityId: string; onCreated: (id: string) => void }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const mut = useMutation({
    mutationFn: () =>
      createSurvey(communityId, {
        title: title.trim(),
        description: description.trim() || undefined,
        questions: [{ ...newQuestion("rating"), prompt: "How satisfied are you with the current road condition?", required: true }],
      }),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ["surveys", communityId] });
      setOpen(false);
      setTitle("");
      setDescription("");
      onCreated(s.id);
      toast.success("Survey created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline"><Plus className="h-4 w-4" /> New</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>New survey</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="stitle" className="text-xs text-muted-foreground">Title</Label>
            <Input id="stitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Road maintenance priorities 2026" />
          </div>
          <div>
            <Label htmlFor="sdesc" className="text-xs text-muted-foreground">Description (optional)</Label>
            <Textarea id="sdesc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button className="w-full" disabled={!title.trim() || mut.isPending} onClick={() => mut.mutate()}>Create survey</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SurveyDetail({ survey, communityId }: { survey: Survey; communityId: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 className="font-display text-xl font-bold">{survey.title}</h2>
          {survey.description && <p className="mt-1 text-sm text-muted-foreground">{survey.description}</p>}
        </div>
        <StatusControls survey={survey} communityId={communityId} />
      </div>
      <Tabs defaultValue={survey.status === "open" ? "collect" : "build"} className="p-5">
        <TabsList>
          <TabsTrigger value="build"><ClipboardList className="h-4 w-4" /> Build</TabsTrigger>
          <TabsTrigger value="collect"><Send className="h-4 w-4" /> Collect</TabsTrigger>
          <TabsTrigger value="results"><BarChart3 className="h-4 w-4" /> Results</TabsTrigger>
        </TabsList>
        <TabsContent value="build" className="pt-4"><BuildTab survey={survey} communityId={communityId} /></TabsContent>
        <TabsContent value="collect" className="pt-4"><CollectTab survey={survey} communityId={communityId} /></TabsContent>
        <TabsContent value="results" className="pt-4"><ResultsTab survey={survey} /></TabsContent>
      </Tabs>
    </div>
  );
}

function StatusControls({ survey, communityId }: { survey: Survey; communityId: string }) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["surveys", communityId] });

  const setStatus = useMutation({
    mutationFn: (status: SurveyStatus) => updateSurvey(survey.id, communityId, { status }),
    onSuccess: () => { invalidate(); toast.success("Status updated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: () => deleteSurvey(survey.id, communityId, survey.title),
    onSuccess: () => { invalidate(); toast.success("Survey deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex items-center gap-2">
      {survey.status !== "open" && (
        <Button size="sm" onClick={() => setStatus.mutate("open")} disabled={parseQuestions(survey.questions).length === 0}>Open</Button>
      )}
      {survey.status === "open" && (
        <Button size="sm" variant="outline" onClick={() => setStatus.mutate("closed")}>Close</Button>
      )}
      <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => del.mutate()} aria-label="Delete survey"><Trash2 className="h-4 w-4" /></Button>
    </div>
  );
}

function BuildTab({ survey, communityId }: { survey: Survey; communityId: string }) {
  const qc = useQueryClient();
  const [questions, setQuestions] = useState<SurveyQuestion[]>(parseQuestions(survey.questions));
  const [threshold, setThreshold] = useState(survey.min_report_threshold);

  const locked = survey.status !== "draft";

  const save = useMutation({
    mutationFn: () => updateSurvey(survey.id, communityId, { questions, min_report_threshold: threshold }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["surveys", communityId] }); toast.success("Survey saved"); },
    onError: (e: Error) => toast.error(e.message),
  });

  function patch(id: string, up: Partial<SurveyQuestion>) {
    setQuestions((qs) => qs.map((q) => (q.id === id ? { ...q, ...up } : q)));
  }

  if (locked) {
    return (
      <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        This survey is {STATUS_LABEL[survey.status].toLowerCase()} and its questions are locked to keep responses comparable. Close and duplicate to revise.
        <ul className="mt-3 space-y-1 text-foreground">
          {questions.map((q, i) => <li key={q.id}>{i + 1}. {q.prompt} <span className="text-muted-foreground">· {KIND_LABEL[q.kind]}</span></li>)}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {questions.map((q, i) => (
        <div key={q.id} className="rounded-xl border border-border p-4">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-muted-foreground">Question {i + 1}</span>
            <button className="text-muted-foreground hover:text-destructive" onClick={() => setQuestions((qs) => qs.filter((x) => x.id !== q.id))} aria-label="Remove question"><Trash2 className="h-4 w-4" /></button>
          </div>
          <Input className="mt-2" value={q.prompt} onChange={(e) => patch(q.id, { prompt: e.target.value })} placeholder="Question prompt" />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Select value={q.kind} onValueChange={(v) => patch(q.id, { kind: v as QuestionKind, options: (v === "single_choice" || v === "multi_choice") && q.options.length === 0 ? ["", ""] : q.options })}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(KIND_LABEL) as QuestionKind[]).map((k) => <SelectItem key={k} value={k}>{KIND_LABEL[k]}</SelectItem>)}</SelectContent>
            </Select>
            <label className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <input type="checkbox" checked={q.required} onChange={(e) => patch(q.id, { required: e.target.checked })} /> Required
            </label>
          </div>
          {(q.kind === "single_choice" || q.kind === "multi_choice") && (
            <div className="mt-3 space-y-2">
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <Input value={opt} onChange={(e) => patch(q.id, { options: q.options.map((o, k) => (k === oi ? e.target.value : o)) })} placeholder={`Option ${oi + 1}`} />
                  <button className="text-muted-foreground hover:text-destructive" onClick={() => patch(q.id, { options: q.options.filter((_, k) => k !== oi) })} aria-label="Remove option"><Trash2 className="h-4 w-4" /></button>
                </div>
              ))}
              <Button size="sm" variant="ghost" onClick={() => patch(q.id, { options: [...q.options, ""] })}><Plus className="h-4 w-4" /> Add option</Button>
            </div>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setQuestions((qs) => [...qs, newQuestion()])}><Plus className="h-4 w-4" /> Add question</Button>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-border bg-muted/20 p-4">
        <div>
          <Label htmlFor="thr" className="flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Privacy threshold</Label>
          <Input id="thr" type="number" min={2} className="mt-1 w-24" value={threshold} onChange={(e) => setThreshold(Math.max(2, Number(e.target.value) || 2))} />
        </div>
        <p className="flex-1 text-xs text-muted-foreground">Results stay hidden until at least this many households respond. This prevents identifying individuals in small groups.</p>
      </div>

      <Button onClick={() => save.mutate()} disabled={save.isPending || questions.some((q) => !q.prompt.trim())}>Save survey</Button>
    </div>
  );
}

function CollectTab({ survey, communityId }: { survey: Survey; communityId: string }) {
  const qc = useQueryClient();
  const questions = useMemo(() => parseQuestions(survey.questions), [survey.questions]);
  const [household, setHousehold] = useState("");
  const [answers, setAnswers] = useState<AnswerMap>({});

  const parcels = useQuery({ queryKey: ["parcels", communityId], queryFn: () => listParcels(communityId), enabled: !!communityId });
  const responses = useQuery({ queryKey: ["survey-responses", survey.id], queryFn: () => listResponses(survey.id) });

  const answered = new Set((responses.data ?? []).map((r) => r.household_label));

  const submit = useMutation({
    mutationFn: () => submitResponse(survey, household.trim(), answers),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["survey-responses", survey.id] });
      setAnswers({});
      setHousehold("");
      toast.success("Response recorded");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteResponse(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["survey-responses", survey.id] }); toast.success("Response removed"); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (survey.status !== "open") {
    return <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Open the survey to collect household responses.</div>;
  }

  const missingRequired = questions.some((q) => {
    if (!q.required) return false;
    const v = answers[q.id];
    return v == null || v === "" || (Array.isArray(v) && v.length === 0);
  });

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground">Household</Label>
          <Select value={household} onValueChange={setHousehold}>
            <SelectTrigger><SelectValue placeholder="Select a verified household…" /></SelectTrigger>
            <SelectContent>
              {(parcels.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.label} disabled={answered.has(p.label)}>
                  {p.label}{p.owner_name ? ` — ${p.owner_name}` : ""}{answered.has(p.label) ? " (responded)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Users className="h-3 w-3" /> One response per household keeps participation verified.</p>
        </div>

        {questions.map((q) => (
          <div key={q.id} className="rounded-xl border border-border p-3">
            <p className="text-sm font-medium">{q.prompt}{q.required && <span className="text-destructive"> *</span>}</p>
            <div className="mt-2">
              <QuestionInput q={q} value={answers[q.id]} onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))} />
            </div>
          </div>
        ))}

        <Button onClick={() => submit.mutate()} disabled={!household || missingRequired || submit.isPending}><Send className="h-4 w-4" /> Record response</Button>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Participation</h3>
        <p className="mt-1 text-xs text-muted-foreground">{answered.size} household(s) responded. Individual answers are stored for aggregate analysis only and never scored.</p>
        <div className="mt-3 space-y-2">
          {(responses.data ?? []).map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm">
              <span className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-600" /> Household {r.household_label}</span>
              <button className="text-muted-foreground hover:text-destructive" onClick={() => del.mutate(r.id)} aria-label="Remove response"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
          {(responses.data?.length ?? 0) === 0 && <p className="text-sm text-muted-foreground">No responses yet.</p>}
        </div>
      </div>
    </div>
  );
}

function QuestionInput({ q, value, onChange }: { q: SurveyQuestion; value: AnswerMap[string]; onChange: (v: AnswerMap[string]) => void }) {
  if (q.kind === "text") {
    return <Textarea rows={2} value={typeof value === "string" ? value : ""} onChange={(e) => onChange(e.target.value)} />;
  }
  if (q.kind === "rating") {
    const cur = Number(value) || 0;
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(n)} className={cn("h-9 w-9 rounded-md border text-sm font-semibold", cur >= n ? "border-gold bg-gold/20 text-gold-foreground" : "border-border text-muted-foreground")}>{n}</button>
        ))}
      </div>
    );
  }
  if (q.kind === "single_choice") {
    return (
      <div className="space-y-1.5">
        {q.options.filter(Boolean).map((opt) => (
          <label key={opt} className="flex items-center gap-2 text-sm">
            <input type="radio" name={q.id} checked={value === opt} onChange={() => onChange(opt)} /> {opt}
          </label>
        ))}
      </div>
    );
  }
  // multi_choice
  const arr = Array.isArray(value) ? value : [];
  return (
    <div className="space-y-1.5">
      {q.options.filter(Boolean).map((opt) => (
        <label key={opt} className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={arr.includes(opt)}
            onChange={(e) => onChange(e.target.checked ? [...arr, opt] : arr.filter((o) => o !== opt))}
          /> {opt}
        </label>
      ))}
    </div>
  );
}

function ResultsTab({ survey }: { survey: Survey }) {
  const responses = useQuery({ queryKey: ["survey-responses", survey.id], queryFn: () => listResponses(survey.id) });
  const questions = useMemo(() => parseQuestions(survey.questions), [survey.questions]);
  const analysis = useMemo(() => analyze(survey, responses.data ?? []), [survey, responses.data]);

  if (responses.isLoading) return <p className="text-sm text-muted-foreground">Loading results…</p>;

  if (analysis.suppressed) {
    return (
      <div className="rounded-xl border border-gold/40 bg-gold/10 p-5">
        <div className="flex items-start gap-3">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-gold-foreground" />
          <div>
            <p className="font-semibold text-gold-foreground">Results hidden to protect privacy</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {analysis.totalResponses} of {analysis.threshold} households have responded. Aggregate results appear once at least {analysis.threshold} households participate — this prevents identifying anyone in a small group.
            </p>
            <Progress className="mt-3 h-2 max-w-xs" value={Math.min(100, (analysis.totalResponses / analysis.threshold) * 100)} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4 text-emerald-600" /> Aggregate results from <strong className="mx-1 text-foreground">{analysis.totalResponses}</strong> households. No individual scoring or subgroup breakdowns.
      </div>
      {questions.map((q) => {
        const a = analysis.perQuestion[q.id];
        if (!a) return null;
        return (
          <div key={q.id} className="rounded-xl border border-border p-4">
            <p className="text-sm font-semibold">{q.prompt}</p>
            <div className="mt-3">
              {a.kind === "text" ? (
                <p className="text-sm text-muted-foreground">{a.count} written response(s). Open text is not aggregated to avoid quoting individuals.</p>
              ) : a.kind === "rating" ? (
                <div className="space-y-2">
                  <p className="text-sm">Average <span className="font-display text-lg font-bold text-primary">{a.average.toFixed(2)}</span> / 5 <span className="text-muted-foreground">({a.count} rated)</span></p>
                  {a.distribution.map((t) => <BarRow key={t.option} label={t.option} count={t.count} pct={t.pct} />)}
                </div>
              ) : (
                <div className="space-y-2">
                  {a.tallies.map((t) => <BarRow key={t.option} label={t.option || "(blank)"} count={t.count} pct={t.pct} />)}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BarRow({ label, count, pct }: { label: string; count: number; pct: number }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{count} · {pct}%</span>
      </div>
      <Progress className="mt-1 h-2" value={pct} />
    </div>
  );
}
