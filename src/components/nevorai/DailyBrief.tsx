import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDailyBrief } from "@/lib/nevorai/brief.functions";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles } from "lucide-react";

export function DailyBrief() {
  const fetchBrief = useServerFn(getDailyBrief);
  const q = useQuery({
    queryKey: ["nevorai", "daily-brief"],
    queryFn: () => fetchBrief(),
    staleTime: 5 * 60_000,
  });

  if (q.isLoading) {
    return (
      <Card className="p-5">
        <Skeleton className="mb-3 h-5 w-40" />
        <Skeleton className="mb-2 h-4 w-full" />
        <Skeleton className="mb-2 h-4 w-4/5" />
        <Skeleton className="h-4 w-3/5" />
      </Card>
    );
  }

  const brief = q.data;
  if (!brief) return null;

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border/60 bg-gradient-to-r from-primary/10 via-transparent to-transparent px-5 py-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Today's Brief
        </div>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">{brief.headline}</h2>
      </div>
      <div className="grid grid-cols-1 gap-4 px-5 py-4 md:grid-cols-3">
        {brief.sections.map((s) => (
          <div key={s.id}>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{s.title}</div>
            <div className="mt-1 text-sm text-foreground">{s.body}</div>
          </div>
        ))}
      </div>
      {brief.recommendations.length > 0 && (
        <div className="border-t border-border/60 px-5 py-4">
          <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
            Recommendations
          </div>
          <ul className="space-y-1.5 text-sm">
            {brief.recommendations.map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary">•</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
