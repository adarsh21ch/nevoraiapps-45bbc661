/**
 * NevorAI Response Renderer.
 *
 * Parses lightweight structured blocks the model emits and renders them
 * as premium, glanceable UI (KPI cards, checklists, timelines, tables,
 * callouts, quick-action buttons). Anything outside a fence is rendered
 * as regular markdown-lite text with tasteful typography.
 *
 * Block grammar (the model is prompted to emit this):
 *
 *   ::kpi[Title]
 *   Label | Value | delta?
 *   Label | Value
 *   ::
 *
 *   ::checklist[Title]
 *   - Item
 *   - Item
 *   ::
 *
 *   ::timeline[Title]
 *   time | text
 *   time | text
 *   ::
 *
 *   ::table[Title]
 *   Col1 | Col2 | Col3
 *   ---
 *   v1   | v2   | v3
 *   ::
 *
 *   ::callout[tone]        tone = info | success | warning | error
 *   text
 *   ::
 *
 *   ::actions
 *   Label -> /path
 *   Label -> /path
 *   ::
 *
 * Anything the model emits outside these fences is plain answer text.
 * The renderer degrades gracefully — if a model reply is pure prose, it
 * still looks great, because the text renderer already handles emoji
 * section headings and bullet lists.
 */

import { Link } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Info,
  Sparkles,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Block =
  | { kind: "text"; text: string }
  | { kind: "kpi"; title: string; rows: Array<{ label: string; value: string; delta?: string }> }
  | { kind: "checklist"; title: string; items: string[] }
  | { kind: "timeline"; title: string; items: Array<{ time: string; text: string }> }
  | { kind: "table"; title: string; columns: string[]; rows: string[][] }
  | { kind: "callout"; tone: "info" | "success" | "warning" | "error"; text: string }
  | { kind: "actions"; items: Array<{ label: string; href?: string }> };

const FENCE_RE = /::([a-z]+)(?:\[([^\]]*)\])?\s*\n([\s\S]*?)\n?::/g;

export function parseBlocks(input: string): Block[] {
  const blocks: Block[] = [];
  let cursor = 0;
  const src = input ?? "";
  FENCE_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FENCE_RE.exec(src)) !== null) {
    if (match.index > cursor) {
      const chunk = src.slice(cursor, match.index).trim();
      if (chunk) blocks.push({ kind: "text", text: chunk });
    }
    const [, tag, arg = "", body = ""] = match;
    const parsed = parseFence(tag, arg, body);
    if (parsed) blocks.push(parsed);
    cursor = match.index + match[0].length;
  }
  if (cursor < src.length) {
    const tail = src.slice(cursor).trim();
    if (tail) blocks.push({ kind: "text", text: tail });
  }
  return blocks.length ? blocks : [{ kind: "text", text: src }];
}

function parseFence(tag: string, arg: string, body: string): Block | null {
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  switch (tag) {
    case "kpi": {
      const rows = lines
        .map((l) => l.split("|").map((s) => s.trim()))
        .filter((cols) => cols.length >= 2)
        .map(([label, value, delta]) => ({ label, value, delta: delta || undefined }));
      return { kind: "kpi", title: arg.trim(), rows };
    }
    case "checklist": {
      const items = lines.map((l) => l.replace(/^[-•□☐]\s*/, "").trim()).filter(Boolean);
      return { kind: "checklist", title: arg.trim(), items };
    }
    case "timeline": {
      const items = lines
        .map((l) => l.split("|").map((s) => s.trim()))
        .filter((cols) => cols.length >= 2)
        .map(([time, text]) => ({ time, text }));
      return { kind: "timeline", title: arg.trim(), items };
    }
    case "table": {
      const sepIdx = lines.findIndex((l) => /^-{2,}(\s*\|\s*-{2,})*$/.test(l));
      const headerIdx = sepIdx > 0 ? sepIdx - 1 : 0;
      const columns = (lines[headerIdx] ?? "").split("|").map((s) => s.trim());
      const rowStart = sepIdx > 0 ? sepIdx + 1 : 1;
      const rows = lines
        .slice(rowStart)
        .map((l) => l.split("|").map((s) => s.trim()));
      return { kind: "table", title: arg.trim(), columns, rows };
    }
    case "callout": {
      const tone = (arg.trim() as "info" | "success" | "warning" | "error") || "info";
      return { kind: "callout", tone, text: lines.join(" ") };
    }
    case "actions": {
      const items = lines.map((l) => {
        const [labelPart, hrefPart] = l.split("->").map((s) => s?.trim() ?? "");
        return { label: labelPart, href: hrefPart || undefined };
      });
      return { kind: "actions", items };
    }
  }
  return null;
}

