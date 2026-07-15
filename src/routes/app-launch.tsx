import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * PWA launch target. `start_url` in the tenant manifest points here so the
 * installed app opens straight into the router (never the marketing homepage).
 *
 * Client-only: session lives in `localStorage`, which the server can't read.
 * A quick native-feeling splash while we restore the session, then a router
 * redirect to /dashboard, /platform-admin, or /auth.
 */
export const Route = createFileRoute("/app-launch")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Academy OS" }, { name: "robots", content: "noindex" }],
  }),
  component: AppLaunch,
});

function AppLaunch() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Loading your academy…");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        if (cancelled) return;

        const session = sessionData.session;
        if (!session?.user) {
          navigate({ to: "/auth", replace: true });
          return;
        }

        setMessage("Signing you in…");
        // Platform admins land on the admin console; everyone else on the
        // owner dashboard. Falls back to /dashboard if the lookup errors.
        let target: "/platform-admin" | "/dashboard" = "/dashboard";
        try {
          const { data } = await supabase
            .from("platform_admins")
            .select("user_id")
            .eq("user_id", session.user.id)
            .maybeSingle();
          if (data) target = "/platform-admin";
        } catch {
          /* ignore — default to /dashboard */
        }
        if (cancelled) return;
        navigate({ to: target, replace: true });
      } catch {
        if (!cancelled) navigate({ to: "/auth", replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div
      className="fixed inset-0 grid place-items-center bg-background text-foreground"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex flex-col items-center gap-4">
        <div
          className="grid h-16 w-16 place-items-center rounded-2xl text-3xl shadow-lg"
          style={{ backgroundColor: "var(--tenant-brand, var(--brand, #E8873C))" }}
        >
          🏏
        </div>
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
