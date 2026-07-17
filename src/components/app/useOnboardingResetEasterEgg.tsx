import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { updateOnboardingState } from "@/lib/onboarding/api";

/**
 * Easter egg: type "roadshare" anywhere (outside a text field) to reset
 * the signed-in user's onboarding flags and reopen the welcome wizard.
 * Does NOT delete communities, parcels, or documents — only re-runs setup.
 */
export function useOnboardingResetEasterEgg() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const bufferRef = useRef("");
  const runningRef = useRef(false);

  useEffect(() => {
    const SECRET = "roadshare";

    function isTypingTarget(t: EventTarget | null) {
      if (!(t instanceof HTMLElement)) return false;
      const tag = t.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        t.isContentEditable
      );
    }

    async function doReset() {
      if (runningRef.current) return;
      runningRef.current = true;
      const t = toast.loading("Resetting onboarding…");
      try {
        await updateOnboardingState({
          wizard_completed: false,
          wizard_skipped: false,
          checklist_dismissed: false,
          dismissed_hints: [],
        });
        await qc.invalidateQueries({ queryKey: ["onboarding"] });
        toast.success("Onboarding reset — welcome back!", { id: t });
        void navigate({ to: "/dashboard", search: { welcome: true } });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Reset failed", { id: t });
      } finally {
        runningRef.current = false;
      }
    }

    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (e.key.length !== 1) return;
      const next = (bufferRef.current + e.key.toLowerCase()).slice(-SECRET.length);
      bufferRef.current = next;
      if (next === SECRET) {
        bufferRef.current = "";
        void doReset();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, qc]);
}