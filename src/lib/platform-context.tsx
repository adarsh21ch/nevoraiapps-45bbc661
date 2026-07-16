import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { isPlatformAdmin, pqk } from "./platform-queries";

type Ctx = { session: Session; signOut: () => Promise<void> };

const PlatformCtx = createContext<Ctx | null>(null);

export function usePlatform() {
  const v = useContext(PlatformCtx);
  if (!v) throw new Error("usePlatform used outside PlatformProvider");
  return v;
}

export function PlatformProvider({ children }: { children: ReactNode }) {
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
  const adminQ = useQuery({
    enabled: !!uid,
    queryKey: uid ? pqk.isAdmin(uid) : ["platform", "is-admin", "-"],
    queryFn: () => isPlatformAdmin(uid!),
  });

  if (session === undefined) return <Full>Loading…</Full>;
  if (session === null) {
    if (typeof window !== "undefined") window.location.href = "/auth?redirect=/platform-admin";
    return <Full>Redirecting…</Full>;
  }
  if (adminQ.isLoading) return <Full>Verifying access…</Full>;
  if (!adminQ.data) {
    return (
      <Full>
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-lg font-semibold">Access denied</h1>
          <p className="text-sm text-muted-foreground">
            {session.user.email} is not a platform administrator.
          </p>
          <button className="text-sm underline" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </Full>
    );
  }

  const value: Ctx = {
    session,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };
  return <PlatformCtx.Provider value={value}>{children}</PlatformCtx.Provider>;
}

function Full({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh grid place-items-center bg-background text-foreground p-6">
      <div>{children}</div>
    </div>
  );
}
