import { Card } from "@/components/ui/card";
import { Sparkles } from "lucide-react";

const PROMPTS = [
  "Brief me on today",
  "Who hasn't paid this month?",
  "Show pending admissions",
  "Attendance for this week",
  "Any automation failures?",
  "Revenue trend last 30 days",
];

/**
 * First-run welcome card shown above the chat panel until the owner
 * starts their first conversation.
 */
export function WelcomeExperience({ onPick }: { onPick?: (prompt: string) => void }) {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border/60 bg-gradient-to-r from-primary/10 via-transparent to-transparent px-5 py-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          Meet NevorAI
        </div>
        <h2 className="mt-1 text-lg font-semibold tracking-tight">
          Hi, I'm NevorAI — your AI Academy Manager.
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          I can help you monitor attendance, fees, admissions, reports and academy performance.
          Everything I do cites the underlying data — and I never write anything without your
          approval.
        </p>
      </div>
      <div className="px-5 py-4">
        <div className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
          Try asking
        </div>
        <div className="flex flex-wrap gap-2">
          {PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPick?.(p)}
              className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-foreground/80 transition hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
            >
              {p}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
