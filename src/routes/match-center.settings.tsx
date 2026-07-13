import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { EmptyState } from "@/components/match-center/ui";

export const Route = createFileRoute("/match-center/settings")({
  head: () => ({ meta: [{ title: "Settings · Match Center" }, { name: "robots", content: "noindex" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div>
      <PageHeader
        title="Match Center settings"
        description="Sport, formats, scoring rules and integrations."
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Settings" },
        ]}
      />
      <EmptyState
        icon={Settings}
        title="Nothing to configure yet"
        description="Sport-specific rules and preferences will land here as modules are built out."
      />
    </div>
  );
}
