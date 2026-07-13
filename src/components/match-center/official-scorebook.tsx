/* ================================================================
 * Official Digital Scorebook — presentation layer only.
 * ----------------------------------------------------------------
 * NO cricket calculations here. Every number is derived from the
 * Statistics Engine (`calculateInningsStatistics`) which itself
 * consumes Ball Event Engine data. The Ball Event log remains the
 * single source of truth.
 * ================================================================ */
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Printer,
  Share2,
  Download,
  Maximize2,
  Minimize2,
  ImageDown,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { calculateInningsStatistics } from "@/lib/mc-statistics-engine";
import type { MCBallEvent } from "@/lib/mc-ball-events";

/* ---------------- Public types ---------------- */

export interface ScorebookTeam {
  id: string;
  name: string | null;
  short_name?: string | null;
}

export interface ScorebookInnings {
  id: string;
  innings_number: number;
  batting_team_id: string;
  bowling_team_id?: string | null;
  target?: number | null;
}

export interface ScorebookMatchInfo {
  title?: string | null;
  tournament?: string | null;
  ground?: string | null;
  date?: string | null;
  format?: string | null;
  overs?: number | null;
  umpire?: string | null;
  scorer?: string | null;
  tossWinner?: string | null;
  tossDecision?: string | null;
  result?: string | null;
  playerOfMatch?: string | null;
  locked?: boolean;
}

export interface OfficialScorebookProps {
  matchInfo: ScorebookMatchInfo;
  teams: ScorebookTeam[];
  innings: ScorebookInnings[];
  events: MCBallEvent[];
  /** Show toolbar (print/share/fullscreen). Hidden in print. */
  toolbar?: boolean;
  /** Force fullscreen presentation styles (used by dedicated route). */
  fullscreen?: boolean;
  onExitFullscreen?: () => void;
}

/* ---------------- Root ---------------- */

