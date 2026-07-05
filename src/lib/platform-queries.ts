import { supabase } from "@/integrations/supabase/client";
import type { Tenant } from "./tenant";

export const pqk = {
  tenants: ["platform", "tenants"] as const,
  tenant: (id: string) => ["platform", "tenant", id] as const,
  priceLog: (id: string) => ["platform", "price-log", id] as const,
  mrr: ["platform", "mrr"] as const,
  isAdmin: (uid: string) => ["platform", "is-admin", uid] as const,
};

export type TenantRow = Tenant & { student_count?: number };

export async function fetchTenants(): Promise<TenantRow[]> {
  const { data, error } = await supabase
    .from("tenants")
    .select("*, students(count)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((t: any) => ({
    ...t,
    student_count: Array.isArray(t.students) ? (t.students[0]?.count ?? 0) : 0,
  }));
}

export async function fetchTenantById(id: string): Promise<Tenant | null> {
  const { data, error } = await supabase.from("tenants").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function fetchPriceLog(tenantId: string) {
  const { data, error } = await supabase
    .from("tenant_price_changes")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function isPlatformAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("platform_admins")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return false;
  return !!data;
}
