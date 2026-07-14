import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Radio, Swords, Users, LineChart, UserCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/lib/dashboard-context";
import { cn } from "@/lib/utils";

type Tab = {
  to: string;
  match: string[]; // pathname prefixes considered active for this tab
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const TABS: Tab[] = [
  {
    to: "/match-center/live",
    match: ["/match-center/live", "/match-center/create", "/match-center", "/match-center/dashboard", "/scorer"],
    label: "Live",
    icon: Radio,
  },
  {
    to: "/match-center/matches",
    match: ["/match-center/matches", "/match-center/scorebook", "/match-center/teams", "/match-center/tournaments"],
    label: "Matches",
    icon: Swords,
  },
  {
    to: "/match-center/players",
    match: ["/match-center/players"],
    label: "Players",
    icon: Users,
  },
  {
    to: "/match-center/insights",
    match: [
      "/match-center/insights",
      "/match-center/leaderboards",
      "/match-center/records",
      "/match-center/performance",
      "/match-center/ai-insights",
      "/match-center/recognition",
      "/match-center/awards",
    ],
    label: "Insights",
    icon: LineChart,
  },
  {
    to: "/match-center/profile",
    match: ["/match-center/profile", "/match-center/settings", "/match-center/scorers", "/match-center/website"],
    label: "Profile",
    icon: UserCircle,
  },
];

export function MatchCenterBottomNav() {
  const { tenant } = useDashboard();
  const location = useLocation();

  const liveMatches = useQuery({
    queryKey: ["mc-live-count", tenant.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("mc_matches" as never)
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenant.id)
        .eq("status", "live");
      return count ?? 0;
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/85 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Match Center navigation"
    >
      <div className="mx-auto grid max-w-2xl grid-cols-5">
        {TABS.map((tab) => {
          const active = tab.match.some(
            (p) => location.pathname === p || location.pathname.startsWith(p + "/"),
          );
          const Icon = tab.icon;
          const showLiveDot = tab.label === "Live" && (liveMatches.data ?? 0) > 0;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 py-2 pb-2.5 no-tap-highlight transition-colors",
                active ? "text-foreground" : "text-muted-foreground/70",
              )}
              style={
                active
                  ? { color: "var(--tenant-brand, var(--brand, #E8873C))" }
                  : undefined
              }
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
            >
              <div className="relative grid h-7 w-12 place-items-center">
                <Icon className={cn("size-[22px]", active && "stroke-[2.25]")} />
                {showLiveDot && (
                  <span className="absolute right-2 top-0.5 flex size-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-red-500" />
                  </span>
                )}
              </div>
              <span
                className={cn(
                  "text-[10.5px] font-medium tracking-tight leading-none",
                  active ? "font-semibold" : "",
                )}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
