import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
  MoreHorizontal,
  RefreshCw,
  UserCog,
  Undo2,
  Trash2,
  Flag,
  StopCircle,
  HeartPulse,
  UserPlus,
  ArrowLeft,
  FileText,
} from "lucide-react";
import type { BatterStats, BowlerStats } from "./scoring-ui";

/**
 * Compact, thumb-first cricket scoring surface. Presentation-only — no MCC /
 * statistics / ball-event change. Layout inspired by CricHeroes / Cricbuzz
 * scoring: a dense info stack on top and a fixed control block at the bottom.
 * Everything a scorer needs in normal play fits without scrolling.
 */
export interface MobileScorerProps {
  // header
  onExit: () => void;
  tournamentLabel?: string;
  matchTitle: string;
  isLive?: boolean;

  // scoreboard
  score: string; // "48/2"
  overs: string; // "5.3"
  crr?: string;
  rrr?: string;
  target?: string;
  chase?: { runsNeeded: number; ballsLeft: number } | null;

  striker?: BatterStats;
  nonStriker?: BatterStats;
  bowler?: BowlerStats;

  partnership?: { runs: number; balls: number } | null;

  // over strip — last 6 legal deliveries or in-progress over
  overBalls: string[];

  // keypad handlers
  disabled?: boolean;
  onRun: (r: 0 | 1 | 2 | 3 | 4 | 6) => void;
  onExtra: (kind: "Wide" | "No Ball" | "Bye" | "Leg Bye") => void;
  onOut: () => void;

  // player pickers
  onOpenStrikerPicker: () => void;
  onOpenNonStrikerPicker: () => void;
  onOpenBowlerPicker: () => void;

  // secondary actions (bottom-sheet)
  onUndo: () => void;
  onSwapStrike: () => void;
  onRetiredHurt: () => void;
  onFinishInnings?: () => void;
  onEndMatch: () => void;
  showFinishInnings?: boolean;
  hideEndMatch?: boolean;

  // footer quick actions
  onOpenScorecard: () => void;
  onOpenScorebook?: () => void;

  // status banners
  awaitingNewBatter?: boolean;
  awaitingNewBowler?: boolean;
}

