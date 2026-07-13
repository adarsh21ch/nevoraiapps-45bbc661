import { createFileRoute } from "@tanstack/react-router";
import { PlusCircle } from "lucide-react";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { EmptyState } from "@/components/match-center/ui";

export const Route = createFileRoute("/match-center/create")({
  head: () => ({ meta: [{ title: "Create match · Match Center" }, { name: "robots", content: "noindex" }] }),
  component: CreateMatchPage,
});

function CreateMatchPage() {
  return (
    <div>
      <PageHeader
        title="Create a match"
        description="Set up a new fixture — teams, format, ground and toss."
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Create match" },
        ]}
      />
      <EmptyState
        icon={PlusCircle}
        title="Match builder coming soon"
        description="The full match creation wizard will land in the next update. For now this is the placeholder for the flow."
      />
    </div>
  );
}
