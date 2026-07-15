import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";

type Action = {
  label: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
};

type Props = {
  /** If false, the section renders nothing. Use for role-gated visibility. */
  visible?: boolean;
  title?: string;
  description?: string;
  actions?: Action[];
  children?: ReactNode;
};

/**
 * Standard "Danger Zone" section. Always render last on the page.
 * Only mount when the current user is allowed to perform at least one
 * destructive action — never show disabled destructive buttons.
 */
export function DangerZone({
  visible = true,
  title = "Danger zone",
  description = "Destructive actions cannot be undone.",
  actions,
  children,
}: Props) {
  if (!visible) return null;
  return (
    <section
      aria-label="Danger zone"
      className="rounded-xl border border-destructive/40 bg-destructive/[0.04]"
    >
      <div className="flex items-start gap-3 border-b border-destructive/30 px-4 py-3">
        <ShieldAlert className="size-4 mt-0.5 text-destructive" />
        <div>
          <h2 className="text-sm font-semibold text-destructive">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {actions?.map((a) => (
          <div
            key={a.label}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/25 bg-background/40 p-3"
          >
            <div className="min-w-0">
              <div className="text-sm font-medium">{a.label}</div>
              <div className="text-xs text-muted-foreground">{a.description}</div>
            </div>
            <button
              type="button"
              onClick={a.onClick}
              disabled={a.disabled}
              className="inline-flex items-center rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
            >
              {a.label}
            </button>
          </div>
        ))}
        {children}
      </div>
    </section>
  );
}
