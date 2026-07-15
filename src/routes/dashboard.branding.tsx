import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Palette, ArrowLeft, Lock } from "lucide-react";
import { Card } from "@/components/ds/Card";
import { useDashboard } from "@/lib/dashboard-context";
import { isOwner } from "@/lib/roles";

export const Route = createFileRoute("/dashboard/branding")({
  head: () => ({ meta: [{ title: "Branding · Academy" }, { name: "robots", content: "noindex" }] }),
  component: BrandingEntry,
});

function BrandingEntry() {
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
      <Link
        to="/dashboard/academy"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Academy
      </Link>
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <div
            className="size-11 rounded-xl grid place-items-center"
            style={{
              backgroundColor: "color-mix(in oklab, var(--brand) 12%, transparent)",
              color: "var(--brand)",
            }}
          >
            <Palette className="size-5" />
          </div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Branding</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Logo, brand color, typography and public-site theme. For now, logo and brand color
              live inside Academy Settings.
            </p>
            <div className="mt-4">
              <Link
                to="/dashboard/settings"
                className="text-sm font-medium"
                style={{ color: "var(--brand)" }}
              >
                Open Academy Settings →
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
