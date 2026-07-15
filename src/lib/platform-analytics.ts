import { supabase } from "@/integrations/supabase/client";

export type PlatformStats = {
  total_tenants: number;
  active_tenants: number;
  suspended_tenants: number;
  trial_tenants: number;
  total_students: number;
  total_admins: number;
  total_parents: number;
  campaigns_sent: number;
  notifications_30d: number;
  mrr: number;
  mrr_collected: number;
  latest_signups: Array<{
    id: string;
    name: string;
    slug: string;
    created_at: string;
    status: string;
  }>;
};

export const analyticsKeys = {
  stats: ["platform", "stats"] as const,
  tenantUsage: (id: string) => ["platform", "usage", id] as const,
};

export async function fetchPlatformStats(): Promise<PlatformStats> {
  const { data, error } = await supabase.rpc("get_platform_stats" as any);
  if (error) throw error;
  return data as unknown as PlatformStats;
}

export type TenantUsage = {
  students: number;
  admins: number;
  parents: number;
  notifications_30d: number;
  campaigns: number;
};

export async function fetchTenantUsage(tenantId: string): Promise<TenantUsage> {
  const [students, admins, parents, notifs, camps] = await Promise.all([
    supabase
      .from("students")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .is("archived_at", null),
    supabase
      .from("profiles")
      .select("user_id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
    supabase
      .from("mc_parent_links")
      .select("id", { count: "exact", head: true })
      .eq("academy_id", tenantId),
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("created_at", new Date(Date.now() - 30 * 86400_000).toISOString()),
    supabase
      .from("comm_campaigns")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId),
  ]);
  return {
    students: students.count ?? 0,
    admins: admins.count ?? 0,
    parents: parents.count ?? 0,
    notifications_30d: notifs.count ?? 0,
    campaigns: camps.count ?? 0,
  };
}
