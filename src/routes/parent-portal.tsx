import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy standalone parent portal — merged into the Student portal.
export const Route = createFileRoute("/parent-portal")({
  beforeLoad: () => {
    throw redirect({ to: "/student", replace: true });
  },
  component: () => null,
});