export function OfficialScorebook({
  matchInfo,
  teams,
  innings,
  events,
  toolbar = true,
  fullscreen = false,
  onExitFullscreen,
}: OfficialScorebookProps) {
  const paperRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const teamById = useMemo(() => {
    const m = new Map<string, ScorebookTeam>();
    for (const t of teams) m.set(t.id, t);
    return m;
  }, [teams]);

  const eventsByInnings = useMemo(() => {
    const m = new Map<string, MCBallEvent[]>();
    for (const e of events) {
      if (!e.innings_id) continue;
      const arr = m.get(e.innings_id) ?? [];
      arr.push(e);
      m.set(e.innings_id, arr);
    }
    return m;
  }, [events]);

  const orderedInnings = useMemo(
    () => [...innings].sort((a, b) => a.innings_number - b.innings_number),
    [innings],
  );

  const teamA = orderedInnings[0]
    ? teamById.get(orderedInnings[0].batting_team_id) ?? null
    : teams[0] ?? null;
  const teamB = orderedInnings[1]
    ? teamById.get(orderedInnings[1].batting_team_id) ?? null
    : teams.find((t) => t.id !== teamA?.id) ?? null;

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = matchInfo.title ?? "Official Scorebook";
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      // fall through to copy
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not share");
    }
  };

  const handlePng = async () => {
    if (!paperRef.current) return;
    try {
      const mod = await import("html-to-image");
      const dataUrl = await mod.toPng(paperRef.current, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `${(matchInfo.title ?? "scorebook").replace(/\W+/g, "-").toLowerCase()}.png`;
      a.click();
      toast.success("Image downloaded");
    } catch (err) {
      console.error(err);
      toast.error("Image export failed");
    }
  };

  const handleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await paperRef.current?.requestFullscreen?.();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={fullscreen ? "min-h-screen bg-background" : ""}>
      {toolbar && (
        <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border bg-card px-3 py-2">
          <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Official Scorebook
            {matchInfo.locked ? (
              <Badge variant="secondary" className="ml-2 align-middle">Final</Badge>
            ) : (
              <Badge variant="outline" className="ml-2 align-middle border-emerald-500/40 text-emerald-600 dark:text-emerald-400">Live</Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={handleFullscreen} aria-label="Toggle fullscreen">
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              <span className="ml-1.5 hidden sm:inline">{isFullscreen ? "Exit" : "Fullscreen"}</span>
            </Button>
            <Button size="sm" variant="outline" onClick={handlePrint} aria-label="Print scorebook">
              <Printer className="size-4" />
              <span className="ml-1.5 hidden sm:inline">Print</span>
            </Button>
            <Button size="sm" variant="outline" onClick={handlePrint} aria-label="Save as PDF">
              <FileText className="size-4" />
              <span className="ml-1.5 hidden sm:inline">PDF</span>
            </Button>
            <Button size="sm" variant="outline" onClick={handlePng} aria-label="Download PNG">
              <ImageDown className="size-4" />
              <span className="ml-1.5 hidden sm:inline">PNG</span>
            </Button>
            <Button size="sm" variant="outline" onClick={handleShare} aria-label="Share scorebook">
              <Share2 className="size-4" />
              <span className="ml-1.5 hidden sm:inline">Share</span>
            </Button>
            {fullscreen && onExitFullscreen && (
              <Button size="sm" variant="ghost" onClick={onExitFullscreen}>
                <Download className="size-4 rotate-180" /> Close
              </Button>
            )}
          </div>
        </div>
      )}

      <div
        ref={paperRef}
        className="scorebook-print scorebook-paper mx-auto max-w-[900px] rounded-2xl border bg-card p-5 shadow-sm sm:p-8"
      >
        <ScorebookHeader info={matchInfo} teamA={teamA} teamB={teamB} />
        <MatchSummaryStrip
          info={matchInfo}
          teamA={teamA}
          teamB={teamB}
          innings={orderedInnings}
          eventsByInnings={eventsByInnings}
        />

        {orderedInnings.map((inn) => {
          const evs = eventsByInnings.get(inn.id) ?? [];
          const battingTeam = teamById.get(inn.batting_team_id);
          const bowlingTeam = inn.bowling_team_id ? teamById.get(inn.bowling_team_id) : null;
          const stats = calculateInningsStatistics(evs, {
            totalOvers: matchInfo.overs ?? null,
            target: inn.target ?? null,
          });
          return (
            <InningsBlock
              key={inn.id}
              inningsNumber={inn.innings_number}
              battingTeamName={battingTeam?.name ?? "Batting"}
              bowlingTeamName={bowlingTeam?.name ?? "Bowling"}
              stats={stats}
            />
          );
        })}

        {orderedInnings.length === 0 && (
          <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
            The scorebook fills automatically as balls are scored.
          </div>
        )}

        <PrintFooter />
      </div>
    </div>
  );
}

/* ---------------- Header ---------------- */

function ScorebookHeader({
  info,
  teamA,
  teamB,
}: {
  info: ScorebookMatchInfo;
  teamA: ScorebookTeam | null;
  teamB: ScorebookTeam | null;
}) {
  const tossLine =
    info.tossWinner && info.tossDecision
      ? `${info.tossWinner} won the toss and chose to ${info.tossDecision}`
      : info.tossWinner
        ? `${info.tossWinner} won the toss`
        : null;

  return (
    <header className="sb-card mb-5 rounded-xl border-2 border-dashed p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            Official Scorebook
          </div>
          <h1 className="mt-0.5 text-xl font-black tracking-tight sm:text-2xl">
            {teamA?.name ?? "Team A"} <span className="text-muted-foreground">v</span> {teamB?.name ?? "Team B"}
          </h1>
          {info.tournament && (
            <div className="mt-0.5 text-sm font-medium">{info.tournament}</div>
          )}
        </div>
        <div className="text-right text-[11px] text-muted-foreground">
          {info.date && <div className="font-semibold text-foreground">{info.date}</div>}
          {info.format && (
            <div>
              {info.format}
              {info.overs ? ` · ${info.overs} overs` : ""}
            </div>
          )}
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-4">
        <MetaCell label="Ground" value={info.ground} />
        <MetaCell label="Umpire" value={info.umpire} />
        <MetaCell label="Scorer" value={info.scorer} />
        <MetaCell label="Toss" value={tossLine} />
        <MetaCell label="Result" value={info.result} span={2} />
        <MetaCell label="Player of the Match" value={info.playerOfMatch} span={2} />
      </dl>
    </header>
  );
}

function MetaCell({
  label,
  value,
  span,
}: {
  label: string;
  value?: string | null;
  span?: number;
}) {
  return (
    <div className={span === 2 ? "sm:col-span-2" : undefined}>
      <dt className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
        {label}
      </dt>
      <dd className="truncate font-medium">{value ?? "—"}</dd>
    </div>
  );
}

/* ---------------- Match summary strip ---------------- */

function MatchSummaryStrip({
  info,
  teamA,
  teamB,
  innings,
  eventsByInnings,
}: {
  info: ScorebookMatchInfo;
  teamA: ScorebookTeam | null;
  teamB: ScorebookTeam | null;
  innings: ScorebookInnings[];
  eventsByInnings: Map<string, MCBallEvent[]>;
}) {
  const rows = innings.map((inn) => {
    const evs = eventsByInnings.get(inn.id) ?? [];
    const s = calculateInningsStatistics(evs, {
      totalOvers: info.overs ?? null,
      target: inn.target ?? null,
    });
    return {
      inn,
      teamName:
        (inn.batting_team_id === teamA?.id ? teamA?.name : teamB?.name) ?? "Team",
      stats: s,
    };
  });

  const chase = rows[rows.length - 1];
  const rrr = chase?.stats.team.requiredRunRate ?? null;

  return (
    <section className="sb-card mb-5 grid gap-3 rounded-xl border p-4 sm:grid-cols-2">
      {rows.length === 0 && (
        <div className="col-span-full text-sm text-muted-foreground">
          No innings started yet.
        </div>
      )}
      {rows.map(({ inn, teamName, stats }) => (
        <div
          key={inn.id}
          className="rounded-lg border bg-background/40 p-3"
        >
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <span>Innings {inn.innings_number} · {teamName}</span>
            {inn.target != null && <span>Target {inn.target}</span>}
          </div>
          <div className="mt-1 flex items-baseline gap-2 num-display">
            <span className="text-3xl font-black">
              {stats.team.runs}/{stats.team.wickets}
            </span>
            <span className="text-sm text-muted-foreground">
              ({stats.team.oversDisplay} ov)
            </span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            RR {stats.team.runRate.toFixed(2)}
            {rrr != null && chase?.inn.id === inn.id && (
              <> · RRR {rrr.toFixed(2)}</>
            )}
            {" · "}Extras {stats.team.extras.total}
            {" · "}Boundaries {stats.team.fours}×4 · {stats.team.sixes}×6
          </div>
        </div>
      ))}
      {info.result && (
        <div className="col-span-full rounded-lg border border-primary/40 bg-primary/5 p-2 text-center text-sm font-semibold">
          {info.result}
        </div>
      )}
    </section>
  );
}

/* ---------------- Innings block ---------------- */

function InningsBlock({
  inningsNumber,
  battingTeamName,
  bowlingTeamName,
  stats,
}: {
  inningsNumber: number;
  battingTeamName: string;
  bowlingTeamName: string;
  stats: ReturnType<typeof calculateInningsStatistics>;
}) {
  return (
    <section className="mb-6 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-1 border-b-2 border-foreground/70 pb-1">
        <h2 className="text-sm font-black uppercase tracking-widest">
          Innings {inningsNumber} — {battingTeamName} batting
        </h2>
        <div className="text-[11px] font-semibold text-muted-foreground">
          v {bowlingTeamName} · {stats.team.runs}/{stats.team.wickets} ({stats.team.oversDisplay})
        </div>
      </div>

      <BattingTable stats={stats} />
      <ExtrasLine stats={stats} />
      <BowlingTable stats={stats} />

      <div className="grid gap-4 sm:grid-cols-2">
        <FallOfWicketsTable stats={stats} />
        <PartnershipsTable stats={stats} />
      </div>

      <OverSummary stats={stats} />
      <MatchNotes stats={stats} />
    </section>
  );
}

/* ---------------- Sub-tables ---------------- */

type Stats = ReturnType<typeof calculateInningsStatistics>;

function BattingTable({ stats }: { stats: Stats }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-y">
            <Th className="text-left">Batter</Th>
            <Th className="text-left">Dismissal</Th>
            <Th className="text-left">Bowler</Th>
            <Th className="text-right">R</Th>
            <Th className="text-right">B</Th>
            <Th className="text-right">4s</Th>
            <Th className="text-right">6s</Th>
            <Th className="text-right">SR</Th>
            <Th className="text-right">Min</Th>
          </tr>
        </thead>
        <tbody>
          {stats.batting.ordered.map((b) => (
            <tr key={b.player.key} className="border-b last:border-0">
              <td className="py-1.5 font-semibold">
                {b.player.name ?? "—"}
                {b.notOut && <span className="ml-1 text-muted-foreground">*</span>}
              </td>
              <td className="text-[11px] text-muted-foreground">
                {b.notOut ? "not out" : b.dismissalType ?? "—"}
              </td>
              <td className="text-[11px] text-muted-foreground">
                {b.dismissedBy?.name ?? (b.notOut ? "—" : "—")}
              </td>
              <Td className="font-bold">{b.runs}</Td>
              <Td>{b.balls}</Td>
              <Td>{b.fours}</Td>
              <Td>{b.sixes}</Td>
              <Td>{b.strikeRate ? b.strikeRate.toFixed(1) : "—"}</Td>
              <Td className="text-muted-foreground">—</Td>
            </tr>
          ))}
          {stats.batting.ordered.length === 0 && (
            <tr>
              <td colSpan={9} className="py-4 text-center text-muted-foreground">
                No balls faced.
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-foreground/80">
            <td colSpan={3} className="py-1.5 text-[11px] font-bold uppercase tracking-widest">
              Total
            </td>
            <td className="text-right text-sm font-black">{stats.team.runs}</td>
            <td colSpan={5} className="text-right text-[11px] text-muted-foreground">
              {stats.team.wickets} wkts · {stats.team.oversDisplay} ov · RR {stats.team.runRate.toFixed(2)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function ExtrasLine({ stats }: { stats: Stats }) {
  const e = stats.team.extras;
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-1.5 text-[11px]">
      <span className="font-bold uppercase tracking-widest">Extras</span>{" "}
      <span className="text-muted-foreground">
        (b {e.byes}, lb {e.legByes}, w {e.wides}, nb {e.noBalls}, p {e.penalty})
      </span>{" "}
      <span className="font-black tabular-nums">{e.total}</span>
    </div>
  );
}

function BowlingTable({ stats }: { stats: Stats }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[12px]">
        <thead>
          <tr className="border-y">
            <Th className="text-left">Bowler</Th>
            <Th className="text-right">O</Th>
            <Th className="text-right">M</Th>
            <Th className="text-right">R</Th>
            <Th className="text-right">W</Th>
            <Th className="text-right">Econ</Th>
            <Th className="text-right">Dots</Th>
            <Th className="text-right">Wd</Th>
            <Th className="text-right">Nb</Th>
          </tr>
        </thead>
        <tbody>
          {stats.bowling.ordered.map((b) => (
            <tr key={b.player.key} className="border-b last:border-0">
              <td className="py-1.5 font-semibold">{b.player.name ?? "—"}</td>
              <Td>{b.oversDisplay}</Td>
              <Td>{b.maidens}</Td>
              <Td>{b.runsConceded}</Td>
              <Td className="font-bold">{b.wickets}</Td>
              <Td>{b.economy ? b.economy.toFixed(2) : "—"}</Td>
              <Td>{b.dotBalls}</Td>
              <Td>{b.wides}</Td>
              <Td>{b.noBalls}</Td>
            </tr>
          ))}
          {stats.bowling.ordered.length === 0 && (
            <tr>
              <td colSpan={9} className="py-4 text-center text-muted-foreground">
                No overs bowled.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function FallOfWicketsTable({ stats }: { stats: Stats }) {
  return (
    <div>
      <SectionTitle>Fall of Wickets</SectionTitle>
      {stats.team.fallOfWickets.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No wickets fallen.</p>
      ) : (
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="border-y">
              <Th className="text-left">#</Th>
              <Th className="text-right">Score</Th>
              <Th className="text-left">Batter</Th>
              <Th className="text-right">Over</Th>
              <Th className="text-left">Bowler</Th>
            </tr>
          </thead>
          <tbody>
            {stats.team.fallOfWickets.map((f) => (
              <tr key={f.wicketNumber} className="border-b last:border-0">
                <td className="py-1 font-bold tabular-nums">{f.wicketNumber}</td>
                <td className="text-right font-semibold tabular-nums">{f.score}</td>
                <td>{f.batter?.name ?? "—"}</td>
                <td className="text-right tabular-nums">{f.overDisplay}</td>
                <td className="text-muted-foreground">{f.bowler?.name ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function PartnershipsTable({ stats }: { stats: Stats }) {
  const rows = stats.team.partnerships;
  return (
    <div>
      <SectionTitle>Partnerships</SectionTitle>
      {rows.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No partnerships yet.</p>
      ) : (
        <table className="w-full border-collapse text-[11.5px]">
          <thead>
            <tr className="border-y">
              <Th className="text-left">Wkt</Th>
              <Th className="text-left">Batters</Th>
              <Th className="text-right">Runs</Th>
              <Th className="text-right">Balls</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={i} className="border-b last:border-0">
                <td className="py-1 font-bold tabular-nums">{p.startWicket + 1}</td>
                <td>
                  {(p.batterA?.name ?? "?")} & {(p.batterB?.name ?? "?")}
                  {p.endWicket == null && (
                    <span className="ml-1 text-[10px] font-bold uppercase text-primary">Live</span>
                  )}
                </td>
                <td className="text-right font-semibold tabular-nums">{p.runs}</td>
                <td className="text-right tabular-nums">{p.balls}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function OverSummary({ stats }: { stats: Stats }) {
  const overs = stats.team.overs_summary;
  if (overs.length === 0) return null;
  return (
    <div>
      <SectionTitle>Over-by-Over</SectionTitle>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {overs.map((o) => (
          <div
            key={o.overNumber}
            className="flex items-center gap-2 rounded-md border bg-background/50 px-2 py-1 text-[11px]"
          >
            <span className="w-8 font-bold tabular-nums">Ov{o.overNumber + 1}</span>
            <span className="flex-1 truncate text-muted-foreground">
              {o.bowler?.name ?? "—"}
            </span>
            <span className="tabular-nums">
              {o.runs}r · {o.wickets}w
              {o.isMaiden ? " · M" : ""}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatchNotes({ stats }: { stats: Stats }) {
  const s = stats.summary;
  const notes: Array<{ label: string; value: string }> = [];
  if (s.highestScorer)
    notes.push({
      label: "Top Batter",
      value: `${s.highestScorer.player.name ?? "?"} — ${s.highestScorer.runs}(${s.highestScorer.balls})`,
    });
  if (s.bestBowler)
    notes.push({
      label: "Top Bowler",
      value: `${s.bestBowler.player.name ?? "?"} — ${s.bestBowler.bestBowlingDisplay}`,
    });
  if (s.bestPartnership)
    notes.push({
      label: "Largest Partnership",
      value: `${s.bestPartnership.runs} runs — ${s.bestPartnership.batterA?.name ?? "?"} & ${s.bestPartnership.batterB?.name ?? "?"}`,
    });
  if (s.mostBoundaries)
    notes.push({
      label: "Most Boundaries",
      value: `${s.mostBoundaries.player.name ?? "?"} — ${s.mostBoundaries.fours + s.mostBoundaries.sixes}`,
    });
  if (s.highestOver)
    notes.push({
      label: "Best Over",
      value: `Ov ${s.highestOver.overNumber + 1} · ${s.highestOver.runs} runs (${s.highestOver.bowler?.name ?? "?"})`,
    });

  if (notes.length === 0) return null;
  return (
    <div>
      <SectionTitle>Match Notes</SectionTitle>
      <ul className="grid gap-1 text-[11.5px] sm:grid-cols-2">
        {notes.map((n) => (
          <li key={n.label} className="flex gap-2">
            <span className="w-40 shrink-0 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {n.label}
            </span>
            <span className="font-medium">{n.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PrintFooter() {
  return (
    <div className="mt-6 border-t pt-3 text-center text-[10px] text-muted-foreground">
      Generated by Academy OS — Official Digital Scorebook · Derived from Ball Event Engine
    </div>
  );
}

/* ---------------- Tiny primitives ---------------- */

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`sb-th py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground ${className}`}
    >
      {children}
    </th>
  );
}
function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`text-right tabular-nums ${className}`}>{children}</td>
  );
}
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
      {children}
    </h3>
  );
}
