import type { ReactNode } from "react";
import { useTenantState } from "@/lib/tenant-context";
import { TenantPlaceholder } from "./TenantPlaceholder";
import { DomainNotConfigured } from "./DomainNotConfigured";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { FloatingWhatsApp } from "./FloatingWhatsApp";
import { MobileCtaBar } from "./MobileCtaBar";
import { isReservedPlatformHost } from "@/lib/tenant";

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
    const host = typeof window !== "undefined" ? window.location.hostname : "";
    // Reserved platform host (academy.nevorai.com, nevorai.com, lovable
    // preview URLs…) → platform marketing site. Any other unknown hostname
    // is a misconfigured domain, not an ad for Academy OS.
    return isReservedPlatformHost(host) ? <TenantPlaceholder /> : <DomainNotConfigured />;
  }


  if (state.status === "suspended") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-center">
        <div className="max-w-md">
          <h1 className="text-3xl font-semibold text-white">Temporarily unavailable</h1>
          <p className="mt-3 text-sm text-neutral-400">
            {state.tenant.name} is not accepting online activity right now. Please check back soon,
            or contact the academy directly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1 pb-20 sm:pb-0">{children}</main>
      <SiteFooter />
      <FloatingWhatsApp />
      <MobileCtaBar />
    </div>
  );
}
