/* ================================================================
 * Tournament Dashboard v2 — Executive Command Center
 * ----------------------------------------------------------------
 * Designed to be understood in <10 seconds:
 *   [KPI strip] · [Health + Alerts] · [Qualification + Groups]
 *   [Today] · [Upcoming] · [Recent results]
 *
 * Reuses existing queries:
 *   - listFixtures, listTournamentTeams (existing)
 *   - evaluateReadiness (existing)
 *   - mc_tournament_groups (single new light read; extends setup domain,
 *     not statistics — no aggregation duplication)
 *
 * Qualification math is pure (mc-tournament-qualification.ts) and
 * consumes only data already in the client cache.
 * ================================================================ */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Radio,
  Trophy,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Users,
  UserSquare2,
  Zap,
  ChevronRight,
  CircleAlert,
  Info,
  Calendar,
  XCircle,
  PauseCircle,
  Play,
  Eye,
  Pencil,
} from "lucide-react";
import { listFixtures, listTournamentTeams, type MCTournament } from "@/lib/mc-tournaments";
import { evaluateReadiness, type SetupCheck } from "@/lib/mc-tournament-setup";
import { computeQualification } from "@/lib/mc-tournament-qualification";
import { EmptyState, LoadingSkeleton } from "@/components/match-center/ui";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  tournament: MCTournament;
  onNavigate: (section: string) => void;
  onQuickAction?: (id: "generate" | "create" | "share" | "export") => void;
  publicUrl?: string | null;
}

