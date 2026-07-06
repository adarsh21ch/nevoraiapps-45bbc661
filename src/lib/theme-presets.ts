/**
 * Per-academy theme presets.
 *
 * We auto-pick a sport-appropriate palette from the tenant's niche and a
 * stable hash of their slug — so every academy gets its own dedicated look
 * without the offline coach having to configure anything. The tenant's
 * explicit primary_color still wins when they've customised it.
 */

import type { NicheKey } from "./niche";

export type ThemePreset = {
  id: string;
  label: string;
  /** Main brand hex — becomes --brand. */
  primary: string;
  /** Ink/foreground hex for on-primary text — becomes --brand-ink. */
  ink: string;
  /** Accent/highlight for pills, underlines — becomes --brand-accent. */
  accent: string;
  /** Deep surface used by hero backdrops — becomes --brand-surface. */
  surface: string;
};

// Curated by niche. Each niche has 3+ options; slug hash picks one.
const PRESETS: Record<NicheKey, ThemePreset[]> = {
  academy: [
    { id: "turf-lime",   label: "Turf Lime",     primary: "#22c55e", ink: "#052e16", accent: "#c6ff4a", surface: "#0a0f0a" },
    { id: "night-navy",  label: "Night Navy",    primary: "#1e3a8a", ink: "#ffffff", accent: "#facc15", surface: "#0b1220" },
    { id: "match-red",   label: "Match Red",     primary: "#dc2626", ink: "#ffffff", accent: "#fbbf24", surface: "#1a0808" },
    { id: "clay-court",  label: "Clay Court",    primary: "#c2410c", ink: "#ffffff", accent: "#fde68a", surface: "#1a0a05" },
    { id: "royal-white", label: "Royal Whites",  primary: "#0f172a", ink: "#ffffff", accent: "#22d3ee", surface: "#0a0f14" },
  ],
  gym: [
    { id: "iron-red",    label: "Iron Red",      primary: "#e11d48", ink: "#ffffff", accent: "#fde047", surface: "#0a0a0a" },
    { id: "neon-lift",   label: "Neon Lift",     primary: "#84cc16", ink: "#0a0a0a", accent: "#22d3ee", surface: "#0a0a0a" },
    { id: "steel-orange",label: "Steel Orange",  primary: "#f97316", ink: "#0a0a0a", accent: "#fafafa", surface: "#0a0a0a" },
    { id: "carbon",      label: "Carbon",        primary: "#525252", ink: "#ffffff", accent: "#f43f5e", surface: "#0a0a0a" },
  ],
  tuition: [
    { id: "scholar-blue",label: "Scholar Blue",  primary: "#2563eb", ink: "#ffffff", accent: "#fbbf24", surface: "#0a1020" },
    { id: "ivy-green",   label: "Ivy Green",     primary: "#065f46", ink: "#ffffff", accent: "#facc15", surface: "#04120e" },
    { id: "study-plum",  label: "Study Plum",    primary: "#7c3aed", ink: "#ffffff", accent: "#f9a8d4", surface: "#0f0820" },
    { id: "focus-amber", label: "Focus Amber",   primary: "#b45309", ink: "#ffffff", accent: "#fef3c7", surface: "#1a0f05" },
  ],
};

/** Simple deterministic 32-bit hash for slug → preset picker. */
function hashSlug(slug: string): number {
  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Pick a preset for a tenant given its niche + slug. Stable across renders. */
export function pickPreset(niche: string | null | undefined, slug: string): ThemePreset {
  const key = (niche ?? "academy") as NicheKey;
  const list = PRESETS[key] ?? PRESETS.academy;
  return list[hashSlug(slug) % list.length];
}

/** Return all presets for a niche (for owner picker UIs, later). */
export function presetsFor(niche: string | null | undefined): ThemePreset[] {
  const key = (niche ?? "academy") as NicheKey;
  return PRESETS[key] ?? PRESETS.academy;
}
