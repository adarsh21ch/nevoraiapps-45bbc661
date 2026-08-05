import { createFileRoute } from "@tanstack/react-router";
import { SessionFeesPanel } from "@/components/fees/SessionFeesPanel";

/**
 * Sessions are the single source of truth for training groups AND their fees —
 * the same panel is what the Fees hub renders under its "Sessions & Fees" tab.
 */
export const Route = createFileRoute("/dashboard/batches")({
  head: () => ({
    meta: [
      { title: "Sessions & fees · Academy dashboard" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BatchesPage,
});

function BatchesPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Sessions</h1>
        <p className="text-sm text-muted-foreground">
          Groups your players train with — each one carries its own monthly fee.
        </p>
      </header>
      <SessionFeesPanel />
    </div>
  );
}
