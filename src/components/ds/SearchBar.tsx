import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** SearchBar — accessible search input with clear button. */
export function SearchBar({
  value,
  onChange,
  placeholder = "Search",
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}) {
  return (
    <label className={cn("relative flex items-center", className)}>
      <Search className="absolute left-3 size-4 text-muted-foreground pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={cn(
          "w-full h-10 pl-9 pr-9 rounded-xl bg-muted border-0 text-sm",
          "placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-[color:var(--brand)]/40 focus:bg-background",
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-1 grid place-items-center min-h-11 min-w-11 rounded-full text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand)]/50"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </label>
  );
}
