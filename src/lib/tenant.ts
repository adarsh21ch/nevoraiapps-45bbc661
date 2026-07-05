import type { Database } from "@/integrations/supabase/types";

export type Tenant = Database["public"]["Tables"]["tenants"]["Row"];
export type FeePlan = Database["public"]["Tables"]["fee_plans"]["Row"];
export type Batch = Database["public"]["Tables"]["batches"]["Row"];
export type SiteContent = Database["public"]["Tables"]["site_content"]["Row"];

export type TenantFeatures = {
  online_registration?: boolean;
  fee_tracking?: boolean;
  whatsapp_reminders?: boolean;
  attendance?: boolean;
  powered_by_badge?: boolean;
};

export function getFeatures(t: Tenant | null | undefined): TenantFeatures {
  if (!t || typeof t.features !== "object" || t.features === null) return {};
  return t.features as TenantFeatures;
}

/**
 * Resolve which tenant slug to load for the current request.
 * Priority: custom_domain match → {slug}.host → path /a/{slug} → ?tenant=slug.
 * Returns { mode: "domain"|"slug", value } or null if no hint found.
 */
export function resolveTenantHint(input: {
  hostname: string;
  pathname: string;
  search: string;
  platformHosts?: string[];
}): { mode: "domain" | "slug"; value: string } | null {
  const { hostname, pathname, search } = input;
  // Wildcard-subdomain base domain (e.g. "nevorai.com" → sai-sports.nevorai.com resolves by slug).
  // Set VITE_PLATFORM_BASE_DOMAIN when deploying behind a *.base-domain DNS record.
  const envBase =
    typeof import.meta !== "undefined"
      ? (import.meta.env?.VITE_PLATFORM_BASE_DOMAIN as string | undefined)
      : undefined;
  const platformHosts = input.platformHosts ?? [
    ...(envBase ? [envBase] : []),
    "localhost",
    "127.0.0.1",
    "lovable.app",
    "lovable.dev",
    "lovableproject.com",
  ];

  // Query param wins for local testing
  const params = new URLSearchParams(search);
  const qTenant = params.get("tenant");
  if (qTenant) return { mode: "slug", value: qTenant };

  // Path-based /a/{slug}
  const pathMatch = pathname.match(/^\/a\/([^/]+)/);
  if (pathMatch) return { mode: "slug", value: pathMatch[1] };

  // Subdomain: {slug}.platform.tld (only when the base host is a known platform host)
  const isPlatformHost = platformHosts.some((h) => hostname === h || hostname.endsWith("." + h));
  if (isPlatformHost) {
    // e.g. kirkland-cricket.something.lovable.app
    const parts = hostname.split(".");
    // Ignore lovable preview subdomains like id-preview--xxx.lovable.app
    if (parts.length > 2 && !parts[0].includes("--") && !parts[0].startsWith("id-preview")) {
      const first = parts[0];
      if (first && first !== "www") return { mode: "slug", value: first };
    }
    return null;
  }

  // External hostname → treat as a possible custom domain
  return { mode: "domain", value: hostname };
}