export function MobileScorer(props: MobileScorerProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirm, setConfirm] = useState<
    | null
    | { kind: "end-match" | "finish-innings" | "delete-ball" }
  >(null);

  const closeAll = () => {
    setMoreOpen(false);
    setConfirm(null);
  };

  const confirmMeta = (() => {
    if (!confirm) return null;
    if (confirm.kind === "end-match")
      return {
        title: "End match?",
        description:
          "This finalises the match. The action cannot be undone once the match is locked.",
        action: "End match",
        run: () => {
          closeAll();
          props.onEndMatch();
        },
      };
    if (confirm.kind === "finish-innings")
      return {
        title: "Finish innings?",
        description:
          "The current innings will be marked complete. You can start the next innings after confirming.",
        action: "Finish innings",
        run: () => {
          closeAll();
          props.onFinishInnings?.();
        },
      };
    return {
      title: "Delete last ball?",
      description:
        "The most recent delivery will be removed and the score will be recomputed from the event log.",
      action: "Delete ball",
      run: () => {
        closeAll();
        props.onUndo();
      },
    };
  })();

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      {/* ---------------- Compact sticky top bar ---------------- */}
      <div className="sticky top-0 z-20 flex h-10 items-center gap-2 border-b bg-card/95 px-2 backdrop-blur">
        <button
          type="button"
          onClick={props.onExit}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-foreground/80 hover:bg-muted active:scale-95 transition duration-100"
          aria-label="Exit scorer"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="truncate text-[13px] font-bold leading-tight">
              {props.matchTitle}
            </div>
            {props.isLive && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-sm border border-rose-500/50 bg-rose-500/10 px-1 py-[1px] text-[9px] font-black uppercase tracking-wider text-rose-600 dark:text-rose-400">
                <span className="inline-block size-1 animate-pulse rounded-full bg-rose-500" />
                Live
              </span>
            )}
          </div>
          {props.tournamentLabel && (
            <div className="truncate text-[9px] font-medium uppercase tracking-widest text-muted-foreground leading-tight">
              {props.tournamentLabel}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md text-foreground/80 hover:bg-muted active:scale-95 transition duration-100"
          aria-label="More options"
        >
          <MoreHorizontal className="size-4" />
        </button>
      </div>

      {/* ---------------- Compact info stack ---------------- */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-2.5 pt-2 pb-1.5">
          {/* Score header (compact) */}
          <div className="flex items-end justify-between gap-2">
            <div className="flex items-baseline gap-1.5 min-w-0">
              <div className="text-3xl font-black leading-none tabular-nums">
                {props.score}
              </div>
              <div className="text-xs font-semibold text-muted-foreground tabular-nums">
                ({props.overs} ov)
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-x-2.5 gap-y-0 text-[11px] tabular-nums">
              {props.crr && (
                <span className="text-muted-foreground">
                  CRR <span className="font-bold text-foreground">{props.crr}</span>
                </span>
              )}
              {props.rrr && (
                <span className="text-muted-foreground">
                  RRR <span className="font-bold text-foreground">{props.rrr}</span>
                </span>
              )}
              {props.target && (
                <span className="text-muted-foreground">
                  Tgt <span className="font-bold text-foreground">{props.target}</span>
                </span>
              )}
            </div>
          </div>

          {props.chase && (
            <div className="mt-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
              Need {props.chase.runsNeeded} off {props.chase.ballsLeft} balls
            </div>
          )}

          {/* Batters row (compact — two batters on one line) */}
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            <PlayerChip
              onClick={props.onOpenStrikerPicker}
              name={props.striker?.name ?? "Striker"}
              onStrike
              value={`${props.striker?.runs ?? 0}${
                props.striker ? ` (${props.striker.balls})` : ""
              }`}
              sub={
                props.striker
                  ? `4s ${props.striker.fours ?? 0} · 6s ${props.striker.sixes ?? 0} · SR ${props.striker.strikeRate ?? "0.0"}`
                  : "Tap to select"
              }
            />
            <PlayerChip
              onClick={props.onOpenNonStrikerPicker}
              name={props.nonStriker?.name ?? "Non-striker"}
              value={`${props.nonStriker?.runs ?? 0}${
                props.nonStriker ? ` (${props.nonStriker.balls})` : ""
              }`}
              sub={
                props.nonStriker
                  ? `SR ${props.nonStriker.strikeRate ?? "0.0"}`
                  : "Tap to select"
              }
            />
          </div>

          {/* Bowler row */}
          <button
            type="button"
            onClick={props.onOpenBowlerPicker}
            className="mt-1.5 flex w-full items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 text-left hover:bg-muted/50"
          >
            <span className="inline-block size-1.5 shrink-0 rounded-full bg-indigo-500" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-[13px] font-semibold">
                  {props.bowler?.name ?? "Bowler"}
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Bowling
                </span>
              </div>
              <div className="text-[10px] text-muted-foreground tabular-nums leading-tight">
                {props.bowler
                  ? `${props.bowler.overs} ov · ${props.bowler.wickets}/${props.bowler.runs} · Econ ${props.bowler.economy ?? "–"}`
                  : "Tap to select"}
              </div>
            </div>
          </button>

          {/* Partnership + This over — single compact row */}
          <div className="mt-1.5 flex items-center gap-2 text-[11px]">
            {props.partnership && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 tabular-nums">
                <span className="text-muted-foreground">P'ship</span>
                <span className="font-bold">
                  {props.partnership.runs}({props.partnership.balls})
                </span>
              </span>
            )}
          </div>

          {/* This over — one row */}
          <div className="mt-1.5 flex h-8 items-center gap-2 rounded-md border bg-card px-2">
            <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground shrink-0">
              This over
            </div>
            <div className="flex flex-1 items-center gap-1 overflow-x-auto scrollbar-none">
              {props.overBalls.length === 0 ? (
                <span className="text-[11px] text-muted-foreground">—</span>
              ) : (
                props.overBalls.map((b, i) => (
                  <span key={i} className="text-[11px] font-bold tabular-nums text-muted-foreground">
                    {i > 0 && <span className="mx-1 text-border">•</span>}
                    <BallText label={b} />
                  </span>
                ))
              )}
            </div>
          </div>

          {(props.awaitingNewBatter || props.awaitingNewBowler) && (
            <button
              type="button"
              onClick={
                props.awaitingNewBatter
                  ? props.onOpenStrikerPicker
                  : props.onOpenBowlerPicker
              }
              className="mt-1.5 flex h-8 w-full items-center gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 text-[11px] font-medium text-amber-700 dark:text-amber-400"
            >
              <span aria-hidden>⚠</span>
              <span className="truncate">
                {props.awaitingNewBatter
                  ? "Waiting for next batter"
                  : "Over complete — pick next bowler"}
              </span>
              <span className="ml-auto shrink-0 text-[10px] opacity-70">Tap to select</span>
            </button>
          )}
        </div>
      </div>

      {/* ---------------- Fixed scoring keypad (compact ~124px) ---------------- */}
      <div
        className="border-t bg-card"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto w-full max-w-xl px-2 pt-2 pb-2">
          {/* Row 1 — runs 0-6 */}
          <div className="grid grid-cols-6 gap-2">
            <RunKey value={0} onClick={() => !props.disabled && props.onRun(0)} />
            <RunKey value={1} onClick={() => !props.disabled && props.onRun(1)} />
            <RunKey value={2} onClick={() => !props.disabled && props.onRun(2)} />
            <RunKey value={3} onClick={() => !props.disabled && props.onRun(3)} />
            <RunKey value={4} tone="four" onClick={() => !props.disabled && props.onRun(4)} />
            <RunKey value={6} tone="six" onClick={() => !props.disabled && props.onRun(6)} />
          </div>
          {/* Row 2 — events */}
          <div className="mt-2 grid grid-cols-5 gap-2">
            <ExtraKey label="Wide" tone="wide" onClick={() => !props.disabled && props.onExtra("Wide")} />
            <ExtraKey label="No Ball" tone="nb" onClick={() => !props.disabled && props.onExtra("No Ball")} />
            <ExtraKey label="Bye" tone="bye" onClick={() => !props.disabled && props.onExtra("Bye")} />
            <ExtraKey label="Leg Bye" tone="lb" onClick={() => !props.disabled && props.onExtra("Leg Bye")} />
            <ExtraKey label="OUT" tone="out" onClick={() => !props.disabled && props.onOut()} />
          </div>

          {/* Compact icon action bar — Undo · Scorecard · More */}
          <div className="mt-2 grid grid-cols-3 gap-2">
            <FooterAction
              icon={<Undo2 className="size-3.5" />}
              label="Undo"
              onClick={props.onUndo}
            />
            <FooterAction
              icon={<FileText className="size-3.5" />}
              label="Scorecard"
              onClick={props.onOpenScorecard}
            />
            <FooterAction
              icon={<MoreHorizontal className="size-3.5" />}
              label="More"
              onClick={() => setMoreOpen(true)}
            />
          </div>
        </div>
      </div>

      {/* ---------------- More sheet ---------------- */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] overflow-y-auto rounded-t-2xl"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <SheetHeader className="text-left">
            <SheetTitle>More options</SheetTitle>
            <SheetDescription>
              Secondary actions — the scoring surface stays fast.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4 pb-6">
            <Section title="Batting">
              <SheetRow
                icon={<UserCog className="size-4" />}
                label="Change striker"
                onClick={() => {
                  setMoreOpen(false);
                  props.onOpenStrikerPicker();
                }}
              />
              <SheetRow
                icon={<UserCog className="size-4" />}
                label="Change non-striker"
                onClick={() => {
                  setMoreOpen(false);
                  props.onOpenNonStrikerPicker();
                }}
              />
              <SheetRow
                icon={<RefreshCw className="size-4" />}
                label="Swap strike"
                onClick={() => {
                  setMoreOpen(false);
                  props.onSwapStrike();
                }}
              />
              <SheetRow
                icon={<HeartPulse className="size-4" />}
                label="Retired hurt"
                onClick={() => {
                  setMoreOpen(false);
                  props.onRetiredHurt();
                }}
              />
            </Section>

            <Section title="Bowling">
              <SheetRow
                icon={<UserPlus className="size-4" />}
                label="Change bowler"
                onClick={() => {
                  setMoreOpen(false);
                  props.onOpenBowlerPicker();
                }}
              />
            </Section>

            <Section title="Corrections">
              <SheetRow
                icon={<Trash2 className="size-4" />}
                label="Delete last ball"
                onClick={() => setConfirm({ kind: "delete-ball" })}
              />
            </Section>

            <Section title="Match" danger>
              {props.showFinishInnings && props.onFinishInnings && (
                <SheetRow
                  icon={<Flag className="size-4" />}
                  label="Finish innings"
                  tone="danger"
                  onClick={() => setConfirm({ kind: "finish-innings" })}
                />
              )}
              {!props.hideEndMatch && (
                <SheetRow
                  icon={<StopCircle className="size-4" />}
                  label="End match"
                  tone="danger"
                  onClick={() => setConfirm({ kind: "end-match" })}
                />
              )}
            </Section>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          {confirmMeta && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{confirmMeta.title}</AlertDialogTitle>
                <AlertDialogDescription>
                  {confirmMeta.description}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={confirmMeta.run}
                >
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

/* ---------------- primitives ---------------- */

function PlayerChip({
  onClick,
  name,
  onStrike,
  value,
  sub,
}: {
  onClick: () => void;
  name: string;
  onStrike?: boolean;
  value: string;
  sub?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg border bg-card px-2 py-1.5 text-left hover:bg-muted/50",
        onStrike && "border-emerald-500/50 bg-emerald-500/5",
      )}
    >
      <span
        className={cn(
          "inline-block size-1.5 shrink-0 rounded-full",
          onStrike ? "bg-emerald-500" : "bg-muted-foreground/40",
        )}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1.5">
          <span className="truncate text-[12px] font-semibold">{name}</span>
          <span className="shrink-0 text-[12px] font-black tabular-nums">
            {value}
          </span>
        </div>
        {sub && (
          <div className="truncate text-[10px] text-muted-foreground tabular-nums leading-tight">
            {sub}
          </div>
        )}
      </div>
    </button>
  );
}

function BallText({ label }: { label: string }) {
  const isBoundary = label === "4" || label === "6";
  const isWicket = /W/i.test(label);
  const isExtra = /wd|nb|b|lb/i.test(label) && !isBoundary && !isWicket;
  return (
    <span
      className={cn(
        "font-bold",
        isWicket && "text-rose-600 dark:text-rose-400",
        !isWicket && isBoundary && label === "4" && "text-blue-600 dark:text-blue-400",
        !isWicket && isBoundary && label === "6" && "text-violet-600 dark:text-violet-400",
        !isWicket && isExtra && "text-amber-600 dark:text-amber-400",
        !isWicket && !isBoundary && !isExtra && "text-foreground",
      )}
    >
      {label}
    </span>
  );
}

function RunKey({
  value,
  tone,
  onClick,
}: {
  value: 0 | 1 | 2 | 3 | 4 | 6;
  tone?: "four" | "six";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid h-11 w-full place-items-center rounded-lg border text-base font-black tabular-nums transition active:scale-[0.95] duration-100",
        tone === "four" &&
          "border-transparent bg-blue-500 text-white shadow-sm hover:bg-blue-600",
        tone === "six" &&
          "border-transparent bg-violet-500 text-white shadow-sm hover:bg-violet-600",
        !tone && "border-border bg-card text-foreground hover:bg-muted",
      )}
    >
      {value}
    </button>
  );
}

