import { Link } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { ArrowRight, FileBarChart2, Users, Send, Download, ClipboardCheck } from "lucide-react";

const FOLLOW_UPS = [
  { id: "report", label: "Generate Report", icon: FileBarChart2, href: "/dashboard/reports" },
  { id: "players", label: "View Players", icon: Users, href: "/dashboard/students" },
  { id: "reminder", label: "Send Fee Reminder", icon: Send, href: "/dashboard/reminders" },
  { id: "export", label: "Export Data", icon: Download, href: "/dashboard/reports" },
  { id: "admissions", label: "Review Admissions", icon: ClipboardCheck, href: "/dashboard/students" },
] as const;

/**
 * Suggested next actions shown alongside the chat. Deep-links only —
 * no client-side business logic.
 */
export function FollowUpCards() {
  return (
    <Card className="p-4">
      <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
        Next actions
      </div>
      <div className="grid grid-cols-2 gap-2">
        {FOLLOW_UPS.map((f) => (
          <Link
            key={f.id}
            to={f.href}
            className="group flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground/80 transition hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
          >
            <f.icon className="h-3.5 w-3.5 text-primary" />
            <span className="min-w-0 flex-1 truncate">{f.label}</span>
            <ArrowRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </Card>
  );
}
