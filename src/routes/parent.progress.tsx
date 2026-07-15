import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { TrendingUp, Target, Clock, Swords, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchStudentProgress, studentKeys } from "@/lib/student-app";
import { useParentChild } from "@/hooks/use-parent-child";

export const Route = createFileRoute("/parent/progress")({
  component: ParentProgressPage,
});

function ParentProgressPage() {
  const { child } = useParentChild();
  const q = useQuery({
    queryKey: child ? studentKeys.progress(child.student_id) : ["parent", "progress", "none"],
    queryFn: () => fetchStudentProgress(child!),
    enabled: !!child,
  });
  const [view, setView] = useState<"weekly" | "monthly">("weekly");

  if (!child || q.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  const p = q.data!;
  const c = p.career;
  const bars = view === "weekly" ? p.weekly : p.monthly;
  const maxHours = Math.max(1, ...bars.map((b) => b.hours));

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <div className="size-10 rounded-full bg-primary/10 grid place-items-center text-primary">
          <TrendingUp className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Progress</h1>
          <p className="text-xs text-muted-foreground">How your child is doing at the academy.</p>
        </div>
      </header>

      {/* Attendance ring */}
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <AttendanceRing pct={p.attendancePct} />
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Attendance</p>
            <p className="text-3xl font-semibold">
              {p.attendancePct}
              <span className="text-lg text-muted-foreground">%</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">across all recorded sessions</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Metric
          icon={<Clock className="size-4" />}
          label="Practice hours"
          value={p.practiceHours.toFixed(1)}
        />
        <Metric
          icon={<Swords className="size-4" />}
          label="Matches played"
          value={String(p.matchesPlayed)}
        />
      </div>

      <section aria-label="Career">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 px-1">Career</p>
        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="Runs" value={c?.runs ?? 0} />
          <MiniStat label="Wickets" value={c?.wickets ?? 0} />
          <MiniStat label="Catches" value={c?.catches ?? 0} />
          <MiniStat label="Strike rate" value={c?.strike_rate?.toFixed(1) ?? "—"} />
          <MiniStat label="Batting avg" value={c?.average?.toFixed(1) ?? "—"} />
          <MiniStat label="Bowl avg" value={c?.bowling_average?.toFixed(1) ?? "—"} />
        </div>
      </section>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium">Practice Trend</p>
          <Tabs value={view} onValueChange={(v) => setView(v as "weekly" | "monthly")}>
            <TabsList className="h-8">
              <TabsTrigger value="weekly" className="text-xs h-6 px-2">
                Weekly
              </TabsTrigger>
              <TabsTrigger value="monthly" className="text-xs h-6 px-2">
                Monthly
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex items-end gap-1.5 h-32">
          {bars.length === 0 && (
            <p className="text-xs text-muted-foreground m-auto">Not enough data yet.</p>
          )}
          {bars.map((b) => {
            const h = (b.hours / maxHours) * 100;
            const key = "week" in b ? b.week : b.month;
            return (
              <div key={key} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                <div className="w-full flex-1 flex items-end">
                  <div
                    className="w-full rounded-t bg-gradient-to-t from-primary/70 to-primary"
                    style={{ height: `${h}%`, minHeight: b.hours > 0 ? 4 : 0 }}
                    title={`${b.hours.toFixed(1)}h`}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground truncate w-full text-center">
                  {("week" in b ? b.week : b.month).slice(-2)}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      <section aria-label="Recent form">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 px-1">
          Recent Form
        </p>
        {p.recentForm.length === 0 ? (
          <Card className="p-4 text-sm text-muted-foreground">No match appearances yet.</Card>
        ) : (
          <div className="space-y-2">
            {p.recentForm.slice(0, 5).map((m) => (
              <Card key={m.id} className="p-3 flex items-center gap-3">
                <div className="size-8 rounded-full bg-muted grid place-items-center">
                  {m.is_player_of_match ? (
                    <Trophy className="size-4 text-amber-500" />
                  ) : (
                    <Target className="size-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {m.match?.match_format ?? "Match"} · {m.match?.ground_name ?? "—"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.match?.scheduled_date
                      ? new Date(m.match.scheduled_date).toLocaleDateString()
                      : "Date TBD"}
                    {m.match?.result ? ` · ${m.match.result}` : ""}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function AttendanceRing({ pct }: { pct: number }) {
  const r = 32;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const dash = (clamped / 100) * c;
  return (
    <div className="relative size-20 grid place-items-center">
      <svg width={80} height={80} className="-rotate-90">
        <circle cx={40} cy={40} r={r} strokeWidth={8} stroke="hsl(var(--muted))" fill="none" />
        <circle
          cx={40}
          cy={40}
          r={r}
          strokeWidth={8}
          stroke="hsl(var(--primary))"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-xl font-semibold mt-1">{value}</p>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-2.5 text-center">
      <p className="text-lg font-semibold leading-tight">{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">{label}</p>
    </Card>
  );
}
