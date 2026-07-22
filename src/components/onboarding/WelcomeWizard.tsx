import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Route as RouteIcon, Sparkles, Home } from "lucide-react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useOnboarding } from "@/lib/onboarding/useOnboarding";
import { applyCcrDraft } from "@/lib/onboarding/api";
import { coerceCcrDraft, type CcrDraft } from "@/lib/onboarding/ccrDraft";
import { createJob, listActiveJob, dismissJob, processJob, type OnboardingJobRow } from "@/lib/onboarding/jobs.functions";

import { BasicInfoStep, type BasicInfo } from "./steps/BasicInfoStep";
import { DocsQuestionStep } from "./steps/DocsQuestionStep";
import { UploadStep } from "./steps/UploadStep";
import { NoDocsStep, type NoDocsResult } from "./steps/NoDocsStep";
import { ProcessingStep } from "./steps/ProcessingStep";
import { SuccessSummaryStep } from "./steps/SuccessSummaryStep";
import { FailureStep } from "./steps/FailureStep";
import { ReviewWorkspace } from "./steps/ReviewWorkspace";
import { CommunityReadyStep } from "./steps/CommunityReadyStep";
import { StartChoiceStep } from "./steps/StartChoiceStep";
import { FindNeighborsStep } from "./steps/FindNeighborsStep";
import { useSession } from "@/lib/auth/useSession";
import {
  clearResumeState,
  loadResumeState,
  saveResumeState,
  type ResumeStep,
} from "@/lib/onboarding/resumeState";

type Step =
  | "welcome"
  | "start"
  | "basic"
  | "docsQ"
  | "upload"
  | "nodocs"
  | "findNeighbors"
  | "processing"
  | "success"
  | "failure"
  | "review"
  | "created"
  | "sample";

const SAMPLE_DRAFT: CcrDraft = {
  community: {
    name: "Cedar Hollow (Sample)",
    region: "Larimer County, CO",
    description: "Sample workspace — 12-home private road community with a shared gravel lane and cul-de-sac. Safe to delete anytime.",
  },
  lots: Array.from({ length: 12 }).map((_, i) => ({
    label: `Home ${i + 1}`,
    owner_name: null,
    address: null,
    area_sqft: null,
    frontage_ft: null,
    provenance: "sample" as const,
  })),
  roads: [
    { name: "Cedar Hollow Lane", responsibility: "shared", surface: "gravel", provenance: "sample" as const, has_geometry: true },
    { name: "Aspen Court", responsibility: "shared", surface: "gravel", provenance: "sample" as const, has_geometry: true },
  ],
  maintenance_summary:
    "All 12 homeowners share the cost of grading and snow removal equally.",
  assessment_formula: "Equal 1/12 share per lot",
  meta: {
    community_found: true,
    region_found: true,
    addresses_found: 0,
    lot_refs_found: 12,
    roads_found: 2,
    maintenance_found: true,
    formula_found: true,
    missing_exhibits: [],
    documents_processed: 0,
  },
};

