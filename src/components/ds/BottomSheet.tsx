import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

/**
 * BottomSheet — mobile-first sheet from the bottom edge.
 *
 * On desktop it also renders from the bottom (native-app parity) but with
 * a max-width. Uses the shadcn Sheet under the hood.
 */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "rounded-t-2xl border-t border-border p-0 max-h-[90dvh] flex flex-col",
          className,
        )}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Grabber */}
        <div className="pt-2 pb-1 grid place-items-center shrink-0">
          <span aria-hidden className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>
        {(title || description) && (
          <SheetHeader className="px-4 pb-2 text-left">
            {title ? <SheetTitle className="text-base">{title}</SheetTitle> : null}
            {description ? (
              <SheetDescription className="text-xs">{description}</SheetDescription>
            ) : null}
          </SheetHeader>
        )}
        <div className="flex-1 overflow-y-auto px-4 pb-4">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
