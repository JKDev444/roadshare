import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({ meta: [{ title: "Signing in…" }, { name: "robots", content: "noindex" }] }),
  component: AuthCallback,
});

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let attempts = 0;

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        navigate({ to: "/dashboard" });
        return;
      }
      attempts += 1;
      if (attempts > 20) {
        setError(true);
        return;
      }
      setTimeout(check, 250);
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session && active) navigate({ to: "/dashboard" });
    });

    check();
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      {error ? (
        <>
          <p className="text-sm text-muted-foreground">
            We couldn't complete sign-in. Please try again.
          </p>
          <button
            className="text-sm font-medium text-primary underline"
            onClick={() => navigate({ to: "/auth" })}
          >
            Back to sign in
          </button>
        </>
      ) : (
        <>
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Signing you in…</p>
        </>
      )}
    </div>
  );
}