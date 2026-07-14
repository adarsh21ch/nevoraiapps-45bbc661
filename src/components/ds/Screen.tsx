import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Screen — consistent vertical rhythm for page content. */
export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("py-4 space-y-4", className)}>{children}</div>;
}

/** Section — groups related content with optional header. */
export function Section({
  title,
  action,
  children,
  className,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 px-0.5">
          {title ? <h2 className="text-sm font-semibold tracking-tight">{title}</h2> : <span />}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
