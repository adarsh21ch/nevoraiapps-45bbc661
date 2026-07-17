import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * BottomSheet — universal popup.
 *
 * Renders as an iOS-style centered modal (rounded corners, centered on screen)
 * on all viewports. Name kept for API compatibility with existing call sites.
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "p-0 gap-0 rounded-3xl border border-border shadow-2xl",
          "w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85dvh] flex flex-col overflow-hidden",
          className,
        )}
      >
        {(title || description) && (
          <DialogHeader className="px-5 pt-5 pb-2 text-left space-y-1">
            {title ? <DialogTitle className="text-base font-semibold">{title}</DialogTitle> : null}
            {description ? (
              <DialogDescription className="text-xs">{description}</DialogDescription>
            ) : null}
          </DialogHeader>
        )}
        <div className="flex-1 overflow-y-auto px-5 pb-5 pt-2">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
