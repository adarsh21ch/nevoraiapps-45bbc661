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
      <div className="flex flex-col items-center gap-6">
        <div
          className="grid h-20 w-20 place-items-center rounded-3xl text-4xl shadow-2xl animate-pulse"
          style={{ backgroundColor: "var(--tenant-brand, var(--brand, #E8873C))" }}
        >
          <img src="/api/public/tenant-icon" alt="" className="size-14 object-contain" onError={(e) => {
            e.currentTarget.style.display = 'none';
            if (e.currentTarget.parentElement) e.currentTarget.parentElement.innerText = '🏏';
          }} />
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="h-1 w-32 overflow-hidden rounded-full bg-muted">
            <div className="h-full w-full origin-left animate-progress bg-primary" />
          </div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground font-semibold">
            {message}
          </p>
        </div>
      </div>

    </div>
  );
}
