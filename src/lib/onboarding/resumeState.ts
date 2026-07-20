/**
 * Onboarding resume state (client-side, sessionStorage-backed).
 *
 * When a user closes the wizard partway through, we snapshot enough state
 * that the dashboard can offer "Pick up where you left off" and the wizard
 * can hop straight back to the same step. Keyed by user id so multiple
 * accounts on the same browser don't step on each other.
 */

import type { BasicInfo } from "@/components/onboarding/steps/BasicInfoStep";

export type ResumeStep =
  | "start"
  | "basic"
  | "findNeighbors"
  | "upload"
  | "nodocs"
  | "processing"
  | "success"
  | "review";

export type ResumeState = {
  step: ResumeStep;
  basicInfo?: BasicInfo | null;
  savedAt: number;
};

const STEP_LABELS: Record<ResumeStep, string> = {
  start: "picking how to start",
  basic: "entering your address",
  findNeighbors: "confirming your neighbors",
  upload: "uploading your HOA papers",
  nodocs: "adding homes",
  processing: "reading your documents",
  success: "reviewing what we found",
  review: "reviewing your workspace",
};

export function resumeStepLabel(step: ResumeStep): string {
  return STEP_LABELS[step] ?? "setup";
}

function storageKey(userId: string) {
  return `roadshare:onboarding:resume:${userId}`;
}

export function saveResumeState(userId: string | undefined, s: ResumeState): void {
  if (!userId || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(userId), JSON.stringify(s));
  } catch {
    // sessionStorage can be blocked (private mode, quota); silently drop.
  }
}

export function loadResumeState(userId: string | undefined): ResumeState | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ResumeState;
    if (!parsed || typeof parsed.step !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearResumeState(userId: string | undefined): void {
  if (!userId || typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKey(userId));
  } catch {
    /* ignore */
  }
}