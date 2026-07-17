import { createFileRoute, redirect } from "@tanstack/react-router";

// Legacy admins page — Team & Access is now unified under /dashboard/staff
// (Directory · Members · Invitations · Activity).
export const Route = createFileRoute("/dashboard/admins")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/staff" });
  },
});
