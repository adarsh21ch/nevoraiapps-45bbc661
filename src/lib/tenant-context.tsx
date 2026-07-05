import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { resolveTenantHint, type Tenant } from "./tenant";

type TenantState =
  | { status: "loading"; tenant: null }
  | { status: "missing"; tenant: null }
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
    .eq("status", "active")
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
    return { status: "ready", tenant: data };
  }, [isLoading, data]);

  // Inject brand colors as CSS variables + document title
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    if (state.tenant) {
      root.style.setProperty("--brand", state.tenant.primary_color);
      root.style.setProperty("--brand-ink", state.tenant.secondary_color);
      document.title = state.tenant.name;
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
