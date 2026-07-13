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
  ClipboardList,
  History,
} from "lucide-react";
import type { BatterStats, BowlerStats } from "./scoring-ui";

/**
 * Compact, thumb-first cricket scoring surface. Presentation-only wrapper
 * that reuses every existing handler — no MCC / statistics / ball-event
 * change. Layout is inspired by CricHeroes / CricClubs: a compact score
 * strip that scrolls, a fixed scoring keypad, and a bottom sheet for every
 * rarely-used control.
 */
export interface MobileScorerProps {
  // header
  onExit: () => void;
  tournamentLabel?: string;
  matchTitle: string; // e.g. "SAI vs SKY · Match #12"
  isLive?: boolean;

  // scoreboard
  score: string; // "48/2"
  overs: string; // "5.3"
  crr?: string;
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
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ---------------- Compact top bar ---------------- */}
      <div className="flex items-center gap-2 border-b bg-card/80 px-3 py-2 backdrop-blur">
        <button
          type="button"
          onClick={props.onExit}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-foreground/80 hover:bg-muted"
          aria-label="Exit scorer"
        >
          <ArrowLeft className="size-4" />
          Exit
        </button>
        <div className="min-w-0 flex-1 text-center">
          <div className="flex items-center justify-center gap-1.5">
            <div className="truncate text-sm font-bold">{props.matchTitle}</div>
            {props.isLive && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-rose-500/50 bg-rose-500/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400">
                <span className="inline-block size-1.5 animate-pulse rounded-full bg-rose-500" />
                Live
              </span>
            )}
          </div>
          {props.tournamentLabel && (
            <div className="truncate text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
              {props.tournamentLabel}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-foreground/80 hover:bg-muted"
          aria-label="More actions"
        >
          <MoreHorizontal className="size-4" />
          More
        </button>
      </div>

      {/* ---------------- Scrollable score strip ---------------- */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-xl flex-col gap-3 px-3 pb-3 pt-3">
          {/* Score line */}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-baseline gap-2">
              <div className="text-4xl font-black leading-none tabular-nums">
                {props.score}
              </div>
              <div className="text-sm font-semibold text-muted-foreground tabular-nums">
                ({props.overs} ov)
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {props.crr && (
                <span>
                  CRR <span className="font-bold text-foreground tabular-nums">{props.crr}</span>
                </span>
              )}
              {props.target && (
                <>
                  <span className="text-border">|</span>
                  <span>
                    Target{" "}
                    <span className="font-bold text-foreground tabular-nums">{props.target}</span>
                  </span>
                </>
              )}
            </div>
            {props.chase && (
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 tabular-nums">
                Need {props.chase.runsNeeded} off {props.chase.ballsLeft} balls
              </div>
            )}
          </div>

          {/* Batters + bowler rows */}
          <div className="rounded-2xl border bg-card divide-y">
            <PlayerRow
              variant="batter"
              onClick={props.onOpenStrikerPicker}
              name={props.striker?.name}
              onStrike
              primary={`${props.striker?.runs ?? 0}`}
              parenthetical={`${props.striker?.balls ?? 0}`}
              subline={
                props.striker
                  ? `4s: ${props.striker.fours ?? 0}  ·  6s: ${props.striker.sixes ?? 0}  ·  SR ${props.striker.strikeRate ?? "0.0"}`
                  : "Tap to select striker"
              }
            />
            <PlayerRow
              variant="batter"
              onClick={props.onOpenNonStrikerPicker}
              name={props.nonStriker?.name}
              primary={`${props.nonStriker?.runs ?? 0}`}
              parenthetical={`${props.nonStriker?.balls ?? 0}`}
              subline={
                props.nonStriker
                  ? `SR ${props.nonStriker.strikeRate ?? "0.0"}`
                  : "Tap to select non-striker"
              }
            />
            <PlayerRow
              variant="bowler"
              onClick={props.onOpenBowlerPicker}
              name={props.bowler?.name}
              primary={props.bowler ? `${props.bowler.overs}` : "—"}
              parenthetical={
                props.bowler ? `${props.bowler.wickets}/${props.bowler.runs}` : ""
              }
              subline={
                props.bowler
                  ? `Econ ${props.bowler.economy ?? "–"}`
                  : "Tap to select bowler"
              }
            />
          </div>

          {/* Inline chips: Partnership + This over */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {props.partnership && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                <span className="text-muted-foreground">Partnership</span>
                <span className="font-bold tabular-nums">
                  {props.partnership.runs} ({props.partnership.balls})
                </span>
              </span>
            )}
            {props.crr && (
              <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1">
                <span className="text-muted-foreground">Run rate</span>
                <span className="font-bold tabular-nums">{props.crr}</span>
              </span>
            )}
          </div>

          {/* This over strip (slim) */}
          <div className="flex h-10 items-center gap-2 rounded-xl border bg-card px-3">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground shrink-0">
              This over
            </div>
            <div className="flex flex-1 items-center gap-1.5 overflow-x-auto scrollbar-none">
              {props.overBalls.length === 0 ? (
                <span className="text-xs text-muted-foreground">—</span>
              ) : (
                props.overBalls.map((b, i) => <BallChip key={i} label={b} />)
              )}
            </div>
          </div>

          {(props.awaitingNewBatter || props.awaitingNewBowler) && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-medium text-amber-700 dark:text-amber-400">
              {props.awaitingNewBatter
                ? "Waiting for next batter…"
                : "Over complete — pick next bowler."}
            </div>
          )}
        </div>
      </div>

      {/* ---------------- Fixed scoring keypad ---------------- */}
      <div
        className="border-t bg-card"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto w-full max-w-xl px-3 py-3">
          <div className="grid grid-cols-3 gap-2">
            <RunKey value={0} onClick={() => !props.disabled && props.onRun(0)} />
            <RunKey value={1} onClick={() => !props.disabled && props.onRun(1)} />
            <RunKey value={2} onClick={() => !props.disabled && props.onRun(2)} />
            <RunKey value={3} onClick={() => !props.disabled && props.onRun(3)} />
            <RunKey
              value={4}
              tone="four"
              onClick={() => !props.disabled && props.onRun(4)}
            />
            <RunKey
              value={6}
              tone="six"
              onClick={() => !props.disabled && props.onRun(6)}
            />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <ExtraKey
              label="Wide"
              tone="wide"
              onClick={() => !props.disabled && props.onExtra("Wide")}
            />
            <ExtraKey
              label="No Ball"
              tone="wide"
              onClick={() => !props.disabled && props.onExtra("No Ball")}
            />
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <ExtraKey
              label="Bye"
              tone="bye"
              onClick={() => !props.disabled && props.onExtra("Bye")}
            />
            <ExtraKey
              label="Leg Bye"
              tone="bye"
              onClick={() => !props.disabled && props.onExtra("Leg Bye")}
            />
          </div>
          <button
            type="button"
            onClick={() => !props.disabled && props.onOut()}
            disabled={props.disabled}
            className="mt-2 grid h-14 w-full place-items-center rounded-2xl bg-rose-600 text-lg font-black uppercase tracking-widest text-white shadow-sm transition active:scale-[0.98] disabled:opacity-60"
          >
            OUT
          </button>

          {/* Quick action row */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <QuickAction
              icon={<FileText className="size-4" />}
              label="Scorecard"
              onClick={props.onOpenScorecard}
            />
            <QuickAction
              icon={<ClipboardList className="size-4" />}
              label="Scorebook"
              onClick={props.onOpenScorebook ?? (() => {})}
              disabled={!props.onOpenScorebook}
            />
            <QuickAction
              icon={<Undo2 className="size-4" />}
              label="Undo"
              onClick={props.onUndo}
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
              Secondary actions live here so the scoring surface stays fast.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4 pb-6">
            <Section title="Batting">
              <SheetRow
                icon={<RefreshCw className="size-4" />}
                label="Swap striker"
                onClick={() => {
                  setMoreOpen(false);
                  props.onSwapStrike();
                }}
              />
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
                icon={<History className="size-4" />}
                label="Undo last ball"
                onClick={() => {
                  setMoreOpen(false);
                  props.onUndo();
                }}
              />
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

function PlayerRow({
  variant,
  onClick,
  name,
  onStrike,
  primary,
  parenthetical,
  subline,
}: {
  variant: "batter" | "bowler";
  onClick: () => void;
  name?: string;
  onStrike?: boolean;
  primary: string;
  parenthetical?: string;
  subline?: string;
}) {
  const initials = (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
        "hover:bg-muted/50 focus:outline-none focus-visible:bg-muted/50",
        variant === "bowler" && "bg-primary/5",
      )}
    >
      <div
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full text-xs font-bold",
          variant === "batter"
            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
            : "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400",
        )}
      >
        {initials || "?"}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <div className="truncate text-sm font-semibold">
            {name ?? (variant === "batter" ? "Batter" : "Bowler")}
          </div>
          {onStrike && (
            <span className="inline-block size-1.5 rounded-full bg-emerald-500" aria-label="on strike" />
          )}
        </div>
        {subline && (
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground tabular-nums">
            {subline}
          </div>
        )}
      </div>
      <div className="shrink-0 text-right">
        <div className="text-base font-black tabular-nums leading-none">
          {primary}
          {parenthetical && (
            <span className="ml-1 text-xs font-semibold text-muted-foreground">
              ({parenthetical})
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

function BallChip({ label }: { label: string }) {
  const isBoundary = label === "4" || label === "6";
  const isWicket = /W/i.test(label);
  const isExtra = /wd|nb|b|lb/i.test(label) && !isBoundary;
  return (
    <span
      className={cn(
        "inline-grid h-7 min-w-[28px] shrink-0 place-items-center rounded-full border px-2 text-[11px] font-bold tabular-nums",
        isWicket && "border-rose-500/50 bg-rose-500/10 text-rose-600 dark:text-rose-400",
        !isWicket &&
          isBoundary &&
          label === "4" &&
          "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-400",
        !isWicket &&
          isBoundary &&
          label === "6" &&
          "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-400",
        !isWicket && isExtra && "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400",
        !isWicket && !isBoundary && !isExtra && "border-border bg-background text-foreground",
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
        "grid h-16 w-full place-items-center rounded-2xl border-2 text-2xl font-black tabular-nums transition active:scale-[0.97]",
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
  tone: "wide" | "bye";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "grid h-12 w-full place-items-center rounded-2xl border text-sm font-bold uppercase tracking-wider transition active:scale-[0.98]",
        tone === "wide" &&
          "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-400",
        tone === "bye" &&
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/15 dark:text-emerald-400",
      )}
    >
      {label}
    </button>
  );
}

function QuickAction({
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
      className="flex h-11 items-center justify-center gap-1.5 rounded-xl border bg-background text-xs font-semibold text-foreground/80 transition hover:bg-muted disabled:opacity-40"
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
