import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { getDailyBrief } from "@/lib/nevorai/brief.functions";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const toneClasses: Record<string, string> = {
  default: "text-foreground",
  positive: "text-emerald-600 dark:text-emerald-400",
  warning: "text-amber-600 dark:text-amber-400",
  danger: "text-rose-600 dark:text-rose-400",
};

export function QuickInsights() {
  const fetchBrief = useServerFn(getDailyBrief);
  const q = useQuery({
    queryKey: ["nevorai", "daily-brief"],
    queryFn: () => fetchBrief(),
    staleTime: 5 * 60_000,
  });

  if (q.isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const insights = q.data?.insights ?? [];
  if (insights.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {insights.map((i) => {
        const inner = (
          <Card className="group h-full p-4 transition hover:border-primary/40 hover:shadow-md">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{i.label}</div>
            <div
              className={cn("mt-1 text-2xl font-semibold tracking-tight", toneClasses[i.tone ?? "default"])}
            >
              {i.value}
            </div>
          </Card>
        );
        return i.href ? (
          <Link key={i.id} to={i.href} className="block">
            {inner}
          </Link>
        ) : (
          <div key={i.id}>{inner}</div>
        );
      })}
    </div>
  );
}
