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
