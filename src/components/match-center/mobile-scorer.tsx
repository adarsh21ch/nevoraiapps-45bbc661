import { useEffect, useMemo, useState, type ReactNode } from "react";
import { NumberRoll } from "@/components/ui/number-roll";
import { useSwipe } from "@/hooks/use-swipe";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  FileText,
  Flag,
  HeartPulse,
  MoreHorizontal,
  Redo2,
  RefreshCw,
  Search,
  Shield,
  StopCircle,
  Trash2,
  Undo2,
  UserCog,
  UserPlus,
} from "lucide-react";

import type { BatterStats, BowlerStats, PlayerOption } from "./scoring-ui";

export interface MobileScorerInsight {
  partnership?: string;
  projected?: string;
  lastWicket?: string;
  extras?: string;
  recentOvers?: { label: string; runs: number; wickets: number }[];
}

export interface MobileScorerProps {
  onExit: () => void;
  tournamentLabel?: string;
  matchTitle: string;
  isLive?: boolean;

  score: string;
  overs: string;
  crr?: string;
  rrr?: string;
  target?: string;
  chase?: { runsNeeded: number; ballsLeft: number } | null;

  striker?: BatterStats;
  nonStriker?: BatterStats;
  bowler?: BowlerStats;
  partnership?: { runs: number; balls: number } | null;
  overBalls: string[];
  insights?: MobileScorerInsight;

  disabled?: boolean;
  onRun: (r: 0 | 1 | 2 | 3 | 4 | 6) => void;
  onExtra: (kind: "Wide" | "No Ball" | "Bye" | "Leg Bye") => void;
  onOut: () => void;

  onOpenStrikerPicker: () => void;
  onOpenNonStrikerPicker: () => void;
  onOpenBowlerPicker: () => void;
  battingOptions?: PlayerOption[];
  bowlingOptions?: PlayerOption[];
  onPickPlayer?: (role: PickerKind, p: PlayerOption) => void;
  awaitingNewBatter?: boolean;
  awaitingNewBatterRole?: "striker" | "nonStriker";
  awaitingNewBowler?: boolean;
  previousBowlerName?: string | null;
  previousBowlerId?: string | null;
  bowledBowlerIds?: string[];
  dismissedBatterIds?: string[];
  dismissedBatterNames?: string[];


  onUndo: () => void;
  onSwapStrike: () => void;
  onRetiredHurt: () => void;
  onFinishInnings?: () => void;
  onEndMatch: () => void;
  showFinishInnings?: boolean;
  hideEndMatch?: boolean;

  onOpenScorecard: () => void;
  onOpenScorebook?: () => void;
  onShareMatch?: () => void;

}


type PickerKind = "striker" | "nonStriker" | "bowler";

