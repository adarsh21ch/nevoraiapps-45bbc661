// Theme engine — unchanged storage key, now supports "system".
// Storage: "light" | "dark" | "system". Default = "system".

export type ThemeMode = "light" | "dark" | "system";

export const THEME_KEY = "acadaos.theme";

function systemPrefersDark(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? true;
  } catch {
    return true;
  }
}

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") return systemPrefersDark() ? "dark" : "light";
  return mode;
}

export function applyTheme(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  const resolved = resolveTheme(mode);
  if (resolved === "dark") el.classList.add("dark");
  else el.classList.remove("dark");
}

export function readStoredThemeMode(): ThemeMode {
  try {
    const s = localStorage.getItem(THEME_KEY);
    if (s === "light" || s === "dark" || s === "system") return s;
  } catch { /* ignore */ }
  return "system";
}

export function setStoredThemeMode(mode: ThemeMode) {
  try { localStorage.setItem(THEME_KEY, mode); } catch { /* ignore */ }
  applyTheme(mode);
}
