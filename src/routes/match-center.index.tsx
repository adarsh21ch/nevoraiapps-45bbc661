import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Match Center root — redirects to dashboard.
 */
export const Route = createFileRoute("/match-center/")({
  beforeLoad: () => {
    throw redirect({ to: "/match-center/dashboard" });
  },
});
