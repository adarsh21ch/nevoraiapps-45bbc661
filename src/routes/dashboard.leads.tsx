import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/leads")({
  loader: () => {
    throw redirect({ to: "/dashboard/registrations", replace: true });
  },
});

