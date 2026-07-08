import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LanguageToggle({ className }: { className?: string }) {
  const { lang, setLang } = useT();
  const btn = (active: boolean) =>
    cn(
      "px-2.5 py-1 rounded-full transition-colors font-semibold",
      active
        ? "bg-foreground text-background shadow-sm"
        : "text-muted-foreground hover:text-foreground",
    );
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-card p-0.5 text-[11px]",
        className,
      )}
      role="group"
      aria-label="Language"
    >
      <button type="button" onClick={() => setLang("en")} className={btn(lang === "en")}>
        EN
      </button>
      <button type="button" onClick={() => setLang("hi")} className={btn(lang === "hi")}>
        हिं
      </button>
    </div>
  );
}
