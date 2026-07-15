import { Link } from "@tanstack/react-router";
import { ArrowLeft, Shield, Sparkles, Trophy, Users } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import type { DemoData } from "@/lib/mc-demo/generate";
import { deriveTeamProfile } from "@/lib/mc-demo/derive";

type DemoTeam = DemoData["teams"][number];

interface Props {
  demo: DemoData;
  team: DemoTeam;
}

/** Real, ball-event-derived team profile for a `demo-*` team. */
export function DemoTeamProfile({ demo, team }: Props) {
  const p = useMemo(() => deriveTeamProfile(demo, team.id), [demo, team.id]);
  return (
    <div>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/match-center/teams">
            <ArrowLeft className="size-4 mr-1.5" /> Teams
          </Link>
        </Button>
      </div>

      <PageHeader
        title={team.name}
        description={[team.age_group, team.city, team.coach_name].filter(Boolean).join(" · ")}
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Teams", to: "/match-center/teams" },
          { label: team.name },
        ]}
      />

      {/* Identity strip */}
      <div className="mb-6 flex items-center gap-4 rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-card to-card p-5">
        <div
          className="grid size-14 shrink-0 place-items-center rounded-2xl text-lg font-bold text-white"
          style={{ backgroundColor: team.team_color ?? "var(--brand)" }}
        >
          {team.short_name ?? team.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-300">
            <Sparkles className="size-3" /> Demo Team
          </div>
          <h2 className="mt-1 truncate text-2xl font-bold tracking-tight">{team.name}</h2>
          <div className="mt-1 text-xs text-muted-foreground">
            {[team.age_group, team.coach_name].filter(Boolean).join(" · ") || "Academy squad"}
          </div>
        </div>
      </div>

      <SectionTitle icon={Trophy} label="Season Record" />
      <StatGrid
        rows={[
          ["Played", p.played],
          ["Won", p.won],
          ["Lost", p.lost],
          ["Tied", p.tied],
          ["Win %", `${p.winPct}%`],
          ["Total Runs", p.totalRuns],
          ["Wickets Taken", p.totalWickets],
          ["Highest Total", p.highestTotal],
          ["Lowest Total", p.played > 0 ? p.lowestTotal : 0],
        ]}
      />

      {(p.topBatter || p.topBowler) && (
        <>
          <SectionTitle icon={Shield} label="Team Leaders" className="mt-6" />
          <div className="grid gap-3 sm:grid-cols-2">
            {p.topBatter && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Top Batter
                </div>
                <div className="mt-1 truncate text-base font-semibold">{p.topBatter.name}</div>
                <div className="mt-0.5 text-2xl font-bold tabular-nums">
                  {p.topBatter.runs} runs
                </div>
              </div>
            )}
            {p.topBowler && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Top Bowler
                </div>
                <div className="mt-1 truncate text-base font-semibold">{p.topBowler.name}</div>
                <div className="mt-0.5 text-2xl font-bold tabular-nums">
                  {p.topBowler.wickets} wkts
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {p.squad.length > 0 && (
        <>
          <SectionTitle icon={Users} label={`Squad (${p.squad.length})`} className="mt-6" />
          <div className="grid gap-2 sm:grid-cols-2">
            {p.squad.map((s) => (
              <Link
                key={s.athleteId}
                to="/match-center/players/$athleteId"
                params={{ athleteId: s.athleteId }}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2 text-sm transition-colors hover:bg-accent/40"
              >
                <span className="truncate font-medium">{s.name}</span>
                <span className="text-[10px] text-muted-foreground">View →</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {p.played === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          This demo team hasn't featured in a completed match yet.
        </p>
      )}
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  label,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={
        "mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground " +
        (className ?? "")
      }
    >
      <Icon className="size-3.5" /> {label}
    </div>
  );
}

function StatGrid({ rows }: { rows: Array<[string, string | number]> }) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
      {rows.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-border bg-card p-3">
          <dt className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
            {label}
          </dt>
          <dd className="mt-0.5 text-lg font-bold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
