import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Award,
  ChevronRight,
  LineChart,
  ListOrdered,
  Medal,
  Sparkles,
  Trophy,
} from "lucide-react";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";

export const Route = createFileRoute("/match-center/insights")({
  head: () => ({ meta: [{ title: "Insights · Match Center" }, { name: "robots", content: "noindex" }] }),
  component: InsightsHub,
});

const CARDS: Array<{
  to: string;
  label: string;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { to: "/match-center/leaderboards", label: "Leaderboards", hint: "Top run-scorers, wicket-takers, all-rounders", icon: ListOrdered },
  { to: "/match-center/records", label: "Records", hint: "Team & academy records", icon: Trophy },
  { to: "/match-center/performance", label: "Performance", hint: "Player trends & form", icon: LineChart },
  { to: "/match-center/recognition", label: "Recognitions", hint: "Player-of-the-match, badges", icon: Award },
  { to: "/match-center/awards", label: "Awards", hint: "Season honours & certificates", icon: Medal },
  { to: "/match-center/ai-insights", label: "AI Insights", hint: "Automated match & player insights", icon: Sparkles },
];

function InsightsHub() {
  return (
    <div>
      <PageHeader title="Insights" description="Records, leaderboards, trends and awards across your academy." />
      <div className="grid gap-3 sm:grid-cols-2">
        {CARDS.map((c) => (
          <Link
            key={c.to}
            to={c.to}
            className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-4 no-tap-highlight transition-colors active:bg-accent/40"
          >
            <div
              className="grid size-11 shrink-0 place-items-center rounded-xl text-white"
              style={{ backgroundColor: "var(--tenant-brand, var(--brand, #E8873C))" }}
            >
              <c.icon className="size-[20px]" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[15px] font-semibold leading-tight">{c.label}</div>
              <div className="mt-0.5 truncate text-[12.5px] text-muted-foreground">{c.hint}</div>
            </div>
            <ChevronRight className="size-4 text-muted-foreground/60 transition-transform group-active:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </div>
  );
}