export function MobileScorer(props: MobileScorerProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState<PickerKind | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [confirm, setConfirm] = useState<
    null | { kind: "end-match" | "finish-innings" | "delete-ball" }
  >(null);

  const sheetPickerEnabled = Boolean(
    props.battingOptions && props.bowlingOptions && props.onPickPlayer,
  );

  const hasActiveStriker = Boolean(props.striker?.name);
  const hasActiveNonStriker = Boolean(props.nonStriker?.name);
  const missingBatterRole: PickerKind | null = !hasActiveStriker
    ? "striker"
    : !hasActiveNonStriker
      ? "nonStriker"
      : null;
  const effectiveAwaitingNewBatter = Boolean(
    props.awaitingNewBatter && missingBatterRole,
  );

  useEffect(() => {
    if (!sheetPickerEnabled || !props.awaitingNewBowler) return;
    setPickerOpen("bowler");
  }, [sheetPickerEnabled, props.awaitingNewBowler]);

  // Auto-open the batter picker when a wicket falls and a slot is empty.
  useEffect(() => {
    if (!sheetPickerEnabled) return;
    if (!props.awaitingNewBatter) return;
    if (!missingBatterRole) return;
    setPickerOpen(missingBatterRole);
  }, [sheetPickerEnabled, props.awaitingNewBatter, missingBatterRole]);


  useEffect(() => {
    setPickerQuery("");
  }, [pickerOpen]);

  const waitingBatterRole = missingBatterRole ?? props.awaitingNewBatterRole ?? "striker";

  // Swipe gestures: right = undo last ball. Swipe-up removed to prevent
  // accidental opening of the More sheet when scrolling.
  const swipeHandlers = useSwipe({
    onSwipeRight: () => props.onUndo(),
    threshold: 72,
  });


  const openPicker = (kind: PickerKind) => {
    if (sheetPickerEnabled) {
      setPickerOpen(kind);
      return;
    }
    if (kind === "striker") props.onOpenStrikerPicker();
    else if (kind === "nonStriker") props.onOpenNonStrikerPicker();
    else props.onOpenBowlerPicker();
  };

  const pickerCandidates = useMemo(() => {
    if (!pickerOpen || !sheetPickerEnabled) return [];
    const base = pickerOpen === "bowler" ? props.bowlingOptions ?? [] : props.battingOptions ?? [];
    if (pickerOpen === "bowler") return base;

    const excluded = new Set<string>();
    const excludedNames = new Set<string>();
    if (pickerOpen === "striker" && props.nonStriker?.name) excludedNames.add(props.nonStriker.name);
    if (pickerOpen === "nonStriker" && props.striker?.name) excludedNames.add(props.striker.name);
    // Exclude anyone already dismissed in this innings.
    for (const id of props.dismissedBatterIds ?? []) excluded.add(id);
    for (const name of props.dismissedBatterNames ?? []) excludedNames.add(name);
    return base.filter((p) => !excluded.has(p.id) && !excludedNames.has(p.name));
  }, [
    pickerOpen,
    sheetPickerEnabled,
    props.battingOptions,
    props.bowlingOptions,
    props.striker?.name,
    props.nonStriker?.name,
    props.dismissedBatterIds,
    props.dismissedBatterNames,
  ]);


  const filteredCandidates = useMemo(() => {
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return pickerCandidates;
    return pickerCandidates.filter((p) => p.name.toLowerCase().includes(q));
  }, [pickerCandidates, pickerQuery]);

  const isIllegalBowler = (p: PlayerOption) => {
    if (pickerOpen !== "bowler") return false;
    if (!props.awaitingNewBowler) return false;
    if (props.previousBowlerId && p.id === props.previousBowlerId) return true;
    return Boolean(props.previousBowlerName && p.name === props.previousBowlerName);
  };

  const closeAll = () => {
    setMoreOpen(false);
    setConfirm(null);
  };

  const confirmMeta = (() => {
    if (!confirm) return null;
    if (confirm.kind === "end-match") {
      return {
        title: "End match?",
        description: "This finalises the match. This action cannot be undone once the match is locked.",
        action: "End match",
        run: () => {
          closeAll();
          props.onEndMatch();
        },
      };
    }
    if (confirm.kind === "finish-innings") {
      return {
        title: "Finish innings?",
        description: "The current innings will be marked complete. You can start the next innings after confirming.",
        action: "Finish innings",
        run: () => {
          closeAll();
          props.onFinishInnings?.();
        },
      };
    }
    return {
      title: "Delete last ball?",
      description: "The most recent delivery will be removed and the score will be recomputed from the event log.",
      action: "Delete ball",
      run: () => {
        closeAll();
        props.onUndo();
      },
    };
  })();

  return (
    <div className="scorer-native-page flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      <header className="relative z-20 shrink-0 overflow-hidden border-b border-border/60 pt-[env(safe-area-inset-top)]">
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-br from-primary/15 via-background to-background"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(120%_60%_at_0%_0%,color-mix(in_oklab,var(--primary)_28%,transparent)_0%,transparent_60%)]"
        />
        <div className="relative grid h-14 grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 px-2">
          <button
            type="button"
            onClick={props.onExit}
            className="grid size-11 place-items-center rounded-full text-foreground/80 transition duration-100 active:scale-95 active:bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 text-left">
            {props.tournamentLabel && (
              <div className="truncate text-[9px] font-semibold uppercase leading-none tracking-[0.14em] text-muted-foreground">
                {props.tournamentLabel}
              </div>
            )}
            <div className="mt-1 flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[15px] font-black leading-none tracking-tight">
                {props.matchTitle}
              </span>
              {props.isLive && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[9px] font-black uppercase leading-none tracking-wider text-destructive">
                  <span className="size-1.5 animate-pulse rounded-full bg-destructive" />
                  Live
                </span>
              )}
            </div>
          </div>
          {!props.hideEndMatch && (
            <button
              type="button"
              onClick={() => setConfirm({ kind: "end-match" })}
              className="mr-1 inline-flex h-8 items-center gap-1 rounded-full border border-destructive/40 bg-destructive/10 px-3 text-[11px] font-black uppercase tracking-wider text-destructive transition duration-100 active:scale-95"
            >
              <StopCircle className="size-3.5" />
              End
            </button>
          )}
        </div>
      </header>



      <main className="scorer-match-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain ds-scroll" {...swipeHandlers}>
        <div className="flex min-h-full flex-col gap-2 px-3 py-2">
          <section className="shrink-0">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
              <div className="min-w-0">
                <div className="flex min-w-0 items-baseline gap-2">
                  <h1 className="truncate text-[44px] font-black leading-none tracking-normal tabular-nums sm:text-[48px]">
                    <NumberRoll value={props.score} />
                  </h1>
                  <span className="shrink-0 text-[14px] font-bold text-muted-foreground tabular-nums">
                    (<NumberRoll value={props.overs} /> ov)
                  </span>
                </div>
                {props.chase && (
                  <div className="mt-1 text-[12px] font-semibold text-[var(--score-success-fg)] tabular-nums">
                    Need {props.chase.runsNeeded} from {props.chase.ballsLeft} balls
                  </div>
                )}
              </div>
              <div className="grid min-w-[92px] gap-1 text-right text-[11px] leading-tight tabular-nums">
                <MetricInline label="CRR" value={props.crr ?? "–"} />
                {props.rrr && <MetricInline label="RRR" value={props.rrr} accent />}
                {props.target && <MetricInline label="TGT" value={props.target} />}
              </div>
            </div>
          </section>

          <ScorebookBatters
            striker={props.striker}
            nonStriker={props.nonStriker}
            onPickStriker={() => openPicker("striker")}
            onPickNonStriker={() => openPicker("nonStriker")}
          />

          <BowlerLine bowler={props.bowler} onClick={() => openPicker("bowler")} />

          {effectiveAwaitingNewBatter && (
            <button
              type="button"
              onClick={() => openPicker(waitingBatterRole)}
              className="grid h-11 w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-[var(--score-wait-border)] bg-[var(--score-wait-bg)] px-3 text-left text-[12px] font-semibold text-[var(--score-wait-fg)] transition duration-100 active:scale-[0.98]"
              aria-live="polite"
            >
              <span aria-hidden>⚠</span>
              <span className="truncate">Waiting for next batter</span>
              <span className="text-[11px] opacity-75">Tap to select</span>
            </button>
          )}

          <ThisOverStrip balls={props.overBalls} />

          <LiveInsights
            className="min-h-[112px]"
            partnership={props.partnership}
            chase={props.chase}
            crr={props.crr}
            rrr={props.rrr}
            target={props.target}
            insights={props.insights}
          />

        </div>
      </main>

      <div
        className="z-20 shrink-0 border-t bg-background/95 backdrop-blur-xl"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="px-3 pt-2">
          <ScoringDock
            disabled={props.disabled}
            onRun={props.onRun}
            onExtra={props.onExtra}
            onOut={props.onOut}
          />
        </div>
        <div className="grid grid-cols-4 gap-1 px-2 pb-1 pt-1">
          <FooterAction icon={<Undo2 className="size-[18px]" />} label="Undo" onClick={props.onUndo} />
          <FooterAction icon={<Redo2 className="size-[18px]" />} label="Redo" onClick={() => {}} disabled title="Redo coming soon" />
          <FooterAction icon={<FileText className="size-[18px]" />} label="Scorecard" onClick={props.onOpenScorecard} />
          <FooterAction icon={<MoreHorizontal className="size-[18px]" />} label="More" onClick={() => setMoreOpen(true)} />
        </div>
      </div>


      <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
        <DialogContent className="max-h-[85dvh] gap-3 overflow-y-auto rounded-2xl bg-card/95 p-0 backdrop-blur-xl sm:max-w-md">
          <DialogHeader className="px-4 pb-1 pt-4 text-left">
            <DialogTitle className="text-base">More actions</DialogTitle>
            <DialogDescription className="sr-only">Secondary scoring controls</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 px-3 pb-4">
            <Section title="Batting">
              <SheetRow icon={<UserCog className="size-4" />} label="Change striker" onClick={() => { setMoreOpen(false); openPicker("striker"); }} />
              <SheetRow icon={<UserCog className="size-4" />} label="Change non-striker" onClick={() => { setMoreOpen(false); openPicker("nonStriker"); }} />
              <SheetRow icon={<RefreshCw className="size-4" />} label="Swap strike" onClick={() => { setMoreOpen(false); props.onSwapStrike(); }} />
              <SheetRow icon={<HeartPulse className="size-4" />} label="Retired hurt" onClick={() => { setMoreOpen(false); props.onRetiredHurt(); }} />
            </Section>
            <Section title="Bowling">
              <SheetRow icon={<UserPlus className="size-4" />} label="Change bowler" onClick={() => { setMoreOpen(false); openPicker("bowler"); }} />
            </Section>
            <Section title="Corrections">
              <SheetRow icon={<Undo2 className="size-4" />} label="Undo last ball" onClick={() => { setMoreOpen(false); props.onUndo(); }} />
              <SheetRow icon={<Trash2 className="size-4" />} label="Delete last ball" onClick={() => setConfirm({ kind: "delete-ball" })} />
            </Section>
            {props.onShareMatch && (
              <Section title="Share">
                <SheetRow icon={<Share2 className="size-4" />} label="Share live match" onClick={() => { setMoreOpen(false); props.onShareMatch?.(); }} />
              </Section>
            )}
            {props.showFinishInnings && props.onFinishInnings && (
              <Section title="Match" danger>
                <SheetRow icon={<Flag className="size-4" />} label="Finish innings" tone="danger" onClick={() => setConfirm({ kind: "finish-innings" })} />
              </Section>
            )}


          </div>
        </DialogContent>
      </Dialog>


      <PlayerPickerSheet
        open={!!pickerOpen}
        kind={pickerOpen}
        query={pickerQuery}
        onQuery={setPickerQuery}
        players={filteredCandidates}
        isDisabled={isIllegalBowler}
        onOpenChange={(v) => !v && setPickerOpen(null)}
        lockedMessage={pickerOpen === "bowler" ? "Cannot bowl consecutive overs" : undefined}
        bowledIds={pickerOpen === "bowler" ? props.bowledBowlerIds ?? [] : []}
        onSelect={(p) => {
          if (!pickerOpen || isIllegalBowler(p)) return;
          props.onPickPlayer?.(pickerOpen, p);
          setPickerOpen(null);
        }}
      />


      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          {confirmMeta && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{confirmMeta.title}</AlertDialogTitle>
                <AlertDialogDescription>{confirmMeta.description}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={confirmMeta.run}>
                  {confirmMeta.action}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function MetricInline({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-end gap-1.5 whitespace-nowrap">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-black", accent && "text-[var(--score-success-fg)]")}>{value}</span>
    </div>
  );
}

