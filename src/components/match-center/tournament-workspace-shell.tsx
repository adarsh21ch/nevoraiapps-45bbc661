/* ================================================================
 * Tournament Workspace Shell
 * ----------------------------------------------------------------
 * The unified command center for a single tournament. Provides:
 *   - Rich tournament header (identity, status, progress, actions)
 *   - Sidebar navigation on tablet/desktop
 *   - Horizontal scroll tab strip on mobile
 *   - Section registry (extensible for future modules)
 *
 * Rendering of each section body is delegated to the caller via a
 * simple `activeSection` string; the shell owns layout only, never
 * data or business logic.
 * ================================================================ */

import { type ComponentType, type ReactNode, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Trophy,
  Users,
  Calendar,
  BarChart3,
  Award,
  Settings as SettingsIcon,
  Radio,
  ListTree,
  MapPin,
  UserCog,
  Layers,
  Medal,
  UserSquare2,
  LayoutDashboard,
  ExternalLink,
  Share2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { MCTournament } from "@/lib/mc-tournaments";

/* ---------------- Section model ---------------- */

export interface WorkspaceSection {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  group: "overview" | "compete" | "insights" | "setup" | "admin";
  /** When true, only shown in overflow / settings. */
  hidden?: boolean;
}

/** Core built-in sections. Future modules append via {@link registerWorkspaceExtension}. */
export const CORE_SECTIONS: WorkspaceSection[] = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard, group: "overview" },
  { id: "fixtures", label: "Fixtures", icon: Calendar, group: "compete" },
  { id: "live", label: "Live", icon: Radio, group: "compete" },
  { id: "standings", label: "Points Table", icon: BarChart3, group: "compete" },
  { id: "bracket", label: "Bracket", icon: Layers, group: "compete" },
  { id: "teams", label: "Teams", icon: Users, group: "compete" },
  { id: "players", label: "Players", icon: UserSquare2, group: "compete" },
  { id: "stats", label: "Statistics", icon: BarChart3, group: "insights" },
  { id: "records", label: "Records", icon: Trophy, group: "insights" },
  { id: "awards", label: "Awards", icon: Award, group: "insights" },
  { id: "groups", label: "Groups", icon: ListTree, group: "setup" },
  { id: "venues", label: "Venues", icon: MapPin, group: "setup" },
  { id: "officials", label: "Officials", icon: UserCog, group: "setup" },
  { id: "settings", label: "Settings", icon: SettingsIcon, group: "admin" },
];

/* ---------------- Extension registry (future modules) ----------------
 * Sponsors, Gallery, Streaming, Volunteers, Ticketing, Analytics, AI
 * Insights and similar modules can register themselves here. The shell
 * simply concatenates them into the navigation. Rendering is handled by
 * the caller which owns the section→component map.
 */
const EXTENSIONS: WorkspaceSection[] = [];

export function registerWorkspaceExtension(section: WorkspaceSection): void {
  if (EXTENSIONS.find((e) => e.id === section.id)) return;
  EXTENSIONS.push(section);
}

export function getWorkspaceSections(): WorkspaceSection[] {
  return [...CORE_SECTIONS, ...EXTENSIONS];
}

/* ---------------- Header ---------------- */

interface TournamentHeaderProps {
  tournament: MCTournament;
  teamCount: number;
  matchTotal: number;
  matchCompleted: number;
  currentStage?: string | null;
  onShare?: () => void;
  publicUrl?: string | null;
}

