import type { MCBallEvent, DismissalType, ExtraType } from "@/lib/mc-ball-events";
import { isLegalDelivery } from "@/lib/mc-ball-events-core";
import {
  isBowlerCredited,
  isWicketDismissal,
  totalRunsForBall,
} from "@/lib/mc-rules-engine";
import {
  playerKey,
  type BattingStat,
  type BowlingStat,
  type OverSummaryStat,
  type Partnership,
  type PlayerKey,
} from "@/lib/mc-statistics-engine";
import { ballChipLabel } from "@/lib/mc-commentary";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

/* ================================================================
 * Scorecard detail bottom sheets — one for batters, one for bowlers.
 * Cricbuzz-familiar layout: big hero number, dense-but-airy stat grid,
 * chip-style scoring sequence, and a scrollable secondary section
 * (partnerships for batters, per-over breakdown + wickets for bowlers).
 * ================================================================ */

function chipTone(label: string): string {
  const t = label.trim().toUpperCase();
  if (t.startsWith("W")) return "bg-destructive/15 text-destructive border-destructive/30";
  if (t === "4") return "bg-primary/12 text-primary border-primary/30";
  if (t === "6") return "bg-primary/20 text-primary border-primary/40";
  if (t === "•" || t === "0") return "bg-muted text-muted-foreground border-border/50";
  if (/^(WD|NB|B|LB)/.test(t)) return "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400";
  return "bg-card text-foreground border-border/60";
}

function SheetShell({
  open,
  onOpenChange,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[85vh] rounded-t-2xl p-0 flex flex-col [&>button.absolute]:hidden"
      >
        <header className="shrink-0 flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div className="min-w-0">
            <SheetTitle className="truncate text-[15px] font-black tracking-tight">
              {title}
            </SheetTitle>
            {subtitle && (
              <div className="mt-0.5 truncate text-[11px] font-semibold text-muted-foreground tabular-nums">
                {subtitle}
              </div>
            )}
          </div>
          <SheetClose
            aria-label="Close"
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-border/60 bg-background/70 px-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground transition duration-100 hover:text-foreground active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X className="size-3.5" />
            Close
          </SheetClose>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain ds-scroll px-4 py-4">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StatTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border px-3 py-2.5",
        accent ? "border-primary/40 bg-primary/[0.06]" : "border-border/60 bg-card",
      )}
    >
      <div className="text-[9.5px] font-black uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-[17px] font-black tabular-nums leading-none">{value}</div>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="mb-2 mt-4 text-[10.5px] font-black uppercase tracking-widest text-muted-foreground">
      {title}
    </h3>
  );
}

/* ---------------------------- BATTER SHEET ---------------------------- */

function buildBatterSequence(
  events: MCBallEvent[],
  batterKey: PlayerKey,
): { chips: string[]; balls: number } {
  const chips: string[] = [];
  let balls = 0;
  for (const e of events) {
    const strikerKey = playerKey(e.striker_athlete_id, e.striker_name);
    if (strikerKey !== batterKey) continue;
    // Skip wides — the batter did not face the ball for personal stats
    if (e.extra_type === "wide") continue;
    chips.push(ballChipLabel(e));
    if (isLegalDelivery(e.extra_type as ExtraType | null)) balls += 1;
  }
  return { chips, balls };
}

function findBatterPartnerships(
  partnerships: Partnership[],
  batterKey: PlayerKey,
): Partnership[] {
  return partnerships.filter(
    (p) => p.batterA?.key === batterKey || p.batterB?.key === batterKey,
  );
}

