import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/match-center/")({
  beforeLoad: () => {
    throw redirect({ to: "/match-center/live" });
  },
});
