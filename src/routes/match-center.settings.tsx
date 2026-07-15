import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { DemoSettingsCard } from "@/components/match-center/demo-settings-card";

export const Route = createFileRoute("/match-center/settings")({
  head: () => ({
    meta: [{ title: "Settings · Match Center" }, { name: "robots", content: "noindex" }],
  }),
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
      <div className="grid gap-4">
        <DemoSettingsCard />
      </div>
    </div>
  );
}
