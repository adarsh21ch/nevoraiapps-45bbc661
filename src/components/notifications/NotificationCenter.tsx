import { useMemo, useState } from "react";
import {
  Search,
  CheckCheck,
  ArrowDownUp,
  Filter as FilterIcon,
  X,
  ExternalLink,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useArchiveNotification,
  useGroupedNotifications,
  useMarkAllRead,
  useMarkManyRead,
  useMarkRead,
  useNotifications,
  useNotificationsRealtime,
  type NotificationRow,
} from "@/lib/notifications";
import {
  EmptyState,
  NotificationCard,
  defaultActionLabel,
  resolveCategoryIconKey,
} from "./NotificationCard";
import { cn } from "@/lib/utils";

type StatusTab = "all" | "unread" | "archived";
type SortMode = "newest" | "oldest" | "unread" | "priority";
type Role = "parent" | "owner";

const PARENT_CHIPS = [
  "all",
  "attendance",
  "billing",
  "match",
  "tournament",
  "registration",
  "announcement",
  "system",
] as const;

const OWNER_EXTRA = ["marketing", "crm", "lead", "automation"] as const;

const CHIP_LABEL: Record<string, string> = {
  all: "All",
  attendance: "Attendance",
  billing: "Fees",
  match: "Matches",
  tournament: "Tournaments",
  registration: "Students",
  announcement: "Announcements",
  system: "System",
  marketing: "Marketing",
  crm: "CRM",
  lead: "Leads",
  automation: "Automation",
};

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

