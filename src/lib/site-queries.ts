import { supabase } from "@/integrations/supabase/client";
import type { Batch, FeePlan, SiteContent } from "./tenant";

export const siteContentQuery = (tenantId: string) => ({
  queryKey: ["site_content", tenantId],
  queryFn: async (): Promise<SiteContent[]> => {
    const { data, error } = await supabase
      .from("site_content")
      .select("*")
      .eq("tenant_id", tenantId)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
});

export const feePlansQuery = (tenantId: string) => ({
  queryKey: ["fee_plans", tenantId],
  queryFn: async (): Promise<FeePlan[]> => {
    const { data, error } = await supabase
      .from("fee_plans")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .order("type", { ascending: true })
      .order("amount", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
});

export const batchesQuery = (tenantId: string) => ({
  queryKey: ["batches", tenantId],
  queryFn: async (): Promise<Batch[]> => {
    const { data, error } = await supabase
      .from("batches")
      .select("*")
      .eq("tenant_id", tenantId)
      .eq("active", true)
      .order("name", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },
});

export type PolicyKind =
  | "terms"
  | "privacy"
  | "refund"
  | "fee"
  | "conduct"
  | "leave"
  | "medical";

export type PolicyDocument = {
  id: string;
  tenant_id: string;
  kind: PolicyKind;
  version: number;
  title: string;
  body_md: string;
  is_published: boolean;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export const POLICY_LABELS: Record<PolicyKind, string> = {
  terms: "Terms & Conditions",
  privacy: "Privacy Policy",
  refund: "Refund Policy",
  fee: "Fee Policy",
  conduct: "Code of Conduct",
  leave: "Leave Policy",
  medical: "Medical Policy",
};

/** Latest published policy per (tenant, kind). Public-readable. */
export const publishedPoliciesQuery = (tenantId: string) => ({
  queryKey: ["policy_documents", "published", tenantId],
  queryFn: async (): Promise<PolicyDocument[]> => {
    const { data, error } = await (supabase as any)
      .from("policy_documents")
      .select("id,tenant_id,kind,version,title,body_md,is_published,published_at,created_at,updated_at")
      .eq("tenant_id", tenantId)
      .eq("is_published", true)
      .order("version", { ascending: false });
    if (error) throw error;
    const rows = (data ?? []) as PolicyDocument[];
    // Keep only the latest published version per kind.
    const byKind = new Map<PolicyKind, PolicyDocument>();
    for (const row of rows) {
      if (!byKind.has(row.kind)) byKind.set(row.kind, row);
    }
    return Array.from(byKind.values());
  },
});

/** All versions for owner CMS. */
export const allPoliciesQuery = (tenantId: string) => ({
  queryKey: ["policy_documents", "all", tenantId],
  queryFn: async (): Promise<PolicyDocument[]> => {
    const { data, error } = await (supabase as any)
      .from("policy_documents")
      .select("id,tenant_id,kind,version,title,body_md,is_published,published_at,created_at,updated_at")
      .eq("tenant_id", tenantId)
      .order("kind", { ascending: true })
      .order("version", { ascending: false });
    if (error) throw error;
    return (data ?? []) as PolicyDocument[];
  },
});

export function sectionsBy(sections: SiteContent[], key: string) {
  return sections.filter((s) => s.section === key);
}

export function sectionOne<T = Record<string, unknown>>(
  sections: SiteContent[],
  key: string,
): T | null {
  const row = sections.find((s) => s.section === key);
  return row ? (row.content as T) : null;
}
