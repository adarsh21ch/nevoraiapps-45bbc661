import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveTenantHint, type Tenant } from "./tenant";

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

  const column = hint.mode === "domain" ? "custom_domain" : "slug";
  const { data, error } = await supabase
    .from("tenants")
    .select("*")
    .eq(column, hint.value)
    .maybeSingle();
  if (error) {
    console.error("[tenant] fetch failed", error);
    return null;
  }
  return data;
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
      root.style.setProperty("--brand", t.primary_color);
      root.style.setProperty("--brand-ink", t.secondary_color);
      document.title = t.tagline ? `${t.name} — ${t.tagline}` : t.name;

      // Favicon
      if (t.logo_url) {
        let link = document.querySelector<HTMLLinkElement>('link[rel="icon"][data-tenant]');
        if (!link) {
          link = document.createElement("link");
          link.rel = "icon";
          link.setAttribute("data-tenant", "1");
          document.head.appendChild(link);
        }
        link.href = t.logo_url;
      }

      // Meta description + og
      const setMeta = (attr: "name" | "property", key: string, value: string) => {
        let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"][data-tenant="1"]`);
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
      if (t.logo_url) setMeta("property", "og:image", t.logo_url);
      setMeta("name", "theme-color", t.primary_color);
    } else {
      root.style.removeProperty("--brand");
      root.style.removeProperty("--brand-ink");
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
