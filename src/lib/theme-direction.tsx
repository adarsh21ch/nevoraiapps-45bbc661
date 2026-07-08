import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ThemeDirection = "fintech" | "bold" | "minimal";

const STORAGE_KEY = "acadaos.theme.direction";

export const THEME_DIRECTIONS: {
  id: ThemeDirection;
  label: string;
  tag: string;
  hint: string;
}[] = [
  { id: "fintech", label: "Fintech", tag: "Dark glass", hint: "Deep surfaces · glow accents · big numbers" },
  { id: "bold", label: "Bold", tag: "Data-first", hint: "Bright · vivid tiles · friendly" },
  { id: "minimal", label: "Editorial", tag: "Minimal luxe", hint: "Whitespace · serif · quiet accents" },
];

type Ctx = {
  direction: ThemeDirection;
  setDirection: (d: ThemeDirection) => void;
};

const ThemeDirCtx = createContext<Ctx | null>(null);

function apply(dir: ThemeDirection) {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", dir);
}

export function ThemeDirectionProvider({ children }: { children: ReactNode }) {
  const [direction, setDirectionState] = useState<ThemeDirection>("fintech");

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as ThemeDirection | null) ?? "fintech";
    setDirectionState(saved);
    apply(saved);
  }, []);

  const setDirection = (d: ThemeDirection) => {
    setDirectionState(d);
    localStorage.setItem(STORAGE_KEY, d);
    apply(d);
  };

  return (
    <ThemeDirCtx.Provider value={{ direction, setDirection }}>{children}</ThemeDirCtx.Provider>
  );
}

export function useThemeDirection() {
  const ctx = useContext(ThemeDirCtx);
  if (!ctx) throw new Error("useThemeDirection outside provider");
  return ctx;
}
