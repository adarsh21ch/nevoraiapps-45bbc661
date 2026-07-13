import { createFileRoute } from "@tanstack/react-router";
import { Medal } from "lucide-react";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { EmptyState } from "@/components/match-center/ui";

export const Route = createFileRoute("/match-center/records")({
  head: () => ({ meta: [{ title: "Records · Match Center" }, { name: "robots", content: "noindex" }] }),
  component: RecordsPage,
});

function RecordsPage() {
  return (
    <div>
      <PageHeader
        title="Records"
        description="Milestones, career highs and academy bests."
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Records" },
        ]}
      />
      <EmptyState
        icon={Medal}
        title="No records yet"
        description="Highest scores, best bowling figures and career milestones will be recorded here after each match."
      />
    </div>
  );
}
