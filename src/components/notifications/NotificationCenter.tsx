import { useMemo, useState } from "react";
import { Search, CheckCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useArchiveNotification,
  useGroupedNotifications,
  useMarkAllRead,
  useMarkRead,
  useNotifications,
  useNotificationsRealtime,
  type NotificationRow,
} from "@/lib/notifications";
import { EmptyState, NotificationCard } from "./NotificationCard";

type Filter = "all" | "unread" | "archived";

function filterRows(rows: NotificationRow[] | undefined, q: string) {
  if (!rows) return [];
  const needle = q.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter(
    (r) =>
      r.title.toLowerCase().includes(needle) ||
      (r.body ?? "").toLowerCase().includes(needle) ||
      r.category.toLowerCase().includes(needle),
  );
}

export function NotificationCenter({
  userId,
  onNavigate,
}: {
  userId: string | null;
  onNavigate?: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  useNotificationsRealtime(userId);
  const list = useNotifications(userId, filter);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const archive = useArchiveNotification();

  const filtered = useMemo(() => filterRows(list.data, q), [list.data, q]);
  const groups = useGroupedNotifications(filtered);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Notifications</h2>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1 text-xs"
            onClick={() => markAll.mutate()}
            disabled={markAll.isPending}
          >
            <CheckCheck className="size-3.5" /> Mark all read
          </Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search notifications"
            className="h-9 pl-8 text-sm"
          />
        </div>
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-6 p-4">
          {list.isLoading ? (
            <EmptyState label="Loading…" />
          ) : filtered.length === 0 ? (
            <EmptyState
              label={
                filter === "unread"
                  ? "You're all caught up."
                  : filter === "archived"
                    ? "Nothing archived yet."
                    : "No notifications yet."
              }
            />
          ) : (
            <>
              <Group
                label="Today"
                rows={groups.today}
                onRead={(id) => markRead.mutate(id)}
                onArchive={(id) => archive.mutate(id)}
                onNavigate={onNavigate}
              />
              <Group
                label="Yesterday"
                rows={groups.yesterday}
                onRead={(id) => markRead.mutate(id)}
                onArchive={(id) => archive.mutate(id)}
                onNavigate={onNavigate}
              />
              <Group
                label="Earlier"
                rows={groups.earlier}
                onRead={(id) => markRead.mutate(id)}
                onArchive={(id) => archive.mutate(id)}
                onNavigate={onNavigate}
              />
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function Group({
  label,
  rows,
  onRead,
  onArchive,
  onNavigate,
}: {
  label: string;
  rows: NotificationRow[];
  onRead: (id: string) => void;
  onArchive: (id: string) => void;
  onNavigate?: () => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <NotificationCard
            key={r.id}
            row={r}
            onMarkRead={onRead}
            onArchive={onArchive}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  );
}
