import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DashboardProvider } from "@/lib/dashboard-context";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { LanguageProvider } from "@/lib/i18n";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard · Academy OS" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <LanguageProvider>
      <DashboardProvider>
        <DashboardShell>
          <Outlet />
        </DashboardShell>
      </DashboardProvider>
    </LanguageProvider>
  );
}
