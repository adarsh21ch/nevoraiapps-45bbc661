import { type ReactNode, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Search,
  User2,
  Undo2,
  X,
  Circle,
} from "lucide-react";

/* ---------------- Status indicator ---------------- */

export type ConnectionStatus = "online" | "offline" | "syncing";

export function StatusIndicator({ status }: { status: ConnectionStatus }) {
  const map = {
    online: {
      icon: Wifi,
      label: "Online",
      cls: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    },
    offline: {
      icon: WifiOff,
      label: "Offline",
      cls: "bg-red-500/15 text-red-500 border-red-500/30",
    },
    syncing: {
      icon: RefreshCw,
      label: "Sync pending",
      cls: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    },
  } as const;
  const { icon: Icon, label, cls } = map[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        cls,
      )}
    >
      <Icon
        className={cn("size-3.5", status === "syncing" && "animate-spin")}
      />
      {label}
    </span>
  );
}

export function LivePulse() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-red-500">
      <span className="relative flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-red-500" />
      </span>
      Live
    </span>
  );
}

/* ---------------- Match header ---------------- */

export interface MatchHeaderProps {
  homeTeam: string;
  awayTeam: string;
  homeShort?: string;
  awayShort?: string;
  score: string; // e.g. "142/4"
  overs: string; // e.g. "18.3"
  crr?: string;
  rrr?: string;
  target?: string;
  status: string;
  format?: string;
  ground?: string;
  tournament?: string;
  timer?: string;
  connection?: ConnectionStatus;
}

export function MatchHeader(props: MatchHeaderProps) {
  return (
    <header className="border-b bg-card">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 sm:gap-6 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <LivePulse />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2 truncate text-sm font-semibold">
              <span className="truncate">{props.homeTeam}</span>
              <span className="text-muted-foreground">vs</span>
              <span className="truncate">{props.awayTeam}</span>
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {[props.format, props.tournament, props.ground]
                .filter(Boolean)
                .join(" · ")}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="hidden text-right sm:block">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Score
            </div>
            <div className="text-xl font-black leading-none tabular-nums">
              {props.score}
              <span className="ml-1 text-sm font-semibold text-muted-foreground">
                ({props.overs})
              </span>
            </div>
          </div>
          <div className="hidden text-right md:block">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              CRR
            </div>
            <div className="text-sm font-bold tabular-nums">
              {props.crr ?? "–"}
            </div>
          </div>
          {props.rrr && (
            <div className="hidden text-right md:block">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                RRR
              </div>
              <div className="text-sm font-bold tabular-nums text-primary">
                {props.rrr}
              </div>
            </div>
          )}
          {props.target && (
            <div className="hidden text-right lg:block">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Target
              </div>
              <div className="text-sm font-bold tabular-nums">
                {props.target}
              </div>
            </div>
          )}
          <Badge variant="secondary" className="hidden sm:inline-flex">
            {props.status}
          </Badge>
          {props.timer && (
            <span className="hidden font-mono text-xs tabular-nums text-muted-foreground lg:inline">
              {props.timer}
            </span>
          )}
          <StatusIndicator status={props.connection ?? "online"} />
        </div>
      </div>
    </header>
  );
}

/* ---------------- Player panels ---------------- */

function Avatar({ name }: { name?: string }) {
  const initials = (name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
      {initials || <User2 className="size-4" />}
    </div>
  );
}

export interface BatterStats {
  name?: string;
  runs: number;
  balls: number;
  fours?: number;
  sixes?: number;
  strikeRate?: string;
  last5?: string[];
  onStrike?: boolean;
}

export function PlayerPanel({
  striker,
  nonStriker,
}: {
  striker?: BatterStats;
  nonStriker?: BatterStats;
}) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border bg-card p-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Batting
      </div>
      <BatterRow batter={striker} primary />
      <div className="h-px bg-border" />
      <BatterRow batter={nonStriker} />
    </div>
  );
}

