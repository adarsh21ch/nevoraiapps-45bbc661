import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tenant } from "./tenant";

type Profile = { user_id: string; tenant_id: string; role: string };

type DashboardCtx = {
  session: Session;
  profile: Profile;
  tenant: Tenant;
  signOut: () => Promise<void>;
};

const Ctx = createContext<DashboardCtx | null>(null);

export function useDashboard() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDashboard used outside DashboardProvider");
  return v;
}

/** Non-throwing variant — returns null when used outside a DashboardProvider (e.g. public pages). */
export function useDashboardOptional() {
  return useContext(Ctx);
}

export function DashboardProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) navigate({ to: "/auth" });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const uid = session?.user?.id;

  const profileQ = useQuery({
    enabled: !!uid,
    queryKey: ["dashboard-profile", uid],
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, tenant_id, role")
        .eq("user_id", uid!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const tenantId = profileQ.data?.tenant_id;
  const tenantQ = useQuery({
    enabled: !!tenantId,
    queryKey: ["dashboard-tenant", tenantId],
    queryFn: async (): Promise<Tenant | null> => {
      // Explicit column list — avoids `select('*')` so column-level GRANT
      // changes or newly added columns can't silently break tenant reads.
      const { data, error } = await supabase
        .from("tenants")
        .select(
          "id, slug, name, short_name, tagline, custom_domain, logo_url, " +
            "primary_color, secondary_color, niche, features, phone, whatsapp, " +
            "email, address, upi_id, upi_qr_url, status, created_at, fee_cycle, " +
            "monthly_price, setup_fee, billing_day, last_paid_date, " +
            "subscription_status, platform_notes, player_prefix, show_billing_to_parents",
        )
        .eq("id", tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data as Tenant | null;
    },
  });

  // Inject branding — muted premium gold accent, universal light/dark.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const t = tenantQ.data;
    const root = document.documentElement;
    const isDark = root.classList.contains("dark");
    root.style.setProperty("--brand", isDark ? "#F0932B" : "#E8873C");
    root.style.setProperty("--brand-ink", isDark ? "#0f0f0f" : "#ffffff");

    if (t) {
      if (t.primary_color) root.style.setProperty("--tenant-brand", t.primary_color);
      if (t.secondary_color) root.style.setProperty("--tenant-brand-ink", t.secondary_color);
      document.title = `${t.name} · Dashboard`;
    }
  }, [tenantQ.data]);

  if (session === undefined) return <FullPage>Loading…</FullPage>;
  if (session === null) {
    // redirect happens via effect; render nothing meaningful
    if (typeof window !== "undefined") {
      window.location.href = "/auth";
    }
    return <FullPage>Redirecting…</FullPage>;
  }

  if (profileQ.isLoading || tenantQ.isLoading) return <FullPage>Loading your academy…</FullPage>;
  if (!profileQ.data) {
    // Platform admins won't have a tenant profile — send them to their control room.
    if (typeof window !== "undefined") {
      supabase.from("platform_admins").select("user_id").eq("user_id", session.user.id).maybeSingle().then(({ data }) => {
        if (data) window.location.href = "/platform-admin";
      });
    }
    return (
      <FullPage>
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-lg font-semibold">No academy linked to this account</h1>
          <p className="text-sm text-muted-foreground">
            Ask your platform admin to link {session.user.email} to a tenant.
          </p>
          <button
            className="text-sm underline"
            onClick={() => supabase.auth.signOut()}
          >
            Sign out
          </button>
        </div>
      </FullPage>
    );
  }
  if (!tenantQ.data) return <FullPage>Academy not found.</FullPage>;

  const value: DashboardCtx = {
    session,
    profile: profileQ.data,
    tenant: tenantQ.data,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

function FullPage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground p-6">
      <div>{children}</div>
    </div>
  );
}
