/**
 * Contextual follow-up chips shown after an assistant message.
 *
 * Two sources:
 *   1. `recommended_actions` inside the tool envelope (deep-link)
 *   2. Heuristic suggestions derived from the last assistant text
 *
 * Selecting a chip either navigates (href) or sends the label as the
 * next prompt via `onSelect`.
 */

import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

export type FollowUp = { label: string; href?: string; prompt?: string };

type Props = {
  items: FollowUp[];
  onSelect: (prompt: string) => void;
};

export function FollowUpChips({ items, onSelect }: Props) {
  if (!items.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {items.slice(0, 6).map((f, i) => {
        const cls =
          "inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-foreground/80 transition hover:border-primary/40 hover:bg-primary/5 hover:text-foreground";
        if (f.href) {
          return (
            <Link key={i} to={f.href} className={cls}>
              {f.label}
              <ArrowRight className="h-3 w-3" />
            </Link>
          );
        }
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(f.prompt ?? f.label)}
            className={cls}
          >
            {f.label}
          </button>
        );
      })}
    </div>
  );
}

/** Heuristic follow-up derivation from the assistant's final text. */
export function deriveFollowUps(text: string): FollowUp[] {
  const t = text.toLowerCase();
  const suggestions: FollowUp[] = [];
  if (t.includes("fee") || t.includes("unpaid") || t.includes("overdue")) {
    suggestions.push(
      { label: "View fee ledger", href: "/dashboard/fees" },
      { label: "Send reminders", prompt: "Send fee reminders to all overdue students" },
    );
  }
  if (t.includes("attendance") || t.includes("absent")) {
    suggestions.push({ label: "Open attendance", href: "/dashboard/attendance" });
  }
  if (t.includes("admission") || t.includes("lead")) {
    suggestions.push({ label: "Open admissions", href: "/dashboard/registrations" });
  }
  if (t.includes("student") || t.includes("player")) {
    suggestions.push({ label: "Open students", href: "/dashboard/students" });
  }
  if (t.includes("report") || t.includes("insight")) {
    suggestions.push({ label: "Open reports", href: "/dashboard/reports" });
  }
  return suggestions.slice(0, 4);
}

/** Extract recommended_actions from any tool envelopes on the message. */
export function extractRecommendedActions(parts: readonly unknown[]): FollowUp[] {
  const out: FollowUp[] = [];
  for (const p of parts) {
    if (!p || typeof p !== "object") continue;
    const output = (p as { output?: unknown }).output;
    if (!output || typeof output !== "object") continue;
    const rec = (output as { recommended_actions?: unknown }).recommended_actions;
    if (!Array.isArray(rec)) continue;
    for (const r of rec) {
      if (!r || typeof r !== "object") continue;
      const label = (r as { label?: string }).label;
      if (!label) continue;
      out.push({
        label,
        href: (r as { href?: string }).href,
        prompt: (r as { prompt?: string }).prompt,
      });
    }
  }
  return out;
}
