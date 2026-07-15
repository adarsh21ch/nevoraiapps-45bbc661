import { formatDistanceToNow } from "date-fns";
import {
  Bell,
  BellOff,
  IndianRupee,
  ClipboardCheck,
  Swords,
  UserPlus,
  MessageSquare,
  Trophy,
  Archive,
  Check,
  ChevronRight,
  Megaphone,
  Users,
  Bot,
  Sparkles,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { NotificationCategory, NotificationRow } from "@/lib/notifications";

// Extended icon map — covers built-in enum categories plus soft "virtual"
// categories used by owner/marketing workflows (matched via row.type prefix).
const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  attendance: ClipboardCheck,
  billing: IndianRupee,
  registration: UserPlus,
  match: Swords,
  coach: MessageSquare,
  achievement: Trophy,
  system: Bell,
  announcement: Megaphone,
  marketing: Megaphone,
  crm: Users,
  lead: Users,
  automation: Bot,
  tournament: Trophy,
};

const PRIORITY_ACCENT: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-accent/60 text-foreground",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  urgent: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: "bg-rose-500/15 text-rose-600 border-rose-500/30",
  high: "bg-amber-500/15 text-amber-600 border-amber-500/30",
};

/** Highlight matched query text inside a string. */
function Highlight({ text, query }: { text: string; query?: string }) {
  if (!query || !query.trim()) return <>{text}</>;
  const needle = query.trim();
  const re = new RegExp(`(${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "ig");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === needle.toLowerCase() ? (
          <mark key={i} className="rounded bg-primary/20 px-0.5 text-inherit">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

/** Resolve the icon key from category + type suffix so soft categories work. */
export function resolveCategoryIconKey(row: NotificationRow): string {
  const t = row.type ?? "";
  if (t.startsWith("lead") || t.startsWith("crm")) return "crm";
  if (t.startsWith("marketing") || t.startsWith("campaign")) return "marketing";
  if (t.startsWith("automation") || t.startsWith("workflow")) return "automation";
  if (t.startsWith("announcement")) return "announcement";
  if (t.startsWith("tournament")) return "tournament";
  return row.category;
}

export function NotificationCard({
  row,
  onMarkRead,
  onArchive,
  onNavigate,
  onOpenDetail,
  selectable,
  selected,
  onSelectChange,
  query,
}: {
  row: NotificationRow;
  onMarkRead: (id: string) => void;
  onArchive: (id: string) => void;
  onNavigate?: () => void;
  onOpenDetail?: (row: NotificationRow) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelectChange?: (id: string, next: boolean) => void;
  query?: string;
}) {
  const iconKey = resolveCategoryIconKey(row);
  const Icon = CATEGORY_ICON[iconKey] ?? Bell;
  const unread = !row.read_at;
  const time = (() => {
    try {
      return formatDistanceToNow(new Date(row.created_at), { addSuffix: true });
    } catch {
      return "";
    }
  })();
  const subtitle = (row.payload as { subtitle?: string } | null)?.subtitle;
  const actionLabel =
    (row.payload as { action_label?: string } | null)?.action_label ?? defaultActionLabel(row);

  const inner = (
    <div
      className={cn(
        "group relative flex items-start gap-3 rounded-xl border p-3 transition-colors",
        unread
          ? "border-primary/30 bg-accent/25"
          : "border-border bg-card hover:bg-accent/30",
      )}
    >
      {selectable ? (
        <div
          className="mt-1"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          <Checkbox
            checked={!!selected}
            onCheckedChange={(v) => onSelectChange?.(row.id, v === true)}
            aria-label="Select notification"
          />
        </div>
      ) : null}

      <div
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-lg",
          PRIORITY_ACCENT[row.priority] ?? PRIORITY_ACCENT.normal,
        )}
      >
        <Icon className="size-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <div className={cn("truncate text-sm", unread ? "font-semibold" : "font-medium")}>
            <Highlight text={row.title} query={query} />
          </div>
          {unread ? (
            <span
              aria-label="Unread"
              className="size-1.5 shrink-0 rounded-full bg-primary"
            />
          ) : null}
          {row.priority === "urgent" || row.priority === "high" ? (
            <Badge
              variant="outline"
              className={cn("h-4 px-1.5 text-[9px] uppercase", PRIORITY_BADGE[row.priority])}
            >
              {row.priority}
            </Badge>
          ) : null}
        </div>
        {subtitle ? (
          <p className="mt-0.5 truncate text-xs font-medium text-foreground/80">
            <Highlight text={subtitle} query={query} />
          </p>
        ) : null}
        {row.body ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            <Highlight text={row.body} query={query} />
          </p>
        ) : null}
        <div className="mt-1.5 flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          <Badge variant="outline" className="h-4 px-1.5 text-[9px] capitalize">
            {iconKey}
          </Badge>
          <span aria-hidden>·</span>
          <span>{time}</span>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-within:opacity-100">
        {row.deep_link ? (
          <span className="hidden text-[10px] text-muted-foreground sm:inline">
            {actionLabel}
          </span>
        ) : null}
        <div className="flex gap-0.5">
          {unread ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onMarkRead(row.id);
              }}
              aria-label="Mark as read"
            >
              <Check className="size-3.5" />
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onArchive(row.id);
            }}
            aria-label="Archive"
          >
            <Archive className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );

  // Row click: open detail drawer (does not consume the deep link).
  const handleActivate = () => {
    if (unread) onMarkRead(row.id);
    onOpenDetail?.(row);
  };

  if (row.deep_link && !onOpenDetail) {
    return (
      <Link
        to={row.deep_link as unknown as never}
        onClick={() => {
          if (unread) onMarkRead(row.id);
          onNavigate?.();
        }}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-xl"
      >
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className="block w-full rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      onClick={handleActivate}
      aria-label={`Open notification: ${row.title}`}
    >
      {inner}
    </button>
  );
}

export function defaultActionLabel(row: NotificationRow): string {
  const t = row.type ?? "";
  if (t.startsWith("attendance")) return "View attendance";
  if (t.startsWith("fee") || t.startsWith("billing") || t.startsWith("payment")) return "Open fee";
  if (t.startsWith("match")) return "View match";
  if (t.startsWith("tournament")) return "Open tournament";
  if (t.startsWith("announcement")) return "Read more";
  if (t.startsWith("student") || t.startsWith("registration")) return "View student";
  if (t.startsWith("lead") || t.startsWith("crm")) return "Open lead";
  return "Open";
}

export function EmptyState({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-muted">
        <Sparkles className="size-6 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
      </div>
    </div>
  );
}

/** Small right-chevron used in detail rows. */
export function DetailChevron() {
  return <ChevronRight className="size-4 text-muted-foreground" />;
}
