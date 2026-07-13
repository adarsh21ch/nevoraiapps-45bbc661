import { createFileRoute } from "@tanstack/react-router";
import { Radio, PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { EmptyState } from "@/components/match-center/ui";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/match-center/live")({
  head: () => ({ meta: [{ title: "Live · Match Center" }, { name: "robots", content: "noindex" }] }),
  component: LivePage,
});

function LivePage() {
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
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/scorer/$matchId" params={{ matchId: "demo" }}>
                <Radio className="size-4 mr-1.5" /> Open scorer (demo)
              </Link>
            </Button>
            <Button asChild>
              <Link to="/match-center/create">
                <PlusCircle className="size-4 mr-1.5" /> Start match
              </Link>
            </Button>
          </div>
        }
      />
      <EmptyState
        icon={Radio}
        title="No live matches right now"
        description="Once a match goes live, the scorecard, commentary and stats will appear here in real time."
        actionLabel="Start a match"
        actionTo="/match-center/create"
      />
    </div>
  );
}