export function TournamentDashboard({ tournament, onNavigate, onQuickAction, publicUrl }: Props) {
  const tournamentId = tournament.id;
  const hasGroups = tournament.has_groups;

  const fxQ = useQuery({
    queryKey: ["mc-tournament-fixtures", tournamentId],
    queryFn: () => listFixtures(tournamentId),
  });
  const teamsQ = useQuery({
    queryKey: ["mc-tournament-teams", tournamentId],
    queryFn: () => listTournamentTeams(tournamentId),
  });
  const readyQ = useQuery({
    queryKey: ["mc-tournament-readiness", tournamentId, hasGroups],
    queryFn: () => evaluateReadiness({ tournamentId, hasGroups }),
  });
  const groupsQ = useQuery({
    enabled: hasGroups,
    queryKey: ["mc-tournament-groups", tournamentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mc_tournament_groups")
        .select("id, name, qualify_count, display_order")
        .eq("tournament_id", tournamentId)
        .order("display_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  const fixtures = fxQ.data ?? [];
  const teamsReg = teamsQ.data ?? [];
  const groups = groupsQ.data ?? [];
  const today = new Date().toISOString().slice(0, 10);

  const buckets = useMemo(() => {
    const live = fixtures.filter((m) => m.status === "in_progress");
    const startingSoon = fixtures.filter(
      (m) => m.scheduled_date === today && m.status !== "completed" && m.status !== "in_progress",
    );
    const completedToday = fixtures.filter(
      (m) => m.match_locked && (m.completed_at ?? "").slice(0, 10) === today,
    );
    const delayed = fixtures.filter((m) => m.status === "delayed" || m.status === "postponed");
    const cancelled = fixtures.filter((m) => m.status === "cancelled");
    const upcoming = fixtures
      .filter((m) => (m.scheduled_date ?? "") > today && m.status !== "completed")
      .slice(0, 5);
    const completed = fixtures.filter((m) => m.match_locked);
    const recent = completed
      .slice()
      .sort((a, b) => (b.completed_at ?? "").localeCompare(a.completed_at ?? ""))
      .slice(0, 5);
    return { live, startingSoon, completedToday, delayed, cancelled, upcoming, completed, recent };
  }, [fixtures, today]);

  const teamNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of teamsReg) if (r.team) m.set(r.team_id, r.team.name);
    return m;
  }, [teamsReg]);

  const totalPlayers = useMemo(
    () => teamsReg.length * 11, // display-only estimate; roster counts live in setup
    [teamsReg],
  );

  const progressPct = fixtures.length
    ? Math.round((buckets.completed.length / fixtures.length) * 100)
    : 0;

  const qualification = useMemo(() => {
    const groupSpecs =
      hasGroups && groups.length > 0
        ? groups.map((g) => ({ id: g.id, name: g.name, qualify_count: g.qualify_count }))
        : [
            {
              id: null,
              name: "Overall",
              qualify_count: Math.max(1, (tournament.max_teams / 2) | 0),
            },
          ];
    return computeQualification({
      standings: teamsReg.map((r) => ({
        team_id: r.team_id,
        group_id: r.group_id,
        points: Number(r.points),
        played: r.played,
      })),
      fixtures: fixtures.map((f) => ({
        team_a_id: f.team_a_id,
        team_b_id: f.team_b_id,
        match_locked: f.match_locked,
        status: f.status,
        group_id: f.group_id,
      })),
      groups: groupSpecs,
      pointsForWin: tournament.points_for_win,
    });
  }, [teamsReg, fixtures, groups, hasGroups, tournament.points_for_win, tournament.max_teams]);

  const alerts = useMemo(() => splitAlerts(readyQ.data?.checks ?? []), [readyQ.data]);
  const health = useMemo(
    () => computeHealth(alerts, buckets.completed.length, fixtures.length),
    [alerts, buckets.completed.length, fixtures.length],
  );

  if (fxQ.isLoading || teamsQ.isLoading) return <LoadingSkeleton />;

  if (fixtures.length === 0 && teamsReg.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="Set up the tournament"
        description="Register teams and generate fixtures to bring the dashboard to life."
      />
    );
  }

  const contentionTotal = Object.values(qualification.byGroup).reduce(
    (acc, g) => acc + g.contention.length,
    0,
  );
  const qualifiedTotal = Object.values(qualification.byGroup).reduce(
    (acc, g) => acc + g.qualified.length,
    0,
  );
  const eliminatedTotal = Object.values(qualification.byGroup).reduce(
    (acc, g) => acc + g.eliminated.length,
    0,
  );

  return (
    <div className="space-y-4">
      {/* ============ KPI STRIP ============ */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <ProgressRing value={progressPct} label="Progress" onClick={() => onNavigate("fixtures")} />
        <Kpi
          icon={CheckCircle2}
          label="Completed"
          value={buckets.completed.length}
          onClick={() => onNavigate("standings")}
        />
        <Kpi
          icon={Clock}
          label="Remaining"
          value={Math.max(0, fixtures.length - buckets.completed.length)}
          onClick={() => onNavigate("fixtures")}
        />
        <Kpi
          icon={Radio}
          label="Live"
          value={buckets.live.length}
          tone={buckets.live.length > 0 ? "live" : "neutral"}
          onClick={() => onNavigate("live")}
        />
        <Kpi
          icon={Calendar}
          label="Today"
          value={buckets.live.length + buckets.startingSoon.length + buckets.completedToday.length}
          onClick={() => onNavigate("fixtures")}
        />
        <Kpi
          icon={Users}
          label="Teams"
          value={teamsReg.length}
          onClick={() => onNavigate("teams")}
        />
        <Kpi
          icon={UserSquare2}
          label="Players"
          value={totalPlayers || "—"}
          onClick={() => onNavigate("players")}
        />
      </div>

      {/* ============ HEALTH + ALERTS + QUICK ACTIONS ============ */}
      <div className="grid gap-3 lg:grid-cols-3">
        <HealthCard health={health} onFix={onNavigate} />
        <AlertsCard alerts={alerts} onNavigate={onNavigate} />
        <QuickActionsCard
          onQuickAction={onQuickAction}
          onNavigate={onNavigate}
          publicUrl={publicUrl}
        />
      </div>

      {/* ============ QUALIFICATION CENTER ============ */}
      <section className="rounded-2xl border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h3 className="text-sm font-bold tracking-tight">Qualification Center</h3>
          <button
            onClick={() => onNavigate("standings")}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Full table <ChevronRight className="size-3" />
          </button>
        </header>
        <div className="grid grid-cols-3 divide-x divide-border">
          <QualStat label="Qualified" value={qualifiedTotal} tone="pos" />
          <QualStat label="In contention" value={contentionTotal} tone="warn" />
          <QualStat label="Eliminated" value={eliminatedTotal} tone="neg" />
        </div>

        <div className="grid gap-2 border-t border-border p-3 md:grid-cols-2 xl:grid-cols-3">
          {Object.entries(qualification.byGroup).map(([groupKey, info]) => {
            const groupMeta = groups.find((g) => g.id === groupKey);
            const groupLabel = groupMeta?.name ?? (groupKey === "__league__" ? "Overall" : "Group");
            const groupProgress =
              info.matchesTotal > 0
                ? Math.round(
                    ((info.matchesTotal - info.matchesRemaining) / info.matchesTotal) * 100,
                  )
                : 0;
            return (
              <button
                key={groupKey}
                onClick={() => onNavigate("standings")}
                className="rounded-xl border border-border bg-background p-3 text-left transition-colors hover:border-foreground/30"
              >
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="text-sm font-semibold">{groupLabel}</div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {info.matchesRemaining} left
                  </span>
                </div>
                <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full bg-foreground" style={{ width: `${groupProgress}%` }} />
                </div>
                <div className="space-y-0.5 text-xs">
                  <TeamLine rank={1} name={teamNameById.get(info.leader ?? "") ?? "—"} />
                  <TeamLine rank={2} name={teamNameById.get(info.runnerUp ?? "") ?? "—"} />
                </div>
                <div className="mt-2 flex gap-1 text-[10px]">
                  <Chip tone="pos">{info.qualified.length} in</Chip>
                  <Chip tone="warn">{info.contention.length} fight</Chip>
                  <Chip tone="neg">{info.eliminated.length} out</Chip>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ============ TODAY ============ */}
      <section className="rounded-2xl border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <h3 className="text-sm font-bold tracking-tight">Today</h3>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {today}
          </span>
        </header>
        <div className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-5">
          <TodayPill
            icon={Radio}
            label="Live"
            value={buckets.live.length}
            tone="live"
            onClick={() => onNavigate("live")}
          />
          <TodayPill
            icon={Play}
            label="Starting soon"
            value={buckets.startingSoon.length}
            onClick={() => onNavigate("fixtures")}
          />
          <TodayPill
            icon={CheckCircle2}
            label="Completed"
            value={buckets.completedToday.length}
            onClick={() => onNavigate("fixtures")}
          />
          <TodayPill
            icon={PauseCircle}
            label="Delayed"
            value={buckets.delayed.length}
            onClick={() => onNavigate("fixtures")}
          />
          <TodayPill
            icon={XCircle}
            label="Cancelled"
            value={buckets.cancelled.length}
            onClick={() => onNavigate("fixtures")}
          />
        </div>
        {buckets.live.length > 0 ? (
          <div className="divide-y divide-border border-t border-border">
            {buckets.live.map((m) => (
              <MatchRow key={m.id} m={m} live />
            ))}
          </div>
        ) : null}
      </section>

      {/* ============ UPCOMING + RECENT ============ */}
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h3 className="text-sm font-bold tracking-tight">Upcoming</h3>
            <button
              onClick={() => onNavigate("fixtures")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              View all
            </button>
          </header>
          {buckets.upcoming.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Nothing scheduled.</div>
          ) : (
            <div className="divide-y divide-border">
              {buckets.upcoming.map((m) => (
                <UpcomingRow key={m.id} m={m} />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-border bg-card">
          <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <h3 className="text-sm font-bold tracking-tight">Recent Results</h3>
            <button
              onClick={() => onNavigate("standings")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              View all
            </button>
          </header>
          {buckets.recent.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No completed matches yet.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {buckets.recent.map((m) => (
                <ResultRow key={m.id} m={m} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ================= Sub-components ================= */

function Kpi({
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
      className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left transition-colors hover:border-foreground/30"
    >
      <div
        className={cn(
          "grid size-7 place-items-center rounded-lg",
          tone === "live" ? "bg-red-500/15 text-red-600" : "bg-muted text-foreground",
        )}
      >
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0">
        <div className="truncate text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-lg font-bold leading-tight tracking-tight">{value}</div>
      </div>
    </button>
  );
}

function ProgressRing({
  value,
  label,
  onClick,
}: {
  value: number;
  label: string;
  onClick?: () => void;
}) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-left transition-colors hover:border-foreground/30"
    >
      <svg viewBox="0 0 36 36" className="size-9 shrink-0">
        <circle cx="18" cy="18" r={r} className="fill-none stroke-muted" strokeWidth="4" />
        <circle
          cx="18"
          cy="18"
          r={r}
          className="fill-none stroke-foreground transition-[stroke-dashoffset] duration-700"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 18 18)"
        />
      </svg>
      <div className="min-w-0">
        <div className="truncate text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-lg font-bold leading-tight tracking-tight">{value}%</div>
      </div>
    </button>
  );
}

function HealthCard({
  health,
  onFix,
}: {
  health: ReturnType<typeof computeHealth>;
  onFix: (section: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
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
      {health.reasons.length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs">
          {health.reasons.map((r) => (
            <li key={r.label} className="flex items-start justify-between gap-2">
              <span className="text-muted-foreground">{r.label}</span>
              <span className="shrink-0 font-semibold text-destructive">−{r.penalty}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-3 text-xs text-muted-foreground">All checks passing.</div>
      )}
      {health.reasons.length > 0 ? (
        <button
          onClick={() => onFix("settings")}
          className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-foreground hover:underline"
        >
          Fix issues <ChevronRight className="size-3" />
        </button>
      ) : null}
    </div>
  );
}

function AlertsCard({
  alerts,
  onNavigate,
}: {
  alerts: ReturnType<typeof splitAlerts>;
  onNavigate: (section: string) => void;
}) {
  const sections: Array<{
    key: keyof typeof alerts;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: string;
  }> = [
    { key: "critical", label: "Critical", icon: CircleAlert, tone: "text-destructive" },
    {
      key: "warning",
      label: "Warnings",
      icon: AlertTriangle,
      tone: "text-amber-600 dark:text-amber-400",
    },
    { key: "info", label: "Info", icon: Info, tone: "text-muted-foreground" },
  ];
  const total = alerts.critical.length + alerts.warning.length + alerts.info.length;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          Alerts
        </div>
        <span className="text-[10px] font-semibold tracking-wider text-muted-foreground">
          {total} total
        </span>
      </div>
      {total === 0 ? (
        <div className="text-sm text-muted-foreground">All clear.</div>
      ) : (
        <div className="space-y-2.5">
          {sections.map(({ key, label, icon: Icon, tone }) => {
            const list = alerts[key];
            if (list.length === 0) return null;
            return (
              <div key={key}>
                <div
                  className={cn(
                    "mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider",
                    tone,
                  )}
                >
                  <Icon className="size-3" /> {label} · {list.length}
                </div>
                <ul className="space-y-0.5 text-xs">
                  {list.slice(0, 3).map((a) => (
                    <li key={a.id} className="flex items-start justify-between gap-2">
                      <span>{a.detail ?? a.label}</span>
                      <button
                        onClick={() => onNavigate(alertToSection(a.id))}
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        aria-label="Fix"
                      >
                        <ChevronRight className="size-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function QuickActionsCard({
  onQuickAction,
  onNavigate,
  publicUrl,
}: {
  onQuickAction?: Props["onQuickAction"];
  onNavigate: (section: string) => void;
  publicUrl?: string | null;
}) {
  const actions: Array<{
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    onClick: () => void;
  }> = [
    { label: "Generate fixtures", icon: Zap, onClick: () => onQuickAction?.("generate") },
    { label: "Create match", icon: Play, onClick: () => onQuickAction?.("create") },
    { label: "Live scoring", icon: Radio, onClick: () => onNavigate("live") },
    { label: "Manage teams", icon: Users, onClick: () => onNavigate("teams") },
    { label: "Share tournament", icon: ChevronRight, onClick: () => onQuickAction?.("share") },
  ];
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Quick actions
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <button
              key={a.label}
              onClick={a.onClick}
              className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-left text-xs font-medium hover:bg-muted"
            >
              <Icon className="size-3.5" />
              <span className="truncate">{a.label}</span>
            </button>
          );
        })}
        {publicUrl ? (
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium hover:bg-muted"
          >
            <Eye className="size-3.5" />
            <span className="truncate">Public site</span>
          </a>
        ) : null}
        <button
          onClick={() => onQuickAction?.("export")}
          className="flex items-center gap-1.5 rounded-md border border-border bg-background px-2 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <ChevronRight className="size-3.5" />
          <span className="truncate">Export</span>
        </button>
      </div>
    </div>
  );
}

function QualStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "pos" | "warn" | "neg";
}) {
  const toneCls =
    tone === "pos"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : "text-destructive";
  return (
    <div className="px-4 py-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-0.5 text-2xl font-black tracking-tight", toneCls)}>{value}</div>
    </div>
  );
}

function TeamLine({ rank, name }: { rank: number; name: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={cn(
          "grid size-4 place-items-center rounded-full text-[9px] font-bold",
          rank === 1
            ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
            : "bg-muted text-muted-foreground",
        )}
      >
        {rank}
      </span>
      <span className="truncate">{name}</span>
    </div>
  );
}

function Chip({ tone, children }: { tone: "pos" | "warn" | "neg"; children: React.ReactNode }) {
  const cls =
    tone === "pos"
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : tone === "warn"
        ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "bg-destructive/10 text-destructive";
  return (
    <span className={cn("rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-wider", cls)}>
      {children}
    </span>
  );
}

function TodayPill({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  tone?: "live";
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-left hover:border-foreground/30"
    >
      <div
        className={cn(
          "grid size-7 place-items-center rounded-lg",
          tone === "live" ? "bg-red-500/15 text-red-600" : "bg-muted",
        )}
      >
        <Icon className="size-3.5" />
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-base font-bold leading-tight">{value}</div>
      </div>
    </button>
  );
}

function MatchRow({
  m,
  live,
}: {
  m: Awaited<ReturnType<typeof listFixtures>>[number];
  live?: boolean;
}) {
  return (
    <Link
      to="/scorer/$matchId"
      params={{ matchId: m.id }}
      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-muted/50"
    >
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">
          {m.team_a?.name} vs {m.team_b?.name}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {m.scheduled_date ?? "TBD"} · {m.scheduled_time ?? "—"}
        </div>
      </div>
      {live ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-600">
          <span className="size-1.5 animate-pulse rounded-full bg-red-500" /> Live
        </span>
      ) : null}
    </Link>
  );
}

function UpcomingRow({ m }: { m: Awaited<ReturnType<typeof listFixtures>>[number] }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-2.5">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">
          {m.team_a?.name} vs {m.team_b?.name}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {m.scheduled_date ?? "TBD"} · {m.scheduled_time ?? "—"}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Link
          to="/scorer/$matchId"
          params={{ matchId: m.id }}
          className="grid size-7 place-items-center rounded-md border border-border hover:bg-muted"
          aria-label="Score match"
        >
          <Radio className="size-3.5" />
        </Link>
        <Link
          to="/scorer/$matchId"
          params={{ matchId: m.id }}
          className="grid size-7 place-items-center rounded-md border border-border hover:bg-muted"
          aria-label="View match"
        >
          <Eye className="size-3.5" />
        </Link>
        <Link
          to="/scorer/$matchId"
          params={{ matchId: m.id }}
          className="grid size-7 place-items-center rounded-md border border-border hover:bg-muted"
          aria-label="Edit fixture"
        >
          <Pencil className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}

function ResultRow({ m }: { m: Awaited<ReturnType<typeof listFixtures>>[number] }) {
  return (
    <Link
      to="/scorer/$matchId"
      params={{ matchId: m.id }}
      className="block px-4 py-2.5 hover:bg-muted/50"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">
            {m.team_a?.name} vs {m.team_b?.name}
          </div>
          <div className="truncate text-xs text-muted-foreground">{m.result ?? "Completed"}</div>
        </div>
        {m.player_of_match_athlete_id ? (
          <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-300">
            🏅 PoM
          </span>
        ) : null}
      </div>
    </Link>
  );
}

/* ================= Health & Alerts logic ================= */

interface HealthResult {
  score: number;
  label: string;
  tone: string;
  reasons: { label: string; penalty: number }[];
}

function computeHealth(
  alerts: ReturnType<typeof splitAlerts>,
  completed: number,
  total: number,
): HealthResult {
  const reasons: { label: string; penalty: number }[] = [];
  let score = 100;

  const progressPenalty = total > 0 ? Math.round(((total - completed) / total) * 10) : 0;
  if (progressPenalty > 0) {
    reasons.push({ label: "Fixtures not yet completed", penalty: progressPenalty });
    score -= progressPenalty;
  }

  for (const a of alerts.critical) {
    const p = 15;
    reasons.push({ label: a.detail ?? a.label, penalty: p });
    score -= p;
  }
  for (const a of alerts.warning) {
    const p = 6;
    reasons.push({ label: a.detail ?? a.label, penalty: p });
    score -= p;
  }
  score = Math.max(0, Math.min(100, score));

  const label = score >= 85 ? "Healthy" : score >= 60 ? "Needs attention" : "Critical";
  const tone =
    score >= 85
      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
      : score >= 60
        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        : "bg-destructive/10 text-destructive";
  return { score, label, tone, reasons };
}

const CRITICAL_CHECKS: SetupCheck["id"][] = [
  "teams_registered",
  "teams_have_players",
  "groups_configured",
  "no_venue_conflicts",
];

function splitAlerts(checks: SetupCheck[]) {
  const critical: SetupCheck[] = [];
  const warning: SetupCheck[] = [];
  const info: SetupCheck[] = [];
  for (const c of checks) {
    if (c.status === "ok") continue;
    if (c.status === "fail" && CRITICAL_CHECKS.includes(c.id)) critical.push(c);
    else if (c.status === "fail") warning.push(c);
    else warning.push(c);
    void info;
  }
  return { critical, warning, info };
}

function alertToSection(id: SetupCheck["id"]): string {
  switch (id) {
    case "teams_registered":
    case "teams_have_players":
      return "teams";
    case "groups_configured":
      return "groups";
    case "venues_configured":
    case "no_venue_conflicts":
      return "venues";
    case "officials_configured":
      return "officials";
    default:
      return "settings";
  }
}
