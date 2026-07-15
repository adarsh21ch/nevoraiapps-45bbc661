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

// Explicit column list — avoids `select('*')` so column-level GRANT changes
// or newly added columns can't silently break tenant reads.
const TENANT_COLS =
  "id, slug, name, short_name, tagline, custom_domain, logo_url, " +
  "primary_color, secondary_color, niche, features, phone, whatsapp, " +
  "email, address, upi_id, upi_qr_url, status, created_at, fee_cycle, " +
  "monthly_price, setup_fee, billing_day, last_paid_date, " +
  "subscription_status, platform_notes, player_prefix, show_billing_to_parents";

export async function fetchTenants(): Promise<TenantRow[]> {
  const { data, error } = await supabase
    .from("tenants")
    .select(`${TENANT_COLS}, students(count)`)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((t: any) => ({
    ...t,
    student_count: Array.isArray(t.students) ? (t.students[0]?.count ?? 0) : 0,
  }));
}

export async function fetchTenantById(id: string): Promise<Tenant | null> {
  const { data, error } = await supabase
    .from("tenants")
    .select(TENANT_COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data as Tenant | null;
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
