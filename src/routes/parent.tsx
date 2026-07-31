import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

// The Parent Portal has been merged into the Student portal: one login
// (the student's) now covers progress, matches, timeline and fee payments.
// Legacy /parent/* links, bookmarks and push deep-links redirect here.
const MAP: Record<string, string> = {
  "/parent": "/student",
  "/parent/progress": "/student/progress",
  "/parent/billing": "/student/fees",
  "/parent/timeline": "/student/timeline",
  "/parent/profile": "/student/profile",
};

export const Route = createFileRoute("/parent")({
  beforeLoad: ({ location }) => {
    const to = MAP[location.pathname.replace(/\/$/, "")] ?? "/student";
    throw redirect({ to, replace: true });
  },
  component: () => <Outlet />,
});
