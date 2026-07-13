import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MCBallEvent, MCInnings } from "@/lib/mc-ball-events";
import { calculateInningsStatistics } from "@/lib/mc-statistics-engine";
import { commentaryForBall } from "@/lib/mc-commentary";

interface Props {
  events: MCBallEvent[];
  innings: MCInnings | null;
  totalOvers?: number | null;
  matchInfo?: {
    ground?: string | null;
    tournament?: string | null;
    date?: string | null;
    format?: string | null;
    homeTeam?: string;
    awayTeam?: string;
    result?: string | null;
  };
}

export function LiveScorecard({ events, innings, totalOvers, matchInfo }: Props) {
  const stats = calculateInningsStatistics(events, {
    totalOvers: totalOvers ?? null,
    target: innings?.target ?? null,
  });

  return (
    <Tabs defaultValue="summary" className="w-full">
      <TabsList className="flex-wrap">
        <TabsTrigger value="summary">Summary</TabsTrigger>
        <TabsTrigger value="batting">Batting</TabsTrigger>
        <TabsTrigger value="bowling">Bowling</TabsTrigger>
        <TabsTrigger value="fow">Fall of wickets</TabsTrigger>
        <TabsTrigger value="partnerships">Partnerships</TabsTrigger>
        <TabsTrigger value="overs">Overs</TabsTrigger>
        <TabsTrigger value="extras">Extras</TabsTrigger>
        <TabsTrigger value="info">Info</TabsTrigger>
      </TabsList>

      <TabsContent value="summary" className="mt-4 space-y-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <Stat label="Score" value={`${stats.team.runs}/${stats.team.wickets}`} />
          <Stat label="Overs" value={stats.team.oversDisplay} />
          <Stat label="Run rate" value={String(stats.team.runRate)} />
          <Stat label="Boundaries" value={`${stats.team.fours} × 4 · ${stats.team.sixes} × 6`} />
          <Stat label="Dot balls" value={String(stats.team.dotBalls)} />
          <Stat label="Extras" value={String(stats.team.extras.total)} />
        </div>
        {stats.summary.highestScorer && (
          <SumRow label="Top scorer" value={`${stats.summary.highestScorer.player.name ?? "—"} · ${stats.summary.highestScorer.runs} (${stats.summary.highestScorer.balls})`} />
        )}
        {stats.summary.bestBowler && (
          <SumRow label="Best bowler" value={`${stats.summary.bestBowler.player.name ?? "—"} · ${stats.summary.bestBowler.bestBowlingDisplay}`} />
        )}
        {stats.summary.bestPartnership && (
          <SumRow label="Best partnership" value={`${stats.summary.bestPartnership.runs} runs · ${stats.summary.bestPartnership.batterA?.name ?? "?"} & ${stats.summary.bestPartnership.batterB?.name ?? "?"}`} />
        )}
      </TabsContent>

      <TabsContent value="batting" className="mt-4">
        <table className="w-full text-sm">
          <thead className="border-b text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2 text-left">Batter</th>
              <th className="text-right">R</th>
              <th className="text-right">B</th>
              <th className="text-right">4s</th>
              <th className="text-right">6s</th>
              <th className="text-right">SR</th>
              <th className="text-left pl-3">Dismissal</th>
            </tr>
          </thead>
          <tbody>
            {stats.batting.ordered.map((b) => (
              <tr key={b.player.key} className="border-b last:border-0">
                <td className="py-2 font-medium">{b.player.name ?? "—"}</td>
                <td className="text-right tabular-nums font-semibold">{b.runs}</td>
                <td className="text-right tabular-nums">{b.balls}</td>
                <td className="text-right tabular-nums">{b.fours}</td>
                <td className="text-right tabular-nums">{b.sixes}</td>
                <td className="text-right tabular-nums">{b.strikeRate}</td>
                <td className="pl-3 text-xs text-muted-foreground">
                  {b.notOut ? "not out" : `${b.dismissalType ?? ""}${b.dismissedBy?.name ? ` b ${b.dismissedBy.name}` : ""}`}
                </td>
              </tr>
            ))}
            {stats.batting.ordered.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No balls yet.</td></tr>
            )}
          </tbody>
        </table>
      </TabsContent>

      <TabsContent value="bowling" className="mt-4">
        <table className="w-full text-sm">
          <thead className="border-b text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2 text-left">Bowler</th>
              <th className="text-right">O</th>
              <th className="text-right">M</th>
              <th className="text-right">R</th>
              <th className="text-right">W</th>
              <th className="text-right">Econ</th>
              <th className="text-right">Dots</th>
            </tr>
          </thead>
          <tbody>
            {stats.bowling.ordered.map((b) => (
              <tr key={b.player.key} className="border-b last:border-0">
                <td className="py-2 font-medium">{b.player.name ?? "—"}</td>
                <td className="text-right tabular-nums">{b.oversDisplay}</td>
                <td className="text-right tabular-nums">{b.maidens}</td>
                <td className="text-right tabular-nums">{b.runsConceded}</td>
                <td className="text-right tabular-nums font-semibold">{b.wickets}</td>
                <td className="text-right tabular-nums">{b.economy}</td>
                <td className="text-right tabular-nums">{b.dotBalls}</td>
              </tr>
            ))}
            {stats.bowling.ordered.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No balls yet.</td></tr>
            )}
          </tbody>
        </table>
      </TabsContent>

      <TabsContent value="fow" className="mt-4">
        <ul className="space-y-1 text-sm">
          {stats.team.fallOfWickets.map((f) => (
            <li key={f.wicketNumber} className="flex items-center gap-3 border-b py-1.5 last:border-0">
              <span className="w-8 font-semibold tabular-nums">{f.wicketNumber}.</span>
              <span className="tabular-nums font-semibold">{f.score}</span>
              <span className="text-xs text-muted-foreground">({f.overDisplay})</span>
              <span className="ml-2">{f.batter?.name ?? "—"}</span>
              {f.bowler?.name && <span className="ml-auto text-xs text-muted-foreground">b {f.bowler.name}</span>}
            </li>
          ))}
          {stats.team.fallOfWickets.length === 0 && (
            <li className="py-6 text-center text-muted-foreground">No wickets yet.</li>
          )}
        </ul>
      </TabsContent>

      <TabsContent value="partnerships" className="mt-4">
        <ul className="space-y-1 text-sm">
          {stats.team.partnerships.map((p, i) => (
            <li key={i} className="flex items-center justify-between border-b py-1.5 last:border-0">
              <span>{(p.batterA?.name ?? "?")} & {(p.batterB?.name ?? "?")}</span>
              <span className="tabular-nums text-muted-foreground">{p.runs} ({p.balls})</span>
            </li>
          ))}
          {stats.team.currentPartnership && (
            <li className="flex items-center justify-between py-1.5 font-semibold">
              <span>Current · {(stats.team.currentPartnership.batterA?.name ?? "?")} & {(stats.team.currentPartnership.batterB?.name ?? "?")}</span>
              <span className="tabular-nums">{stats.team.currentPartnership.runs} ({stats.team.currentPartnership.balls})</span>
            </li>
          )}
        </ul>
      </TabsContent>

      <TabsContent value="overs" className="mt-4">
        <table className="w-full text-sm">
          <thead className="border-b text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2 text-left">Over</th>
              <th className="text-left">Bowler</th>
              <th className="text-right">Runs</th>
              <th className="text-right">Wkts</th>
              <th className="text-right">Dots</th>
              <th className="text-right">4/6</th>
              <th className="text-right">M</th>
            </tr>
          </thead>
          <tbody>
            {stats.team.overs_summary.map((o) => (
              <tr key={o.overNumber} className="border-b last:border-0">
                <td className="py-1.5 tabular-nums">{o.overNumber + 1}</td>
                <td className="text-xs">{o.bowler?.name ?? "—"}</td>
                <td className="text-right tabular-nums font-semibold">{o.runs}</td>
                <td className="text-right tabular-nums">{o.wickets}</td>
                <td className="text-right tabular-nums">{o.dotBalls}</td>
                <td className="text-right tabular-nums">{o.boundaries}</td>
                <td className="text-right">{o.isMaiden ? "•" : ""}</td>
              </tr>
            ))}
            {stats.team.overs_summary.length === 0 && (
              <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No overs yet.</td></tr>
            )}
          </tbody>
        </table>
      </TabsContent>

      <TabsContent value="extras" className="mt-4">
        <div className="grid gap-2 sm:grid-cols-3">
          <Stat label="Wides" value={String(stats.team.extras.wides)} />
          <Stat label="No balls" value={String(stats.team.extras.noBalls)} />
          <Stat label="Byes" value={String(stats.team.extras.byes)} />
          <Stat label="Leg byes" value={String(stats.team.extras.legByes)} />
          <Stat label="Penalty" value={String(stats.team.extras.penalty)} />
          <Stat label="Total extras" value={String(stats.team.extras.total)} />
        </div>
      </TabsContent>

      <TabsContent value="info" className="mt-4 space-y-2">
        <SumRow label="Teams" value={`${matchInfo?.homeTeam ?? "Home"} vs ${matchInfo?.awayTeam ?? "Away"}`} />
        {matchInfo?.format && <SumRow label="Format" value={matchInfo.format} />}
        {matchInfo?.ground && <SumRow label="Ground" value={matchInfo.ground} />}
        {matchInfo?.tournament && <SumRow label="Tournament" value={matchInfo.tournament} />}
        {matchInfo?.date && <SumRow label="Date" value={matchInfo.date} />}
        {matchInfo?.result && <SumRow label="Result" value={matchInfo.result} />}
      </TabsContent>

      <TabsContent value="commentary" className="mt-4">
        <ul className="space-y-1 text-sm">
          {events
            .slice()
            .reverse()
            .map((e) => (
              <li key={e.id} className="flex gap-2 border-b py-1.5 last:border-0">
                <span className="w-10 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {e.over_number}.{e.ball_number}
                </span>
                <span>{commentaryForBall(e)}</span>
              </li>
            ))}
        </ul>
      </TabsContent>
    </Tabs>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function SumRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}
