import { useState } from "react";
import type { MCBallEvent, MCInnings } from "@/lib/mc-ball-events";
import { ballChipLabel } from "@/lib/mc-commentary";
import {
  calculateInningsStatistics,
  type BattingStat,
  type BowlingStat,
  type OverSummaryStat,
  type Partnership,
  type FallOfWicket,
} from "@/lib/mc-statistics-engine";
import { cn } from "@/lib/utils";
import {
  BatterDetailSheet,
  BowlerDetailSheet,
} from "@/components/match-center/scorecard-detail-sheets";
import { SquadList } from "@/components/match-center/SquadList";

interface Props {
  events: MCBallEvent[];
  innings: MCInnings | null;
  totalOvers?: number | null;
  hideHero?: boolean;
  commentary?: { id: string; over: string; text: string }[];
  matchInfo?: {
    ground?: string | null;
    tournament?: string | null;
    date?: string | null;
    format?: string | null;
    homeTeam?: string;
    awayTeam?: string;
    result?: string | null;
  };
  squad?: {
    matchId: string;
    teamId: string;
    teamName: string;
  };
  /**
   * Optional inline team switcher rendered at the top of team-scoped tabs
   * (Batting / Bowling / Squad). Phase 33 — replaces the page-level pill.
   */
  teamSwitcher?: React.ReactNode;
}

type TabKey = "summary" | "batting" | "bowling" | "overs" | "squad" | "commentary";

const TABS: { key: TabKey; label: string }[] = [
  { key: "summary", label: "Summary" },
  { key: "batting", label: "Batting" },
  { key: "bowling", label: "Bowling" },
  { key: "overs", label: "Overs" },
  { key: "squad", label: "Squad" },
  { key: "commentary", label: "Commentary" },
];

