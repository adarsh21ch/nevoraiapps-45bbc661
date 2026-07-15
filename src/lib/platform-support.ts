import { supabase } from "@/integrations/supabase/client";
import { logPlatformAction } from "./platform-audit";

export type SupportNote = {
  id: string;
  tenant_id: string;
  author_id: string;
  body: string;
  priority: "low" | "normal" | "high" | "urgent";
  status: "open" | "resolved";
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
};

export const supportKeys = {
  byTenant: (id: string) => ["platform", "support", id] as const,
  all: ["platform", "support", "all"] as const,
};

export async function listSupportNotes(tenantId?: string) {
  let q = supabase
    .from("platform_support_notes" as any)
    .select("*")
    .order("created_at", { ascending: false });
  if (tenantId) q = q.eq("tenant_id", tenantId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as SupportNote[];
}

export async function addSupportNote(input: {
  tenantId: string;
  body: string;
  priority?: SupportNote["priority"];
}) {
  const { data: session } = await supabase.auth.getSession();
  const uid = session.session?.user.id;
  if (!uid) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("platform_support_notes" as any)
    .insert({
      tenant_id: input.tenantId,
      author_id: uid,
      body: input.body,
      priority: input.priority ?? "normal",
    })
    .select()
    .single();
  if (error) throw error;
  await logPlatformAction({
    tenantId: input.tenantId,
    targetType: "support_note",
    targetId: (data as any).id,
    action: "note_add",
    after: { priority: input.priority ?? "normal" },
  });
  return data as unknown as SupportNote;
}

export async function resolveSupportNote(id: string, tenantId: string) {
  const { error } = await supabase
    .from("platform_support_notes" as any)
    .update({ status: "resolved", resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
  await logPlatformAction({
    tenantId,
    targetType: "support_note",
    targetId: id,
    action: "note_resolve",
  });
}

export async function setTenantStatus(
  tenantId: string,
  status: "active" | "suspended" | "trial" | "archived",
) {
  const { data: before } = await supabase
    .from("tenants")
    .select("status")
    .eq("id", tenantId)
    .maybeSingle();
  const { error } = await supabase.from("tenants").update({ status }).eq("id", tenantId);
  if (error) throw error;
  await logPlatformAction({
    tenantId,
    targetType: "tenant",
    targetId: tenantId,
    action: status === "suspended" ? "suspend" : status === "archived" ? "archive" : "activate",
    before: before ?? null,
    after: { status },
  });
}

export async function setTenantFeature(tenantId: string, key: string, enabled: boolean) {
  const { error } = await supabase.rpc("set_tenant_feature" as any, {
    _tenant_id: tenantId,
    _key: key,
    _enabled: enabled,
  });
  if (error) throw error;
}
