/* ================================================================
 * Academy Website Engine — read-only presentation layer.
 * ---------------------------------------------------------------
 * NEVER calculates cricket stats. NEVER duplicates academy data.
 * Reads everything via existing public RPCs / tables that already
 * have RLS + narrow anon policies.
 * ================================================================ */
import { supabase } from "@/integrations/supabase/client";

export type WebsiteTheme = "classic" | "modern" | "professional" | "minimal" | "dark";

export type WidgetKey =
  | "live_match"
  | "upcoming_matches"
  | "recent_results"
  | "top_run_scorer"
  | "top_wicket_taker"
  | "player_of_month"
  | "academy_records"
  | "tournament_table"
  | "orange_cap"
  | "purple_cap"
  | "recognition_wall"
  | "hall_of_fame"
  | "upcoming_events";

export interface WidgetSlot {
  key: WidgetKey;
  enabled: boolean;
  order: number;
}

export interface WebsiteConfig {
  id: string;
  tenant_id: string;
  theme: WebsiteTheme;
  is_published: boolean;
  homepage_widget: WidgetKey;
  hero: {
    headline?: string;
    subheadline?: string;
    background_url?: string;
    cta_label?: string;
    cta_href?: string;
  };
  widgets: WidgetSlot[];
  featured_player_ids: string[];
  featured_tournament_ids: string[];
  seo: {
    title?: string;
    description?: string;
    og_image?: string;
  };
}

export interface PublicAcademyBundle {
  academy: { id: string; slug: string; name: string; custom_domain: string | null };
  config: WebsiteConfig;
  upcoming_matches: Array<Record<string, unknown>>;
  recent_results: Array<Record<string, unknown>>;
  academy_records: Array<Record<string, unknown>>;
  hall_of_fame: Array<Record<string, unknown>>;
  recognitions: Array<Record<string, unknown>>;
}

export const DEFAULT_WIDGETS: WidgetSlot[] = [
  { key: "live_match", enabled: true, order: 0 },
  { key: "upcoming_matches", enabled: true, order: 1 },
  { key: "recent_results", enabled: true, order: 2 },
  { key: "top_run_scorer", enabled: true, order: 3 },
  { key: "top_wicket_taker", enabled: true, order: 4 },
  { key: "player_of_month", enabled: true, order: 5 },
  { key: "academy_records", enabled: true, order: 6 },
  { key: "tournament_table", enabled: true, order: 7 },
  { key: "orange_cap", enabled: false, order: 8 },
  { key: "purple_cap", enabled: false, order: 9 },
  { key: "recognition_wall", enabled: true, order: 10 },
  { key: "hall_of_fame", enabled: true, order: 11 },
  { key: "upcoming_events", enabled: false, order: 12 },
];

export const WIDGET_LABELS: Record<WidgetKey, string> = {
  live_match: "Live Match",
  upcoming_matches: "Upcoming Matches",
  recent_results: "Recent Results",
  top_run_scorer: "Top Run Scorer",
  top_wicket_taker: "Top Wicket Taker",
  player_of_month: "Player Of The Month",
  academy_records: "Academy Records",
  tournament_table: "Tournament Table",
  orange_cap: "Orange Cap",
  purple_cap: "Purple Cap",
  recognition_wall: "Recognition Wall",
  hall_of_fame: "Hall Of Fame",
  upcoming_events: "Upcoming Events",
};

/* ---------------- Public read ---------------- */

export async function getPublicAcademyBundle(slug: string): Promise<PublicAcademyBundle | null> {
  const { data, error } = await supabase.rpc("get_public_academy_bundle", { _slug: slug });
  if (error) throw error;
  return (data as unknown as PublicAcademyBundle) ?? null;
}

export async function trackWebsiteEvent(
  slug: string,
  eventType: string,
  eventKey?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.rpc("track_website_event", {
      _slug: slug,
      _event_type: eventType,
      _event_key: eventKey ?? null,
      _metadata: (metadata ?? {}) as never,
    });
  } catch {
    /* analytics is best-effort */
  }
}

/* ---------------- Admin read/write ---------------- */

export async function getWebsiteConfig(tenantId: string): Promise<WebsiteConfig | null> {
  const { data, error } = await supabase
    .from("mc_website_config")
    .select("*")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as WebsiteConfig) ?? null;
}

export async function upsertWebsiteConfig(
  tenantId: string,
  patch: Partial<Omit<WebsiteConfig, "id" | "tenant_id">>,
): Promise<WebsiteConfig> {
  const existing = await getWebsiteConfig(tenantId);
  const payload = {
    tenant_id: tenantId,
    theme: patch.theme ?? existing?.theme ?? "modern",
    is_published: patch.is_published ?? existing?.is_published ?? true,
    homepage_widget: patch.homepage_widget ?? existing?.homepage_widget ?? "live_match",
    hero: (patch.hero ?? existing?.hero ?? {}) as never,
    widgets: (patch.widgets ?? existing?.widgets ?? DEFAULT_WIDGETS) as never,
    featured_player_ids: (patch.featured_player_ids ??
      existing?.featured_player_ids ?? []) as never,
    featured_tournament_ids: (patch.featured_tournament_ids ??
      existing?.featured_tournament_ids ?? []) as never,
    seo: (patch.seo ?? existing?.seo ?? {}) as never,
  };
  const { data, error } = await supabase
    .from("mc_website_config")
    .upsert(payload, { onConflict: "tenant_id" })
    .select("*")
    .single();
  if (error) throw error;
  return data as unknown as WebsiteConfig;
}
