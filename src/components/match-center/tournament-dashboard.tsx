/* ================================================================
 * Tournament Dashboard
 * ----------------------------------------------------------------
 * Executive overview for a single tournament. Reuses existing
 * queries (listFixtures, listTournamentTeams, computeTournament*)
 * — no new aggregation is introduced here.
 * ================================================================ */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Calendar,
  Radio,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { listFixtures, listTournamentTeams } from "@/lib/mc-tournaments";
import { evaluateReadiness } from "@/lib/mc-tournament-setup";
import { EmptyState, LoadingSkeleton } from "@/components/match-center/ui";
import { SetupProgress } from "@/components/match-center/tournament-setup";
import { cn } from "@/lib/utils";

interface Props {
  tournamentId: string;
  hasGroups: boolean;
  onNavigate: (section: string) => void;
}

export function TournamentDashboard({ tournamentId, hasGroups, onNavigate }: Props) {
  const fxQ = useQuery({
    queryKey: ["mc-tournament-fixtures", tournamentId],
    queryFn: () => listFixtures(tournamentId),
  });
  const teamsQ = useQuery({
    queryKey: ["mc-tournament-teams", tournamentId],
    queryFn: () => listTournamentTeams(tournamentId),
  });
  const readyQ = useQuery({
    queryKey: ["mc-tournament-readiness", tournamentId],
    queryFn: () => evaluateReadiness(tournamentId),
  });

  const fixtures = fxQ.data ?? [];
  const today = new Date().toISOString().slice(0, 10);

  const buckets = useMemo(() => {
    const live = fixtures.filter((m) => m.status === "in_progress");
    const todays = fixtures.filter((m) => m.scheduled_date === today && m.status !== "completed");
    const upcoming = fixtures
      .filter((m) => (m.scheduled_date ?? "") > today && m.status !== "completed")
      .slice(0, 5);
    const completed = fixtures.filter((m) => m.match_locked);
    const recent = completed.slice(-5).reverse();
    return { live, todays, upcoming, completed, recent };
  }, [fixtures, today]);

  const readiness = readyQ.data;
  const alerts = readiness
    ? [
        !readiness.hasEnoughTeams &&
          `Only ${readiness.teamCount} team${readiness.teamCount === 1 ? "" : "s"} registered`,
        !readiness.hasVenues && "No venues configured",
        !readiness.hasOfficials && "No officials assigned",
        hasGroups && !readiness.hasGroups && "Groups enabled but none created",
        readiness.conflictCount > 0 && `${readiness.conflictCount} scheduling conflict(s)`,
      ].filter(Boolean) as string[]
    : [];

  if (fxQ.isLoading || teamsQ.isLoading) return <LoadingSkeleton />;

  const health = computeHealth(alerts.length, buckets.completed.length, fixtures.length);

  return (
    <div className="space-y-4">
      <SetupProgress tournamentId={tournamentId} hasGroups={hasGroups} />

      {/* Executive stat row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Radio}
          label="Live now"
          value={buckets.live.length}
          tone={buckets.live.length > 0 ? "live" : "neutral"}
          onClick={() => onNavigate("live")}
        />
        <StatCard
          icon={Calendar}
          label="Today"
          value={buckets.todays.length}
          onClick={() => onNavigate("fixtures")}
        />
        <StatCard
          icon={Clock}
          label="Upcoming"
          value={buckets.upcoming.length}
          onClick={() => onNavigate("fixtures")}
        />
        <StatCard
          icon={CheckCircle2}
          label="Completed"
          value={buckets.completed.length}
          onClick={() => onNavigate("standings")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Live + Today */}
        <section className="lg:col-span-2 space-y-4">
          <Panel title="Live matches" empty={buckets.live.length === 0 ? "No live matches" : null}>
            {buckets.live.map((m) => (
              <MatchRow key={m.id} m={m} live />
            ))}
          </Panel>
          <Panel title="Today's matches" empty={buckets.todays.length === 0 ? "Nothing scheduled today" : null}>
            {buckets.todays.map((m) => (
              <MatchRow key={m.id} m={m} />
            ))}
          </Panel>
          <Panel title="Recent results" empty={buckets.recent.length === 0 ? "No completed matches yet" : null}>
            {buckets.recent.map((m) => (
              <MatchRow key={m.id} m={m} completed />
            ))}
          </Panel>
        </section>

        {/* Alerts + Health */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Tournament health
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black tracking-tight">{health.score}%</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                  health.tone,
                )}
              >
                {health.label}
              </span>
            </div>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-foreground transition-[width] duration-500"
                style={{ width: `${health.score}%` }}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <AlertTriangle className="size-3" /> Alerts
            </div>
            {alerts.length === 0 ? (
              <div className="text-xs text-muted-foreground">All clear.</div>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {alerts.map((a) => (
                  <li key={a} className="flex items-start gap-2">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Upcoming
            </div>
            {buckets.upcoming.length === 0 ? (
              <div className="text-xs text-muted-foreground">Nothing scheduled.</div>
            ) : (
              <ul className="space-y-2">
                {buckets.upcoming.map((m) => (
                  <li key={m.id} className="text-sm">
                    <div className="font-medium truncate">
                      {m.team_a?.name} vs {m.team_b?.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {m.scheduled_date ?? "TBD"} {m.scheduled_time ?? ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {fixtures.length === 0 ? (
        <EmptyState
          icon={Trophy}
          title="No fixtures generated yet"
          description="Complete setup, then generate fixtures to see the tournament come to life."
        />
      ) : null}
    </div>
  );
}

function computeHealth(
  alertCount: number,
  completed: number,
  total: number,
): { score: number; label: string; tone: string } {
  const alertsPenalty = Math.min(alertCount * 15, 60);
  const progress = total > 0 ? Math.round((completed / total) * 20) : 20;
  const score = Math.max(0, Math.min(100, 100 - alertsPenalty + (progress - 20)));
  if (score >= 80)
    return { score, label: "Healthy", tone: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" };
  if (score >= 50)
    return { score, label: "Needs attention", tone: "bg-amber-500/15 text-amber-700 dark:text-amber-300" };
  return { score, label: "Critical", tone: "bg-destructive/10 text-destructive" };
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  tone?: "live" | "neutral";
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-foreground/30",
      )}
    >
      <div
        className={cn(
          "grid size-9 place-items-center rounded-xl",
          tone === "live" ? "bg-red-500/15 text-red-600" : "bg-muted text-foreground",
        )}
      >
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-2xl font-bold tracking-tight">{value}</div>
      </div>
    </button>
  );
}

function Panel({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      {empty ? (
        <div className="p-6 text-center text-sm text-muted-foreground">{empty}</div>
      ) : (
        <div className="divide-y divide-border">{children}</div>
      )}
    </div>
  );
}

function MatchRow({
  m,
  live,
  completed,
}: {
  m: Awaited<ReturnType<typeof listFixtures>>[number];
  live?: boolean;
  completed?: boolean;
}) {
  return (
    <Link
      to="/scorer/$matchId"
      params={{ matchId: m.id }}
      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">
          {m.team_a?.name} vs {m.team_b?.name}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {completed ? (m.result ?? "Result") : `${m.scheduled_date ?? "TBD"} ${m.scheduled_time ?? ""}`}
        </div>
      </div>
      {live ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-600">
          <span className="size-1.5 animate-pulse rounded-full bg-red-500" /> Live
        </span>
      ) : (
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {m.status}
        </span>
      )}
    </Link>
  );
}
