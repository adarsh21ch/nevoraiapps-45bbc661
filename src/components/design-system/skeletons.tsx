import { cn } from "@/lib/utils";

/**
 * Reusable skeleton loaders. Use these instead of spinners.
 * All animate via the `ds-shimmer` utility defined in styles.css.
 */

function Bar({ className }: { className?: string }) {
  return <div className={cn("ds-shimmer rounded-md", className)} />;
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-5 space-y-3", className)}>
      <Bar className="h-4 w-1/3" />
      <Bar className="h-8 w-1/2" />
      <Bar className="h-3 w-2/3" />
    </div>
  );
}

export function StatCardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl border border-border bg-card p-4 flex items-center gap-3"
        >
          <Bar className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Bar className="h-3.5 w-1/3" />
            <Bar className="h-3 w-1/2" />
          </div>
          <Bar className="h-6 w-16" />
        </div>
      ))}
    </div>
  );
}

export function TableSkeleton({
  rows = 6,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="border-b border-border p-3 grid gap-3" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Bar key={i} className="h-3 w-2/3" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="border-b last:border-b-0 border-border p-3 grid gap-3"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, c) => (
            <Bar key={c} className="h-4 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-card p-6 flex flex-col sm:flex-row gap-4 items-start">
        <Bar className="size-20 rounded-full" />
        <div className="flex-1 space-y-3 w-full">
          <Bar className="h-6 w-1/3" />
          <Bar className="h-4 w-1/2" />
          <div className="flex gap-2 flex-wrap">
            <Bar className="h-6 w-20 rounded-full" />
            <Bar className="h-6 w-24 rounded-full" />
            <Bar className="h-6 w-16 rounded-full" />
          </div>
        </div>
      </div>
      <StatCardSkeleton />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <StatCardSkeleton />
      <div className="grid gap-4 md:grid-cols-2">
        <CardSkeleton className="h-48" />
        <CardSkeleton className="h-48" />
      </div>
      <ListSkeleton />
    </div>
  );
}