function ScorebookBatters({
  striker,
  nonStriker,
  onPickStriker,
  onPickNonStriker,
}: {
  striker?: BatterStats;
  nonStriker?: BatterStats;
  onPickStriker: () => void;
  onPickNonStriker: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border bg-card/70">
      <BatterLine batter={striker} striker onClick={onPickStriker} />
      <div className="h-px bg-border/70" />
      <BatterLine batter={nonStriker} onClick={onPickNonStriker} />
    </section>
  );
}

function BatterLine({ batter, striker, onClick }: { batter?: BatterStats; striker?: boolean; onClick: () => void }) {
  const name = batter?.name ?? (striker ? "Select striker" : "Select non-striker");
  const sr = batter?.strikeRate ?? "0.0";
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid h-[52px] w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3 text-left transition duration-100 active:scale-[0.995] active:bg-muted/70",
        striker && "bg-[var(--score-striker-bg)]",
      )}
    >
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-1.5">
          {striker && (
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--score-striker-dot)] text-[var(--score-action-foreground)] text-[11px] font-black">
              *
            </span>
          )}
          <span className="truncate text-[13px] font-bold leading-tight">{name}</span>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-2 overflow-hidden text-[10.5px] leading-tight text-muted-foreground tabular-nums">
          <span>4s {batter?.fours ?? 0}</span>
          <span>6s {batter?.sixes ?? 0}</span>
          <span>SR {sr}</span>
        </div>
      </div>
      <div className="text-right tabular-nums">
        <div className="text-[17px] font-black leading-none">
          {batter?.runs ?? 0}
          <span className="ml-1 text-[12px] font-bold text-muted-foreground">({batter?.balls ?? 0})</span>
        </div>
      </div>
    </button>
  );
}

