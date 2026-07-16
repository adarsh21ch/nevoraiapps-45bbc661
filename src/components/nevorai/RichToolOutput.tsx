/**
 * Rich tool-output renderer.
 *
 * Tools return a standardized envelope (from Phase 11.3):
 *   { title, summary, structured_data, recommended_actions, citations, errorCode }
 * When we detect known shapes we render KPI cards / tables / badges;
 * otherwise we fall back to compact JSON.
 *
 * Pure presentation — no business logic.
 */

import { cn } from "@/lib/utils";

type Envelope = {
  title?: string;
  summary?: string;
  structured_data?: unknown;
  recommended_actions?: Array<{ label: string; href?: string; toolName?: string }>;
  citations?: Array<{ label: string; href?: string }>;
  errorCode?: string;
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isKpiShape(v: unknown): v is Array<{ label: string; value: string | number; delta?: string }> {
  return (
    Array.isArray(v) &&
    v.length > 0 &&
    v.every((r) => isRecord(r) && "label" in r && "value" in r)
  );
}

function isTableShape(
  v: unknown,
): v is { columns: string[]; rows: Array<Record<string, string | number | null>> } {
  return (
    isRecord(v) &&
    Array.isArray((v as { columns?: unknown }).columns) &&
    Array.isArray((v as { rows?: unknown }).rows)
  );
}

export function RichToolOutput({ output }: { output: unknown }) {
  if (output == null) return null;

  // Try to parse an envelope; fall back to raw display.
  const env: Envelope | null = isRecord(output) ? (output as Envelope) : null;
  const data = env?.structured_data ?? output;

  return (
    <div className="space-y-3">
      {env?.title ? (
        <div className="text-sm font-semibold text-foreground">{env.title}</div>
      ) : null}
      {env?.summary ? (
        <p className="text-sm text-muted-foreground">{env.summary}</p>
      ) : null}

      {isKpiShape(data) ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {data.slice(0, 6).map((k) => (
            <div
              key={k.label}
              className="rounded-lg border border-border/60 bg-card/60 px-3 py-2"
            >
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {k.label}
              </div>
              <div className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
                {k.value}
              </div>
              {k.delta ? (
                <div
                  className={cn(
                    "text-[11px] tabular-nums",
                    String(k.delta).startsWith("-") ? "text-destructive" : "text-emerald-600",
                  )}
                >
                  {k.delta}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {isTableShape(data) ? (
        <div className="overflow-x-auto rounded-lg border border-border/60">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 text-left text-muted-foreground">
              <tr>
                {data.columns.map((c) => (
                  <th key={c} className="px-2 py-1.5 font-medium">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.slice(0, 25).map((row, i) => (
                <tr key={i} className="border-t border-border/40">
                  {data.columns.map((c) => (
                    <td key={c} className="px-2 py-1.5 tabular-nums">
                      {String(row[c] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.rows.length > 25 ? (
            <div className="border-t border-border/40 px-2 py-1 text-[11px] text-muted-foreground">
              Showing 25 of {data.rows.length} rows.
            </div>
          ) : null}
        </div>
      ) : null}

      {!isKpiShape(data) && !isTableShape(data) && data ? (
        <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted/40 p-2 text-[11px] leading-snug text-foreground/80">
          {typeof data === "string" ? data : JSON.stringify(data, null, 2)}
        </pre>
      ) : null}

      {env?.citations?.length ? (
        <div className="flex flex-wrap gap-1 pt-1">
          {env.citations.map((c, i) => (
            <a
              key={i}
              href={c.href}
              target={c.href?.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="rounded-full border border-border/60 bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary/50 hover:text-foreground"
            >
              {c.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
