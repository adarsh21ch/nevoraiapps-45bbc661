import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Radio, PlusCircle, Trophy } from "lucide-react";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { EmptyState, LoadingSkeleton } from "@/components/match-center/ui";
import { Button } from "@/components/ui/button";
import { useDashboard } from "@/lib/dashboard-context";
import { listMatches } from "@/lib/mc-matches";
import { useDemoOverlay } from "@/lib/mc-demo/overlay";

export const Route = createFileRoute("/match-center/live")({
  head: () => ({ meta: [{ title: "Live · Match Center" }, { name: "robots", content: "noindex" }] }),
  component: LivePage,
});

function LivePage() {
  const { tenant } = useDashboard();
  const matchesQ = useQuery({
    queryKey: ["mc-matches", tenant.id],
    queryFn: () => listMatches(tenant.id),
    refetchInterval: 15000,
  });

  const overlaid = useDemoOverlay(tenant.id, matchesQ.data, (d) => d.matches);
  const live = useMemo(
    () => overlaid.filter((m) => m.status === "live"),
    [overlaid],
  );
  const completed = useMemo(
    () => overlaid.filter((m) => m.status === "completed").slice(0, 8),
    [overlaid],
  );

  return (
    <div>
      <PageHeader
        title="Live matches"
        description="Follow every ball as it happens."
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Live" },
        ]}
        actions={
          <Button asChild>
            <Link to="/match-center/create">
              <PlusCircle className="size-4 mr-1.5" /> Start match
            </Link>
          </Button>
        }
      />

      {matchesQ.isLoading ? (
        <LoadingSkeleton rows={3} />
      ) : live.length === 0 ? (
        <EmptyState
          icon={Radio}
          title="No live matches right now"
          description="When a match goes live, its scorer, commentary and stats appear here."
          actionLabel="Start a match"
          actionTo="/match-center/create"
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {live.map((m) => (
            <div key={m.id} className="rounded-xl border bg-card p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-red-500">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-red-500" />
                </span>
                LIVE
              </div>
              <div className="mt-1 text-lg font-semibold">
                {m.team_a?.name ?? "Team A"} <span className="text-muted-foreground">vs</span> {m.team_b?.name ?? "Team B"}
              </div>
              <div className="text-xs text-muted-foreground">
                {[m.match_format, m.ground_name, m.match_type].filter(Boolean).join(" · ")}
              </div>
              <div className="mt-3 flex gap-2">
                <Button asChild size="sm">
                  <Link to="/scorer/$matchId" params={{ matchId: m.id }}>
                    <Radio className="mr-1.5 size-3.5" /> Open scorer
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Trophy className="size-4 text-primary" /> Recently completed
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {completed.map((m) => (
              <Link
                key={m.id}
                to="/scorer/$matchId"
                params={{ matchId: m.id }}
                className="rounded-xl border bg-card p-4 transition hover:bg-accent"
              >
                <div className="text-sm font-semibold">
                  {m.team_a?.name ?? "Team A"} vs {m.team_b?.name ?? "Team B"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {[m.match_format, m.scheduled_date, m.ground_name].filter(Boolean).join(" · ")}
                </div>
                {m.result && (
                  <div className="mt-2 text-xs font-medium text-primary">{m.result}</div>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                  {(m as { match_locked?: boolean }).match_locked && (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-600 dark:text-emerald-400">
                      Final
                    </span>
                  )}
                  {m.match_type && (
                    <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                      {m.match_type}
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