function BowlerLine({ bowler, onClick }: { bowler?: BowlerStats; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="grid h-12 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-xl border bg-card/70 px-3 text-left transition duration-100 active:scale-[0.995] active:bg-muted/70"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[var(--score-bowler-bg)] text-[var(--score-bowler-fg)]">
            <Shield className="size-3" />
          </span>
          <span className="truncate text-[13px] font-bold">{bowler?.name ?? "Select bowler"}</span>
          <span className="shrink-0 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Bowling</span>
        </div>
      </div>
      <div className="text-right text-[11px] font-semibold text-muted-foreground tabular-nums">
        <span className="text-foreground">{bowler?.wickets ?? 0}/{bowler?.runs ?? 0}</span>
        <span> · {bowler?.overs ?? "0.0"} ov</span>
        <span> · Econ {bowler?.economy ?? "–"}</span>
      </div>
    </button>
  );
}

function ThisOverStrip({ balls }: { balls: string[] }) {
  return (
    <section className="flex h-11 shrink-0 items-center gap-2 rounded-xl border bg-card/70 px-3">
      <span className="shrink-0 text-[10px] font-black uppercase tracking-widest text-muted-foreground">This over</span>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto ds-scroll">
        {balls.length === 0 ? (
          <span className="text-[12px] text-muted-foreground">Ready</span>
        ) : (
          balls.map((ball, i) => <BallBubble key={`${ball}-${i}`} label={ball} />)
        )}
      </div>
    </section>
  );
}

