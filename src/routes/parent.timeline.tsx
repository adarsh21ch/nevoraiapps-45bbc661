import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  Swords,
  Trophy,
  Medal,
  MessageSquareQuote,
  IndianRupee,
  Search,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchChildTimeline, parentKeys, type TimelineEvent } from "@/lib/parent-app";
import { supabase } from "@/integrations/supabase/client";
import { useParentChild } from "@/hooks/use-parent-child";

export const Route = createFileRoute("/parent/timeline")({
  component: ParentTimelinePage,
});

function ParentTimelinePage() {
  const { child } = useParentChild();
  const [q, setQ] = useState("");

  const tenantBillingQ = useQuery({
    queryKey: child ? ["parent", "tenant-billing", child.tenant_id] : ["parent", "tenant-billing", "none"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tenants")
        .select("show_billing_to_parents")
        .eq("id", child!.tenant_id)
        .maybeSingle();
      return !!(data as { show_billing_to_parents?: boolean } | null)?.show_billing_to_parents;
    },
    enabled: !!child,
  });

  const includeBilling = !!tenantBillingQ.data;

  const timelineQ = useQuery({
    queryKey: child
      ? [...parentKeys.timeline(child.student_id), includeBilling]
      : ["parent", "timeline", "none"],
    queryFn: () => fetchChildTimeline(child!, { includeBilling }),
    enabled: !!child && tenantBillingQ.isSuccess,
  });

  const filtered = useMemo(() => {
    const events = timelineQ.data ?? [];
    if (!q.trim()) return events;
    const needle = q.trim().toLowerCase();
    return events.filter(
      (e) =>
        e.title.toLowerCase().includes(needle) ||
        (e.subtitle ?? "").toLowerCase().includes(needle),
    );
  }, [timelineQ.data, q]);

  const grouped = useMemo(() => groupByMonth(filtered), [filtered]);

  if (!child || timelineQ.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <div className="size-10 rounded-full bg-primary/10 grid place-items-center text-primary">
          <CalendarDays className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Timeline</h1>
          <p className="text-xs text-muted-foreground">
            Everything that happened, in one story.
          </p>
        </div>
      </header>

      <div className="relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search this timeline…"
          className="pl-9"
        />
      </div>

      {grouped.length === 0 ? (
        <Card className="p-6 text-center text-sm text-muted-foreground">
          No events yet.
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ month, events }) => (
            <section key={month}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2 px-1">
                {month}
              </p>
              <ol className="relative border-l pl-4 space-y-3 ml-2">
                {events.map((e) => (
                  <li key={e.id} className="relative">
                    <span className="absolute -left-[22px] top-1 size-3 rounded-full bg-primary/70 ring-2 ring-background" />
                    <Card className="p-3">
                      <div className="flex items-start gap-3">
                        <IconFor kind={e.kind} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{e.title}</p>
                          {e.subtitle && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-3">
                              {e.subtitle}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {new Date(e.at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                      </div>
                    </Card>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function IconFor({ kind }: { kind: TimelineEvent["kind"] }) {
  const cls = "size-8 rounded-full grid place-items-center shrink-0";
  switch (kind) {
    case "attendance":
      return (
        <div className={`${cls} bg-emerald-500/15 text-emerald-600 dark:text-emerald-400`}>
          <CheckCircle2 className="size-4" />
        </div>
      );
    case "match":
      return (
        <div className={`${cls} bg-primary/10 text-primary`}>
          <Swords className="size-4" />
        </div>
      );
    case "achievement":
      return (
        <div className={`${cls} bg-amber-500/15 text-amber-600 dark:text-amber-400`}>
          <Trophy className="size-4" />
        </div>
      );
    case "award":
      return (
        <div className={`${cls} bg-amber-500/15 text-amber-600 dark:text-amber-400`}>
          <Medal className="size-4" />
        </div>
      );
    case "coach_note":
      return (
        <div className={`${cls} bg-primary/10 text-primary`}>
          <MessageSquareQuote className="size-4" />
        </div>
      );
    case "billing":
      return (
        <div className={`${cls} bg-muted text-muted-foreground`}>
          <IndianRupee className="size-4" />
        </div>
      );
    default:
      return (
        <div className={`${cls} bg-muted text-muted-foreground`}>
          <CalendarDays className="size-4" />
        </div>
      );
  }
}

function groupByMonth(events: TimelineEvent[]): { month: string; events: TimelineEvent[] }[] {
  const map = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const d = new Date(e.at);
    const key = d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const arr = map.get(key) ?? [];
    arr.push(e);
    map.set(key, arr);
  }
  return [...map.entries()].map(([month, events]) => ({ month, events }));
}
