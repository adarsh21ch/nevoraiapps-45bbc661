import { createFileRoute } from "@tanstack/react-router";
import { ListOrdered } from "lucide-react";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { EmptyState } from "@/components/match-center/ui";

export const Route = createFileRoute("/match-center/leaderboards")({
  head: () => ({ meta: [{ title: "Leaderboards · Match Center" }, { name: "robots", content: "noindex" }] }),
  component: LeaderboardsPage,
});

function LeaderboardsPage() {
  return (
    <div>
      <PageHeader
        title="Leaderboards"
        description="Batting, bowling and all-rounder charts across your academy."
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Leaderboards" },
        ]}
      />
      <EmptyState
        icon={ListOrdered}
        title="No leaderboards yet"
        description="Once matches are played, top-run scorers, wicket-takers and MVPs will rank here automatically."
      />
    </div>
  );
}
