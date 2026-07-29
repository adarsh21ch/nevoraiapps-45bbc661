import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy deep link — the Fees hub now owns this surface as an in-page tab. */
export const Route = createFileRoute("/dashboard/fee-plans")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/fees", search: { tab: "plans" }, replace: true });
  },
});
