/**
 * Phase 03.0 — Cricket Today widget for the Owner Dashboard.
 *
 * Phase 31: cards are Live · Match History · Players.
 */
import { Link } from "@tanstack/react-router";
import { Radio, History, Users, ArrowRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useTenantMatches, type MatchWithTeams } from "@/lib/match-feeds";

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

function resultSummary(m: MatchWithTeams): string {
  return (
    m.result ||
    (m.winner_team === "a"
      ? `${m.team_a?.short_name ?? "Team A"} won`
      : m.winner_team === "b"
        ? `${m.team_b?.short_name ?? "Team B"} won`
        : "Completed")
  );
}

export function CricketToday({
  tenantId,
  playerCount,
}: {
  tenantId: string;
  playerCount?: number;
}) {
  const all = useTenantMatches(tenantId);
  const matches = all.data ?? [];
  const live = matches.filter((m) => m.status === "live");
  const completed = matches.filter((m) => m.status === "completed");
  const latestCompleted = completed[0];

  const anyLoading = all.isLoading;
  const anyData = matches.length > 0 || (playerCount ?? 0) > 0;

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
        {live.length > 0 ? (
          <LiveMatchTile match={live[0]} extra={live.length - 1} />
        ) : (
          <EmptyTile icon={<Radio className="size-4" />} label="Live now" hint="No live matches" />
        )}

        {/* Match History */}
        <MatchHistoryTile count={completed.length} latest={latestCompleted} />

        {/* Players */}
        <PlayersTile count={playerCount ?? 0} />
      </div>
    </section>
  );
}

function LiveMatchTile({ match, extra }: { match: MatchWithTeams; extra: number }) {
  return (
    <Link to="/scorer/$matchId" params={{ matchId: match.id }} className="group">
      <Card className="p-3.5 min-h-[96px] flex flex-col justify-between transition-all hover:border-[color:var(--brand)]/40 hover:-translate-y-[1px]">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            <span className="relative inline-flex size-1.5">
              <span className="absolute inline-flex size-full rounded-full bg-emerald-500 opacity-70 animate-ping" />
              <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
            </span>
            Live
          </span>
          {extra > 0 && <span className="text-[10px] text-muted-foreground">+{extra} more</span>}
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight truncate">{teamsLabel(match)}</div>
          <div className="text-[11px] text-muted-foreground truncate">
            {match.match_format ?? match.match_type ?? "Match"}
            {match.ground_name ? ` · ${match.ground_name}` : ""}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function MatchHistoryTile({ count, latest }: { count: number; latest?: MatchWithTeams }) {
  return (
    <Link to="/match-center/matches" className="group">
      <Card className="p-3.5 min-h-[96px] flex flex-col justify-between transition-all hover:border-[color:var(--brand)]/40 hover:-translate-y-[1px]">
        <div className="flex items-center justify-between">
          <span className="grid size-7 place-items-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <History className="size-4" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            History
          </span>
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight truncate">
            {count} completed {count === 1 ? "match" : "matches"}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            {latest ? `Last: ${resultSummary(latest)}` : "No completed matches yet"}
          </div>
        </div>
      </Card>
    </Link>
  );
}

function PlayersTile({ count }: { count: number }) {
  return (
    <Link to="/match-center/players" className="group">
      <Card className="p-3.5 min-h-[96px] flex flex-col justify-between transition-all hover:border-[color:var(--brand)]/40 hover:-translate-y-[1px]">
        <div className="flex items-center justify-between">
          <span className="grid size-7 place-items-center rounded-lg bg-[color-mix(in_oklab,var(--brand,#E8873C)_14%,transparent)] text-[color:var(--brand,#E8873C)]">
            <Users className="size-4" />
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Players
          </span>
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight truncate">
            {count} {count === 1 ? "player" : "players"}
          </div>
          <div className="text-[11px] text-muted-foreground truncate">
            View stats &amp; performance
          </div>
        </div>
      </Card>
    </Link>
  );
}

function EmptyTile({ icon, label, hint }: { icon: React.ReactNode; label: string; hint: string }) {
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
