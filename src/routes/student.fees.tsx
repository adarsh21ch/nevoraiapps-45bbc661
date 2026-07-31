import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CreditCard } from "lucide-react";
import { fetchMyPortalContext, studentKeys } from "@/lib/student-app";
import { BillingPanel } from "@/components/portal/BillingPanel";

export const Route = createFileRoute("/student/fees")({
  head: () => ({
    meta: [
      { title: "Fees — My Academy" },
      { name: "description", content: "View and pay your academy invoices." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StudentFeesPage,
});

function StudentFeesPage() {
  const ctxQ = useQuery({ queryKey: studentKeys.me, queryFn: fetchMyPortalContext });

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <div className="size-10 rounded-full bg-primary/10 grid place-items-center text-primary">
          <CreditCard className="size-5" />
        </div>
        <div>
          <h1 className="text-xl font-semibold">Fees</h1>
          <p className="text-xs text-muted-foreground">Invoices, payments and receipts.</p>
        </div>
      </header>
      <BillingPanel child={ctxQ.data ?? null} />
    </div>
  );
}
