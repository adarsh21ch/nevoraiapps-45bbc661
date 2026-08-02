import { createFileRoute, redirect } from "@tanstack/react-router";

// Consolidation: this dashboard "Insights & Records" page was a second hub of
// links to the very same Match Center screens (Leaderboards / Records /
// Awards / Players). Match Center already exposes them under one tab bar, so
// this route now forwards there instead of duplicating navigation.
export const Route = createFileRoute("/dashboard/insights")({
  beforeLoad: () => {
    throw redirect({ to: "/match-center/leaderboards", replace: true });
  },
  component: () => null,
});
