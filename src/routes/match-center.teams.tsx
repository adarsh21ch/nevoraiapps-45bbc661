import { createFileRoute } from "@tanstack/react-router";
import { Users2, PlusCircle } from "lucide-react";
import { PageHeader, SearchBar } from "@/components/match-center/MatchCenterLayout";
import { EmptyState } from "@/components/match-center/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/match-center/teams")({
  head: () => ({ meta: [{ title: "Teams · Match Center" }, { name: "robots", content: "noindex" }] }),
  component: TeamsPage,
});

function TeamsPage() {
  return (
    <div>
      <PageHeader
        title="Teams"
        description="Squads competing under your academy."
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Teams" },
        ]}
        actions={
          <Button>
            <PlusCircle className="size-4 mr-1.5" /> Create team
          </Button>
        }
      />
      <div className="mb-6 max-w-xl">
        <SearchBar placeholder="Search teams…" />
      </div>
      <EmptyState
        icon={Users2}
        title="No teams created yet"
        description="Build a squad, add players and get them ready for match day."
        actionLabel="Create team"
      />
    </div>
  );
}
