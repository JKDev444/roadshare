import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  cancelJob,
  getJob,
  JOB_STAGES,
  resumeJob,
  type OnboardingJobRow,
} from "@/lib/onboarding/jobs.functions";

function formatElapsed(startedAt: string): string {
  const diff = Math.max(0, (Date.now() - new Date(startedAt).getTime()) / 1000);
  const m = Math.floor(diff / 60);
  const s = Math.floor(diff % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Step 3A processing screen. Polls the job row, shows staged progress, and
 *  auto-resumes if the worker stalled. */
export function ProcessingStep({
  jobId,
  filenames,
  onSucceeded,
  onFailed,
  onLeave,
}: {
  jobId: string;
  filenames: string[];
  onSucceeded: (job: OnboardingJobRow) => void;
  onFailed: (job: OnboardingJobRow) => void;
  onLeave: () => void;
}) {
  const getJobFn = useServerFn(getJob);
  const cancelJobFn = useServerFn(cancelJob);
  const resumeJobFn = useServerFn(resumeJob);
  const [tick, setTick] = useState(0);

  const { data: job } = useQuery({
    queryKey: ["onboarding-job", jobId],
    queryFn: () => getJobFn({ data: { jobId } }),
    refetchInterval: (q) => {
      const row = q.state.data as OnboardingJobRow | null | undefined;
      if (!row) return 2000;
      if (row.status === "succeeded" || row.status === "failed" || row.status === "cancelled") return false;
      return 2000;
    },
    refetchIntervalInBackground: true,
  });

  // 1-second UI tick for elapsed timer.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Terminal transitions.
  useEffect(() => {
    if (!job) return;
    if (job.status === "succeeded") onSucceeded(job);
    else if (job.status === "failed") onFailed(job);
  }, [job, onSucceeded, onFailed]);

  // Auto-resume if the worker stalled (>60s without updates).
  useEffect(() => {
    if (!job) return;
    if (job.status !== "processing" && job.status !== "uploading") return;
    const stale = Date.now() - new Date(job.updated_at).getTime() > 60_000;
    if (stale) {
      void resumeJobFn({ data: { jobId } });
    }
  }, [job, tick, jobId, resumeJobFn]);

  const stageIndex = job?.stage_index ?? 0;
  const progress = job?.progress ?? 0;
  const startedAt = job?.started_at ?? new Date().toISOString();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-xl font-semibold">Reading your documents</h2>
          <p className="text-xs text-muted-foreground">
            RoadShare is building your starting workspace. Longer or scanned documents may take a few minutes.
          </p>
        </div>
      </div>

      <Progress value={Math.max(progress, 2)} className="h-2" />

      <ul className="space-y-1.5 text-sm">
        {JOB_STAGES.map((label, i) => {
          const done = i < stageIndex || job?.status === "succeeded";
          const active = i === stageIndex && !done;
          return (
            <li
              key={label}
              className={`flex items-center gap-2 ${
                done ? "text-foreground" : active ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              {done ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
              ) : active ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
              ) : (
                <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-border" />
              )}
              <span className={done ? "line-through decoration-muted-foreground/40" : ""}>{label}</span>
            </li>
          );
        })}
      </ul>

      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <p><strong className="text-foreground">Uploaded:</strong> {filenames.join(", ")}</p>
        <p className="mt-0.5">Elapsed: {formatElapsed(startedAt)}</p>
        <p className="mt-1">
          You may leave this screen. We'll save the result and you'll see it when you come back.
        </p>
      </div>

      <div className="flex items-center justify-between pt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={async () => {
            await cancelJobFn({ data: { jobId } });
            onLeave();
          }}
        >
          Cancel processing
        </Button>
        <Button variant="outline" size="sm" onClick={onLeave}>
          <AlertTriangle className="h-3.5 w-3.5" />
          Leave and return later
        </Button>
      </div>
    </div>
  );
}