export function LiveScorecard({ events, innings, totalOvers, matchInfo, hideHero, commentary, squad }: Props) {

  const [tab, setTab] = useState<TabKey>("summary");
  const [openBatter, setOpenBatter] = useState<BattingStat | null>(null);
  const [openBowler, setOpenBowler] = useState<BowlingStat | null>(null);
  const stats = calculateInningsStatistics(events, {
    totalOvers: totalOvers ?? null,
    target: innings?.target ?? null,
  });

  // When embedded in a page that scrolls (hideHero=true, e.g. public match view),
  // don't create nested scroll containers — let the page scroll naturally.
  const embedded = !!hideHero;

  return (
    <div className={embedded ? "flex flex-col" : "flex h-full min-h-0 flex-col"}>

      {!hideHero && (
        <div className="px-1 pb-3">
          <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-sm">
            <div className="flex items-baseline justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {matchInfo?.homeTeam ?? "Home"} vs {matchInfo?.awayTeam ?? "Away"}
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-[34px] font-black leading-none tabular-nums tracking-tight">
                    {stats.team.runs}
                    <span className="text-muted-foreground">/</span>
                    {stats.team.wickets}
                  </span>
                  <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                    ({stats.team.oversDisplay})
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  CRR
                </div>
                <div className="text-xl font-bold tabular-nums">{stats.team.runRate}</div>
                {stats.team.requiredRunRate != null && (
                  <>
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      RRR
                    </div>
                    <div className="text-sm font-bold tabular-nums text-primary">
                      {stats.team.requiredRunRate}
                    </div>
                  </>
                )}
              </div>
            </div>
            {stats.team.target != null &&
              stats.team.requiredRuns != null &&
              stats.team.ballsRemaining != null && (
                <div className="mt-3 rounded-xl bg-background/60 px-3 py-2 text-xs font-medium tabular-nums">
                  Need <span className="font-bold text-foreground">{stats.team.requiredRuns}</span>{" "}
                  from{" "}
                  <span className="font-bold text-foreground">{stats.team.ballsRemaining}</span>{" "}
                  balls · Target{" "}
                  <span className="font-bold text-foreground">{stats.team.target}</span>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Segment control */}
      <div className={cn("z-10 -mx-1 space-y-2 bg-background/95 px-1 pb-2 backdrop-blur", !embedded && "sticky top-0")}>
        <div className="flex gap-1 overflow-x-auto rounded-full bg-muted p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-all",
                tab === t.key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scroll content */}
      <div className={cn("px-1 pt-3 pb-4 animate-fade-in", embedded ? "" : "flex-1 min-h-0 overflow-y-auto overscroll-contain")}>
        {tab === "summary" && <SummaryPane stats={stats} matchInfo={matchInfo} />}
        {tab === "batting" && (
          <BattingTable batters={stats.batting.ordered} onSelect={setOpenBatter} />
        )}
        {tab === "bowling" && (
          <BowlingTable bowlers={stats.bowling.ordered} onSelect={setOpenBowler} />
        )}
        {tab === "overs" && <OversPane overs={stats.team.overs_summary} />}
        {tab === "squad" && (squad ? (
          <SquadList matchId={squad.matchId} teamId={squad.teamId} teamName={squad.teamName} />
        ) : (
          <EmptyState text="Squad unavailable." />
        ))}
        {tab === "more" && <MorePane stats={stats} matchInfo={matchInfo} commentary={commentary} />}

      </div>

      <BatterDetailSheet
        open={!!openBatter}
        onOpenChange={(o) => !o && setOpenBatter(null)}
        batter={openBatter}
        events={events}
        partnerships={stats.team.partnerships}
      />

      <BowlerDetailSheet
        open={!!openBowler}
        onOpenChange={(o) => !o && setOpenBowler(null)}
        bowler={openBowler}
        events={events}
        overs={stats.team.overs_summary}
      />
    </div>
  );
}

/* ----------------------------- Compact tables ---------------------------- */

function BattingTable({
  batters,
  onSelect,
}: {
  batters: BattingStat[];
  onSelect?: (b: BattingStat) => void;
}) {
  if (batters.length === 0) return <EmptyState text="No balls yet." />;
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      {/* Header row — semantic grid so columns align perfectly with each row. */}
      <div className="sticky top-0 z-[1] grid grid-cols-[minmax(0,1fr)_2.25rem_2.25rem_2.25rem_2.25rem_3rem] items-center gap-x-2 border-b border-border/60 bg-muted/60 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        <div className="text-left">Batter</div>
        <div className="text-right">R</div>
        <div className="text-right">B</div>
        <div className="text-right">4s</div>
        <div className="text-right">6s</div>
        <div className="text-right">SR</div>
      </div>
      <ul className="divide-y divide-border/40">
        {batters.map((b) => {
          const dismissal = b.notOut
            ? "not out"
            : `${b.dismissalType ?? "out"}${b.dismissedBy?.name ? ` b ${b.dismissedBy.name}` : ""}`;
          return (
            <li
              key={b.player.key}
              onClick={() => onSelect?.(b)}
              onKeyDown={(e) => {
                if (!onSelect) return;
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSelect(b);
                }
              }}
              role={onSelect ? "button" : undefined}
              tabIndex={onSelect ? 0 : undefined}
              className={cn(
                "grid grid-cols-[minmax(0,1fr)_2.25rem_2.25rem_2.25rem_2.25rem_3rem] items-center gap-x-2 px-3 py-3 min-h-14 tabular-nums text-[13px]",
                onSelect &&
                  "cursor-pointer transition-colors hover:bg-muted/40 active:bg-muted/60 focus:outline-none focus-visible:bg-muted/40",
              )}
            >
              <div className="min-w-0 text-left">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-[14px] font-bold leading-tight">
                    {b.player.name ?? "—"}
                  </span>
                  {b.notOut && (
                    <span
                      className="shrink-0 text-[13px] font-black leading-none text-primary"
                      aria-label="not out"
                    >
                      *
                    </span>
                  )}
                </div>
                <div className="truncate text-[10.5px] font-medium text-muted-foreground">
                  {dismissal}
                </div>
              </div>
              <div className="text-right font-black">{b.runs}</div>
              <div className="text-right">{b.balls}</div>
              <div className="text-right">{b.fours}</div>
              <div className="text-right">{b.sixes}</div>
              <div className="text-right">{b.strikeRate}</div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BowlingTable({
  bowlers,
  onSelect,
}: {
  bowlers: BowlingStat[];
  onSelect?: (b: BowlingStat) => void;
}) {
  if (bowlers.length === 0) return <EmptyState text="No balls yet." />;
  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
      <div className="sticky top-0 z-[1] grid grid-cols-[minmax(0,1fr)_2.5rem_2.5rem_2.25rem_3rem] items-center gap-x-2 border-b border-border/60 bg-muted/60 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        <div className="text-left">Bowler</div>
        <div className="text-right">O</div>
        <div className="text-right">R</div>
        <div className="text-right">W</div>
        <div className="text-right">Econ</div>
      </div>
      <ul className="divide-y divide-border/40">
        {bowlers.map((b) => (
          <li
            key={b.player.key}
            onClick={() => onSelect?.(b)}
            onKeyDown={(e) => {
              if (!onSelect) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(b);
              }
            }}
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect ? 0 : undefined}
            className={cn(
              "grid grid-cols-[minmax(0,1fr)_2.5rem_2.5rem_2.25rem_3rem] items-center gap-x-2 px-3 py-3 min-h-14 tabular-nums text-[13px]",
              onSelect &&
                "cursor-pointer transition-colors hover:bg-muted/40 active:bg-muted/60 focus:outline-none focus-visible:bg-muted/40",
            )}
          >
            <div className="min-w-0 text-left">
              <div className="truncate text-[14px] font-bold leading-tight">
                {b.player.name ?? "—"}
              </div>
              <div className="truncate text-[10.5px] font-medium text-muted-foreground">
                {b.dotBalls} dots • {b.wides} wd • {b.noBalls} nb • {b.maidens}{" "}
                {b.maidens === 1 ? "maiden" : "maidens"}
              </div>
            </div>
            <div className="text-right">{b.oversDisplay}</div>
            <div className="text-right">{b.runsConceded}</div>
            <div className="text-right font-black">{b.wickets}</div>
            <div className="text-right">{b.economy}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --------------------------------- Panes --------------------------------- */

function SummaryPane({
  stats,
  matchInfo,
}: {
  stats: ReturnType<typeof calculateInningsStatistics>;
  matchInfo?: Props["matchInfo"];
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <MetricCard label="Boundaries" value={`${stats.team.fours}·4  ${stats.team.sixes}·6`} />
        <MetricCard label="Dot balls" value={String(stats.team.dotBalls)} />
        <MetricCard label="Extras" value={String(stats.team.extras.total)} />
        <MetricCard label="Wickets" value={String(stats.team.wickets)} />
      </div>

      {stats.summary.highestScorer && (
        <HighlightRow
          label="Top scorer"
          name={stats.summary.highestScorer.player.name ?? "—"}
          value={`${stats.summary.highestScorer.runs} (${stats.summary.highestScorer.balls})`}
        />
      )}
      {stats.summary.bestBowler && (
        <HighlightRow
          label="Best bowler"
          name={stats.summary.bestBowler.player.name ?? "—"}
          value={stats.summary.bestBowler.bestBowlingDisplay}
        />
      )}
      {stats.summary.bestPartnership && (
        <HighlightRow
          label="Best partnership"
          name={`${stats.summary.bestPartnership.batterA?.name ?? "?"} & ${stats.summary.bestPartnership.batterB?.name ?? "?"}`}
          value={`${stats.summary.bestPartnership.runs} (${stats.summary.bestPartnership.balls})`}
        />
      )}

      {stats.team.currentPartnership && (
        <PartnershipCard p={stats.team.currentPartnership} current />
      )}

      {matchInfo?.result && (
        <div className="rounded-2xl border border-primary/40 bg-primary/5 px-4 py-3 text-sm font-semibold text-foreground">
          {matchInfo.result}
        </div>
      )}
    </div>
  );
}

function BattingPane({ batters }: { batters: BattingStat[] }) {
  if (batters.length === 0) return <EmptyState text="No balls yet." />;
  return (
    <div className="space-y-2">
      {batters.map((b) => (
        <BatterCard key={b.player.key} b={b} />
      ))}
    </div>
  );
}

function BatterCard({ b }: { b: BattingStat }) {
  const dismissal = b.notOut
    ? "not out"
    : `${b.dismissalType ?? "out"}${b.dismissedBy?.name ? ` b ${b.dismissedBy.name}` : ""}`;
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold leading-tight">
            {b.player.name ?? "—"}
            {b.notOut && (
              <span className="ml-1.5 rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                Not out
              </span>
            )}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{dismissal}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xl font-black leading-none tabular-nums">
            {b.runs}
            <span className="ml-1 text-xs font-semibold text-muted-foreground">({b.balls})</span>
          </div>
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-4 gap-1.5">
        <MiniStat label="4s" value={b.fours} />
        <MiniStat label="6s" value={b.sixes} />
        <MiniStat label="SR" value={b.strikeRate} />
        <MiniStat label="Dots" value={b.dotBalls} />
      </div>
    </div>
  );
}

function BowlingPane({ bowlers }: { bowlers: BowlingStat[] }) {
  if (bowlers.length === 0) return <EmptyState text="No balls yet." />;
  return (
    <div className="space-y-2">
      {bowlers.map((b) => (
        <BowlerCard key={b.player.key} b={b} />
      ))}
    </div>
  );
}

function BowlerCard({ b }: { b: BowlingStat }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[15px] font-semibold leading-tight">
            {b.player.name ?? "—"}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground tabular-nums">
            {b.oversDisplay} ov · Econ {b.economy}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xl font-black leading-none tabular-nums">
            {b.wickets}
            <span className="text-muted-foreground">/</span>
            {b.runsConceded}
          </div>
        </div>
      </div>
      <div className="mt-2.5 grid grid-cols-4 gap-1.5">
        <MiniStat label="Overs" value={b.oversDisplay} />
        <MiniStat label="Mdns" value={b.maidens} />
        <MiniStat label="Dots" value={b.dotBalls} />
        <MiniStat label="Econ" value={b.economy} />
      </div>
    </div>
  );
}

function OversPane({ overs }: { overs: OverSummaryStat[] }) {
  if (overs.length === 0) return <EmptyState text="No overs yet." />;
  return (
    <div className="space-y-2">
      {[...overs].reverse().map((o) => (
        <div
          key={o.overNumber}
          className="rounded-2xl border border-border/60 bg-card p-3 shadow-sm"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                Over {o.overNumber + 1}
                {o.isMaiden && (
                  <span className="ml-1.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-600">
                    Maiden
                  </span>
                )}
              </div>
              <div className="mt-0.5 truncate text-[13px] font-semibold">
                {o.bowler?.name ?? "—"}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-lg font-black leading-none tabular-nums">
                {o.runs}
                <span className="text-muted-foreground">/</span>
                {o.wickets}
              </div>
              <div className="text-[10px] text-muted-foreground tabular-nums">
                {o.dotBalls} dots · {o.boundaries} bnd
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MorePane({
  stats,
  matchInfo,
  commentary,
}: {
  stats: ReturnType<typeof calculateInningsStatistics>;
  matchInfo?: Props["matchInfo"];
  commentary?: { id: string; over: string; text: string }[];
}) {
  return (
    <div className="space-y-4">
      {commentary && commentary.length > 0 && (
        <Section title="Commentary">
          <CommentaryPane commentary={commentary} />
        </Section>
      )}

      <Section title="Fall of wickets">
        {stats.team.fallOfWickets.length === 0 ? (
          <EmptyState text="No wickets yet." />
        ) : (
          <div className="space-y-1.5">
            {stats.team.fallOfWickets.map((f) => (
              <FowRow key={f.wicketNumber} f={f} />
            ))}
          </div>
        )}
      </Section>

      <Section title="Partnerships">
        {stats.team.partnerships.length === 0 && !stats.team.currentPartnership ? (
          <EmptyState text="No partnerships yet." />
        ) : (
          <div className="space-y-1.5">
            {stats.team.partnerships.map((p, i) => (
              <PartnershipCard key={i} p={p} />
            ))}
            {stats.team.currentPartnership && (
              <PartnershipCard p={stats.team.currentPartnership} current />
            )}
          </div>
        )}
      </Section>

      <Section title="Extras">
        <div className="grid grid-cols-2 gap-2">
          <MetricCard label="Wides" value={String(stats.team.extras.wides)} />
          <MetricCard label="No balls" value={String(stats.team.extras.noBalls)} />
          <MetricCard label="Byes" value={String(stats.team.extras.byes)} />
          <MetricCard label="Leg byes" value={String(stats.team.extras.legByes)} />
          <MetricCard label="Penalty" value={String(stats.team.extras.penalty)} />
          <MetricCard label="Total" value={String(stats.team.extras.total)} accent />
        </div>
      </Section>

      <Section title="Match info">
        <div className="rounded-2xl border border-border/60 bg-card divide-y divide-border/50">
          <InfoRow
            label="Teams"
            value={`${matchInfo?.homeTeam ?? "Home"} vs ${matchInfo?.awayTeam ?? "Away"}`}
          />
          {matchInfo?.format && <InfoRow label="Format" value={matchInfo.format} />}
          {matchInfo?.ground && <InfoRow label="Ground" value={matchInfo.ground} />}
          {matchInfo?.tournament && <InfoRow label="Tournament" value={matchInfo.tournament} />}
          {matchInfo?.date && <InfoRow label="Date" value={matchInfo.date} />}
          {matchInfo?.result && <InfoRow label="Result" value={matchInfo.result} />}
        </div>
      </Section>
    </div>
  );
}

/* ------------------------------- Primitives ------------------------------ */

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-3",
        accent ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card",
      )}
    >
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-lg font-black tabular-nums leading-none">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg bg-muted/60 px-2 py-1.5 text-center">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="text-[13px] font-bold tabular-nums leading-tight">{value}</div>
    </div>
  );
}

function HighlightRow({ label, name, value }: { label: string; name: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card px-3.5 py-2.5 shadow-sm">
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {label}
        </div>
        <div className="truncate text-[14px] font-semibold">{name}</div>
      </div>
      <div className="shrink-0 text-right text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}

function PartnershipCard({ p, current }: { p: Partnership; current?: boolean }) {
  const rr = p.balls > 0 ? +((p.runs / p.balls) * 6).toFixed(2) : 0;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5",
        current ? "border-primary/40 bg-primary/5" : "border-border/60 bg-card",
      )}
    >
      <div className="min-w-0 flex-1">
        {current && (
          <div className="text-[9px] font-bold uppercase tracking-widest text-primary">Current</div>
        )}
        <div className="truncate text-[13px] font-semibold">
          {p.batterA?.name ?? "?"} <span className="text-muted-foreground">&</span>{" "}
          {p.batterB?.name ?? "?"}
        </div>
        <div className="text-[10px] text-muted-foreground tabular-nums">RR {rr}</div>
      </div>
      <div className="shrink-0 text-right">
        <div className="text-lg font-black tabular-nums leading-none">{p.runs}</div>
        <div className="text-[10px] text-muted-foreground tabular-nums">({p.balls})</div>
      </div>
    </div>
  );
}

function FowRow({ f }: { f: FallOfWicket }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-3 py-2">
      <div className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-bold text-primary tabular-nums">
        {f.wicketNumber}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold">{f.batter?.name ?? "—"}</div>
        {f.bowler?.name && (
          <div className="truncate text-[10px] text-muted-foreground">b {f.bowler.name}</div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-sm font-bold tabular-nums">{f.score}</div>
        <div className="text-[10px] text-muted-foreground tabular-nums">{f.overDisplay} ov</div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
      <span className="text-[12px] text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right text-[13px] font-semibold">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 px-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-card/50 p-6 text-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}

function CommentaryPane({ commentary }: { commentary: { id: string; over: string; text: string }[] }) {
  if (commentary.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-card/50 p-6 text-center text-xs text-muted-foreground">
        No commentary yet.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-border/60 rounded-2xl border border-border/60 bg-card/50">
      {commentary.map((c) => (
        <li key={c.id} className="flex items-start gap-3 px-4 py-3">
          <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-muted-foreground">
            {c.over}
          </span>
          <span className="text-sm">{c.text}</span>
        </li>
      ))}
    </ul>
  );
}