function LiveInsights({
  partnership,
  chase,
  crr,
  rrr,
  target,
  insights,
  className,
}: {
  partnership?: { runs: number; balls: number } | null;
  chase?: { runsNeeded: number; ballsLeft: number } | null;
  crr?: string;
  rrr?: string;
  target?: string;
  insights?: MobileScorerInsight;
  className?: string;
}) {
  const recentOvers = insights?.recentOvers ?? [];
  return (
    <section className={cn("flex flex-col gap-2 overflow-hidden rounded-xl border bg-muted/25 p-2", className)}>
      <div className="grid shrink-0 grid-cols-4 gap-1.5">
        <InfoTile label="P'ship" value={insights?.partnership ?? (partnership ? `${partnership.runs}(${partnership.balls})` : "0(0)")} />
        <InfoTile label={chase ? "Need" : "Proj"} value={chase ? `${chase.runsNeeded}` : insights?.projected ?? "–"} accent={Boolean(chase)} />
        <InfoTile label={chase ? "Balls" : "Extras"} value={chase ? `${chase.ballsLeft}` : insights?.extras ?? "0"} />
        <InfoTile label="FOW" value={insights?.lastWicket ?? "–"} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-2 overflow-hidden">
        <div className="min-w-0 rounded-lg bg-card/55 p-2">
          <div className="mb-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Recent overs</div>
          {recentOvers.length === 0 ? (
            <div className="text-[12px] text-muted-foreground">Ball-by-ball data appears here.</div>
          ) : (
            <div className="space-y-1">
              {recentOvers.slice(-3).map((over) => (
                <div key={over.label} className="grid grid-cols-[44px_1fr_auto] items-center gap-2 text-[12px] tabular-nums">
                  <span className="font-bold text-muted-foreground">{over.label}</span>
                  <span className="h-1.5 rounded-full bg-[var(--score-over-track)]">
                    <span className="block h-full rounded-full bg-[var(--score-over-fill)]" style={{ width: `${Math.min(100, Math.max(8, over.runs * 7))}%` }} />
                  </span>
                  <span className="font-black">{over.runs}{over.wickets ? `/${over.wickets}` : ""}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="grid min-w-[76px] content-center gap-1 rounded-lg bg-card/55 p-2 text-right text-[11px] tabular-nums">
          <MetricInline label="CRR" value={crr ?? "–"} />
          {rrr && <MetricInline label="RRR" value={rrr} accent />}
          {target && <MetricInline label="T" value={target} />}
        </div>
      </div>
    </section>
  );
}


function InfoTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0 rounded-lg bg-card/70 px-2 py-1.5 text-center tabular-nums">
      <div className="truncate text-[9px] font-black uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className={cn("truncate text-[12px] font-black", accent && "text-[var(--score-success-fg)]")}>{value}</div>
    </div>
  );
}

function BallBubble({ label }: { label: string }) {
  const upper = label.toUpperCase();
  const wicket = /W/.test(upper);
  const four = upper === "4";
  const six = upper === "6";
  const extra = /WD|NB|LB|B/.test(upper) && !four && !six && !wicket;
  return (
    <span
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-black tabular-nums",
        wicket && "bg-destructive text-destructive-foreground",
        four && "bg-[var(--score-four)] text-[var(--score-action-foreground)]",
        six && "bg-[var(--score-six)] text-[var(--score-action-foreground)]",
        extra && "bg-[var(--score-extra-bg)] text-[var(--score-extra-fg)]",
        !wicket && !four && !six && !extra && "bg-muted text-foreground",
      )}
    >
      {upper}
    </span>
  );
}

function ScoringDock({
  disabled,
  onRun,
  onExtra,
  onOut,
}: {
  disabled?: boolean;
  onRun: (r: 0 | 1 | 2 | 3 | 4 | 6) => void;
  onExtra: (kind: "Wide" | "No Ball" | "Bye" | "Leg Bye") => void;
  onOut: () => void;
}) {
  return (
    <div className="rounded-2xl border bg-card/95 p-2 shadow-[0_4px_20px_-12px_oklch(0_0_0/45%)] backdrop-blur-xl">
      <div className="grid grid-cols-6 gap-2">
        {([0, 1, 2, 3, 4, 6] as const).map((run) => (
          <RunKey key={run} value={run} disabled={disabled} onClick={() => onRun(run)} />
        ))}
      </div>
      <div className="mt-2 grid grid-cols-5 gap-2">
        <ExtraKey label="Wide" tone="wide" disabled={disabled} onClick={() => onExtra("Wide")} />
        <ExtraKey label="No Ball" tone="nb" disabled={disabled} onClick={() => onExtra("No Ball")} />
        <ExtraKey label="Bye" tone="bye" disabled={disabled} onClick={() => onExtra("Bye")} />
        <ExtraKey label="Leg Bye" tone="lb" disabled={disabled} onClick={() => onExtra("Leg Bye")} />
        <ExtraKey label="OUT" tone="out" disabled={disabled} onClick={onOut} />
      </div>
    </div>
  );
}


function RunKey({ value, disabled, onClick }: { value: 0 | 1 | 2 | 3 | 4 | 6; disabled?: boolean; onClick: () => void }) {
  const tone = value === 4 ? "four" : value === 6 ? "six" : "neutral";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-11 w-full place-items-center rounded-xl border text-[20px] font-black tabular-nums transition duration-100 active:scale-[0.95] disabled:opacity-40",
        tone === "four" && "border-transparent bg-[var(--score-four)] text-[var(--score-action-foreground)]",
        tone === "six" && "border-transparent bg-[var(--score-six)] text-[var(--score-action-foreground)]",
        tone === "neutral" && "border-border/80 bg-background text-foreground active:bg-muted",
      )}
    >
      {value}
    </button>
  );
}

