import { createFileRoute, redirect } from "@tanstack/react-router";

// Consolidation: the Insights hub was only a page of links to Leaderboards /
// Records / Players / Awards / AI. Those now share one tab bar, so this route
// forwards to the first tab. Kept as a redirect so existing links keep working.
export const Route = createFileRoute("/match-center/insights")({
  beforeLoad: () => {
    throw redirect({ to: "/match-center/leaderboards", replace: true });
  },
  component: () => null,
});
