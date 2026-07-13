import { cn } from "@/lib/utils";
import { Link } from "@tanstack/react-router";
import {
  Crown,
  Shield,
  Star,
  MoreVertical,
  Copy,
  Trash2,
  Archive,
  Pencil,
  Users2,
  User as UserIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StoragedImage } from "@/components/site/StoragedImage";
import type { StudentLite, TeamStatus, TeamWithCount } from "@/lib/mc-teams";
import { ageFromDob } from "@/lib/mc-teams";

/* -------- Status badge -------- */

export function StatusBadge({ status }: { status: TeamStatus | string | null | undefined }) {
  const map: Record<string, { label: string; className: string }> = {
    active: {
      label: "Active",
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    },
    inactive: {
      label: "Inactive",
      className: "bg-muted text-muted-foreground border-border",
    },
    archived: {
      label: "Archived",
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
    },
  };
  const s = map[status ?? "active"] ?? map.active;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        s.className,
      )}
    >
      {s.label}
    </span>
  );
}

/* -------- Age group badge -------- */

export function AgeGroupBadge({ ageGroup, custom }: { ageGroup?: string | null; custom?: string | null }) {
  if (!ageGroup) return null;
  const label = ageGroup === "Custom" && custom ? custom : ageGroup;
  return (
    <span className="inline-flex items-center rounded-md bg-accent/50 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-foreground/80">
      {label}
    </span>
  );
}

/* -------- Captain badge -------- */

export function CaptainBadge({
  kind,
  size = "sm",
}: {
  kind: "captain" | "vice" | "keeper";
  size?: "sm" | "md";
}) {
  const cfg = {
    captain: {
      icon: Crown,
      label: "C",
      full: "Captain",
      className: "bg-amber-500 text-white",
    },
    vice: {
      icon: Star,
      label: "VC",
      full: "Vice Captain",
      className: "bg-sky-500 text-white",
    },
    keeper: {
      icon: Shield,
      label: "WK",
      full: "Wicket Keeper",
      className: "bg-violet-500 text-white",
    },
  }[kind];
  const Icon = cfg.icon;
  return (
    <span
      title={cfg.full}
      className={cn(
        "inline-flex items-center gap-1 rounded-md font-bold",
        cfg.className,
        size === "sm" ? "px-1.5 py-0.5 text-[9px]" : "px-2 py-1 text-[11px]",
      )}
    >
      <Icon className={size === "sm" ? "size-2.5" : "size-3"} />
      {cfg.label}
    </span>
  );
}

/* -------- Player photo -------- */

function PlayerPhoto({
  photoUrl,
  name,
  size = 40,
}: {
  photoUrl: string | null | undefined;
  name: string;
  size?: number;
}) {
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className="shrink-0 rounded-full grid place-items-center overflow-hidden bg-accent/60 text-foreground/70 text-xs font-semibold"
      style={{ width: size, height: size }}
    >
      {photoUrl ? (
        <StoragedImage
          path={photoUrl}
          alt={name}
          className="w-full h-full object-cover"
          fallback={<span>{initials || "P"}</span>}
        />
      ) : (
        <span>{initials || "P"}</span>
      )}
    </div>
  );
}

/* -------- Player chip -------- */

export function PlayerChip({
  student,
  onRemove,
  captaincy,
}: {
  student: Pick<StudentLite, "id" | "name" | "photo_url" | "dob"> & { player_id?: string | null };
  onRemove?: () => void;
  captaincy?: "captain" | "vice" | "keeper" | null;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card pl-1 pr-3 py-1 text-sm">
      <PlayerPhoto photoUrl={student.photo_url} name={student.name} size={26} />
      <span className="font-medium truncate max-w-[9rem]">{student.name}</span>
      {captaincy && <CaptainBadge kind={captaincy} />}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="ml-0.5 rounded-full p-0.5 hover:bg-accent/70 text-muted-foreground hover:text-foreground"
          aria-label={`Remove ${student.name}`}
        >
          <X className="size-3.5" />
        </button>
      )}
    </span>
  );
}

/* -------- Team card -------- */

