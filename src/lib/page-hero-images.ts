import type { Tenant } from "./tenant";

export type PageHeroKey =
  | "home"
  | "about"
  | "programs"
  | "star_players"
  | "matches"
  | "gallery"
  | "fees"
  | "contact"
  | "coaches"
  | "achievements";

export const PAGE_HERO_KEYS: { key: PageHeroKey; label: string }[] = [
  { key: "home", label: "Home" },
  { key: "about", label: "About" },
  { key: "programs", label: "Programs" },
  { key: "star_players", label: "Star Players" },
  { key: "matches", label: "Matches" },
  { key: "gallery", label: "Gallery" },
  { key: "fees", label: "Fees" },
  { key: "contact", label: "Contact" },
  { key: "coaches", label: "Coaches" },
  { key: "achievements", label: "Achievements" },
];

export const MAX_HERO_IMAGES_PER_PAGE = 8;

/** Reads the ordered array of image paths for a page from tenant.page_hero_images. */
export function getPageHeroImages(
  tenant: Tenant | (Record<string, unknown> & { page_hero_images?: unknown }) | null | undefined,
  key: PageHeroKey,
): string[] {
  if (!tenant) return [];
  const raw = (tenant as { page_hero_images?: unknown }).page_hero_images;
  if (!raw || typeof raw !== "object") return [];
  const arr = (raw as Record<string, unknown>)[key];
  if (!Array.isArray(arr)) return [];
  return arr.filter((p): p is string => typeof p === "string" && p.length > 0);
}

export function showFeesTab(
  tenant: Tenant | (Record<string, unknown> & { show_fees_tab?: unknown }) | null | undefined,
): boolean {
  if (!tenant) return true;
  const v = (tenant as { show_fees_tab?: unknown }).show_fees_tab;
  return v !== false;
}
