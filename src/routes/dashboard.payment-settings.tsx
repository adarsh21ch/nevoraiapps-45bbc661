import { createFileRoute, redirect } from "@tanstack/react-router";

/** Legacy deep link — the Fees hub now owns this surface as an in-page tab. */
export const Route = createFileRoute("/dashboard/payment-settings")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/fees", search: { tab: "setup" }, replace: true });
  },
});
