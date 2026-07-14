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
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { NotificationCategory, NotificationRow } from "@/lib/notifications";

const CATEGORY_ICON: Record<NotificationCategory, React.ComponentType<{ className?: string }>> = {
  attendance: ClipboardCheck,
  billing: IndianRupee,
  registration: UserPlus,
  match: Swords,
  coach: MessageSquare,
  achievement: Trophy,
  system: Bell,
};

const PRIORITY_ACCENT: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-accent/60 text-foreground",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  urgent: "bg-rose-500/15 text-rose-700 dark:text-rose-400",
};

export function NotificationCard({
  row,
  onMarkRead,
  onArchive,
  onNavigate,
}: {
  row: NotificationRow;
  onMarkRead: (id: string) => void;
  onArchive: (id: string) => void;
  onNavigate?: () => void;
}) {
  const Icon = CATEGORY_ICON[row.category] ?? Bell;
  const unread = !row.read_at;
  const time = (() => {
    try {
      return formatDistanceToNow(new Date(row.created_at), { addSuffix: true });
    } catch {
      return "";
    }
  })();

  const inner = (
    <div
      className={cn(
        "group relative flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition-colors",
        unread ? "bg-accent/20" : "hover:bg-accent/30",
      )}
    >
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
            {row.title}
          </div>
          {unread ? (
            <span
              aria-hidden
              className="size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: "var(--brand, #E8873C)" }}
            />
          ) : null}
        </div>
        {row.body ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{row.body}</p>
        ) : null}
        <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          <span>{row.category}</span>
          <span aria-hidden>·</span>
          <span>{time}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
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
  );

  if (row.deep_link) {
    return (
      <Link
        to={row.deep_link as unknown as never}
        onClick={() => {
          if (unread) onMarkRead(row.id);
          onNavigate?.();
        }}
      >
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      className="block w-full text-left"
      onClick={() => {
        if (unread) onMarkRead(row.id);
      }}
    >
      {inner}
    </button>
  );
}

export function EmptyState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <BellOff className="size-6 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
