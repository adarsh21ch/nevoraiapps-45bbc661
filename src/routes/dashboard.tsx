import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DashboardProvider } from "@/lib/dashboard-context";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

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
    <DashboardProvider>
      <DashboardShell>
        <Outlet />
      </DashboardShell>
    </DashboardProvider>
  );
}
