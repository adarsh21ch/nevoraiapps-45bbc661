import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ShieldCheck, ArrowLeft, Lock } from "lucide-react";
import { Card } from "@/components/ds/Card";
import { useDashboard } from "@/lib/dashboard-context";
import { isOwner } from "@/lib/roles";

export const Route = createFileRoute("/dashboard/admins")({
  head: () => ({ meta: [{ title: "Admin Management · Academy" }, { name: "robots", content: "noindex" }] }),
  component: AdminsEntry,
});

function AdminsEntry() {
  const { profile } = useDashboard();
  const navigate = useNavigate();
  const owner = isOwner(profile);

  useEffect(() => {
    if (!owner) navigate({ to: "/dashboard/academy", replace: true });
  }, [owner, navigate]);

  if (!owner) {
    return (
      <div className="grid place-items-center py-16 text-center text-muted-foreground">
        <Lock className="size-5 mb-2" />
        <p className="text-sm">Owner-only area</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link to="/dashboard/academy" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Academy
      </Link>
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <div className="size-11 rounded-xl grid place-items-center" style={{ backgroundColor: "color-mix(in oklab, var(--brand) 12%, transparent)", color: "var(--brand)" }}>
            <ShieldCheck className="size-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Admin Management</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create, suspend, remove admins, reset passwords, and view admin activity. Only the Owner can access this.
            </p>
            <ul className="mt-4 space-y-1.5 text-sm">
              {["Create Admin", "Remove Admin", "Suspend Admin", "Reset Password", "Admin Activity"].map((f) => (
                <li key={f} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                  <span>{f}</span>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Soon</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
