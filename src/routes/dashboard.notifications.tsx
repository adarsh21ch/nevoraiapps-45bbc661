import { createFileRoute, Link } from "@tanstack/react-router";
import { BellRing, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ds/Card";

export const Route = createFileRoute("/dashboard/notifications")({
  head: () => ({ meta: [{ title: "Notifications · Academy" }, { name: "robots", content: "noindex" }] }),
  component: NotificationsEntry,
});

function NotificationsEntry() {
  return (
    <div className="space-y-4">
      <Link to="/dashboard/academy" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Academy
      </Link>
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <div className="size-11 rounded-xl grid place-items-center" style={{ backgroundColor: "color-mix(in oklab, var(--brand) 12%, transparent)", color: "var(--brand)" }}>
            <BellRing className="size-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Notifications</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Reminders, broadcasts, WhatsApp and push notifications. This module is coming next — the attendance and fee architecture already emits events it will consume.
            </p>
            <div className="mt-4">
              <Link to="/dashboard/reminders" className="text-sm font-medium" style={{ color: "var(--brand)" }}>
                Open Fee Reminders →
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
