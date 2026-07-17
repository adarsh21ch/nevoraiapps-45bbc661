import { createFileRoute, redirect } from "@tanstack/react-router";

// The old /apply/$slug funnel is folded into /register — a single
// public intake with email + password + academy details.
export const Route = createFileRoute("/apply/$slug")({
  beforeLoad: () => {
    throw redirect({ to: "/register" });
  },
});
