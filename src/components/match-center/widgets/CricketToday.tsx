/**
 * Phase 03.0 — Cricket Today widget for the Owner Dashboard.
 *
 * A small, additive section that surfaces live/upcoming/recent matches on
 * the frozen `/dashboard` shell without touching its existing sections.
 * Reads use the shared `match-feeds` cache keys, so opening Match Center
 * afterwards is instant.
 */
import { Link } from "@tanstack/react-router";
import { Radio, Swords, Trophy, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  useLiveMatches,
  useUpcomingMatches,
  useRecentMatches,
  type MatchWithTeams,
} from "@/lib/match-feeds";

function SectionLabel({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-0.5 mb-2">
      <h2 className="text-[11px] uppercase tracking-[0.18em] font-semibold text-muted-foreground">
        {children}
      </h2>
      {action}
    </div>
  );
}

function teamsLabel(m: MatchWithTeams): string {
  const a = m.team_a?.short_name ?? m.team_a?.name ?? "Team A";
  const b = m.team_b?.short_name ?? m.team_b?.name ?? "Team B";
  return `${a} vs ${b}`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "TBD";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function CricketToday({ tenantId }: { tenantId: string }) {
  const live = useLiveMatches(tenantId);
  const upcoming = useUpcomingMatches(tenantId, 3);
  const recent = useRecentMatches(tenantId, 3);

  const anyLoading = live.isLoading || upcoming.isLoading || recent.isLoading;
  const anyData =
    live.data.length + upcoming.data.length + recent.data.length > 0;

  // Hide the whole section when the tenant has no cricket activity — keeps
  // the frozen dashboard clean for non-cricket academies.
  if (!anyLoading && !anyData) return null;

  return (
    <section aria-label="Cricket today">
      <SectionLabel
        action={
          <Link
            to="/match-center/dashboard"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Match Center <ArrowRight className="size-3" />
          </Link>
        }
      >
        Cricket today
      </SectionLabel>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
        {/* Live */}
        {live.data.length > 0 ? (
          <LiveMatchTile match={live.data[0]} extra={live.data.length - 1} />
        ) : (
          <EmptyTile
            icon={<Radio className="size-4" />}
            label="Live now"
            hint="No live matches"
          />
        )}

        {/* Next upcoming */}
        {upcoming.data.length > 0 ? (
          <UpcomingTile match={upcoming.data[0]} />
        ) : (
          <EmptyTile
            icon={<Swords className="size-4" />}
            label="Upcoming"
            hint="No matches scheduled"
          />
        )}

        {/* Latest result */}
        {recent.data.length > 0 ? (
          <RecentTile match={recent.data[0]} />
        ) : (
          <EmptyTile
            icon={<Trophy className="size-4" />}
            label="Recent result"
            hint="No completed matches"
          />
        )}
      </div>
    </section>
  );
}

function LiveMatchTile({
  match,
  extra,
}: {
  match: MatchWithTeams;
  extra: number;
}) {
  return (
    <Link
      to="/scorer/$matchId"
      params={{ matchId: match.id }}
      className="group"
    >
      <Card className="p-3.5 min-h-[96px] flex flex-col justify-between transition-all hover:border-[color:var(--brand)]/40 hover:-translate-y-[1px]">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            <span className="relative inline-flex size-1.5">
              <span className="absolute inline-flex size-full rounded-full bg-emerald-500 opacity-70 animate-ping" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
          {extra > 0 && (
            <span className="text-[10px] text-muted-foreground">
              +{extra} more
            </span>
          )}
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight truncate">
            {teamsLabel(match)}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {match.match_format ?? match.match_type ?? "Match"}
            {match.ground_name ? ` · ${match.ground_name}` : ""}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function UpcomingTile({ match }: { match: MatchWithTeams }) {
  return (
    <Link
      to="/match-center/matches"
      className="group"
    >
      <Card className="p-3.5 min-h-[96px] flex flex-col justify-between transition-all hover:border-[color:var(--brand)]/40 hover:-translate-y-[1px]">
        <div className="flex items-center justify-between">
          <span className="grid size-7 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--brand,#E8873C)_14%,transparent)] text-[color:var(--brand,#E8873C)]">
            <Swords className="size-4" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Next
          </span>
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight truncate">
            {teamsLabel(match)}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {formatWhen(match.scheduled_date)}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function RecentTile({ match }: { match: MatchWithTeams }) {
  const summary =
    match.result ||
    (match.winner_team === "a"
      ? `${match.team_a?.short_name ?? "Team A"} won`
      : match.winner_team === "b"
        ? `${match.team_b?.short_name ?? "Team B"} won`
        : "Completed");
  return (
    <Link
      to="/match-center/matches"
      className="group"
    >
      <Card className="p-3.5 min-h-[96px] flex flex-col justify-between transition-all hover:border-[color:var(--brand)]/40 hover:-translate-y-[1px]">
        <div className="flex items-center justify-between">
          <span className="grid size-7 place-items-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Trophy className="size-4" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Result
          </span>
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight truncate">
            {teamsLabel(match)}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {summary}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function EmptyTile({
  icon,
  label,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
}) {
  return (
    <Card className="p-3.5 min-h-[96px] flex flex-col justify-between opacity-70">
      <div className="flex items-center justify-between">
        <span className="grid size-7 place-items-center rounded-lg bg-muted text-muted-foreground">
          {icon}
        </span>
      </div>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="text-[11px] text-muted-foreground/80">{hint}</div>
      </div>
    </Card>
  );
}
