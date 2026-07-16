import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getPriorities } from "@/lib/nevorai/priorities.functions";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, ChevronRight, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

const sevRing: Record<string, string> = {
  critical: "border-l-rose-500",
  warning: "border-l-amber-500",
  info: "border-l-primary/60",
};

export function TodaysPriorities() {
  const fetchPriorities = useServerFn(getPriorities);
  const q = useQuery({
    queryKey: ["nevorai", "priorities"],
    queryFn: () => fetchPriorities(),
    staleTime: 60_000,
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
        <ListChecks className="h-4 w-4 text-primary" />
        <div className="text-sm font-semibold tracking-tight">Today's Priorities</div>
      </div>
      <div className="divide-y divide-border/60">
        {q.isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : (q.data ?? []).length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            No urgent items. Everything looks calm today.
          </div>
        ) : (
          (q.data ?? []).map((p) => (
            <Link
              key={p.id}
              to={p.action.href}
              className={cn(
                "flex items-center gap-3 border-l-4 px-4 py-3 transition hover:bg-muted/40",
                sevRing[p.severity] ?? "border-l-primary/40",
              )}
            >
              <AlertTriangle
                className={cn(
                  "h-4 w-4 shrink-0",
                  p.severity === "critical"
                    ? "text-rose-500"
                    : p.severity === "warning"
                    ? "text-amber-500"
                    : "text-primary",
                )}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-foreground">{p.title}</div>
                <div className="truncate text-xs text-muted-foreground">{p.detail}</div>
              </div>
              <span className="hidden text-xs font-medium text-primary sm:inline">
                {p.action.label}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))
        )}
      </div>
    </Card>
  );
}
