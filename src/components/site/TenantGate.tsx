import type { ReactNode } from "react";
import { useTenantState } from "@/lib/tenant-context";
import { TenantPlaceholder } from "./TenantPlaceholder";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

/**
 * Wraps public site pages: shows a placeholder when no tenant is resolved,
 * otherwise renders the branded header/footer around the page.
 */
export function TenantGate({ children }: { children: ReactNode }) {
  const state = useTenantState();

  if (state.status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
      </div>
    );
  }

  if (state.status === "missing") {
    return <TenantPlaceholder />;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