export function BatterDetailSheet({
  open,
  onOpenChange,
  batter,
  events,
  partnerships,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  batter: BattingStat | null;
  events: MCBallEvent[];
  partnerships: Partnership[];
}) {
  if (!batter) return null;

  const dismissal = batter.notOut
    ? "not out"
    : `${batter.dismissalType ?? "out"}${batter.dismissedBy?.name ? ` b ${batter.dismissedBy.name}` : ""}${batter.fielder?.name && batter.dismissalType !== "bowled" ? ` c ${batter.fielder.name}` : ""}`;

  const { chips } = buildBatterSequence(events, batter.player.key);
  const batterPartnerships = findBatterPartnerships(partnerships, batter.player.key);

  return (
    <SheetShell
      open={open}
      onOpenChange={onOpenChange}
      title={batter.player.name ?? "Batter"}
      subtitle={dismissal}
    >
      {/* Hero score */}
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-[42px] font-black leading-none tabular-nums tracking-tight">
          {batter.runs}
        </span>
        <span className="text-[15px] font-bold tabular-nums text-muted-foreground">
          ({batter.balls})
        </span>
        {batter.notOut && (
          <span className="ml-1 rounded-full bg-primary/15 px-2 py-0.5 text-[9.5px] font-black uppercase tracking-widest text-primary">
            Not out
          </span>
        )}
        <span className="ml-auto text-right">
          <div className="text-[9.5px] font-black uppercase tracking-widest text-muted-foreground">
            Strike rate
          </div>
          <div className="text-[19px] font-black tabular-nums leading-none">
            {batter.strikeRate}
          </div>
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="4s" value={batter.fours} />
        <StatTile label="6s" value={batter.sixes} />
        <StatTile label="Dots" value={batter.dotBalls} />
        <StatTile label="Singles" value={batter.singles} />
        <StatTile label="Doubles" value={batter.doubles} />
        <StatTile label="Triples" value={batter.triples} />
      </div>

      {/* Scoring sequence */}
      <SectionHeader title="Scoring sequence" />
      {chips.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-card/50 p-4 text-center text-[12px] text-muted-foreground">
          No balls faced yet.
        </div>
      ) : (
        <div className="flex flex-wrap gap-1 rounded-xl border border-border/60 bg-card p-2.5">
          {chips.map((chip, i) => (
            <span
              key={`${chip}-${i}`}
              className={cn(
                "inline-flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 text-[11px] font-black tabular-nums",
                chipTone(chip),
              )}
            >
              {chip}
            </span>
          ))}
        </div>
      )}

      {/* Wagon wheel placeholder */}
      <SectionHeader title="Wagon wheel" />
      <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 text-[11.5px] font-semibold text-muted-foreground">
        Coming soon
      </div>

      {/* Partnerships */}
      <SectionHeader title="Partnerships" />
      {batterPartnerships.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-card/50 p-4 text-center text-[12px] text-muted-foreground">
          No partnerships yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {batterPartnerships.map((p, i) => {
            const partner =
              p.batterA?.key === batter.player.key ? p.batterB : p.batterA;
            return (
              <li
                key={i}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-2"
              >
                <span className="min-w-0 truncate text-[13px] font-semibold">
                  with {partner?.name ?? "?"}
                </span>
                <span className="shrink-0 text-right tabular-nums">
                  <span className="text-[14px] font-black">{p.runs}</span>
                  <span className="ml-1 text-[11px] font-semibold text-muted-foreground">
                    ({p.balls})
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {/* Dismissal */}
      <SectionHeader title="Dismissal" />
      <div className="rounded-xl border border-border/60 bg-card px-3 py-2.5 text-[13px] font-semibold">
        {dismissal}
      </div>
    </SheetShell>
  );
}

/* ---------------------------- BOWLER SHEET ---------------------------- */

function bowlerOvers(
  overs: OverSummaryStat[],
  bowlerKey: PlayerKey,
): OverSummaryStat[] {
  return overs.filter((o) => o.bowler?.key === bowlerKey);
}

function bowlerWickets(
  events: MCBallEvent[],
  bowlerKey: PlayerKey,
): { overDisplay: string; batter: string; dismissal: string }[] {
  const out: { overDisplay: string; batter: string; dismissal: string }[] = [];
  let legalBalls = 0;
  for (const e of events) {
    if (isLegalDelivery(e.extra_type as ExtraType | null)) legalBalls += 1;
    const dt = e.dismissal_type as DismissalType | null;
    if (!isWicketDismissal(dt)) continue;
    if (!isBowlerCredited(dt)) continue;
    const bKey = playerKey(e.bowler_athlete_id, e.bowler_name);
    if (bKey !== bowlerKey) continue;
    const overs = Math.floor(legalBalls / 6);
    const balls = legalBalls % 6;
    out.push({
      overDisplay: `${overs}.${balls}`,
      batter: e.dismissed_name ?? e.striker_name ?? "—",
      dismissal: dt ?? "out",
    });
  }
  return out;
}

export function BowlerDetailSheet({
  open,
  onOpenChange,
  bowler,
  events,
  overs,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  bowler: BowlingStat | null;
  events: MCBallEvent[];
  overs: OverSummaryStat[];
}) {
  if (!bowler) return null;
  const perOver = bowlerOvers(overs, bowler.player.key);
  const wickets = bowlerWickets(events, bowler.player.key);

  return (
    <SheetShell
      open={open}
      onOpenChange={onOpenChange}
      title={bowler.player.name ?? "Bowler"}
      subtitle={`${bowler.oversDisplay} ov  •  Econ ${bowler.economy}`}
    >
      {/* Hero figures */}
      <div className="mb-3 flex items-baseline gap-2">
        <span className="text-[42px] font-black leading-none tabular-nums tracking-tight">
          {bowler.wickets}
        </span>
        <span className="text-[24px] font-black leading-none tabular-nums text-muted-foreground">
          /
        </span>
        <span className="text-[42px] font-black leading-none tabular-nums tracking-tight">
          {bowler.runsConceded}
        </span>
        <span className="ml-auto text-right">
          <div className="text-[9.5px] font-black uppercase tracking-widest text-muted-foreground">
            Economy
          </div>
          <div className="text-[19px] font-black tabular-nums leading-none">
            {bowler.economy}
          </div>
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-2">
        <StatTile label="Overs" value={bowler.oversDisplay} />
        <StatTile label="Maidens" value={bowler.maidens} />
        <StatTile label="Dots" value={bowler.dotBalls} />
        <StatTile label="Wides" value={bowler.wides} />
        <StatTile label="No balls" value={bowler.noBalls} />
        <StatTile label="Best" value={bowler.bestBowlingDisplay} />
      </div>

      {/* Over-by-over */}
      <SectionHeader title="Over-by-over" />
      {perOver.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-card/50 p-4 text-center text-[12px] text-muted-foreground">
          No overs bowled yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {perOver.map((o) => (
            <li
              key={o.overNumber}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-2"
            >
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="text-[9.5px] font-black uppercase tracking-widest text-muted-foreground">
                  Over
                </span>
                <span className="text-[14px] font-black tabular-nums">
                  {o.overNumber + 1}
                </span>
                {o.isMaiden && (
                  <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                    M
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5 tabular-nums">
                <span className="rounded-md bg-primary/12 px-2 py-0.5 text-[11.5px] font-black text-primary">
                  {o.runs}R
                </span>
                {o.wickets > 0 && (
                  <span className="rounded-md bg-destructive/15 px-2 py-0.5 text-[11.5px] font-black text-destructive">
                    {o.wickets}W
                  </span>
                )}
                <span className="rounded-md bg-muted px-2 py-0.5 text-[11.5px] font-black text-muted-foreground">
                  {o.dotBalls} dots
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Wickets */}
      <SectionHeader title="Wickets" />
      {wickets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-card/50 p-4 text-center text-[12px] text-muted-foreground">
          No wickets yet.
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {wickets.map((w, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold">{w.batter}</div>
                <div className="text-[10.5px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {w.dismissal}
                </div>
              </div>
              <span className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-[11.5px] font-black tabular-nums text-muted-foreground">
                {w.overDisplay}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SheetShell>
  );
}