/** Main onboarding wizard. State-machine walk-through per RoadShare spec. */
export function WelcomeWizard({ forceOpen }: { forceOpen?: boolean } = {}) {
  const { state, progress, update } = useOnboarding();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useSession();
  const userId = user?.id;

  const createJobFn = useServerFn(createJob);
  const listActiveJobFn = useServerFn(listActiveJob);
  const dismissJobFn = useServerFn(dismissJob);
  const processJobFn = useServerFn(processJob);

  const hasCommunity = progress?.community ?? false;
  const skipped = state?.wizard_skipped ?? false;
  const completed = state?.wizard_completed ?? false;

  const shouldOpen = forceOpen || (!!state && !hasCommunity && !skipped && !completed);
  const [openOverride, setOpenOverride] = useState<boolean | null>(null);
  const open = openOverride ?? shouldOpen;

  const [step, setStep] = useState<Step>("start");
  const [nodocsMode, setNodocsMode] = useState<"menu" | "paste" | "manual">("menu");
  const [confirmClose, setConfirmClose] = useState(false);
  const [basicInfo, setBasicInfo] = useState<BasicInfo | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobFilenames, setJobFilenames] = useState<string[]>([]);
  const [finishedJob, setFinishedJob] = useState<OnboardingJobRow | null>(null);
  const [draft, setDraft] = useState<CcrDraft | null>(null);
  const [applying, setApplying] = useState(false);
  const [applyProgress, setApplyProgress] = useState<{ done: number; total: number; phase: string } | null>(null);
  const [creatingJob, setCreatingJob] = useState(false);
  const [focusUnresolved, setFocusUnresolved] = useState(false);
  const [created, setCreated] = useState<{
    id: string;
    name: string;
    region: string | null;
    homeCount: number;
    roadCount: number;
    documentCount: number;
  } | null>(null);

  // Resume any in-flight job when the wizard opens.
  useEffect(() => {
    if (!open || jobId) return;
    let cancelled = false;
    (async () => {
      try {
        const job = await listActiveJobFn();
        if (cancelled || !job) return;
        setJobId(job.id);
        setJobFilenames(job.filenames);
        if (job.status === "succeeded" && job.result) {
          setDraft(coerceCcrDraft(job.result));
          setFinishedJob(job);
          setStep("success");
        } else if (job.status === "failed") {
          setFinishedJob(job);
          setStep("failure");
        } else if (job.status === "cancelled") {
          // ignore
        } else {
          setStep("processing");
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, jobId, listActiveJobFn]);

  // Restore in-browser resume state when the wizard opens without an in-flight job.
  const resumeAttemptedRef = useRef(false);
  useEffect(() => {
    if (!open || jobId) return;
    if (step !== "start") return;
    // Only ever auto-restore once per open — otherwise Back buttons that
    // return to "start" would immediately be re-forwarded to the saved step.
    if (resumeAttemptedRef.current) return;
    resumeAttemptedRef.current = true;
    const saved = loadResumeState(userId);
    if (!saved) return;
    if (saved.basicInfo) setBasicInfo(saved.basicInfo);
    // Only restore to steps that don't need external state we haven't loaded.
    const restoreable: ResumeStep[] = ["basic", "findNeighbors", "nodocs", "upload"];
    if (restoreable.includes(saved.step)) {
      setStep(saved.step as Step);
    }
  }, [open, jobId, step, userId]);

  // Reset the resume guard when the wizard closes, so the next open still restores.
  useEffect(() => {
    if (!open) resumeAttemptedRef.current = false;
  }, [open]);

  // Persist a lightweight snapshot whenever the user's step or basicInfo changes.
  useEffect(() => {
    if (!open || !userId) return;
    const persistable: Step[] = ["basic", "findNeighbors", "nodocs", "upload"];
    if (persistable.includes(step)) {
      saveResumeState(userId, {
        step: step as ResumeStep,
        basicInfo,
        savedAt: Date.now(),
      });
    }
  }, [step, basicInfo, open, userId]);

  function close(markSkip = false) {
    setOpenOverride(false);
    if (markSkip && !completed) update({ wizard_skipped: true });
    if (completed) clearResumeState(userId);
    // If the user is exiting mid-flow, drop the resume snapshot too so a
    // "Save & exit" is a real exit — not a trap that reopens the wizard.
    if (markSkip) clearResumeState(userId);
    // Strip the ?welcome=1 param so the dashboard behind the wizard is a
    // clean landing instead of re-triggering forceOpen on refresh.
    if (typeof window !== "undefined" && window.location.search) {
      window.history.replaceState(null, "", "/dashboard");
    }
    setTimeout(() => {
      setStep("start");
      setNodocsMode("menu");
      setBasicInfo(null);
      setJobId(null);
      setJobFilenames([]);
      setFinishedJob(null);
      setDraft(null);
      setFocusUnresolved(false);
      setCreated(null);
      setConfirmClose(false);
    }, 200);
  }

  /** Intercept an attempted close: from mid-flow, ask for confirmation first. */
  function requestClose() {
    const midFlow: Step[] = [
      "basic",
      "findNeighbors",
      "nodocs",
      "upload",
      "processing",
      "success",
      "review",
    ];
    if (midFlow.includes(step)) {
      setConfirmClose(true);
      return;
    }
    close(true);
  }

  const applyDraft = useCallback(
    async (d: CcrDraft) => {
      if (applying) return;
      setApplying(true);
      setApplyProgress({ done: 0, total: d.lots.length + Math.min(d.roads.length, 20) + 1, phase: "Starting…" });
      try {
        const community = await applyCcrDraft(d, {
          onProgress: (done, total, phase) => setApplyProgress({ done, total, phase }),
        });
        if (jobId) await dismissJobFn({ data: { jobId } });
        await qc.invalidateQueries({ queryKey: ["onboarding", "progress"] });
        await qc.invalidateQueries({ queryKey: ["dashboard", "stats"] });
        update({ wizard_completed: true, wizard_skipped: false });
        clearResumeState(userId);
        toast.success(`${community.name} is ready`);
        setCreated({
          id: community.id,
          name: community.name,
          region: d.community.region ?? null,
          homeCount: d.lots.length,
          roadCount: d.roads.length,
          documentCount: finishedJob?.filenames?.length ?? jobFilenames.length,
        });
        setStep("created");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setApplying(false);
        setApplyProgress(null);
      }
    },
    [applying, dismissJobFn, finishedJob, jobFilenames, jobId, qc, update],
  );

  async function submitUpload(files: { file: File; dataUrl: string }[]) {
    if (creatingJob) return;
    setCreatingJob(true);
    try {
      const res = await createJobFn({
        data: {
          files: files.map((f) => ({ filename: f.file.name, dataUrl: f.dataUrl })),
        },
      });
      setJobId(res.jobId);
      setJobFilenames(files.map((f) => f.file.name));
      setStep("processing");
      // Fire processing in the background. The request stays open so the
      // serverless worker keeps running until extraction completes. If the
      // browser disconnects, ProcessingStep's stall detector will call
      // resumeJob after 60s. Errors are surfaced via the job row.
      void processJobFn({ data: { jobId: res.jobId } }).catch(() => {
        // The polling loop reads job status; nothing to do here.
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setCreatingJob(false);
    }
  }

  function handleNoDocs(r: NoDocsResult) {
    if (!basicInfo) return;
    // Build a draft directly from the collected info + user-entered addresses.
    const communityName =
      basicInfo.communityName ||
      (basicInfo.city ? `${basicInfo.city} Road Group` : "My Road Group");
    const region =
      [basicInfo.city, basicInfo.state].filter(Boolean).join(", ") || null;
    let lots: CcrDraft["lots"] = [];
    let roads: CcrDraft["roads"] = [];
    if (r.kind === "addresses") {
      lots = r.items.map((it) => ({
        label: it.label,
        address: it.address ?? null,
        provenance: "entered" as const,
      }));
    } else if (r.kind === "manual") {
      lots = r.items.map((it, i) => ({
        label: it.label || (it.lot ? `Home ${it.lot}` : `Home ${i + 1}`),
        address: it.address || null,
        provenance: "entered" as const,
      }));
    }
    // Include the starting address as first lot when going the "no docs" path.
    if (basicInfo.startingAddress) {
      lots = [
        { label: "Home 1", address: basicInfo.startingAddress, provenance: "entered" as const },
        ...lots.map((l, i) => ({ ...l, label: `Home ${i + 2}` })),
      ];
    }
    const d: CcrDraft = {
      community: {
        name: communityName,
        region,
        description: null,
      },
      lots,
      roads,
      maintenance_summary: null,
      assessment_formula: null,
      meta: {
        community_found: !!basicInfo.communityName,
        region_found: !!region,
        addresses_found: lots.filter((l) => l.address).length,
        lot_refs_found: lots.length,
        roads_found: roads.length,
        maintenance_found: false,
        formula_found: false,
        missing_exhibits: [],
        documents_processed: 0,
      },
    };
    setDraft(d);
    setStep("review");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) setOpenOverride(true);
        else requestClose();
      }}
    >
      <WizardBodyLock open={open} />
      <DialogContent
        className={cn(
          "max-w-2xl overflow-hidden",
          step === "review" && "max-w-4xl",
        )}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <VisuallyHidden>
          <DialogTitle>Set up your road group</DialogTitle>
          <DialogDescription>
            Guided setup to add your community, properties, and roads.
          </DialogDescription>
        </VisuallyHidden>
        {applying && applyProgress && (
          <div className="absolute inset-x-0 top-0 z-20 border-b border-primary/30 bg-primary/10 px-4 py-2">
            <div className="flex items-center justify-between text-xs font-medium text-primary">
              <span>{applyProgress.phase}</span>
              <span>
                {Math.min(applyProgress.done, applyProgress.total)} / {applyProgress.total}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-primary/20">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: `${Math.min(100, (applyProgress.done / Math.max(1, applyProgress.total)) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}
        <div className="relative mb-3 overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-fun-2/5 to-fun-3/10 px-4 py-2.5">
          <div className="relative flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground shadow-md">
              <RouteIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="font-display text-base font-bold leading-tight tracking-tight">
                Set up your road group
              </p>
              <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">
                {step === "welcome"
                  ? "Welcome — this takes about 2 minutes"
                  : step === "start"
                    ? "Pick how you want to start"
                  : step === "basic"
                    ? "Takes about 2 minutes"
                    : step === "review"
                    ? "Review your workspace"
                      : step === "docsQ"
                        ? "Choose your path"
                        : "Setup"}
              </p>
            </div>
          </div>
        </div>

        <div className="max-h-[80vh] overflow-y-auto pr-1">
          {step === "start" && (
            <StartChoiceStep
              onPick={(choice) => {
                if (choice === "docs") {
                  if (!basicInfo) {
                    setBasicInfo({ communityName: "", city: "", state: "", startingAddress: "" });
                  }
                  setStep("upload");
                } else if (choice === "address") setStep("basic");
                else if (choice === "paste") {
                  setBasicInfo({ communityName: "", city: "", state: "", startingAddress: "" });
                  setNodocsMode("paste");
                  setStep("nodocs");
                }
                else {
                  // "manual" — we still need a stub basicInfo for handleNoDocs.
                  setBasicInfo({ communityName: "", city: "", state: "", startingAddress: "" });
                  setNodocsMode("manual");
                  setStep("nodocs");
                }
              }}
              onSample={() => {
                setDraft(SAMPLE_DRAFT);
                setJobFilenames([]);
                setStep("review");
              }}
              onLater={() => close(true)}
            />
          )}

          {step === "basic" && (
            <BasicInfoStep
              initial={basicInfo ?? undefined}
              onContinue={(info) => {
                setBasicInfo(info);
                // If we got real coordinates, auto-find neighbors first.
                if (typeof info.lat === "number" && typeof info.lng === "number") {
                  setStep("findNeighbors");
                } else {
                  setStep("nodocs");
                }
              }}
              onNoAddress={(info) => {
                setBasicInfo(info);
                setStep("nodocs");
              }}
              onBack={() => setStep("start")}
              onSample={() => {
                setDraft(SAMPLE_DRAFT);
                setJobFilenames([]);
                setStep("review");
              }}
              onLater={() => close(true)}
            />
          )}

          {step === "findNeighbors" && basicInfo && (
            <FindNeighborsStep
              basicInfo={basicInfo}
              onConfirm={(result) => {
                void handleNoDocs(result);
              }}
              onManualInstead={() => setStep("nodocs")}
              onBack={() => setStep("basic")}
            />
          )}

          {step === "docsQ" && (
            <DocsQuestionStep
              onAnswer={(a) =>
                setStep(
                  a === "yes" ? "upload" : "nodocs",
                )
              }
              onBack={() => setStep("basic")}
            />
          )}

          {step === "upload" && (
            <UploadStep
              onSubmit={submitUpload}
              onSkip={() => setStep("nodocs")}
              submitting={creatingJob}
            />
          )}

          {step === "nodocs" && basicInfo && (
            <NoDocsStep
              state={basicInfo?.state}
              basicInfo={basicInfo}
              onSubmit={handleNoDocs}
              onUploadInstead={() => setStep("upload")}
              onBack={() => {
                setNodocsMode("menu");
                setStep("start");
              }}
              submitting={applying}
              initialMode={nodocsMode}
            />
          )}

          {step === "processing" && jobId && (
            <ProcessingStep
              jobId={jobId}
              filenames={jobFilenames}
              onSucceeded={(job) => {
                setFinishedJob(job);
                if (job.result) setDraft(coerceCcrDraft(job.result));
                setStep("success");
              }}
              onFailed={(job) => {
                setFinishedJob(job);
                setStep("failure");
              }}
              onLeave={() => close(false)}
            />
          )}

          {step === "success" && draft && (
            <SuccessSummaryStep
              draft={draft}
              filenames={finishedJob?.filenames ?? jobFilenames}
              onReviewImportant={() => {
                setFocusUnresolved(true);
                setStep("review");
              }}
              onReviewAll={() => {
                setFocusUnresolved(false);
                setStep("review");
              }}
              onUploadAnother={() => setStep("upload")}
              onSaveForLater={() => close(false)}
            />
          )}

          {step === "failure" && finishedJob && (
            <FailureStep
              job={finishedJob}
              onRetry={() => setStep("upload")}
              onReplace={() => setStep("upload")}
              onContinueWithout={() => setStep("nodocs")}
              onSaveForLater={() => close(false)}
            />
          )}

          {step === "review" && draft && (
            <ReviewWorkspace
              draft={draft}
              filenames={finishedJob?.filenames ?? jobFilenames}
              onChange={setDraft}
              onFinish={applyDraft}
              onSaveForLater={() => close(false)}
              applying={applying}
              focusUnresolved={focusUnresolved}
            />
          )}

          {step === "created" && created && (
            <CommunityReadyStep
              communityName={created.name}
              region={created.region}
              homeCount={created.homeCount}
              roadCount={created.roadCount}
              roadFeet={0}
              documentCount={created.documentCount}
              onGoHome={() => {
                setOpenOverride(false);
                setTimeout(() => {
                  void navigate({
                    to: "/community/$id",
                    params: { id: created.id },
                    search: { tab: "roads", justCreated: "1" },
                  });
                }, 100);
              }}
              onReviewRoad={() => {
                setOpenOverride(false);
                setTimeout(() => {
                  void navigate({
                    to: "/community/$id",
                    params: { id: created.id },
                    search: { tab: "roads" },
                  });
                }, 100);
              }}
              onUploadDocuments={() => {
                setOpenOverride(false);
                setTimeout(() => {
                  void navigate({ to: "/documents" });
                }, 100);
              }}
              onAddNeighbors={() => {
                setOpenOverride(false);
                setTimeout(() => {
                  void navigate({
                    to: "/community/$id",
                    params: { id: created.id },
                    search: { tab: "homes" },
                  });
                }, 100);
              }}
            />
          )}
        </div>
      </DialogContent>
      {confirmClose && (
        <ConfirmSaveExit
          onCancel={() => setConfirmClose(false)}
          onExit={() => {
            setConfirmClose(false);
            close(true);
          }}
        />
      )}
    </Dialog>
  );
}

function ConfirmSaveExit({
  onCancel,
  onExit,
}: {
  onCancel: () => void;
  onExit: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-5 shadow-2xl">
        <h3 className="font-display text-lg font-bold">Save and finish later?</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          We'll remember where you left off so you can pick right back up from your
          dashboard.
        </p>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Keep going
          </Button>
          <Button size="sm" onClick={onExit}>
            Save & exit
          </Button>
        </div>
      </div>
    </div>
  );
}

function WelcomeScreen({
  onStart,
  onSample,
  onLater,
}: {
  onStart: () => void;
  onSample: () => void;
  onLater: () => void;
}) {
  return (
    <div className="space-y-4 py-2">
      <div>
        <h1 className="font-display text-2xl font-bold">Let's set up your road group</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We'll help you identify the properties, roads, and any rules that explain how
          maintenance costs should be shared. You can change anything later.
        </p>
      </div>

      <ul className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
        <li>You'll answer a few quick questions about your community.</li>
        <li>If you have documents (CC&amp;R, plat, road agreement), we'll read them for you.</li>
        <li>If you don't, we'll help you enter the properties by hand.</li>
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <Button variant="ghost" size="sm" onClick={onLater}>
          I'll finish this later
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={onSample}>
            <Sparkles className="h-4 w-4" /> Load Cedar Hollow (Sample)
          </Button>
          <Button size="sm" onClick={onStart}>
            Get Started
          </Button>
        </div>
      </div>
    </div>
  );
}

function WizardBodyLock({ open }: { open: boolean }) {
  useEffect(() => {
    if (!open) return;
    document.body.setAttribute("data-wizard-open", "true");
    return () => document.body.removeAttribute("data-wizard-open");
  }, [open]);
  return null;
}