import { supabase } from "@/integrations/supabase/client";

export type AuditRow = {
  id: string;
  actor_id: string;
  tenant_id: string | null;
  target_type: string;
  target_id: string | null;
  action: string;
  before_state: unknown;
  after_state: unknown;
  created_at: string;
};

export const auditKeys = {
  list: (tenantId?: string | null) => ["platform", "audit", tenantId ?? "all"] as const,
};

export async function logPlatformAction(input: {
  tenantId?: string | null;
  targetType: string;
  targetId?: string | null;
  action: string;
  before?: unknown;
  after?: unknown;
}) {
  const { error } = await supabase.rpc("log_platform_action" as any, {
    _tenant_id: input.tenantId ?? null,
    _target_type: input.targetType,
    _target_id: input.targetId ?? null,
    _action: input.action,
    _before: (input.before ?? null) as any,
    _after: (input.after ?? null) as any,
  });
  if (error) throw error;
}

export async function fetchAuditLog(tenantId?: string | null, limit = 200): Promise<AuditRow[]> {
  let q = supabase
    .from("platform_audit_log" as any)
    .select(
      "id, actor_id, tenant_id, target_type, target_id, action, before_state, after_state, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as AuditRow[];
}
