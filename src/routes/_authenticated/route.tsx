import { useEffect } from "react";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

/**
 * Auth gate.
 *
 * We used to `await supabase.auth.getUser()` in beforeLoad, which blocks
 * the first paint of the whole authed shell (sidebar + content go blank
 * for a beat while the network round-trip happens). Instead we do a
 * synchronous check against the persisted Supabase session in
 * localStorage — that's what supabase-js reads from anyway — so the
 * shell paints immediately. A background `getUser()` still runs and
 * boots to /auth if the token turns out to be invalid.
 */
function hasPersistedSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith("sb-") && k.endsWith("-auth-token")) {
        const raw = window.localStorage.getItem(k);
        if (raw && raw.length > 2) return true;
      }
    }
  } catch {
    /* localStorage unavailable */
  }
  return false;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: ({ location }) => {
    if (!hasPersistedSession()) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  // Background verification — if the persisted token is bad, kick to /auth.
  useEffect(() => {
    let cancelled = false;
    supabase.auth.getUser().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data.user) {
        window.location.href = `/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return <Outlet />;
}