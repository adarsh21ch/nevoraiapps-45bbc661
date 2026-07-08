import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useHydrated } from "@/hooks/use-hydrated";

const KEY = "acadaos-theme";

function applyTheme(t: "light" | "dark") {
  const el = document.documentElement;
  if (t === "dark") el.classList.add("dark");
  else el.classList.remove("dark");
}

export function ThemeToggle() {
  const hydrated = useHydrated();
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    const saved = (localStorage.getItem(KEY) as "light" | "dark" | null) ?? "dark";
    setTheme(saved);
    applyTheme(saved);
  }, []);

  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem(KEY, next);
    applyTheme(next);
  };

  if (!hydrated) {
    return <div className="h-8 w-8" aria-hidden />;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-none border border-white/10 bg-white/5 text-zinc-300 hover:text-lime-400 hover:border-lime-400/40 transition-colors"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}
