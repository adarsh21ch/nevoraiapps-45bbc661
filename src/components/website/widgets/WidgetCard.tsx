import type { ReactNode } from "react";

export function WidgetCard({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <header className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {action}
      </header>
      <div className="text-sm text-foreground">{children}</div>
    </section>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
