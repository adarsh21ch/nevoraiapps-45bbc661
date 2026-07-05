import { supabase } from "@/integrations/supabase/client";

export type PlatformSettings = {
  contact_whatsapp: string;
  contact_email: string;
};

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  contact_whatsapp: "9329040508",
  contact_email: "team@nevorai.com",
};

export const platformSettingsKey = ["platform-settings"] as const;

export async function fetchPlatformSettings(): Promise<PlatformSettings> {
  const { data, error } = await supabase
    .from("platform_settings")
    .select("contact_whatsapp, contact_email")
    .eq("id", true)
    .maybeSingle();
  if (error) throw error;
  return data ?? DEFAULT_PLATFORM_SETTINGS;
}

export async function savePlatformSettings(patch: PlatformSettings) {
  const { error } = await supabase
    .from("platform_settings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) throw error;
}

/** Build wa.me link, prefixing 91 for 10-digit Indian numbers. */
export function waHref(number: string, text?: string) {
  const digits = number.replace(/\D/g, "");
  const withCc = digits.length === 10 ? `91${digits}` : digits;
  const q = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${withCc}${q}`;
}
