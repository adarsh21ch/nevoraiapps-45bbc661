import { createFileRoute, redirect } from "@tanstack/react-router";

// Consolidation: logo, favicon, brand colour and public-site theme are all
// edited on the Website page (/dashboard/site). This route was a stub that
// only linked elsewhere, so it now redirects to the canonical surface.
export const Route = createFileRoute("/dashboard/branding")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/site", replace: true });
  },
  head: () => ({
    meta: [{ title: "Branding · Academy" }, { name: "robots", content: "noindex" }],
  }),
  component: () => null,
});
