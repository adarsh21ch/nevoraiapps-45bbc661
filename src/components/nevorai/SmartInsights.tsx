import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getSmartInsights } from "@/lib/nevorai/trends.functions";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownRight, ArrowUpRight, Minus, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const dirIcon = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: Minus,
} as const;
const dirTone = {
  up: "text-emerald-600 dark:text-emerald-400",
  down: "text-rose-600 dark:text-rose-400",
  flat: "text-muted-foreground",
} as const;

export function SmartInsights() {
  const fetchInsights = useServerFn(getSmartInsights);
  const q = useQuery({
    queryKey: ["nevorai", "smart-insights"],
    queryFn: () => fetchInsights(),
    staleTime: 5 * 60_000,
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
        <TrendingUp className="h-4 w-4 text-primary" />
        <div className="text-sm font-semibold tracking-tight">Smart Insights</div>
      </div>
      <div className="grid grid-cols-1 gap-0 md:grid-cols-3">
        {q.isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border-r border-border/60 p-4 last:border-r-0">
                <Skeleton className="mb-2 h-4 w-24" />
                <Skeleton className="mb-2 h-6 w-20" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))
          : (q.data ?? []).map((ins) => {
              const Icon = dirIcon[ins.direction];
              return (
                <div
                  key={ins.id}
                  className="flex flex-col gap-2 border-b border-border/60 p-4 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
                >
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {ins.title}
                  </div>
                  <div className="flex items-baseline gap-2">
                    <div className="text-xl font-semibold tracking-tight">{ins.metric}</div>
                    <div className={cn("flex items-center gap-0.5 text-xs", dirTone[ins.direction])}>
                      <Icon className="h-3.5 w-3.5" />
                      {ins.delta}
                    </div>
                  </div>
                  <Link
                    to={ins.recommendation.href}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    → {ins.recommendation.label}
                  </Link>
                </div>
              );
            })}
      </div>
    </Card>
  );
}
