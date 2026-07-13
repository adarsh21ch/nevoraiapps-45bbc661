import { createFileRoute } from "@tanstack/react-router";
import { Trophy, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { EmptyState } from "@/components/match-center/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/match-center/tournaments")({
  head: () => ({ meta: [{ title: "Tournaments · Match Center" }, { name: "robots", content: "noindex" }] }),
  component: TournamentsPage,
});

function TournamentsPage() {
  return (
    <div>
      <PageHeader
        title="Tournaments"
        description="Leagues, knockouts and series run under your academy."
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Tournaments" },
        ]}
        actions={
          <Button>
            <PlusCircle className="size-4 mr-1.5" /> Create tournament
          </Button>
        }
      />
      <EmptyState
        icon={Trophy}
        title="No tournaments yet"
        description="Set up a tournament with fixtures, brackets and standings, all in one place."
        actionLabel="Create tournament"
      />
    </div>
  );
}
