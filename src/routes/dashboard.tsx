import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { DashboardProvider, useDashboard } from "@/lib/dashboard-context";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { LanguageProvider } from "@/lib/i18n";
import { isCoach } from "@/lib/roles";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Academy OS" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardLayout,
});

function CoachRedirect({ children }: { children: React.ReactNode }) {
  const { profile } = useDashboard();
  const navigate = useNavigate();
  useEffect(() => {
    if (isCoach(profile)) {
      navigate({ to: "/match-center/live", replace: true });
    }
  }, [profile, navigate]);
  if (isCoach(profile)) {
    return (
      <div className="min-h-screen grid place-items-center text-sm text-muted-foreground">
        Redirecting to Match Center…
      </div>
    );
  }
  return <>{children}</>;
}

function DashboardLayout() {
  return (
    <LanguageProvider>
      <DashboardProvider>
        <CoachRedirect>
          <DashboardShell>
            <Outlet />
          </DashboardShell>
        </CoachRedirect>
      </DashboardProvider>
    </LanguageProvider>
  );
}
