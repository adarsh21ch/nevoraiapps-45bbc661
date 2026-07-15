/* ================================================================
 * Tournament Awards
 * ----------------------------------------------------------------
 * Presentation-only. All logic delegates to:
 *   - `mc-tournament-statistics.ts`  → analytics aggregation
 *   - `mc-tournament-awards.ts`       → award derivation
 *
 * Auto-refresh is inherited from the analytics query key, which
 * `TournamentStatistics` already invalidates via the shared
 * `mc-stats-{tournamentId}` realtime channel.
 * ================================================================ */

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Award,
  Crown,
  Trophy,
  Zap,
  Shield,
  Sparkles,
  Users,
  Download,
  FileText,
  Image as ImageIcon,
  Printer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, LoadingSkeleton } from "@/components/match-center/ui";
import {
  buildTournamentAnalytics,
  loadTournamentAnalyticsData,
} from "@/lib/mc-tournament-statistics";
import {
  computeTournamentAwards,
  awardsToRows,
  type AwardWinner,
  type TeamAwardWinner,
  type TeamOfTournamentPick,
  type TournamentAwards,
} from "@/lib/mc-tournament-awards";
import {
  downloadCSV,
  downloadElementPNG,
  downloadElementPDF,
  printElement,
} from "@/lib/mc-tournament-export";
import { toast } from "sonner";

interface Props {
  tournamentId: string;
  tournamentName?: string;
  /** When true, render in a public-page style (no export toolbar, denser). */
  publicMode?: boolean;
}

export function TournamentAwardsPanel({ tournamentId, tournamentName, publicMode }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["mc-tournament-analytics", tournamentId, {}],
    queryFn: async () => {
      const data = await loadTournamentAnalyticsData(tournamentId);
      return buildTournamentAnalytics(data, {});
    },
    staleTime: 30_000,
  });

  const awards = useMemo(
    () => (q.data ? computeTournamentAwards(q.data) : null),
    [q.data],
  );

  if (q.isLoading) return <LoadingSkeleton />;
  if (!awards || q.data?.matches.length === 0)
    return (
      <EmptyState
        icon={Trophy}
        title="No awards yet"
        description="Awards populate automatically after finalized matches."
      />
    );

  const filenameBase = (tournamentName ?? "tournament") + "-awards";

  const onExportCSV = () => {
    downloadCSV(filenameBase, awardsToRows(awards));
    toast.success("CSV exported");
  };
  const onExportPNG = async () => {
    setBusy("png");
    const ok = await downloadElementPNG(ref.current, filenameBase);
    setBusy(null);
    if (!ok) toast.error("PNG export unavailable");
  };
  const onExportPDF = async () => {
    setBusy("pdf");
    const ok = await downloadElementPDF(ref.current, filenameBase);
    setBusy(null);
    if (!ok) toast.error("PDF export unavailable");
  };
  const onPrint = () => printElement(ref.current);

  return (
    <div className="space-y-4">
      {!publicMode && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="size-3.5" /> Auto-computed from finalized matches
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button variant="outline" size="sm" onClick={onExportCSV}>
              <Download className="mr-1.5 size-3.5" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={onExportPNG} disabled={busy === "png"}>
              <ImageIcon className="mr-1.5 size-3.5" /> PNG
            </Button>
            <Button variant="outline" size="sm" onClick={onExportPDF} disabled={busy === "pdf"}>
              <FileText className="mr-1.5 size-3.5" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={onPrint}>
              <Printer className="mr-1.5 size-3.5" /> Print
            </Button>
          </div>
        </div>
      )}

      <div ref={ref} className="space-y-4">
        {/* Marquee: Player of the Tournament */}
        <MarqueeAward winner={awards.playerOfTournament} />

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AwardCard icon={Crown} accent="text-amber-500" label="Orange Cap" description="Most runs" winner={awards.orangeCap} />
          <AwardCard icon={Zap} accent="text-purple-500" label="Purple Cap" description="Most wickets" winner={awards.purpleCap} />
          <AwardCard icon={Trophy} accent="text-emerald-500" label="Best Batter" description="Runs · Avg · SR" winner={awards.bestBatter} />
          <AwardCard icon={Trophy} accent="text-sky-500" label="Best Bowler" description="Wickets · Econ" winner={awards.bestBowler} />
          <AwardCard icon={Award} accent="text-rose-500" label="Best All-Rounder" description="Bat + Ball impact" winner={awards.bestAllRounder} />
          <AwardCard icon={Shield} accent="text-indigo-500" label="Best Fielder" description="Catches · Stumpings · RO" winner={awards.bestFielder} />
          <AwardCard icon={Sparkles} accent="text-fuchsia-500" label="Emerging Player" description="Top output in ≤ 3 matches" winner={awards.emergingPlayer} />
          <TeamAwardCard label="Fair Play Team" winner={awards.fairPlayTeam} />
        </div>

        <TeamOfTournament picks={awards.teamOfTournament} />
      </div>
    </div>
  );
}

/* ---------------- Bits ---------------- */

function MarqueeAward({ winner }: { winner: AwardWinner | null }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-amber-500/10 via-card to-card p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-8 -top-8 opacity-10">
        <Trophy className="size-40" />
      </div>
      <div className="relative flex items-center gap-4">
        <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-amber-500/15 text-amber-600 sm:size-16">
          <Crown className="size-8 sm:size-9" />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            Player of the Tournament
          </div>
          <div className="mt-0.5 truncate text-xl font-black tracking-tight sm:text-2xl">
            {winner?.name ?? "—"}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {winner?.headline ?? "Awaiting finalized matches"}
          </div>
        </div>
      </div>
    </div>
  );
}

function AwardCard({
  icon: Icon,
  accent,
  label,
  description,
  winner,
}: {
  icon: typeof Trophy;
  accent: string;
  label: string;
  description: string;
  winner: AwardWinner | null;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-card p-3">
      <div className={`grid size-10 shrink-0 place-items-center rounded-lg bg-muted ${accent}`}>
        <Icon className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-bold">{winner?.name ?? "—"}</div>
        <div className="truncate text-xs text-muted-foreground">{winner?.headline ?? description}</div>
      </div>
    </div>
  );
}

function TeamAwardCard({ label, winner }: { label: string; winner: TeamAwardWinner | null }) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-card p-3">
      <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-teal-500">
        <Users className="size-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="truncate text-sm font-bold">{winner?.name ?? "—"}</div>
        <div className="truncate text-xs text-muted-foreground">{winner?.headline ?? "Awaiting more matches"}</div>
      </div>
    </div>
  );
}

function TeamOfTournament({ picks }: { picks: TeamOfTournamentPick[] }) {
  if (picks.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Team of the Tournament</div>
          <div className="text-sm font-bold">Best XI · Auto-selected</div>
        </div>
        <Trophy className="size-5 text-amber-500" />
      </div>
      <ul className="grid gap-0 sm:grid-cols-2 lg:grid-cols-3">
        {picks.map((p, i) => (
          <li key={`${p.athleteId ?? p.name}-${i}`} className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0 sm:last:border-b sm:[&:nth-last-child(-n+2)]:border-b-0 lg:[&:nth-last-child(-n+3)]:border-b-0">
            <span className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-[10px] font-bold">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{p.name}</div>
              <div className="truncate text-xs text-muted-foreground">{p.headline}</div>
            </div>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider">
              {p.role}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