function ExtraKey({ label, tone, disabled, onClick }: { label: string; tone: "wide" | "nb" | "bye" | "lb" | "out"; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-11 w-full place-items-center rounded-xl border px-1 text-[10px] font-black uppercase leading-none tracking-wide transition duration-100 active:scale-[0.95] disabled:opacity-40",
        tone === "wide" && "border-[var(--score-wide-border)] bg-[var(--score-wide-bg)] text-[var(--score-wide-fg)]",
        tone === "nb" && "border-[var(--score-nb-border)] bg-[var(--score-nb-bg)] text-[var(--score-nb-fg)]",
        tone === "bye" && "border-[var(--score-bye-border)] bg-[var(--score-bye-bg)] text-[var(--score-bye-fg)]",
        tone === "lb" && "border-[var(--score-lb-border)] bg-[var(--score-lb-bg)] text-[var(--score-lb-fg)]",
        tone === "out" && "border-transparent bg-destructive text-destructive-foreground",
      )}
    >
      {label}
    </button>
  );
}


function PlayerPickerSheet({
  open,
  kind,
  players,
  query,
  onQuery,
  onOpenChange,
  onSelect,
  isDisabled,
  lockedMessage,
  bowledIds,
}: {
  open: boolean;
  kind: PickerKind | null;
  players: PlayerOption[];
  query: string;
  onQuery: (v: string) => void;
  onOpenChange: (v: boolean) => void;
  onSelect: (p: PlayerOption) => void;
  isDisabled: (p: PlayerOption) => boolean;
  lockedMessage?: string;
  bowledIds?: string[];
}) {
  const title = kind === "bowler" ? "Select bowler" : kind === "nonStriker" ? "Select non-striker" : "Select striker";
  const bowledSet = useMemo(() => new Set(bowledIds ?? []), [bowledIds]);
  const groups = useMemo(() => {
    if (kind !== "bowler" || bowledSet.size === 0) {
      return [{ label: "", items: players }];
    }
    const already: PlayerOption[] = [];
    const rest: PlayerOption[] = [];
    for (const p of players) (bowledSet.has(p.id) ? already : rest).push(p);
    return [
      { label: "Already bowled", items: already },
      { label: "Yet to bowl", items: rest },
    ];
  }, [players, bowledSet, kind]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" overlayClassName="bg-background/35 backdrop-blur-[1px]" className="max-h-[74dvh] overflow-hidden rounded-t-3xl bg-card/95 p-0 backdrop-blur-xl">
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/30" />
        <SheetHeader className="px-4 pb-2 pt-3 text-left">
          <div className="grid grid-cols-1 items-center gap-2 pr-10">
            <div className="min-w-0">
              <SheetTitle className="truncate text-base">{title}</SheetTitle>
              <SheetDescription className="text-xs">Tap once to continue scoring</SheetDescription>
            </div>
          </div>
        </SheetHeader>
        <div className="border-y px-3 py-2">
          <label className="flex h-10 items-center gap-2 rounded-xl bg-muted px-3">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              placeholder="Search player"
              className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>
        <div className="max-h-[52dvh] overflow-y-auto pb-3" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + .75rem)" }}>
          {players.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">No players found.</div>
          ) : (
            groups.map((group, gi) =>
              group.items.length === 0 ? null : (
                <div key={group.label || `g-${gi}`}>
                  {group.label && (
                    <div className="sticky top-0 z-10 border-b bg-card/95 px-4 py-1.5 text-[10px] font-black uppercase tracking-widest text-muted-foreground backdrop-blur">
                      {group.label}
                      <span className="ml-1 text-muted-foreground/60">({group.items.length})</span>
                    </div>
                  )}
                  <ul className="divide-y divide-border/70">
                    {group.items.map((player) => {
                      const locked = isDisabled(player);
                      const bowled = bowledSet.has(player.id);
                      return (
                        <li key={player.id}>
                          <button
                            type="button"
                            disabled={locked}
                            onClick={() => onSelect(player)}
                            className="grid h-14 w-full grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 px-4 text-left transition duration-100 active:bg-muted disabled:opacity-45"
                          >
                            <span className="grid size-9 place-items-center rounded-full bg-muted text-[12px] font-black text-foreground/80">{initials(player.name)}</span>
                            <span className="min-w-0">
                              <span className="block truncate text-[14px] font-bold leading-tight">{player.name}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">
                                {locked ? lockedMessage : bowled ? "Bowled earlier · Tap to continue" : player.role || "Player"}
                              </span>
                            </span>
                            {locked && <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Locked</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ),
            )
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}


function Section({ title, danger, children }: { title: string; danger?: boolean; children: ReactNode }) {
  return (
    <section>
      <div className={cn("mb-1.5 px-1 text-[10px] font-black uppercase tracking-widest", danger ? "text-destructive" : "text-muted-foreground")}>{title}</div>
      <div className="overflow-hidden rounded-2xl border bg-background/60">{children}</div>
    </section>
  );
}

function SheetRow({ icon, label, onClick, tone }: { icon: ReactNode; label: string; onClick: () => void; tone?: "danger" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid h-12 w-full grid-cols-[32px_minmax(0,1fr)] items-center gap-3 border-b px-3 text-left text-[14px] font-semibold last:border-b-0 active:bg-muted",
        tone === "danger" ? "text-destructive" : "text-foreground",
      )}
    >
      <span className={cn("grid size-8 place-items-center rounded-xl", tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function FooterAction({ icon, label, onClick, disabled, title }: { icon: ReactNode; label: string; onClick: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="grid h-12 w-full grid-rows-[auto_auto] place-items-center gap-0.5 rounded-xl text-foreground/85 transition duration-100 active:scale-[0.97] active:bg-muted disabled:opacity-40"
    >
      <span aria-hidden>{icon}</span>
      <span className="text-[10px] font-bold uppercase tracking-wider leading-none">{label}</span>
    </button>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? "").join("") || "?";
}
