import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  Swords,
  MapPin,
  Clock,
  Calendar,
  MoreVertical,
  Play,
  Copy,
  Trash2,
  Archive,
  Pencil,
  Trophy,
  Radio,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar } from "@/components/match-center/athlete-ui";
import { MATCH_STATUSES, MATCH_TYPES, type MatchWithTeams, type TeamLite } from "@/lib/mc-matches";

/* -------- Status badge -------- */
export function MatchStatusBadge({ status }: { status: string | null | undefined }) {
  const s = status ?? "scheduled";
  const map: Record<string, string> = {
    scheduled: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/20",
    live: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/20 animate-pulse",
    completed:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    abandoned: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
    cancelled: "bg-muted text-muted-foreground border-border",
    archived: "bg-muted text-muted-foreground border-border",
  };
  const label = MATCH_STATUSES.find((m) => m.value === s)?.label ?? "Scheduled";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        map[s] ?? map.scheduled,
      )}
    >
      {s === "live" && <Radio className="size-3" />}
      {label}
    </span>
  );
}

/* -------- Team side inside a match card (stacked layout) -------- */
function TeamSide({ team, align }: { team: TeamLite | null; align: "left" | "right" }) {
  return (
    <div className={cn("flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center", align)}>
      <Avatar
        src={team?.logo_url ?? null}
        name={team?.name ?? "?"}
        size={44}
        className="rounded-xl"
      />
      <div className="min-w-0 w-full">
        <div className="truncate text-[13px] font-semibold tracking-tight leading-tight">
          {team?.name ?? "TBD"}
        </div>
        <div className="truncate text-[10.5px] text-muted-foreground">
          {team?.is_external ? "External" : team?.age_group ?? "Academy"}
        </div>
      </div>
    </div>
  );
}

/* -------- Match card -------- */
export function MatchCard({
  match,
  onStart,
  onEdit,
  onDelete,
  onArchive,
  onDuplicate,
}: {
  match: MatchWithTeams;
  onStart?: (m: MatchWithTeams) => void;
  onEdit?: (m: MatchWithTeams) => void;
  onDelete?: (m: MatchWithTeams) => void;
  onArchive?: (m: MatchWithTeams) => void;
  onDuplicate?: (m: MatchWithTeams) => void;
}) {
  const typeLabel = MATCH_TYPES.find((t) => t.value === match.match_type)?.label ?? match.match_type;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-5 transition-all hover:border-foreground/20 hover:shadow-sm">
      {/* Top row: status + format + menu */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <MatchStatusBadge status={match.status} />
          <span className="inline-flex items-center rounded-md bg-accent/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            {match.match_format} · {match.overs} ov
          </span>
          <span className="inline-flex items-center rounded-md bg-accent/50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
            {typeLabel}
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" aria-label="More" className="shrink-0 -mr-1">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onStart && (
              <DropdownMenuItem onClick={() => onStart(match)}>
                <Play className="size-4 mr-2" /> Start
              </DropdownMenuItem>
            )}
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(match)}>
                <Pencil className="size-4 mr-2" /> Edit
              </DropdownMenuItem>
            )}
            {onDuplicate && (
              <DropdownMenuItem onClick={() => onDuplicate(match)}>
                <Copy className="size-4 mr-2" /> Duplicate
              </DropdownMenuItem>
            )}
            {onArchive && (
              <DropdownMenuItem onClick={() => onArchive(match)}>
                <Archive className="size-4 mr-2" /> Archive
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {onDelete && (
              <DropdownMenuItem onClick={() => onDelete(match)} className="text-destructive focus:text-destructive">
                <Trash2 className="size-4 mr-2" /> Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Middle: Team A · VS · Team B — always fits, never clips */}
      <div className="flex items-start gap-2">
        <TeamSide team={match.team_a} align="left" />
        <div className="mt-3 grid size-8 shrink-0 place-items-center rounded-full border border-border bg-background text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          vs
        </div>
        <TeamSide team={match.team_b} align="right" />
      </div>

      {/* Meta row: date · time · venue · result */}
      <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {match.scheduled_date && (
          <span className="inline-flex items-center gap-1">
            <Calendar className="size-3" /> {match.scheduled_date}
          </span>
        )}
        {match.scheduled_time && (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3" /> {match.scheduled_time}
          </span>
        )}
        {match.ground_name && (
          <span className="inline-flex min-w-0 items-center gap-1">
            <MapPin className="size-3 shrink-0" />
            <span className="truncate">{match.ground_name}</span>
          </span>
        )}
        {match.result && (
          <span className="inline-flex min-w-0 items-center gap-1 text-foreground/80">
            <Trophy className="size-3 shrink-0" />
            <span className="truncate font-semibold">{match.result}</span>
          </span>
        )}
      </div>

      {/* Actions — full-width primary on mobile */}
      <div className="mt-3.5 flex items-center gap-2">
        <Button asChild size="sm" variant="outline" className="flex-1 sm:flex-initial">
          <Link to="/match-center/scorebook/$matchId" params={{ matchId: match.id }}>
            <BookOpen className="size-4 mr-1.5" /> Scorebook
          </Link>
        </Button>
        {onStart && match.status === "scheduled" && (
          <Button size="sm" onClick={() => onStart(match)} className="flex-1 sm:flex-initial">
            <Play className="size-4 mr-1.5" /> Start
          </Button>
        )}
      </div>
    </div>
  );
}


/* -------- Team option card for the wizard -------- */
export function TeamOptionCard({
  team,
  selected,
  onClick,
}: {
  team: TeamLite;
  selected?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-2xl border p-3 text-left transition-all",
        selected
          ? "border-primary bg-primary/10 shadow-sm"
          : "border-border bg-card hover:border-foreground/20 hover:bg-accent/40",
      )}
    >
      <Avatar
        src={team.logo_url ?? null}
        name={team.name}
        size={44}
        className="rounded-xl"
      />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{team.name}</div>
        <div className="truncate text-[11px] text-muted-foreground">
          {team.is_external
            ? `External${team.city ? ` · ${team.city}` : ""}`
            : team.age_group ?? "Academy"}
        </div>
      </div>
      {team.is_external && (
        <span className="inline-flex items-center rounded-md bg-accent/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
          Ext
        </span>
      )}
    </button>
  );
}

export { Swords };
