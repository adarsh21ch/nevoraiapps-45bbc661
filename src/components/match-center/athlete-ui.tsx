import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { User as UserIcon, Activity, Trophy, Medal, Sparkles } from "lucide-react";
import type { AthleteWithStudent, MCAthlete } from "@/lib/mc-athletes";
import {
  ageFromDob,
  CRICKET_ROLES,
  ATHLETE_STATUSES,
  FITNESS_STATUSES,
  PRIMARY_SPORTS,
} from "@/lib/mc-athletes";

function labelFor(
  list: readonly { value: string; label: string }[],
  value: string | null | undefined,
) {
  if (!value) return null;
  return list.find((l) => l.value === value)?.label ?? value;
}

export function AthleteStatusBadge({ status }: { status: string | null | undefined }) {
  const s = status ?? "active";
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    inactive: "bg-muted text-muted-foreground border-border",
    retired: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        map[s] ?? map.active,
      )}
    >
      {labelFor(ATHLETE_STATUSES, s) ?? "Active"}
    </span>
  );
}

export function FitnessBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const map: Record<string, string> = {
    fit: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    recovering: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    injured: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    rest: "bg-muted text-muted-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        map[status] ?? map.rest,
      )}
    >
      <Activity className="size-3" />
      {labelFor(FITNESS_STATUSES, status)}
    </span>
  );
}

/* -------- Player avatar -------- */
export function Avatar({
  src,
  name,
  size = 56,
  className,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
}) {
  const initials =
    (name ?? "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?";
  return (
    <div
      className={cn(
        "relative shrink-0 rounded-2xl overflow-hidden bg-accent/60 grid place-items-center text-foreground/70 font-semibold",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name ?? ""} className="w-full h-full object-cover" />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}

/* -------- Reusable Athlete Card -------- */
export function AthleteCard({
  athlete,
  to,
}: {
  athlete: AthleteWithStudent;
  to?: string;
}) {
  const s = athlete.student;
  const age = ageFromDob(s?.dob);
  const role = labelFor(CRICKET_ROLES, athlete.cricket?.playing_role);
  const sport = labelFor(PRIMARY_SPORTS, athlete.primary_sport);
  const inner = (
    <div className="group flex h-full flex-col gap-4 rounded-2xl border border-border bg-card p-5 transition-all hover:border-foreground/20 hover:shadow-md">
      <div className="flex items-start gap-4">
        <Avatar src={s?.photo_url ?? null} name={s?.name ?? "?"} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-base font-semibold tracking-tight">
                {s?.name ?? "Unknown"}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                {s?.player_id && <span className="font-mono">{s.player_id}</span>}
                {age !== null && <span>· {age} yrs</span>}
              </div>
            </div>
            <AthleteStatusBadge status={athlete.current_status} />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs">
        {role && (
          <span className="inline-flex items-center gap-1 rounded-md bg-accent/50 px-2 py-0.5 font-medium">
            {role}
          </span>
        )}
        {sport && (
          <span className="inline-flex items-center gap-1 rounded-md bg-accent/50 px-2 py-0.5 font-medium">
            {sport}
          </span>
        )}
        {athlete.team?.name && (
          <span className="inline-flex items-center gap-1 rounded-md bg-accent/50 px-2 py-0.5 font-medium">
            {athlete.team.name}
          </span>
        )}
        <FitnessBadge status={athlete.fitness_status} />
      </div>
    </div>
  );
  if (to)
    return (
      <Link to={to} className="block h-full">
        {inner}
      </Link>
    );
  return inner;
}

/* -------- Section shell -------- */

export function InfoRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/60 last:border-b-0">
      {Icon && <Icon className="size-4 mt-0.5 text-muted-foreground shrink-0" />}
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="mt-0.5 text-sm font-medium break-words">
          {value ?? <span className="text-muted-foreground">—</span>}
        </div>
      </div>
    </div>
  );
}

export function InfoCard({
  title,
  action,
  icon: Icon,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="size-4 text-muted-foreground" />}
          <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

/* -------- Kind badges -------- */

export function KindBadge({
  kind,
  label,
  tone = "brand",
}: {
  kind: "achievement" | "award" | "timeline";
  label: string;
  tone?: "brand" | "muted";
}) {
  const Icon = kind === "award" ? Medal : kind === "timeline" ? Sparkles : Trophy;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        tone === "brand"
          ? "bg-primary/15 text-primary"
          : "bg-accent/50 text-muted-foreground",
      )}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}

export { UserIcon };
