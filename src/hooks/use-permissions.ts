/**
 * Phase 3 — canonical permission hook.
 *
 * Server-side truth: user_roles + has_role() RPC.
 * Client-side: this hook reads the current role from user_roles for the
 * active tenant (falling back to the legacy `profiles.role` bridge, which
 * is now trigger-synced into user_roles). Use `canAccess` from
 * `use-current-role.ts` to gate rendering of restricted features.
 *
 * IMPORTANT: this is a UI-only gate. Every mutation and RPC MUST also
 * enforce the permission server-side via RLS or has_role().
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "admin" | "platform_admin" | "student";

export function usePermissions(tenantId: string | null | undefined) {
  const q = useQuery({
    enabled: !!tenantId,
    queryKey: ["perm", "role", tenantId],
    queryFn: async (): Promise<AppRole> => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).rpc("current_role", {
        _tenant_id: tenantId,
      });
      if (error) throw error;
      return (data as AppRole) ?? "student";
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
  });

  const role = q.data ?? "student";
  return {
    role,
    isOwner: role === "owner",
    isAdmin: role === "admin" || role === "owner",
    isPlatformAdmin: role === "platform_admin",
    isStudent: role === "student",
    isLoading: q.isLoading,
  };
}