export function TournamentHeader({
  tournament: t,
  teamCount,
  matchTotal,
  matchCompleted,
  currentStage,
  onShare,
  publicUrl,
}: TournamentHeaderProps) {
  const progress = matchTotal > 0 ? Math.round((matchCompleted / matchTotal) * 100) : 0;
  const statusTone = statusToneFor(t.status);
  const initials = (t.name ?? "T")
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 p-4 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          {t.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={t.logo_url}
              alt=""
              className="size-12 shrink-0 rounded-xl object-cover ring-1 ring-border sm:size-14"
            />
          ) : (
            <div className="grid size-12 shrink-0 place-items-center rounded-xl bg-foreground/5 text-sm font-black text-foreground sm:size-14">
              {initials}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Link
                to="/match-center/tournaments"
                className="inline-flex items-center text-xs text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="mr-0.5 size-3" /> Tournaments
              </Link>
            </div>
            <h1 className="truncate text-lg font-black tracking-tight sm:text-2xl">
              {t.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              {t.season ? <span>{t.season}</span> : null}
              {t.format ? <span>· {t.format}</span> : null}
              {t.age_group ? <span>· {t.age_group}</span> : null}
              {currentStage ? <span>· Stage: {currentStage}</span> : null}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider",
              statusTone,
            )}
          >
            {t.status}
          </span>
          {onShare ? (
            <Button variant="outline" size="sm" onClick={onShare}>
              <Share2 className="mr-1.5 size-3.5" /> Share
            </Button>
          ) : null}
          {publicUrl ? (
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium hover:bg-muted"
            >
              <ExternalLink className="size-3.5" /> Public
            </a>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 border-t border-border sm:grid-cols-4">
        <StatCell label="Teams" value={teamCount} />
        <StatCell label="Matches" value={matchTotal} />
        <StatCell label="Completed" value={matchCompleted} />
        <StatCell label="Progress" value={`${progress}%`} accent />
      </div>
      <div className="h-1 w-full bg-muted">
        <div
          className="h-full bg-foreground transition-[width] duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function StatCell({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="px-4 py-3 sm:px-5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-lg font-bold tracking-tight sm:text-xl",
          accent && "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function statusToneFor(status: string | null | undefined): string {
  switch (status) {
    case "ongoing":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "completed":
      return "bg-muted text-muted-foreground";
    case "cancelled":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
  }
}

/* ---------------- Shell layout ---------------- */

const GROUP_LABEL: Record<WorkspaceSection["group"], string> = {
  overview: "Overview",
  compete: "Compete",
  insights: "Insights",
  setup: "Setup",
  admin: "Admin",
};

interface ShellProps {
  header: ReactNode;
  activeSection: string;
  onSectionChange: (id: string) => void;
  sections?: WorkspaceSection[];
  quickActions?: ReactNode;
  children: ReactNode;
}

export function TournamentWorkspaceShell({
  header,
  activeSection,
  onSectionChange,
  sections,
  quickActions,
  children,
}: ShellProps) {
  const nav = sections ?? getWorkspaceSections();
  const grouped = useMemo(() => {
    const map = new Map<WorkspaceSection["group"], WorkspaceSection[]>();
    for (const s of nav) {
      if (s.hidden) continue;
      const list = map.get(s.group) ?? [];
      list.push(s);
      map.set(s.group, list);
    }
    return Array.from(map.entries());
  }, [nav]);

  return (
    <div className="space-y-3">
      {header}

      {/* Mobile: horizontal scroll strip */}
      <nav
        aria-label="Tournament sections"
        className="-mx-1 flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 lg:hidden"
      >
        {nav
          .filter((s) => !s.hidden)
          .map((s) => (
            <TabButton
              key={s.id}
              section={s}
              active={s.id === activeSection}
              onSelect={onSectionChange}
            />
          ))}
      </nav>

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-4 space-y-4">
            <nav
              aria-label="Tournament sections"
              className="rounded-xl border border-border bg-card p-2"
            >
              {grouped.map(([group, list]) => (
                <div key={group} className="mb-2 last:mb-0">
                  <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {GROUP_LABEL[group]}
                  </div>
                  <ul className="space-y-0.5">
                    {list.map((s) => {
                      const Icon = s.icon;
                      const active = s.id === activeSection;
                      return (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => onSectionChange(s.id)}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                              active
                                ? "bg-foreground text-background"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                          >
                            <Icon className="size-4" />
                            <span className="truncate">{s.label}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
            {quickActions ? (
              <div className="rounded-xl border border-border bg-card p-3">
                <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Sparkles className="size-3" /> Quick actions
                </div>
                <div className="space-y-1.5">{quickActions}</div>
              </div>
            ) : null}
          </div>
        </aside>

        {/* Main content */}
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}

function TabButton({
  section,
  active,
  onSelect,
}: {
  section: WorkspaceSection;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  const Icon = section.icon;
  return (
    <button
      type="button"
      onClick={() => onSelect(section.id)}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
        active
          ? "bg-foreground text-background"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-4" />
      {section.label}
    </button>
  );
}

/* ---------------- Quick action row helper ---------------- */

export function QuickActionButton({
  icon: Icon,
  label,
  onClick,
  href,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  href?: string;
}) {
  const cls =
    "flex w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 py-1.5 text-left text-xs font-medium hover:bg-muted";
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        <Icon className="size-3.5" />
        {label}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}

export const MedalIcon = Medal;
