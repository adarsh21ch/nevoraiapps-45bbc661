import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Trophy,
  Award,
  BarChart3,
  Sparkles,
  Users,
  Radio,
  ChevronRight,
  Swords,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/lib/tenant-context";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/insights")({
  head: () => ({
    meta: [
      { title: "Insights & Records — Academy" },
      {
        name: "description",
        content:
          "Live matches, academy records, leaderboards, awards and player insights at a glance.",
      },
    ],
  }),
  component: InsightsPage,
});

function InsightsPage() {
  const tenant = useTenant();

  const liveQ = useQuery({
    queryKey: ["insights-live", tenant.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("mc_matches")
        .select("id, team_a_id, team_b_id, match_type, ground_name, status")
        .eq("tenant_id", tenant.id)
        .eq("status", "live")
        .limit(5);
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const live = liveQ.data ?? [];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-24 pt-4 md:pb-8">
      <header className="mb-4">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
          Insights
        </div>
        <h1 className="mt-0.5 text-2xl font-black tracking-tight">
          Records & performance
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Live scores, career records, leaderboards and player insights across your academy.
        </p>
      </header>

      {live.length > 0 && (
        <section className="mb-5">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-destructive">
            <span className="grid size-4 place-items-center">
              <span className="size-2 animate-pulse rounded-full bg-destructive" />
            </span>
            Live now
          </div>
          <ul className="space-y-2">
            {live.map((m) => (
              <li key={m.id}>
                <Link
                  to="/match/$slug"
                  params={{ slug: m.id }}
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm transition active:scale-[0.99]"
                >
                  <span className="grid size-9 place-items-center rounded-full bg-destructive/15 text-destructive">
                    <Radio className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-bold">
                      {m.match_type || "Live match"}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {m.ground_name || "In progress"}
                    </span>
                  </span>
                  <ChevronRight className="size-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3">
        <InsightTile
          to="/match-center/records"
          icon={<Trophy className="size-5" />}
          title="Academy records"
          desc="All-time bests"
          tone="amber"
        />
        <InsightTile
          to="/match-center/leaderboards"
          icon={<BarChart3 className="size-5" />}
          title="Leaderboards"
          desc="Top run-scorers & wicket-takers"
          tone="indigo"
        />
        <InsightTile
          to="/star-players"
          icon={<Sparkles className="size-5" />}
          title="Star players"
          desc="Standout performers"
          tone="emerald"
        />
        <InsightTile
          to="/match-center/awards"
          icon={<Award className="size-5" />}
          title="Awards"
          desc="Player of the match, MVP"
          tone="rose"
        />
        <InsightTile
          to="/match-center/players"
          icon={<Users className="size-5" />}
          title="Player profiles"
          desc="Career stats"
          tone="sky"
        />
        <InsightTile
          to="/match-center"
          icon={<Swords className="size-5" />}
          title="Match Center"
          desc="Create & manage matches"
          tone="slate"
        />
      </section>
    </main>
  );
}

function InsightTile({
  to,
  icon,
  title,
  desc,
  tone,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  tone: "amber" | "indigo" | "emerald" | "rose" | "sky" | "slate";
}) {
  const toneClasses: Record<typeof tone, string> = {
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    sky: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    slate: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  };
  return (
    <Link to={to} className="block">
      <Card className="grid h-full grid-rows-[auto_1fr_auto] gap-2 rounded-2xl border p-4 transition duration-100 active:scale-[0.98]">
        <span
          className={cn(
            "grid size-10 place-items-center rounded-xl",
            toneClasses[tone],
          )}
          aria-hidden
        >
          {icon}
        </span>
        <div>
          <div className="text-[14px] font-black leading-tight">{title}</div>
          <div className="mt-0.5 text-[11.5px] leading-tight text-muted-foreground">
            {desc}
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-bold text-primary">
          Open <ChevronRight className="size-3" />
        </div>
      </Card>
    </Link>
  );
}