function ExtraKey({
  label,
  tone,
  onClick,
}: {
  label: string;
  tone: "wide" | "nb" | "bye" | "lb" | "out";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid h-11 w-full place-items-center rounded-lg border px-1 text-[11px] font-black uppercase tracking-wider transition active:scale-[0.95] duration-100",
        tone === "wide" &&
          "border-orange-500/50 bg-orange-500/10 text-orange-700 hover:bg-orange-500/20 dark:text-orange-400",
        tone === "nb" &&
          "border-amber-500/50 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400",
        tone === "bye" &&
          "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400",
        tone === "lb" &&
          "border-teal-500/50 bg-teal-500/10 text-teal-700 hover:bg-teal-500/20 dark:text-teal-400",
        tone === "out" &&
          "border-transparent bg-rose-600 text-white shadow-sm hover:bg-rose-700",
      )}
    >
      {label}
    </button>
  );
}

function FooterAction({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-9 items-center justify-center gap-1.5 rounded-lg border bg-background text-[11px] font-semibold text-foreground/80 transition hover:bg-muted disabled:opacity-40 active:scale-[0.97] duration-100"
    >
      {icon}
      {label}
    </button>
  );
}

function Section({
  title,
  danger,
  children,
}: {
  title: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <div
        className={cn(
          "mb-1.5 text-[10px] font-semibold uppercase tracking-widest",
          danger ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {title}
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">{children}</div>
    </div>
  );
}

function SheetRow({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 border-b px-4 py-3 text-left text-sm font-medium last:border-b-0 active:bg-muted",
        tone === "danger" ? "text-destructive" : "text-foreground",
      )}
    >
      <span
        className={cn(
          "grid size-8 place-items-center rounded-lg",
          tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground",
        )}
      >
        {icon}
      </span>
      <span className="flex-1">{label}</span>
    </button>
  );
}
