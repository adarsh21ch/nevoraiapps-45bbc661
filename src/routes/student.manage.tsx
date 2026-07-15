import { createFileRoute, Link } from "@tanstack/react-router";
import {
  UserCircle,
  ClipboardCheck,
  Swords,
  History,
  Megaphone,
  ChevronRight,
  IndianRupee,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { fetchMyStudentContext, studentKeys } from "@/lib/student-app";

export const Route = createFileRoute("/student/manage")({
  head: () => ({
    meta: [
      { title: "Manage — My Academy" },
      { name: "description", content: "Your personal information, attendance, matches and documents." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentManagePage,
});

type Tile = {
  to: "/student/profile" | "/student/progress" | "/student/matches";
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
};

const TILES: Tile[] = [
  { to: "/student/profile", label: "My Profile", hint: "Personal details & documents", icon: UserCircle },
  { to: "/student/progress", label: "My Attendance", hint: "Check-ins and history", icon: ClipboardCheck },
  { to: "/student/matches", label: "My Matches", hint: "Fixtures & performance", icon: Swords },
  { to: "/student/progress", label: "Practice History", hint: "Sessions this month", icon: History },
];

function StudentManagePage() {
  const ctxQ = useQuery({ queryKey: studentKeys.me, queryFn: fetchMyStudentContext });
  const feesEnabled = false; // Reuse existing gating — no route exists yet; hidden by default.

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold leading-tight">Manage</h1>
        <p className="text-sm text-muted-foreground">
          Your personal information, attendance and activity.
        </p>
      </header>

      <section aria-label="Personal">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 px-1">
          Personal
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TILES.map((t) => {
            const Icon = t.icon;
            return (
              <Link key={`${t.to}-${t.label}`} to={t.to}>
                <Card className="p-4 flex items-center gap-3 hover:bg-muted/40 transition-colors">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{t.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.hint}</p>
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      {feesEnabled && (
        <section aria-label="Fees">
          <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 px-1">
            Fees
          </p>
          <Card className="p-4 flex items-center gap-3 opacity-60">
            <IndianRupee className="size-5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">My Fees</p>
              <p className="text-xs text-muted-foreground">Contact your academy for details.</p>
            </div>
          </Card>
        </section>
      )}

      <section aria-label="Updates">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 px-1">
          Updates
        </p>
        <Card className="p-4 flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Megaphone className="size-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">Announcements</p>
            <p className="text-xs text-muted-foreground">
              {ctxQ.data ? "Latest updates from your academy appear here." : "Loading…"}
            </p>
          </div>
        </Card>
      </section>
    </div>
  );
}
