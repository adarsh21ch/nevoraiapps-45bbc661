import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useT();
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-background p-0.5 text-[11px] font-semibold",
        className,
      )}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLang("en")}
        className={cn(
          "px-2.5 py-1 rounded-full transition-colors",
          lang === "en" ? "text-white" : "text-muted-foreground hover:text-foreground",
        )}
        style={lang === "en" ? { backgroundColor: "var(--brand, #0ea5e9)" } : undefined}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang("hi")}
        className={cn(
          "px-2.5 py-1 rounded-full transition-colors",
          lang === "hi" ? "text-white" : "text-muted-foreground hover:text-foreground",
        )}
        style={lang === "hi" ? { backgroundColor: "var(--brand, #0ea5e9)" } : undefined}
      >
        हिं
      </button>
    </div>
  );
}
