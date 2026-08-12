import {
  createFileRoute,
  Outlet,
  useNavigate,
  useLocation,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { DashboardProvider, useDashboard } from "@/lib/dashboard-context";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { LanguageProvider } from "@/lib/i18n";
import { isCoach, isOwnerOrAdmin } from "@/lib/roles";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard · Academy OS" }, { name: "robots", content: "noindex" }],
  }),
  component: DashboardLayout,
});

/**
 * Phase 6 — coaches (legacy profiles.role='coach' + user_roles coach family)
 * land on the dedicated Coach Home surface when they open /dashboard.
 * They can navigate freely to any dashboard route their RLS allows.
 */
function CoachIndexRedirect({ children }: { children: React.ReactNode }) {
  const { profile } = useDashboard();
  const navigate = useNavigate();
  const location = useLocation();
  const isStaff = isOwnerOrAdmin(profile);
  const shouldRedirect =
    (isCoach(profile) || isStaff) && location.pathname === "/dashboard";
  useEffect(() => {
    if (shouldRedirect) {
      const target = isStaff ? "/dashboard/attendance" : "/dashboard/coach";
      navigate({ to: target, replace: true });
    }
  }, [shouldRedirect, navigate, isStaff]);
  if (shouldRedirect) {
    return null;
  }
  return <>{children}</>;
}

function DashboardLayout() {
  return (
    <LanguageProvider>
      <DashboardProvider>
        <CoachIndexRedirect>
          <DashboardShell>
            <Outlet />
          </DashboardShell>
        </CoachIndexRedirect>
      </DashboardProvider>
    </LanguageProvider>
  );
}