/* ────────────────────────────  RENDERERS  ──────────────────────────── */

export function ResponseRenderer({
  text,
  onAction,
}: {
  text: string;
  onAction?: (label: string) => void;
}) {
  const blocks = parseBlocks(text);
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} onAction={onAction} />
      ))}
    </div>
  );
}

function BlockView({ block, onAction }: { block: Block; onAction?: (label: string) => void }) {
  switch (block.kind) {
    case "text":
      return <TextBlock text={block.text} />;
    case "kpi":
      return <KpiBlock title={block.title} rows={block.rows} />;
    case "checklist":
      return <ChecklistBlock title={block.title} items={block.items} />;
    case "timeline":
      return <TimelineBlock title={block.title} items={block.items} />;
    case "table":
      return <TableBlock title={block.title} columns={block.columns} rows={block.rows} />;
    case "callout":
      return <CalloutBlock tone={block.tone} text={block.text} />;
    case "actions":
      return <ActionsBlock items={block.items} onAction={onAction} />;
  }
}

/** Renders plain prose with emoji section headings + bullet lists. */
function TextBlock({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: ReactNode[] = [];
  let listBuf: string[] = [];
  const flushList = (key: string) => {
    if (!listBuf.length) return;
    nodes.push(
      <ul key={`ul-${key}`} className="ml-1 space-y-1 text-sm leading-relaxed">
        {listBuf.map((l, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-[0.5em] size-1 shrink-0 rounded-full bg-muted-foreground/60" />
            <span>{l}</span>
          </li>
        ))}
      </ul>,
    );
    listBuf = [];
  };
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushList(`b-${i}`);
      return;
    }
    const bullet = line.match(/^\s*[-•]\s+(.*)$/);
    if (bullet) {
      listBuf.push(bullet[1]);
      return;
    }
    flushList(`s-${i}`);
    // Emoji-lead section headings.
    if (/^\p{Extended_Pictographic}/u.test(line) && line.length < 60) {
      nodes.push(
        <div key={i} className="text-sm font-semibold tracking-tight">
          {line}
        </div>,
      );
      return;
    }
    if (/^Suggestion:/i.test(line)) {
      nodes.push(
        <div key={i} className="flex items-start gap-1.5 text-sm text-foreground/85">
          <Sparkles className="mt-[3px] size-3.5 shrink-0 text-primary" />
          <span>{line.replace(/^Suggestion:\s*/i, "")}</span>
        </div>,
      );
      return;
    }
    nodes.push(
      <p key={i} className="text-sm leading-relaxed">
        {inline(line)}
      </p>,
    );
  });
  flushList("end");
  return <div className="space-y-1.5">{nodes}</div>;
}

function inline(s: string): ReactNode {
  // very lightweight bold parsing for **text**
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p) ? (
      <strong key={i} className="font-semibold">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}