/** Filter rows against a search string and category chip. */
function applyFilters(
  rows: NotificationRow[] | undefined,
  q: string,
  chip: string,
  sort: SortMode,
): NotificationRow[] {
  if (!rows) return [];
  const needle = q.trim().toLowerCase();
  let out = rows;
  if (chip !== "all") {
    out = out.filter((r) => resolveCategoryIconKey(r) === chip);
  }
  if (needle) {
    out = out.filter(
      (r) =>
        r.title.toLowerCase().includes(needle) ||
        (r.body ?? "").toLowerCase().includes(needle) ||
        (r.category ?? "").toLowerCase().includes(needle) ||
        (((r.payload as { subtitle?: string; student_name?: string; tenant_name?: string } | null))
          ? Object.values(r.payload as Record<string, unknown>).some(
              (v) => typeof v === "string" && v.toLowerCase().includes(needle),
            )
          : false),
    );
  }
  if (sort === "oldest") {
    out = [...out].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  } else if (sort === "unread") {
    out = [...out].sort((a, b) => {
      const au = a.read_at ? 1 : 0;
      const bu = b.read_at ? 1 : 0;
      if (au !== bu) return au - bu;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  } else if (sort === "priority") {
    out = [...out].sort((a, b) => {
      const ap = PRIORITY_ORDER[a.priority] ?? 4;
      const bp = PRIORITY_ORDER[b.priority] ?? 4;
      if (ap !== bp) return ap - bp;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }
  return out;
}

export function NotificationCenter({
  userId,
  onNavigate,
  role = "parent",
}: {
  userId: string | null;
  onNavigate?: () => void;
  role?: Role;
}) {
  const [status, setStatus] = useState<StatusTab>("all");
  const [chip, setChip] = useState<string>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortMode>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const [detail, setDetail] = useState<NotificationRow | null>(null);
  const [visibleCount, setVisibleCount] = useState(30);

  useNotificationsRealtime(userId);
  const list = useNotifications(userId, status);
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const markMany = useMarkManyRead();
  const archive = useArchiveNotification();

  const chips: readonly string[] =
    role === "owner" ? [...PARENT_CHIPS, ...OWNER_EXTRA] : PARENT_CHIPS;

  const filtered = useMemo(
    () => applyFilters(list.data, q, chip, sort),
    [list.data, q, chip, sort],
  );
  const visible = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const groups = useGroupedNotifications(visible);

  const unreadInFiltered = filtered.filter((r) => !r.read_at).length;

  const toggleSelect = (id: string, next: boolean) => {
    setSelected((prev) => {
      const s = new Set(prev);
      if (next) s.add(id);
      else s.delete(id);
      return s;
    });
  };

  const markSelectedRead = () => {
    if (selected.size === 0) return;
    markMany.mutate(Array.from(selected), {
      onSuccess: () => {
        setSelected(new Set());
        setSelectionMode(false);
      },
    });
  };

  return (
    <div className="flex h-full flex-col">
      <header className="space-y-3 border-b border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="text-base font-semibold">Notifications</h2>
            {unreadInFiltered > 0 ? (
              <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                {unreadInFiltered} unread
              </Badge>
            ) : null}
          </div>
          <div className="flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-xs"
                  aria-label="Sort notifications"
                >
                  <ArrowDownUp className="size-3.5" />
                  <span className="hidden sm:inline">{sortLabel(sort)}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(["newest", "oldest", "unread", "priority"] as const).map((s) => (
                  <DropdownMenuItem key={s} onSelect={() => setSort(s)}>
                    {sortLabel(s)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {selectionMode ? (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-xs"
                  onClick={markSelectedRead}
                  disabled={selected.size === 0 || markMany.isPending}
                >
                  <CheckCheck className="size-3.5" /> Read ({selected.size})
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  onClick={() => {
                    setSelectionMode(false);
                    setSelected(new Set());
                  }}
                  aria-label="Cancel selection"
                >
                  <X className="size-3.5" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="hidden h-8 gap-1 text-xs sm:inline-flex"
                  onClick={() => setSelectionMode(true)}
                >
                  <FilterIcon className="size-3.5" /> Select
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 gap-1 text-xs"
                  onClick={() => markAll.mutate()}
                  disabled={markAll.isPending}
                >
                  <CheckCheck className="size-3.5" />
                  <span className="hidden sm:inline">Mark all read</span>
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title, message, category, or student"
            className="h-9 pl-8 text-sm"
            aria-label="Search notifications"
          />
        </div>

        <Tabs value={status} onValueChange={(v) => setStatus(v as StatusTab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
          </TabsList>
        </Tabs>

        <div
          role="tablist"
          aria-label="Filter by category"
          className="-mx-1 flex snap-x snap-mandatory flex-nowrap gap-1.5 overflow-x-auto px-1 pb-1"
        >
          {chips.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={chip === c}
              type="button"
              onClick={() => setChip(c)}
              className={cn(
                "shrink-0 snap-start rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                chip === c
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {CHIP_LABEL[c] ?? c}
            </button>
          ))}
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div
          className="space-y-6 p-4"
          onScroll={(e) => {
            const el = e.currentTarget;
            if (
              el.scrollHeight - el.scrollTop - el.clientHeight < 300 &&
              visibleCount < filtered.length
            ) {
              setVisibleCount((v) => Math.min(v + 30, filtered.length));
            }
          }}
        >
          {list.isLoading ? (
            <SkeletonList />
          ) : filtered.length === 0 ? (
            <EmptyState
              label={
                status === "unread"
                  ? "You're all caught up."
                  : status === "archived"
                    ? "Nothing archived yet."
                    : q || chip !== "all"
                      ? "No matches for these filters."
                      : "No notifications yet."
              }
              hint={
                status === "unread"
                  ? "New alerts will land here as they arrive."
                  : q || chip !== "all"
                    ? "Try clearing filters or searching different keywords."
                    : undefined
              }
            />
          ) : (
            <>
              <Group
                label="Today"
                rows={groups.today}
                query={q}
                selectable={selectionMode}
                selected={selected}
                onSelect={toggleSelect}
                onRead={(id) => markRead.mutate(id)}
                onArchive={(id) => archive.mutate(id)}
                onOpenDetail={setDetail}
                onNavigate={onNavigate}
              />
              <Group
                label="Yesterday"
                rows={groups.yesterday}
                query={q}
                selectable={selectionMode}
                selected={selected}
                onSelect={toggleSelect}
                onRead={(id) => markRead.mutate(id)}
                onArchive={(id) => archive.mutate(id)}
                onOpenDetail={setDetail}
                onNavigate={onNavigate}
              />
              <Group
                label="Earlier this week"
                rows={groups.thisWeek}
                query={q}
                selectable={selectionMode}
                selected={selected}
                onSelect={toggleSelect}
                onRead={(id) => markRead.mutate(id)}
                onArchive={(id) => archive.mutate(id)}
                onOpenDetail={setDetail}
                onNavigate={onNavigate}
              />
              <Group
                label="Earlier this month"
                rows={groups.thisMonth}
                query={q}
                selectable={selectionMode}
                selected={selected}
                onSelect={toggleSelect}
                onRead={(id) => markRead.mutate(id)}
                onArchive={(id) => archive.mutate(id)}
                onOpenDetail={setDetail}
                onNavigate={onNavigate}
              />
              <Group
                label="Older"
                rows={groups.older}
                query={q}
                selectable={selectionMode}
                selected={selected}
                onSelect={toggleSelect}
                onRead={(id) => markRead.mutate(id)}
                onArchive={(id) => archive.mutate(id)}
                onOpenDetail={setDetail}
                onNavigate={onNavigate}
              />
              {visibleCount < filtered.length ? (
                <div className="flex justify-center pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setVisibleCount((v) => Math.min(v + 30, filtered.length))}
                  >
                    Load more ({filtered.length - visibleCount})
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </ScrollArea>

      <DetailDrawer
        row={detail}
        onOpenChange={(o) => !o && setDetail(null)}
        onNavigate={onNavigate}
      />
    </div>
  );
}

function Group({
  label,
  rows,
  query,
  selectable,
  selected,
  onSelect,
  onRead,
  onArchive,
  onOpenDetail,
  onNavigate,
}: {
  label: string;
  rows: NotificationRow[];
  query: string;
  selectable: boolean;
  selected: Set<string>;
  onSelect: (id: string, next: boolean) => void;
  onRead: (id: string) => void;
  onArchive: (id: string) => void;
  onOpenDetail: (row: NotificationRow) => void;
  onNavigate?: () => void;
}) {
  if (rows.length === 0) return null;
  return (
    <section className="space-y-2" aria-label={label}>
      <h3 className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </h3>
      <div className="space-y-2">
        {rows.map((r) => (
          <NotificationCard
            key={r.id}
            row={r}
            query={query}
            selectable={selectable}
            selected={selected.has(r.id)}
            onSelectChange={onSelect}
            onMarkRead={onRead}
            onArchive={onArchive}
            onOpenDetail={onOpenDetail}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </section>
  );
}

function DetailDrawer({
  row,
  onOpenChange,
  onNavigate,
}: {
  row: NotificationRow | null;
  onOpenChange: (open: boolean) => void;
  onNavigate?: () => void;
}) {
  const subtitle = (row?.payload as { subtitle?: string } | null)?.subtitle;
  const source =
    (row?.payload as { source?: string; automation_source?: string } | null)?.automation_source ??
    (row?.payload as { source?: string } | null)?.source ??
    null;
  return (
    <Sheet open={!!row} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        {row ? (
          <>
            <SheetHeader>
              <SheetTitle className="pr-6 text-left text-base">{row.title}</SheetTitle>
              {subtitle ? (
                <SheetDescription className="text-left">{subtitle}</SheetDescription>
              ) : null}
            </SheetHeader>
            <div className="mt-4 space-y-4 text-sm">
              {row.body ? (
                <p className="whitespace-pre-wrap text-foreground/90">{row.body}</p>
              ) : (
                <p className="text-muted-foreground">No additional detail.</p>
              )}
              <dl className="grid grid-cols-3 gap-y-2 rounded-lg border border-border bg-muted/30 p-3 text-xs">
                <dt className="text-muted-foreground">Category</dt>
                <dd className="col-span-2 capitalize">{resolveCategoryIconKey(row)}</dd>
                <dt className="text-muted-foreground">Priority</dt>
                <dd className="col-span-2 capitalize">{row.priority}</dd>
                <dt className="text-muted-foreground">Received</dt>
                <dd className="col-span-2">{new Date(row.created_at).toLocaleString()}</dd>
                <dt className="text-muted-foreground">Status</dt>
                <dd className="col-span-2">
                  {row.archived_at ? "Archived" : row.read_at ? "Read" : "Unread"}
                </dd>
                {source ? (
                  <>
                    <dt className="text-muted-foreground">Source</dt>
                    <dd className="col-span-2">{source}</dd>
                  </>
                ) : null}
                {row.dedupe_key ? (
                  <>
                    <dt className="text-muted-foreground">Ref</dt>
                    <dd className="col-span-2 truncate font-mono text-[10px]">
                      {row.dedupe_key}
                    </dd>
                  </>
                ) : null}
              </dl>
              {row.deep_link ? (
                <Link
                  to={row.deep_link as unknown as never}
                  onClick={() => {
                    onOpenChange(false);
                    onNavigate?.();
                  }}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  <ExternalLink className="size-4" />
                  {defaultActionLabel(row)}
                </Link>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-xl border border-border bg-card p-3"
        >
          <div className="size-9 shrink-0 animate-pulse rounded-lg bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
            <div className="h-3 w-full animate-pulse rounded bg-muted/70" />
            <div className="h-2 w-1/3 animate-pulse rounded bg-muted/50" />
          </div>
        </div>
      ))}
    </div>
  );
}

function sortLabel(s: SortMode): string {
  switch (s) {
    case "newest":
      return "Newest first";
    case "oldest":
      return "Oldest first";
    case "unread":
      return "Unread first";
    case "priority":
      return "Priority first";
  }
}
