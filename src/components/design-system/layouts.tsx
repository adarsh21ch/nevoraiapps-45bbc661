import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Reusable page layouts. These wrap route content with consistent spacing,
 * scroll behavior, and sticky-footer scaffolding. Zero business logic.
 */

export function DashboardLayout({
  header,
  children,
  className,
}: {
  header?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-8", className)}>
      {header}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">{children}</div>
    </div>
  );
}

export function DetailLayout({
  header,
  aside,
  children,
  className,
}: {
  header?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {header}
      <div
        className={cn(
          "grid gap-6",
          aside ? "lg:grid-cols-[minmax(0,1fr)_320px]" : "grid-cols-1",
        )}
      >
        <div className="min-w-0 space-y-6">{children}</div>
        {aside && <aside className="space-y-6">{aside}</aside>}
      </div>
    </div>
  );
}

export function ListLayout({
  header,
  toolbar,
  children,
  className,
}: {
  header?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {header}
      {toolbar && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">{toolbar}</div>
      )}
      <div>{children}</div>
    </div>
  );
}

export function SettingsLayout({
  header,
  nav,
  children,
  className,
}: {
  header?: ReactNode;
  nav?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {header}
      <div
        className={cn(
          "grid gap-6",
          nav ? "lg:grid-cols-[220px_minmax(0,1fr)]" : "grid-cols-1",
        )}
      >
        {nav && <aside className="lg:sticky lg:top-20 lg:self-start">{nav}</aside>}
        <div className="min-w-0 space-y-6">{children}</div>
      </div>
    </div>
  );
}

export function WizardLayout({
  step,
  totalSteps,
  title,
  children,
  footer,
  className,
}: {
  step: number;
  totalSteps: number;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, (step / totalSteps) * 100));
  return (
    <div className={cn("flex flex-col gap-6 pb-24 md:pb-0", className)}>
      <div>
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
          <span className="font-medium">
            Step {step} of {totalSteps}
          </span>
          {title && <span className="truncate ml-3">{title}</span>}
        </div>
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-[var(--ds-duration-normal)]"
            style={{ width: `${pct}%`, backgroundColor: "var(--brand)" }}
          />
        </div>
      </div>
      <div className="space-y-6">{children}</div>
      {footer && (
        <div
          className="sticky bottom-0 left-0 right-0 z-[var(--ds-z-sticky)] -mx-4 md:mx-0 border-t border-border bg-background/95 backdrop-blur px-4 py-3 md:static md:border-0 md:bg-transparent md:p-0"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}
        >
          <div className="flex items-center justify-between gap-2">{footer}</div>
        </div>
      )}
    </div>
  );
}

export function ProfileLayout({
  hero,
  tabs,
  children,
  className,
}: {
  hero: ReactNode;
  tabs?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="rounded-2xl border border-border bg-card p-5 md:p-6">{hero}</div>
      {tabs && (
        <div className="border-b border-border overflow-x-auto ds-scroll">{tabs}</div>
      )}
      <div className="space-y-6">{children}</div>
    </div>
  );
}
