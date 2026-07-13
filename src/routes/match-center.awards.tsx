import { createFileRoute } from "@tanstack/react-router";
import { Award } from "lucide-react";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { EmptyState } from "@/components/match-center/ui";

export const Route = createFileRoute("/match-center/awards")({
  head: () => ({ meta: [{ title: "Awards · Match Center" }, { name: "robots", content: "noindex" }] }),
  component: AwardsPage,
});

function AwardsPage() {
  return (
    <div>
      <PageHeader
        title="Awards"
        description="Man of the match, player of the series and academy honours."
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Awards" },
        ]}
      />
      <EmptyState
        icon={Award}
        title="No awards handed out yet"
        description="Match-day and tournament awards will show up here as they are given."
      />
    </div>
  );
}
