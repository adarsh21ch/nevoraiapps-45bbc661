import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchMyPortalContext, studentKeys } from "@/lib/student-app";
import { TimelinePanel } from "@/components/portal/TimelinePanel";

export const Route = createFileRoute("/student/timeline")({
  head: () => ({
    meta: [
      { title: "Timeline — My Academy" },
      { name: "description", content: "Your academy journey, in one story." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentTimelinePage,
});

function StudentTimelinePage() {
  const ctxQ = useQuery({ queryKey: studentKeys.me, queryFn: fetchMyPortalContext });
  return <TimelinePanel child={ctxQ.data ?? null} />;
}
