import { createFileRoute, Link } from "@tanstack/react-router";
import { ListOrdered, Trophy, Target, Zap } from "lucide-react";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { EmptyState } from "@/components/match-center/ui";
import { useDashboard } from "@/lib/dashboard-context";
import { useDemoData } from "@/lib/mc-demo/store";
import { deriveLeaderboards, type LeaderRow } from "@/lib/mc-demo/derive";

export const Route = createFileRoute("/match-center/leaderboards")({
  head: () => ({ meta: [{ title: "Leaderboards · Match Center" }, { name: "robots", content: "noindex" }] }),
  component: LeaderboardsPage,
});

function LeaderboardsPage() {
  const { tenant } = useDashboard();
  const demo = useDemoData(tenant.id);

  const leaders = demo ? deriveLeaderboards(demo) : null;
  const hasData =
    !!leaders &&
    (leaders.mostRuns.length > 0 || leaders.mostWickets.length > 0 || leaders.mostBoundaries.length > 0);

  return (
    <div>
      <PageHeader
        title="Leaderboards"
        description="Batting, bowling and boundary charts across your academy."
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Leaderboards" },
        ]}
      />
      {!hasData ? (
        <EmptyState
          icon={ListOrdered}
          title="No leaderboards yet"
          description="Once matches are played, top-run scorers, wicket-takers and MVPs will rank here automatically."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <LeaderCard
            icon={Trophy}
            title="Most Runs"
            unit="runs"
            rows={leaders!.mostRuns}
          />
          <LeaderCard
            icon={Target}
            title="Most Wickets"
            unit="wkts"
            rows={leaders!.mostWickets}
          />
          <LeaderCard
            icon={Zap}
            title="Most Boundaries"
            unit="4s+6s"
            rows={leaders!.mostBoundaries}
          />
        </div>
      )}
    </div>
  );
}

function LeaderCard({
  icon: Icon,
  title,
  unit,
  rows,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  unit: string;
  rows: LeaderRow[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
        <Icon className="size-3.5" /> {title}
      </div>
      <ol className="space-y-1">
        {rows.map((r, i) => (
          <li
            key={(r.athleteId ?? r.name) + i}
            className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-accent/40"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-bold tabular-nums">
                {i + 1}
              </span>
              {r.athleteId ? (
                <Link
                  to="/match-center/players/$athleteId"
                  params={{ athleteId: r.athleteId }}
                  className="truncate font-medium hover:text-primary"
                >
                  {r.name}
                </Link>
              ) : (
                <span className="truncate font-medium">{r.name}</span>
              )}
            </div>
            <span className="shrink-0 text-sm font-bold tabular-nums">
              {r.value}
              <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                {unit}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
