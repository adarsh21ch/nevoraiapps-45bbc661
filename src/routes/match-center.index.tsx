import { createFileRoute, redirect } from "@tanstack/react-router";

// Phase 03.0 — Match Center home is now the polished dashboard route.
export const Route = createFileRoute("/match-center/")({
  beforeLoad: () => {
    throw redirect({ to: "/match-center/dashboard" });
  },
});