function BatterRow({
  batter,
  primary,
}: {
  batter?: BatterStats;
  primary?: boolean;
}) {
  if (!batter?.name) {
    return (
      <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
        <div className="grid size-11 place-items-center rounded-full border border-dashed">
          <User2 className="size-4" />
        </div>
        Waiting for {primary ? "first batter" : "partner"}…
      </div>
    );
  }
  const sr =
    batter.strikeRate ??
    (batter.balls > 0
      ? ((batter.runs / batter.balls) * 100).toFixed(1)
      : "0.0");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Avatar name={batter.name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="truncate text-sm font-semibold">{batter.name}</div>
            {(primary || batter.onStrike) && (
              <span className="text-primary" title="On strike">
                *
              </span>
            )}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
            <span className="font-bold text-foreground">
              {batter.runs}
              <span className="text-muted-foreground"> ({batter.balls})</span>
            </span>
            {primary && (
              <>
                <span>4s: {batter.fours ?? 0}</span>
                <span>6s: {batter.sixes ?? 0}</span>
              </>
            )}
            <span>SR: {sr}</span>
          </div>
        </div>
      </div>
      {primary && (
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Last 5
          </span>
          <div className="flex gap-1">
            {(batter.last5 ?? []).slice(-5).map((b, i) => (
              <BallChip key={i} value={b} />
            ))}
            {(batter.last5 ?? []).length === 0 && (
              <span className="text-xs text-muted-foreground">–</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export interface BowlerStats {
  name?: string;
  overs?: string;
  runs?: number;
  wickets?: number;
  economy?: string;
  lastOver?: string[];
}

export function BowlerPanel({ bowler }: { bowler?: BowlerStats }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-xl border bg-card p-3">
      <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Bowling
      </div>
      {!bowler?.name ? (
        <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-2 text-xs text-muted-foreground">
          <div className="grid size-11 place-items-center rounded-full border border-dashed">
            <User2 className="size-4" />
          </div>
          Waiting for bowler…
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <Avatar name={bowler.name} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {bowler.name}
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground tabular-nums">
                <span className="font-bold text-foreground">
                  {bowler.wickets ?? 0}/{bowler.runs ?? 0}
                </span>
                <span>{bowler.overs ?? "0.0"} ov</span>
                <span>Econ: {bowler.economy ?? "–"}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              This over
            </span>
            <div className="flex gap-1">
              {(bowler.lastOver ?? []).map((b, i) => (
                <BallChip key={i} value={b} />
              ))}
              {(bowler.lastOver ?? []).length === 0 && (
                <span className="text-xs text-muted-foreground">–</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------------- Ball chip / over timeline ---------------- */

export function BallChip({ value }: { value: string }) {
  const v = value.toUpperCase();
  const cls =
    v === "W"
      ? "bg-red-500 text-white border-red-500"
      : v === "4"
        ? "bg-blue-500 text-white border-blue-500"
        : v === "6"
          ? "bg-purple-500 text-white border-purple-500"
          : v.includes("WD") || v.includes("NB")
            ? "bg-amber-500/20 text-amber-600 border-amber-500/40"
            : v === "0"
              ? "bg-muted text-muted-foreground border-border"
              : "bg-card text-foreground border-border";
  return (
    <span
      className={cn(
        "grid size-7 place-items-center rounded-full border text-xs font-bold tabular-nums",
        cls,
      )}
    >
      {v}
    </span>
  );
}

export function OverTimeline({ balls }: { balls: string[] }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto rounded-xl border bg-card px-3 py-2">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Over
      </span>
      <div className="flex gap-1.5">
        {balls.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            Waiting for first ball…
          </span>
        ) : (
          balls.map((b, i) => <BallChip key={i} value={b} />)
        )}
      </div>
    </div>
  );
}

/* ---------------- Scoring buttons ---------------- */

type Tone =
  | "run"
  | "boundary"
  | "six"
  | "extra"
  | "wicket"
  | "neutral"
  | "danger";

const toneCls: Record<Tone, string> = {
  run: "bg-card hover:bg-muted text-foreground border-border",
  boundary: "bg-blue-500 hover:bg-blue-600 text-white border-blue-600",
  six: "bg-purple-500 hover:bg-purple-600 text-white border-purple-600",
  extra:
    "bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border-amber-500/40",
  wicket: "bg-red-500 hover:bg-red-600 text-white border-red-600",
  neutral: "bg-secondary hover:bg-secondary/80 text-secondary-foreground border-border",
  danger: "bg-destructive hover:bg-destructive/90 text-destructive-foreground border-destructive",
};

export function ScoreButton({
  label,
  sublabel,
  tone = "neutral",
  size = "lg",
  onClick,
  disabled,
  className,
}: {
  label: ReactNode;
  sublabel?: string;
  tone?: Tone;
  size?: "lg" | "xl";
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group relative flex flex-col items-center justify-center rounded-2xl border-2 font-black tabular-nums shadow-sm transition active:scale-[0.97] disabled:opacity-50",
        toneCls[tone],
        size === "xl" ? "min-h-24 text-4xl" : "min-h-20 text-3xl",
        "px-4 py-3",
        className,
      )}
    >
      <span>{label}</span>
      {sublabel && (
        <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-widest opacity-80">
          {sublabel}
        </span>
      )}
    </button>
  );
}

export function RunsButton(props: {
  value: 0 | 1 | 2 | 3 | 4 | 6;
  onClick?: () => void;
}) {
  const tone: Tone =
    props.value === 4 ? "boundary" : props.value === 6 ? "six" : "run";
  const sublabel =
    props.value === 4 ? "Four" : props.value === 6 ? "Six" : undefined;
  return (
    <ScoreButton
      label={props.value}
      tone={tone}
      sublabel={sublabel}
      onClick={props.onClick}
    />
  );
}

export function ExtraButton({
  label,
  onClick,
}: {
  label: string;
  onClick?: () => void;
}) {
  return (
    <ScoreButton label={label} tone="extra" size="lg" onClick={onClick} />
  );
}

export function UndoButton({ onClick }: { onClick?: () => void }) {
  return (
    <Button
      variant="outline"
      size="lg"
      onClick={onClick}
      className="h-14 gap-2 text-sm font-semibold"
    >
      <Undo2 className="size-4" /> Undo
    </Button>
  );
}

/* ---------------- Dismissal / caught / run out / new batter / extras modals ---------------- */

const DISMISSALS = [
  "Bowled",
  "Caught",
  "LBW",
  "Run Out",
  "Stumped",
  "Hit Wicket",
  "Retired Hurt",
  "Retired Out",
  "Timed Out",
] as const;
export type DismissalKind = (typeof DISMISSALS)[number];

export function DismissalModal({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (kind: DismissalKind) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>How is the batter out?</DialogTitle>
          <DialogDescription>
            Select the mode of dismissal. Further details next.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DISMISSALS.map((d) => (
            <Button
              key={d}
              variant="outline"
              className="h-14 text-sm font-semibold"
              onClick={() => onSelect(d)}
            >
              {d}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export interface PlayerOption {
  id: string;
  name: string;
  role?: string;
}

export function PlayerPickerModal({
  open,
  onOpenChange,
  title,
  description,
  players,
  recent,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  players: PlayerOption[];
  recent?: PlayerOption[];
  onSelect: (p: PlayerOption) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () =>
      players.filter((p) =>
        p.name.toLowerCase().includes(q.trim().toLowerCase()),
      ),
    [q, players],
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search players…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        {recent && recent.length > 0 && !q && (
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              Recent
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recent.map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant="secondary"
                  onClick={() => onSelect(p)}
                >
                  {p.name}
                </Button>
              ))}
            </div>
          </div>
        )}
        <div>
          <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Team
          </div>
          <div className="grid max-h-72 grid-cols-2 gap-1.5 overflow-y-auto sm:grid-cols-3">
            {filtered.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p)}
                className="flex items-center gap-2 rounded-lg border bg-card p-2 text-left transition hover:bg-muted"
              >
                <Avatar name={p.name} />
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">
                    {p.name}
                  </div>
                  {p.role && (
                    <div className="truncate text-[11px] text-muted-foreground">
                      {p.role}
                    </div>
                  )}
                </div>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="col-span-full py-6 text-center text-sm text-muted-foreground">
                No players found.
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RunOutModal({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (who: "striker" | "non-striker") => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Who is out?</DialogTitle>
          <DialogDescription>
            Tap the batter dismissed on this run out.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            className="h-16 text-base font-semibold"
            onClick={() => onSelect("striker")}
          >
            Striker
          </Button>
          <Button
            variant="outline"
            className="h-16 text-base font-semibold"
            onClick={() => onSelect("non-striker")}
          >
            Non-striker
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ExtraRunsModal({
  open,
  onOpenChange,
  kind,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kind: string;
  onSelect: (runs: number) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{kind} — how many runs?</DialogTitle>
          <DialogDescription>
            Total runs conceded on this ball including the {kind.toLowerCase()}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-5 gap-2">
          {[1, 2, 3, 4, 5].map((r) => (
            <Button
              key={r}
              variant="outline"
              className="h-16 text-2xl font-black tabular-nums"
              onClick={() => onSelect(r)}
            >
              {r}
            </Button>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Drawers ---------------- */

export function SquadDrawer({
  open,
  onOpenChange,
  side = "right",
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  side?: "left" | "right";
  title: string;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={side} className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription className="sr-only">{title}</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}

/* ---------------- Commentary ---------------- */

export function CommentaryPanel({
  entries,
  collapsed,
  onToggle,
}: {
  entries: { id: string; over: string; text: string }[];
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="rounded-xl border bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-semibold"
      >
        <span className="flex items-center gap-2">
          <Circle className="size-3 fill-primary text-primary" />
          Commentary
        </span>
        <span className="text-xs text-muted-foreground">
          {collapsed ? "Show" : "Hide"}
        </span>
      </button>
      {!collapsed && (
        <div className="max-h-40 space-y-1.5 overflow-y-auto border-t px-3 py-2 text-sm">
          {entries.length === 0 ? (
            <div className="py-3 text-center text-xs text-muted-foreground">
              Ball-by-ball commentary will appear here.
            </div>
          ) : (
            entries.map((e) => (
              <div key={e.id} className="flex gap-2">
                <span className="w-10 shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                  {e.over}
                </span>
                <span className="flex-1">{e.text}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export function IconCloseButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label="Close"
      className="size-9"
    >
      <X className="size-4" />
    </Button>
  );
}
