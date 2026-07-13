import { createFileRoute } from "@tanstack/react-router";
import { Swords, PlusCircle } from "lucide-react";
import { PageHeader, SearchBar } from "@/components/match-center/MatchCenterLayout";
import { EmptyState } from "@/components/match-center/ui";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/match-center/matches")({
  head: () => ({ meta: [{ title: "Matches · Match Center" }, { name: "robots", content: "noindex" }] }),
  component: MatchesPage,
});

function MatchesPage() {
  return (
    <div>
      <PageHeader
        title="Matches"
        description="Every fixture — upcoming, live and completed."
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Matches" },
        ]}
        actions={
          <Button asChild>
            <Link to="/match-center/create">
              <PlusCircle className="size-4 mr-1.5" /> Create match
            </Link>
          </Button>
        }
      />
      <div className="mb-6 max-w-xl">
        <SearchBar placeholder="Search matches by team, ground or date…" />
      </div>
      <EmptyState
        icon={Swords}
        title="No matches have been played"
        description="Create your first match to see it here. Fixtures, results and scorecards will all live in this list."
        actionLabel="Create match"
        actionTo="/match-center/create"
      />
    </div>
  );
}
