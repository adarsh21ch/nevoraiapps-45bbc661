import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useCurrentRole } from "@/hooks/use-current-role";
import { Card } from "@/components/ui/card";
import { Lock } from "lucide-react";

/**
 * Owner-only gate. Redirects Admins away from financial routes and renders
 * a friendly placeholder while the navigation happens. Owners see children.
 *
 * Data access is still enforced by RLS + `is_tenant_owner`; this is purely
 * a UX gate so admins don't see billing/fees/subscription/reports UI.
 */
export function OwnerOnly({ children, redirectTo = "/dashboard" }: { children: ReactNode; redirectTo?: string }) {
  const role = useCurrentRole();
  const navigate = useNavigate();
  useEffect(() => {
    if (role === "admin" || role === "student") {
      navigate({ to: redirectTo, replace: true });
    }
  }, [role, navigate, redirectTo]);

  if (role === "owner") return <>{children}</>;
  return (
    <Card className="p-10 text-center space-y-2">
      <Lock className="size-6 mx-auto text-muted-foreground" />
      <div className="text-sm font-semibold">Owner-only area</div>
      <p className="text-xs text-muted-foreground">
        Financial and subscription tools are visible to the academy owner.
      </p>
    </Card>
  );
}
