import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveTenantHint, type Tenant } from "./tenant";
import { pickPreset } from "./theme-presets";

type TenantState =
  | { status: "loading"; tenant: null }
  | { status: "missing"; tenant: null }
  | { status: "suspended"; tenant: Tenant }
  | { status: "ready"; tenant: Tenant };

const TenantContext = createContext<TenantState>({ status: "loading", tenant: null });

async function fetchTenant(): Promise<Tenant | null> {
  if (typeof window === "undefined") return null;
  const hint = resolveTenantHint({
    hostname: window.location.hostname,
    pathname: window.location.pathname,
    search: window.location.search,
  });
  if (!hint) return null;

  // Domain mode: exact custom_domain match. Slug mode: match the subdomain slug OR a
  // custom_domain equal to the full hostname, so any platform subdomain typed into the
  // tenant's custom-domain field resolves instantly even when it differs from the slug.
  const hostname = window.location.hostname;
  // Anon reads go through the tenants_public_directory view, which exposes only
  // marketing-safe columns. Sensitive billing/subscription fields on the
  // tenants table are not accessible to anon or cross-tenant users.
  const PUBLIC_COLS =
    "id, slug, name, short_name, tagline, custom_domain, logo_url, primary_color, secondary_color, niche, features, phone, whatsapp, email, address, upi_id, upi_qr_url, status, fee_cycle, player_prefix";
  const from = supabase.from("tenants_public_directory" as never);
  const query =
    hint.mode === "domain"
      ? (from.select(PUBLIC_COLS) as any).eq("custom_domain", hint.value)
      : (from.select(PUBLIC_COLS) as any).or(`slug.eq.${hint.value},custom_domain.eq.${hostname}`);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) {
    console.error("[tenant] fetch failed", error);
    return null;
  }
  return data as unknown as Tenant | null;
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const { data, isLoading } = useQuery({
    queryKey: ["current-tenant"],
    queryFn: fetchTenant,
    staleTime: 5 * 60 * 1000,
  });

  const state: TenantState = useMemo(() => {
    if (isLoading) return { status: "loading", tenant: null };
    if (!data) return { status: "missing", tenant: null };
    if (data.status !== "active") return { status: "suspended", tenant: data };
    return { status: "ready", tenant: data };
  }, [isLoading, data]);

  // Inject brand colors as CSS variables + document title + favicon + meta description
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (state.tenant) {
      const t = state.tenant;
      // Auto-pick a sport-appropriate palette from niche + slug.
      // Existing per-tenant primary_color still wins so owners keep control.
      const preset = pickPreset(t.niche, t.slug);
      root.style.setProperty("--brand", t.primary_color || preset.primary);
      root.style.setProperty("--brand-ink", t.secondary_color || preset.ink);
      root.style.setProperty("--brand-accent", preset.accent);
      root.style.setProperty("--brand-surface", preset.surface);
      document.title = t.tagline ? `${t.name} — ${t.tagline}` : t.name;
      const tenantIconUrl = t.logo_url
        ? `/api/public/tenant-icon?tenant=${encodeURIComponent(t.slug)}&v=${encodeURIComponent(
            t.logo_url.split("/").pop() ?? t.slug,
          )}`
        : "";

      // Favicon / app icons. Tenant logos are stored as private storage paths,
      // so resolve them before using them in browser chrome metadata.
      if (t.logo_url) {
        let link = document.querySelector<HTMLLinkElement>('link[rel="icon"][data-tenant]');
        if (!link) {
          link = document.createElement("link");
          link.rel = "icon";
          link.setAttribute("data-tenant", "1");
          document.head.appendChild(link);
        }
        link.href = tenantIconUrl;
      }

      // Meta description + og
      const setMeta = (attr: "name" | "property", key: string, value: string) => {
        let el = document.head.querySelector<HTMLMetaElement>(
          `meta[${attr}="${key}"][data-tenant="1"]`,
        );
        if (!el) el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
        if (!el) {
          el = document.createElement("meta");
          el.setAttribute(attr, key);
          el.setAttribute("data-tenant", "1");
          document.head.appendChild(el);
        }
        el.content = value;
      };
      const desc = t.tagline ?? `${t.name} — register online, view fees, and get in touch.`;
      setMeta("name", "description", desc);
      setMeta("property", "og:title", t.name);
      setMeta("property", "og:description", desc);
      setMeta("property", "og:type", "website");
      setMeta("name", "theme-color", t.primary_color);

      // PWA / Add-to-Home-Screen — per-tenant manifest so each academy installs
      // with its own name, icon and colors on the phone home screen.
      const setLink = (rel: string, href: string, extra?: Record<string, string>) => {
        let el = document.head.querySelector<HTMLLinkElement>(
          `link[rel="${rel}"][data-tenant="1"]`,
        );
        if (!el) {
          el = document.createElement("link");
          el.rel = rel;
          el.setAttribute("data-tenant", "1");
          document.head.appendChild(el);
        }
        el.href = href;
        if (extra) for (const [k, v] of Object.entries(extra)) el.setAttribute(k, v);
      };
      setLink("manifest", "/api/public/manifest/webmanifest");
      if (tenantIconUrl) setLink("apple-touch-icon", tenantIconUrl);
      setMeta("name", "apple-mobile-web-app-capable", "yes");
      setMeta("name", "apple-mobile-web-app-title", t.name);
      setMeta("name", "apple-mobile-web-app-status-bar-style", "black-translucent");
    } else {
      root.style.removeProperty("--brand");
      root.style.removeProperty("--brand-ink");
      root.style.removeProperty("--brand-accent");
      root.style.removeProperty("--brand-surface");
    }
  }, [state.tenant]);

  return <TenantContext.Provider value={state}>{children}</TenantContext.Provider>;
}

export function useTenantState() {
  return useContext(TenantContext);
}

/** Throws-friendly hook: only call inside components that already checked status === "ready". */
export function useTenant(): Tenant {
  const s = useContext(TenantContext);
  if (s.status !== "ready" || !s.tenant) {
    throw new Error("useTenant called before tenant was loaded");
  }
  return s.tenant;
}