export function TeamCard({
  team,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
}: {
  team: TeamWithCount;
  onEdit?: () => void;
  onDuplicate?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="group relative flex flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:border-foreground/20 hover:shadow-md">
      <div className="flex items-start gap-3">
        <div
          className="size-12 shrink-0 rounded-xl grid place-items-center text-white text-base font-bold overflow-hidden"
          style={{
            backgroundColor:
              team.team_color || "var(--tenant-brand, var(--brand, #E8873C))",
          }}
        >
          {team.logo_url ? (
            <StoragedImage
              path={team.logo_url}
              alt={team.name}
              className="w-full h-full object-cover"
              fallback={<span>{team.short_name?.slice(0, 3) ?? team.name.slice(0, 2).toUpperCase()}</span>}
            />
          ) : (
            <span>{team.short_name?.slice(0, 3) ?? team.name.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <Link
            to="/match-center/teams/$teamId"
            params={{ teamId: team.id }}
            className="block truncate text-base font-semibold tracking-tight hover:underline"
          >
            {team.name}
          </Link>
          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
            <AgeGroupBadge ageGroup={team.age_group} custom={team.age_group_custom} />
            <StatusBadge status={team.status} />
            {team.season && (
              <span className="text-[10px] font-medium text-muted-foreground">{team.season}</span>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-mr-2 -mt-1" aria-label="Team actions">
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem asChild>
              <Link to="/match-center/teams/$teamId" params={{ teamId: team.id }}>
                Open
              </Link>
            </DropdownMenuItem>
            {onEdit && (
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="size-3.5 mr-2" /> Edit
              </DropdownMenuItem>
            )}
            {onDuplicate && (
              <DropdownMenuItem onClick={onDuplicate}>
                <Copy className="size-3.5 mr-2" /> Duplicate
              </DropdownMenuItem>
            )}
            {onArchive && (
              <DropdownMenuItem onClick={onArchive}>
                <Archive className="size-3.5 mr-2" />{" "}
                {team.status === "archived" ? "Unarchive" : "Archive"}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            {onDelete && (
              <DropdownMenuItem onClick={onDelete} className="text-destructive focus:text-destructive">
                <Trash2 className="size-3.5 mr-2" /> Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
        <Metric icon={Users2} label="Players" value={String(team.player_count ?? 0)} />
        <Metric icon={UserIcon} label="Coach" value={team.coach_name || "—"} />
      </div>

      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
        <span>0 matches</span>
        <span>Updated {new Date(team.updated_at).toLocaleDateString()}</span>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg bg-accent/30 px-2.5 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        <Icon className="size-3" />
        {label}
      </div>
      <div className="mt-0.5 truncate text-sm font-semibold">{value}</div>
    </div>
  );
}

/* -------- Team header (used on profile page) -------- */

export function TeamHeader({
  team,
  onEdit,
}: {
  team: TeamWithCount | (import("@/lib/mc-teams").MCTeam & { player_count?: number });
  onEdit?: () => void;
}) {
  const anyTeam = team as import("@/lib/mc-teams").MCTeam & { player_count?: number };
  return (
    <div className="mb-8 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start gap-5">
        <div
          className="size-16 shrink-0 rounded-2xl grid place-items-center text-white text-xl font-bold overflow-hidden"
          style={{
            backgroundColor:
              anyTeam.team_color || "var(--tenant-brand, var(--brand, #E8873C))",
          }}
        >
          {anyTeam.logo_url ? (
            <StoragedImage
              path={anyTeam.logo_url}
              alt={anyTeam.name}
              className="w-full h-full object-cover"
              fallback={
                <span>{anyTeam.short_name?.slice(0, 3) ?? anyTeam.name.slice(0, 2).toUpperCase()}</span>
              }
            />
          ) : (
            <span>{anyTeam.short_name?.slice(0, 3) ?? anyTeam.name.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-2xl font-bold tracking-tight truncate">{anyTeam.name}</h2>
            <StatusBadge status={anyTeam.status} />
          </div>
          <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
            <AgeGroupBadge ageGroup={anyTeam.age_group} custom={anyTeam.age_group_custom} />
            {anyTeam.season && <span>• {anyTeam.season}</span>}
            {anyTeam.coach_name && <span>• Coach {anyTeam.coach_name}</span>}
            <span>• {anyTeam.player_count ?? 0} players</span>
          </div>
          {anyTeam.description && (
            <p className="mt-3 text-sm text-muted-foreground max-w-2xl">{anyTeam.description}</p>
          )}
        </div>
        {onEdit && (
          <Button variant="outline" onClick={onEdit}>
            <Pencil className="size-4 mr-1.5" /> Edit
          </Button>
        )}
      </div>
    </div>
  );
}

/* -------- Player grid -------- */

export function PlayerGrid({
  players,
  onAction,
  captainId,
  viceCaptainId,
  keeperId,
}: {
  players: Array<
    Pick<StudentLite, "id" | "name" | "photo_url" | "dob" | "player_id"> & {
      role?: string | null;
      batting_style?: string | null;
      bowling_style?: string | null;
    }
  >;
  onAction?: (
    action: "remove" | "captain" | "vice" | "keeper" | "profile",
    studentId: string,
  ) => void;
  captainId?: string | null;
  viceCaptainId?: string | null;
  keeperId?: string | null;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
      {players.map((p) => {
        const captaincy: "captain" | "vice" | "keeper" | null =
          p.id === captainId
            ? "captain"
            : p.id === viceCaptainId
              ? "vice"
              : p.id === keeperId
                ? "keeper"
                : null;
        const age = ageFromDob(p.dob);
        return (
          <div
            key={p.id}
            className="group relative flex items-start gap-3 rounded-2xl border border-border bg-card p-4 transition hover:border-foreground/20"
          >
            <PlayerPhoto photoUrl={p.photo_url} name={p.name} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <div className="truncate text-sm font-semibold">{p.name}</div>
                {captaincy && <CaptainBadge kind={captaincy} />}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground truncate">
                {p.player_id && <span>{p.player_id} · </span>}
                {p.role ? formatRole(p.role) : "Role not set"}
                {age !== null && <span> · {age}y</span>}
              </div>
              <div className="mt-1 flex items-center gap-1 flex-wrap text-[10px] text-muted-foreground">
                {p.batting_style && <Chip>{formatStyle(p.batting_style)} bat</Chip>}
                {p.bowling_style && <Chip>{p.bowling_style}</Chip>}
              </div>
            </div>
            {onAction && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="-mr-1 -mt-1">
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => onAction("captain", p.id)}>
                    <Crown className="size-3.5 mr-2" /> Set captain
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAction("vice", p.id)}>
                    <Star className="size-3.5 mr-2" /> Set vice captain
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onAction("keeper", p.id)}>
                    <Shield className="size-3.5 mr-2" /> Set keeper
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onAction("remove", p.id)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="size-3.5 mr-2" /> Remove from team
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        );
      })}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-accent/50 px-1.5 py-0.5 font-medium text-foreground/70">
      {children}
    </span>
  );
}

function formatRole(r: string) {
  return {
    batter: "Batter",
    bowler: "Bowler",
    all_rounder: "All-rounder",
    wicket_keeper: "Wicket keeper",
  }[r] ?? r;
}

function formatStyle(s: string) {
  return s === "right_hand" ? "Right-hand" : s === "left_hand" ? "Left-hand" : s;
}
