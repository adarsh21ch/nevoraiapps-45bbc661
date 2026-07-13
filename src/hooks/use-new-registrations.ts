import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Single source of truth for the "new registration" notification badge.
 *
 * Only registrations with status = 'new' contribute to the count.
 * Once the Registrations inbox is opened they are flipped to 'reviewed'
 * (see markRegistrationsReviewed) — they never come back to 'new'.
 *
 * A single Realtime subscription is installed per tenant; every consumer
 * shares the same React Query cache entry, so header, sidebar, bottom
 * nav and dashboard banner always render an identical number.
 */
export function newRegsQueryKey(tenantId: string) {
  return ["d", "regs-new-count", tenantId] as const;
}

export function useNewRegistrationsCount(tenantId: string) {
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: newRegsQueryKey(tenantId),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("status", "new");
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!tenantId) return;
    const channel = supabase
      .channel(`reg-notify:${tenantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "registrations", filter: `tenant_id=eq.${tenantId}` },
        () => {
          qc.invalidateQueries({ queryKey: newRegsQueryKey(tenantId) });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, qc]);

  return q.data ?? 0;
}

/**
 * Flip every NEW registration for the tenant to REVIEWED. Called when the
 * Registrations inbox mounts — matches Gmail/WhatsApp/Slack behaviour.
 */
export async function markRegistrationsReviewed(tenantId: string) {
  const { error } = await supabase
    .from("registrations")
    .update({ status: "reviewed" })
    .eq("tenant_id", tenantId)
    .eq("status", "new");
  if (error) throw error;
}