function KpiBlock({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ label: string; value: string; delta?: string }>;
}) {
  if (!rows.length) return null;
  return (
    <div className="animate-fade-in rounded-2xl border border-border/60 bg-card/60 p-4">
      {title ? (
        <div className="mb-3 text-sm font-semibold tracking-tight">{title}</div>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {rows.map((r, i) => {
          const isNeg = /^[-↓]/.test(r.delta ?? "") || /-\d/.test(r.delta ?? "");
          const DeltaIcon = r.delta
            ? isNeg
              ? TrendingDown
              : TrendingUp
            : null;
          return (
            <div key={i} className="flex flex-col gap-0.5">
              <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {r.label}
              </div>
              <div className="text-xl font-semibold tabular-nums leading-tight">
                {r.value}
              </div>
              {r.delta ? (
                <div
                  className={cn(
                    "flex items-center gap-1 text-[11px] tabular-nums",
                    isNeg ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400",
                  )}
                >
                  {DeltaIcon ? <DeltaIcon className="size-3" /> : null}
                  {r.delta.replace(/^[↑↓]\s*/, "")}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChecklistBlock({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="animate-fade-in rounded-2xl border border-border/60 bg-card/60 p-4">
      {title ? <div className="mb-2 text-sm font-semibold tracking-tight">{title}</div> : null}
      <ul className="flex flex-col gap-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <Circle className="size-3.5 shrink-0 text-muted-foreground/70" />
            <span className="min-w-0 truncate">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TimelineBlock({
  title,
  items,
}: {
  title: string;
  items: Array<{ time: string; text: string }>;
}) {
  if (!items.length) return null;
  return (
    <div className="animate-fade-in rounded-2xl border border-border/60 bg-card/60 p-4">
      {title ? <div className="mb-3 text-sm font-semibold tracking-tight">{title}</div> : null}
      <ol className="relative ml-1 flex flex-col gap-3 border-l border-border/60 pl-4">
        {items.map((it, i) => (
          <li key={i} className="relative">
            <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary/70 ring-4 ring-background" />
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
              {it.time}
            </div>
            <div className="text-sm">{it.text}</div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function TableBlock({
  title,
  columns,
  rows,
}: {
  title: string;
  columns: string[];
  rows: string[][];
}) {
  if (!rows.length) return null;
  return (
    <div className="animate-fade-in overflow-hidden rounded-2xl border border-border/60 bg-card/60">
      {title ? (
        <div className="border-b border-border/60 px-4 py-2.5 text-sm font-semibold tracking-tight">
          {title}
        </div>
      ) : null}
      {/* Mobile: card list. Desktop: table. */}
      <div className="hidden sm:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              {columns.map((c, i) => (
                <th key={i} className="px-4 py-2 font-medium">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 25).map((row, i) => (
              <tr key={i} className="border-t border-border/40">
                {columns.map((_, ci) => (
                  <td key={ci} className="px-4 py-2 tabular-nums">
                    {row[ci] ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="flex flex-col divide-y divide-border/40 sm:hidden">
        {rows.slice(0, 25).map((row, i) => (
          <li key={i} className="flex flex-col gap-1 p-3">
            {columns.map((c, ci) => (
              <div key={ci} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">
                  {c}
                </span>
                <span className="tabular-nums">{row[ci] ?? "—"}</span>
              </div>
            ))}
          </li>
        ))}
      </ul>
      {rows.length > 25 ? (
        <div className="border-t border-border/40 px-4 py-1.5 text-[11px] text-muted-foreground">
          Showing 25 of {rows.length} rows.
        </div>
      ) : null}
    </div>
  );
}

function CalloutBlock({
  tone,
  text,
}: {
  tone: "info" | "success" | "warning" | "error";
  text: string;
}) {
  const meta = {
    info: {
      Icon: Info,
      cls: "border-primary/30 bg-primary/5 text-foreground",
      iconCls: "text-primary",
    },
    success: {
      Icon: CheckCircle2,
      cls: "border-emerald-500/30 bg-emerald-500/5 text-foreground",
      iconCls: "text-emerald-600 dark:text-emerald-400",
    },
    warning: {
      Icon: AlertTriangle,
      cls: "border-amber-500/30 bg-amber-500/5 text-foreground",
      iconCls: "text-amber-600 dark:text-amber-400",
    },
    error: {
      Icon: XCircle,
      cls: "border-destructive/30 bg-destructive/5 text-foreground",
      iconCls: "text-destructive",
    },
  }[tone];
  return (
    <div
      className={cn(
        "animate-fade-in flex items-start gap-2 rounded-2xl border p-3 text-sm",
        meta.cls,
      )}
    >
      <meta.Icon className={cn("mt-0.5 size-4 shrink-0", meta.iconCls)} />
      <div className="min-w-0 flex-1 leading-relaxed">{text}</div>
    </div>
  );
}

function ActionsBlock({
  items,
  onAction,
}: {
  items: Array<{ label: string; href?: string }>;
  onAction?: (label: string) => void;
}) {
  if (!items.length) return null;
  return (
    <div className="animate-fade-in flex flex-wrap gap-2 pt-1">
      {items.slice(0, 4).map((it, i) => {
        const cls =
          "inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background px-3.5 py-1.5 text-xs font-medium text-foreground/85 shadow-sm transition hover:border-primary/50 hover:bg-primary/5 hover:text-foreground";
        if (it.href && it.href.startsWith("/")) {
          return (
            <Link key={i} to={it.href} className={cls}>
              {it.label}
              <ArrowRight className="size-3" />
            </Link>
          );
        }
        return (
          <button
            key={i}
            type="button"
            onClick={() => onAction?.(it.label)}
            className={cls}
          >
            {it.label}
            <ArrowRight className="size-3" />
          </button>
        );
      })}
    </div>
  );
}
