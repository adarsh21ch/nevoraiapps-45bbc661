import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Flame,
  Clock,
  CalendarCheck2,
  ChevronRight,
  MessageSquareQuote,
  Swords,
  Trophy,
  TrendingUp,
  QrCode,
  Megaphone,
  Mail,
  FileText,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMyStudentContext, fetchStudentHome, studentKeys } from "@/lib/student-app";

export const Route = createFileRoute("/student/")({
  component: StudentHomePage,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function StudentHomePage() {
  const ctxQ = useQuery({ queryKey: studentKeys.me, queryFn: fetchMyStudentContext });
  const ctx = ctxQ.data;
  const homeQ = useQuery({
    queryKey: ctx ? studentKeys.home(ctx.student_id) : ["student", "home", "none"],
    queryFn: () => fetchStudentHome(ctx!),
    enabled: !!ctx,
  });

  const firstName = useMemo(() => (ctx?.name ?? "").split(" ")[0] || "Player", [ctx?.name]);

  if (!ctx || homeQ.isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const home = homeQ.data!;
  const statusLabel = home.todayVisit
    ? home.todayVisit.check_out_at
      ? "Practice complete for today"
      : "You're in the academy right now"
    : "No check-in yet today";

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex items-center gap-4">
        <div className="size-14 rounded-full bg-gradient-to-br from-primary to-primary/60 grid place-items-center text-primary-foreground font-semibold text-lg overflow-hidden">
          {ctx.photo_url ? (
            <img src={ctx.photo_url} alt="" className="size-full object-cover" />
          ) : (
            firstName.slice(0, 1).toUpperCase()
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {greeting()}
          </p>
          <h1 className="text-2xl font-semibold leading-tight truncate">{firstName}</h1>
          {ctx.player_id && (
            <p className="text-xs text-muted-foreground mt-0.5">ID · {ctx.player_id}</p>
          )}
        </div>
      </header>

      {/* Today status */}
      <Card className="p-4 flex items-center gap-3">
        <div
          className={`size-2.5 rounded-full ${
            home.todayVisit && !home.todayVisit.check_out_at
              ? "bg-emerald-500 animate-pulse"
              : home.todayVisit
                ? "bg-emerald-500"
                : "bg-muted-foreground/40"
          }`}
        />
        <div className="flex-1">
          <p className="text-sm font-medium">{statusLabel}</p>
          <p className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>
      </Card>

      {/* Stat rings */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Flame className="size-5" />}
          label="Current Streak"
          value={`${home.streakDays}`}
          suffix={home.streakDays === 1 ? "day" : "days"}
          tone="orange"
        />
        <StatCard
          icon={<Clock className="size-5" />}
          label="Practice this month"
          value={home.hoursThisMonth.toFixed(1)}
          suffix="hrs"
          tone="blue"
        />
      </div>

      {/* Upcoming match */}
      {home.upcomingMatch?.match && (
        <Link
          to="/student/matches"
          className="block"
        >
          <Card className="p-4 flex items-center gap-3 hover:bg-muted/40 transition-colors">
            <div className="size-10 rounded-full bg-primary/10 grid place-items-center text-primary">
              <Swords className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Upcoming Match
              </p>
              <p className="text-sm font-medium truncate">
                {home.upcomingMatch.match.match_format ?? "Match"} ·{" "}
                {home.upcomingMatch.match.ground_name ?? "TBD"}
              </p>
              <p className="text-xs text-muted-foreground">
                {home.upcomingMatch.match.scheduled_date
                  ? new Date(home.upcomingMatch.match.scheduled_date).toLocaleDateString(
                      undefined,
                      { month: "short", day: "numeric", year: "numeric" },
                    )
                  : "Date TBD"}
              </p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Card>
        </Link>
      )}

      {/* Coach note */}
      {home.latestRemark && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <MessageSquareQuote className="size-4 text-primary" />
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Coach's Latest Note
            </p>
          </div>
          <p className="text-sm leading-relaxed">"{home.latestRemark.remark}"</p>
          <p className="text-xs text-muted-foreground mt-2">
            {home.latestRemark.author_name ?? "Coach"} ·{" "}
            {new Date(home.latestRemark.created_at).toLocaleDateString()}
          </p>
        </Card>
      )}

      {/* Recent achievement */}
      {home.recentAchievement && (
        <Card className="p-4 bg-gradient-to-br from-amber-500/10 to-transparent border-amber-500/20">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-amber-500/20 grid place-items-center text-amber-600 dark:text-amber-400">
              <Trophy className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Recent Achievement
              </p>
              <p className="text-sm font-medium truncate">
                {home.recentAchievement.title}
              </p>
              {home.recentAchievement.event_date && (
                <p className="text-xs text-muted-foreground">
                  {new Date(home.recentAchievement.event_date).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Quick actions — player workflows only (no academy management) */}
      <section aria-label="Quick actions">
        <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 px-1">
          Quick Actions
        </p>
        <div className="grid grid-cols-4 grid-rows-2 gap-2">
          <PlayerQuickAction to="/student/progress" icon={<CalendarCheck2 className="size-5" />} label="My Schedule" />
          <PlayerQuickAction to="/student/progress" icon={<QrCode className="size-5" />} label="QR Check-In" />
          <PlayerQuickAction to="/student/matches" icon={<Swords className="size-5" />} label="My Matches" />
          <PlayerQuickAction to="/student/progress" icon={<TrendingUp className="size-5" />} label="Performance" />
          <PlayerQuickAction to="/student/progress" icon={<MessageSquareQuote className="size-5" />} label="Coach Feedback" />
          <PlayerQuickAction to="/student/manage" icon={<Megaphone className="size-5" />} label="Announcements" />
          <PlayerQuickAction to="/student/manage" icon={<Mail className="size-5" />} label="Contact Academy" />
          <PlayerQuickAction to="/student/profile" icon={<FileText className="size-5" />} label="My Documents" />
        </div>
      </section>
    </div>
  );
}

function PlayerQuickAction({
  to,
  icon,
  label,
}: {
  to: "/student" | "/student/progress" | "/student/matches" | "/student/profile" | "/student/manage";
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link to={to}>
      <Card className="p-2 flex flex-col items-center justify-center gap-1 h-full min-h-[76px] hover:bg-muted/40 transition-colors">
        <span className="text-primary">{icon}</span>
        <span className="text-[11px] font-medium text-center leading-tight">{label}</span>
      </Card>
    </Link>
  );
}

function StatCard({
  icon,
  label,
  value,
  suffix,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  tone: "orange" | "blue";
}) {
  const bg =
    tone === "orange"
      ? "from-orange-500/15 to-transparent border-orange-500/20 text-orange-600 dark:text-orange-400"
      : "from-blue-500/15 to-transparent border-blue-500/20 text-blue-600 dark:text-blue-400";
  return (
    <Card className={`p-4 bg-gradient-to-br ${bg}`}>
      <div className="flex items-center justify-between">
        {icon}
      </div>
      <p className="mt-2 text-2xl font-semibold text-foreground">
        {value}
        {suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{suffix}</span>}
      </p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </Card>
  );
}

function QuickAction({
  to,
  icon,
  children,
}: {
  to: "/student" | "/student/progress" | "/student/matches" | "/student/profile";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link to={to}>
      <Card className="p-3 flex items-center gap-2 hover:bg-muted/40 transition-colors">
        <span className="text-primary">{icon}</span>
        <span className="text-sm font-medium">{children}</span>
      </Card>
    </Link>
  );
}
