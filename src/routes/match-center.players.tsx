import { createFileRoute } from "@tanstack/react-router";
import { User, PlusCircle } from "lucide-react";
import { PageHeader, SearchBar } from "@/components/match-center/MatchCenterLayout";
import { EmptyState } from "@/components/match-center/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/match-center/players")({
  head: () => ({ meta: [{ title: "Players · Match Center" }, { name: "robots", content: "noindex" }] }),
  component: PlayersPage,
});

function PlayersPage() {
  return (
    <div>
      <PageHeader
        title="Players"
        description="Every player on your roster with match-ready profiles."
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Players" },
        ]}
        actions={
          <Button>
            <PlusCircle className="size-4 mr-1.5" /> Add player
          </Button>
        }
      />
      <div className="mb-6 max-w-xl">
        <SearchBar placeholder="Search players by name, role or team…" />
      </div>
      <EmptyState
        icon={User}
        title="No players yet"
        description="Players from your academy will appear here as they are added to teams and matches."
        actionLabel="Add a player"
      />
    </div>
  );
}
