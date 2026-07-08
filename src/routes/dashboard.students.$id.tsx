import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { StudentProfilePanel } from "@/components/dashboard/StudentProfilePanel";

export const Route = createFileRoute("/dashboard/students/$id")({
  component: StudentDetail,
});

function StudentDetail() {
  const { id } = Route.useParams();
  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <Link
        to="/dashboard/students"
        className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> All students
      </Link>
      <div className="rounded-2xl bg-white border border-black/[0.06] shadow-sm p-5">
        <StudentProfilePanel studentId={id} />
      </div>
    </div>
  );
}
