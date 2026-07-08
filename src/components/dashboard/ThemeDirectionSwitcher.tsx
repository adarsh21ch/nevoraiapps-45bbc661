import { Check, Palette } from "lucide-react";
import { THEME_DIRECTIONS, useThemeDirection, type ThemeDirection } from "@/lib/theme-direction";
import { useHydrated } from "@/hooks/use-hydrated";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function ThemeDirectionSwitcher() {
  const hydrated = useHydrated();
  const { direction, setDirection } = useThemeDirection();

  if (!hydrated) return <div className="size-9" aria-hidden />;

  const current = THEME_DIRECTIONS.find((d) => d.id === direction) ?? THEME_DIRECTIONS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="rounded-full gap-1.5 px-2.5">
          <Palette className="size-4" />
          <span className="hidden sm:inline text-xs font-medium">{current.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Preview theme direction
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {THEME_DIRECTIONS.map((d) => (
          <DropdownMenuItem
            key={d.id}
            onClick={() => setDirection(d.id as ThemeDirection)}
            className="flex items-start gap-2 py-2.5"
          >
            <div className="mt-0.5 size-4 shrink-0">
              {d.id === direction ? <Check className="size-4" /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold leading-tight">
                {d.label} <span className="text-[10px] font-normal text-muted-foreground">· {d.tag}</span>
              </div>
              <div className="text-[11px] text-muted-foreground leading-snug">{d.hint}</div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
