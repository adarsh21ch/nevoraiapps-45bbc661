import { Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles, Trophy, Award, Zap } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { PlayerAvatar } from "@/components/shared/PlayerAvatar";
import type { DemoData } from "@/lib/mc-demo/generate";
import { derivePlayerCareer } from "@/lib/mc-demo/derive";

type DemoPlayer = DemoData["players"][number];

interface Props {
  demo: DemoData;
  player: DemoPlayer;
}

/** Real, ball-event-derived player profile for a `demo-*` athlete. Renders the
 *  same information architecture as the production profile (career summary,
 *  batting/bowling/fielding, match history) — every number comes from
 *  `computeBatting`/`computeBowling`/`computeFielding` run against demo events. */
export function DemoPlayerProfile({ demo, player }: Props) {
  const career = useMemo(() => derivePlayerCareer(demo, player.id), [demo, player.id]);
  const s = player.student;
  const cricket = player.cricket;
  const name = s?.name ?? "Demo player";

  // Team lookup: first match's squad that contains this player
  const team = useMemo(() => {
    for (const m of demo.matches) {
      const sq = demo.matchSquads?.[m.id];
      if (!sq) continue;
      for (const [teamId, players] of Object.entries(sq)) {
        if (players.some((p) => p.id === player.id)) {
          return demo.teams.find((t) => t.id === teamId) ?? null;
        }
      }
    }
    return null;
  }, [demo, player.id]);

  const age = s?.dob ? ageFrom(s.dob) : null;

  return (
    <div>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/match-center/players">
            <ArrowLeft className="size-4 mr-1.5" /> Athletes
          </Link>
        </Button>
      </div>

      <PageHeader
        title={name}
        description={[cricket?.playing_role, team?.name, age ? `${age} yrs` : null]
          .filter(Boolean)
          .join(" · ")}
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Athletes", to: "/match-center/players" },
          { label: name },
        ]}
      />

      {/* Identity card */}
      <div className="mb-6 flex items-center gap-4 rounded-3xl border border-amber-500/30 bg-gradient-to-br from-amber-500/5 via-card to-card p-5">
        <PlayerAvatar name={name} size={72} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-300">
            <Sparkles className="size-3" /> Demo Player
          </div>
          <h2 className="mt-1 truncate text-2xl font-bold tracking-tight">{name}</h2>
          <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <Fact label="Role" value={cricket?.playing_role ?? "—"} />
            <Fact label="Batting" value={cricket?.batting_style ?? "—"} />
            <Fact label="Bowling" value={cricket?.bowling_style ?? "—"} />
            {team && <Fact label="Team" value={team.name} />}
          </dl>
        </div>
      </div>

      {/* Career summary */}
      <SectionTitle icon={Trophy} label="Career Summary" />
      <StatGrid
        rows={[
          ["Matches", career.batting.matches],
          ["Innings", career.batting.innings],
          ["Runs", career.batting.runs],
          ["Highest", career.batting.highest],
          ["Average", career.batting.average],
          ["Strike Rate", career.batting.strikeRate],
          ["50s", career.batting.fifties],
          ["100s", career.batting.hundreds],
          ["Fours", career.batting.fours],
          ["Sixes", career.batting.sixes],
          ["Ducks", career.batting.ducks],
          ["Not Outs", career.batting.notOuts],
        ]}
      />

      <SectionTitle icon={Zap} label="Bowling" className="mt-6" />
      <StatGrid
        rows={[
          ["Innings", career.bowling.innings],
          ["Overs", career.bowling.overs],
          ["Maidens", career.bowling.maidens],
          ["Runs", career.bowling.runsConceded],
          ["Wickets", career.bowling.wickets],
          ["Economy", career.bowling.economy],
          ["Average", career.bowling.average],
          ["Strike Rate", career.bowling.strikeRate],
          ["Best", career.bowling.bestFigures],
        ]}
      />

      <SectionTitle icon={Award} label="Fielding" className="mt-6" />
      <StatGrid
        rows={[
          ["Catches", career.fielding.catches],
          ["Run Outs", career.fielding.runOuts],
          ["Stumpings", career.fielding.stumpings],
        ]}
      />

      {/* Match history */}
      {career.matchHistory.length > 0 && (
        <>
          <SectionTitle icon={Trophy} label="Match History" className="mt-6" />

          {/* Mobile: stacked cards */}
          <ul className="grid gap-2 sm:hidden">
            {career.matchHistory.map((l) => {
              const field = [
                l.fieldingCatches ? `${l.fieldingCatches}c` : null,
                l.fieldingRunOuts ? `${l.fieldingRunOuts}ro` : null,
                l.fieldingStumpings ? `${l.fieldingStumpings}st` : null,
              ].filter(Boolean).join(" ");
              return (
                <li key={l.matchId} className="rounded-xl border border-border bg-card px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <div className="min-w-0 truncate text-[13px] font-semibold">{l.opponent}</div>
                    <div className="shrink-0 text-[10.5px] text-muted-foreground">{l.date ?? ""}</div>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums">
                    <span className="text-muted-foreground">Bat <b className="text-foreground">
                      {l.battedBalls > 0 ? `${l.battedRuns}${l.battedOut ? "" : "*"} (${l.battedBalls})` : "—"}
                    </b></span>
                    <span className="text-muted-foreground">Bowl <b className="text-foreground">
                      {l.bowledOvers !== "0.0" ? `${l.bowledWickets}/${l.bowledRuns} (${l.bowledOvers})` : "—"}
                    </b></span>
                    <span className="text-muted-foreground">Field <b className="text-foreground">
                      {field || "—"}
                    </b></span>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Desktop: table */}
          <div className="hidden sm:block overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Opponent</th>
                  <th className="px-2 py-2 text-right">Bat</th>
                  <th className="px-2 py-2 text-right">Bowl</th>
                  <th className="px-2 py-2 text-right">Field</th>
                </tr>
              </thead>
              <tbody>
                {career.matchHistory.map((l) => (
                  <tr key={l.matchId} className="border-t border-border/50">
                    <td className="px-3 py-2">
                      <div className="font-medium">{l.opponent}</div>
                      <div className="text-[10px] text-muted-foreground">{l.date ?? ""}</div>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {l.battedBalls > 0 ? (
                        <span>
                          {l.battedRuns}
                          {l.battedOut ? "" : "*"}
                          <span className="text-muted-foreground"> ({l.battedBalls})</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {l.bowledOvers !== "0.0" ? (
                        <span>
                          {l.bowledWickets}/{l.bowledRuns}
                          <span className="text-muted-foreground"> ({l.bowledOvers})</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums">
                      {l.fieldingCatches + l.fieldingRunOuts + l.fieldingStumpings > 0
                        ? [
                            l.fieldingCatches ? `${l.fieldingCatches}c` : null,
                            l.fieldingRunOuts ? `${l.fieldingRunOuts}ro` : null,
                            l.fieldingStumpings ? `${l.fieldingStumpings}st` : null,
                          ]
                            .filter(Boolean)
                            .join(" ")
                        : <span className="text-muted-foreground">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}


      {career.batting.matches === 0 && (
        <p className="mt-6 rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          This demo player hasn't featured in a completed match yet.
        </p>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
        {label}
      </span>{" "}
      <span className="font-medium text-foreground">{value}</span>
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

function ageFrom(dob: string): number | null {
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}
