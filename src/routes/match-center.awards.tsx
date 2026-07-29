import { createFileRoute, redirect } from "@tanstack/react-router";

// Consolidation: Awards and Recognitions were two views of the same data.
// /match-center/recognition is now the single Awards surface (published
// awards, certificates, badges, templates). This route redirects so old
// links, AI hrefs and bookmarks keep resolving.
export const Route = createFileRoute("/match-center/awards")({
  beforeLoad: () => {
    throw redirect({ to: "/match-center/recognition", replace: true });
  },
  component: () => null,
});
