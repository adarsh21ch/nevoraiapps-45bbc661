import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ClipboardCheck,
  Swords,
  LineChart,
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
      { name: "description", content: "Your training, matches and payments." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentManagePage,
});

type Tile = {
  to: "/student" | "/student/progress" | "/student/matches" | "/fees";
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
};

const TILES: Tile[] = [
  { to: "/student", label: "My Attendance", hint: "Check-ins & streaks", icon: ClipboardCheck },
  {
    to: "/student/progress",
    label: "My Performance",
    hint: "Progress & milestones",
    icon: LineChart,
  },
  { to: "/student/matches", label: "My Matches", hint: "Fixtures & scorecards", icon: Swords },
  { to: "/fees", label: "My Fees", hint: "Payments & receipts", icon: IndianRupee },
];

function StudentManagePage() {
  const ctxQ = useQuery({ queryKey: studentKeys.me, queryFn: fetchMyStudentContext });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold leading-tight">Manage</h1>
        <p className="text-sm text-muted-foreground">Your training, matches and payments.</p>
      </header>

      <section aria-label="Training">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 px-1">Training</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {TILES.map((t) => {
            const Icon = t.icon;
            return (
              <Link key={t.label} to={t.to}>
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

      <section aria-label="Updates">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 px-1">Updates</p>
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
