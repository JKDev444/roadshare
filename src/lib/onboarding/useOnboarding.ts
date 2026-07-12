import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  dismissHint,
  getChecklistProgress,
  getOnboardingState,
  updateOnboardingState,
  type ChecklistProgress,
  type OnboardingPatch,
  type OnboardingState,
} from "./api";

const STATE_KEY = ["onboarding", "state"] as const;
const PROGRESS_KEY = ["onboarding", "progress"] as const;

export function useOnboarding() {
  const qc = useQueryClient();

  const state = useQuery<OnboardingState>({
    queryKey: STATE_KEY,
    queryFn: getOnboardingState,
    staleTime: 60_000,
  });

  const progress = useQuery<ChecklistProgress>({
    queryKey: PROGRESS_KEY,
    queryFn: () => getChecklistProgress(state.data?.report_generated ?? false),
    enabled: state.isSuccess,
  });

  const update = useMutation({
    mutationFn: (patch: OnboardingPatch) => updateOnboardingState(patch),
    onSuccess: (data) => {
      qc.setQueryData(STATE_KEY, data);
      qc.invalidateQueries({ queryKey: PROGRESS_KEY });
    },
  });

  const dismiss = useMutation({
    mutationFn: (hintId: string) => dismissHint(hintId),
    onSuccess: (data) => qc.setQueryData(STATE_KEY, data),
  });

  return {
    state: state.data,
    progress: progress.data,
    isLoading: state.isLoading,
    update: update.mutate,
    updateAsync: update.mutateAsync,
    isUpdating: update.isPending,
    dismissHint: dismiss.mutate,
  };
}

/** Convenience hook for a single coach-mark: is it visible, and how to close it. */
export function useHint(hintId: string) {
  const { state, dismissHint } = useOnboarding();
  const visible = !!state && !state.dismissed_hints.includes(hintId);
  return { visible, dismiss: () => dismissHint(hintId) };
}