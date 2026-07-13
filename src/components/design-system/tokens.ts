/**
 * Semantic accent tones — mapped to CSS custom properties defined in styles.css.
 * Use for badges, stat cards, chips, icon backgrounds. Never hardcode colors.
 */
export type AccentTone =
  | "live"
  | "success"
  | "tournament"
  | "ai"
  | "award"
  | "wicket"
  | "analytics"
  | "info"
  | "warning"
  | "danger"
  | "neutral";

export const accentVar: Record<AccentTone, string> = {
  live: "var(--accent-live)",
  success: "var(--accent-success)",
  tournament: "var(--accent-tournament)",
  ai: "var(--accent-ai)",
  award: "var(--accent-award)",
  wicket: "var(--accent-wicket)",
  analytics: "var(--accent-analytics)",
  info: "var(--accent-live)",
  warning: "var(--accent-tournament)",
  danger: "var(--accent-wicket)",
  neutral: "var(--muted-foreground)",
};

/** Inline style helpers for tone-tinted surfaces. */
export const toneStyle = {
  soft: (tone: AccentTone): React.CSSProperties => ({
    backgroundColor: `color-mix(in oklch, ${accentVar[tone]} 12%, transparent)`,
    color: accentVar[tone],
    borderColor: `color-mix(in oklch, ${accentVar[tone]} 40%, transparent)`,
  }),
  solid: (tone: AccentTone): React.CSSProperties => ({
    backgroundColor: accentVar[tone],
    color: "var(--background)",
  }),
  outline: (tone: AccentTone): React.CSSProperties => ({
    color: accentVar[tone],
    borderColor: `color-mix(in oklch, ${accentVar[tone]} 50%, transparent)`,
  }),
};

/** Duration tokens for JS-driven animations (mirrors CSS custom properties). */
export const duration = {
  instant: 80,
  fast: 140,
  normal: 220,
  slow: 320,
} as const;

/** Z-index scale used by layered surfaces. */
export const zIndex = {
  base: 0,
  sticky: 20,
  drawer: 40,
  topbar: 50,
  dropdown: 60,
  dialog: 70,
  toast: 80,
} as const;
