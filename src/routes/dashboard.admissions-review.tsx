import { createFileRoute, redirect } from "@tanstack/react-router";

// The Admissions Review tab has been merged into the Registrations tab.
// All admissions capabilities (approve-with-details, request-changes,
// waitlist, reject-with-reason, filter by review status) are now available
// there under a single canonical "Registrations / Admissions" inbox.
// This route stays as a redirect so old links, AI briefs, and bookmarks
// keep working.
export const Route = createFileRoute("/dashboard/admissions-review")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/registrations" });
  },
});
