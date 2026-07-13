import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Search, RefreshCw, FileText, Trash2, Trophy, User, Users2, Medal } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { SectionTitle, EmptyState } from "@/components/match-center/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboard } from "@/lib/dashboard-context";
import { supabase } from "@/integrations/supabase/client";
import {
  listReports,
  searchReports,
  deleteReport,
  getAISettings,
  updateAISettings,
  generateAndSaveMatchReport,
  generateAndSavePlayerReport,
  generateAndSaveTeamReport,
  generateAndSaveTournamentReport,
  generateAndSaveAcademyMonthly,
  type MCAIReport,
  type AIReportType,
} from "@/lib/mc-ai-engine";

export const Route = createFileRoute("/match-center/ai-insights")({
  component: AIInsightsPage,
});

function ReportCard({ r, onDelete }: { r: MCAIReport; onDelete: (id: string) => void }) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="capitalize">{r.report_type.replace("_", " ")}</Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(r.generated_at).toLocaleString()}
            </span>
          </div>
          <h3 className="font-semibold mt-1 truncate">{r.title}</h3>
          {r.summary && <p className="text-sm text-muted-foreground mt-1">{r.summary}</p>}
        </div>
        <Button size="icon" variant="ghost" onClick={() => onDelete(r.id)} aria-label="Delete">
          <Trash2 className="size-4" />
        </Button>
      </div>

      {Array.isArray(r.key_findings) && r.key_findings.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase text-muted-foreground mb-1">Key findings</div>
          <ul className="text-sm space-y-0.5">
            {(r.key_findings as Array<{ label: string; detail?: string }>).map((f, i) => (
              <li key={i}>• <span className="font-medium">{f.label}</span>{f.detail ? ` — ${f.detail}` : ""}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {Array.isArray(r.strengths) && r.strengths.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase text-emerald-600 mb-1">Strengths</div>
            <ul className="text-sm space-y-0.5">
              {(r.strengths as Array<{ label: string; detail?: string }>).map((f, i) => (
                <li key={i}>• {f.label}{f.detail ? ` — ${f.detail}` : ""}</li>
              ))}
            </ul>
          </div>
        )}
        {Array.isArray(r.weaknesses) && r.weaknesses.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase text-amber-600 mb-1">Weaknesses</div>
            <ul className="text-sm space-y-0.5">
              {(r.weaknesses as Array<{ label: string; detail?: string }>).map((f, i) => (
                <li key={i}>• {f.label}{f.detail ? ` — ${f.detail}` : ""}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {Array.isArray(r.recommendations) && r.recommendations.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase text-primary mb-1">Recommendations</div>
          <ul className="text-sm space-y-0.5">
            {(r.recommendations as Array<{ label: string; detail?: string }>).map((f, i) => (
              <li key={i}>• <span className="font-medium">{f.label}</span>{f.detail ? ` — ${f.detail}` : ""}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function ReportList({ tenantId, reportType }: { tenantId: string; reportType?: AIReportType }) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["mc-ai-reports", tenantId, reportType ?? "all", search],
    queryFn: () =>
      search.trim() ? searchReports(tenantId, search.trim()) : listReports(tenantId, { reportType, limit: 100 }),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteReport(id),
    onSuccess: () => {
      toast.success("Report deleted");
      qc.invalidateQueries({ queryKey: ["mc-ai-reports", tenantId] });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reports…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      {q.isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : (q.data ?? []).length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No reports yet"
          description="Reports are generated automatically after match finalization or on demand."
        />
      ) : (
        <div className="space-y-3">
          {(q.data ?? []).map((r) => (
            <ReportCard key={r.id} r={r} onDelete={(id) => del.mutate(id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function GenerateForm({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const [scope, setScope] = useState<AIReportType>("match");
  const [refId, setRefId] = useState<string>("");

  const matchesQ = useQuery({
    queryKey: ["mc-ai-gen-matches", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("mc_matches")
        .select("id, scheduled_date, team_a_id, team_b_id, mc_teams!mc_matches_team_a_id_fkey(name), team_b:mc_teams!mc_matches_team_b_id_fkey(name)")
        .eq("tenant_id", tenantId)
        .eq("match_locked", true)
        .order("finalized_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
    enabled: scope === "match",
  });
  const athletesQ = useQuery({
    queryKey: ["mc-ai-gen-athletes", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("mc_athlete_profiles")
        .select("id, students(name)")
        .eq("tenant_id", tenantId)
        .limit(200);
      return data ?? [];
    },
    enabled: scope === "player",
  });
  const teamsQ = useQuery({
    queryKey: ["mc-ai-gen-teams", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("mc_teams").select("id, name").eq("tenant_id", tenantId);
      return data ?? [];
    },
    enabled: scope === "team",
  });
  const tournamentsQ = useQuery({
    queryKey: ["mc-ai-gen-tournaments", tenantId],
    queryFn: async () => {
      const { data } = await supabase.from("mc_tournaments").select("id, name").eq("tenant_id", tenantId);
      return data ?? [];
    },
    enabled: scope === "tournament",
  });

  const gen = useMutation({
    mutationFn: async () => {
      const t0 = performance.now();
      if (scope === "match" && refId) await generateAndSaveMatchReport(tenantId, refId);
      else if (scope === "player" && refId) await generateAndSavePlayerReport(tenantId, refId);
      else if (scope === "team" && refId) await generateAndSaveTeamReport(tenantId, refId);
      else if (scope === "tournament" && refId) await generateAndSaveTournamentReport(tenantId, refId);
      else if (scope === "academy_monthly") await generateAndSaveAcademyMonthly(tenantId);
      else throw new Error("Select a target");
      return Math.round(performance.now() - t0);
    },
    onSuccess: (ms) => {
      toast.success(`Report generated in ${ms}ms`);
      qc.invalidateQueries({ queryKey: ["mc-ai-reports", tenantId] });
      setRefId("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Generation failed"),
  });

  const options = useMemo(() => {
    if (scope === "match")
      return (matchesQ.data ?? []).map((m) => {
        const row = m as unknown as {
          id: string;
          scheduled_date?: string | null;
          mc_teams?: { name?: string } | null;
          team_b?: { name?: string } | null;
        };
        return {
          id: row.id,
          label: `${row.mc_teams?.name ?? "A"} vs ${row.team_b?.name ?? "B"}${row.scheduled_date ? ` — ${new Date(row.scheduled_date).toLocaleDateString()}` : ""}`,
        };
      });
    if (scope === "player")
      return (athletesQ.data ?? []).map((a) => {
        const row = a as unknown as { id: string; students?: { name?: string } | null };
        return { id: row.id, label: row.students?.name ?? "Player" };
      });
    if (scope === "team") return (teamsQ.data ?? []).map((t) => ({ id: t.id, label: t.name }));
    if (scope === "tournament")
      return (tournamentsQ.data ?? []).map((t) => ({ id: t.id, label: t.name }));
    return [];
  }, [scope, matchesQ.data, athletesQ.data, teamsQ.data, tournamentsQ.data]);

  return (
    <Card className="p-4 space-y-3">
      <SectionTitle title="Generate a report" />
      <div className="grid gap-3 sm:grid-cols-[200px_1fr_auto]">
        <Select value={scope} onValueChange={(v) => { setScope(v as AIReportType); setRefId(""); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="match">Match report</SelectItem>
            <SelectItem value="player">Player report</SelectItem>
            <SelectItem value="team">Team report</SelectItem>
            <SelectItem value="tournament">Tournament report</SelectItem>
            <SelectItem value="academy_monthly">Academy monthly</SelectItem>
          </SelectContent>
        </Select>
        {scope !== "academy_monthly" ? (
          <Select value={refId} onValueChange={setRefId}>
            <SelectTrigger><SelectValue placeholder="Select target" /></SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="text-sm text-muted-foreground self-center">Aggregates current period.</div>
        )}
        <Button onClick={() => gen.mutate()} disabled={gen.isPending}>
          {gen.isPending ? <RefreshCw className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Generate
        </Button>
      </div>
    </Card>
  );
}

function SettingsPanel({ tenantId }: { tenantId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["mc-ai-settings", tenantId],
    queryFn: () => getAISettings(tenantId),
  });
  const upd = useMutation({
    mutationFn: (patch: Parameters<typeof updateAISettings>[1]) => updateAISettings(tenantId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mc-ai-settings", tenantId] });
      toast.success("Settings updated");
    },
  });
  if (q.isLoading || !q.data) return <Skeleton className="h-64" />;
  const s = q.data;
  return (
    <Card className="p-4 space-y-4 max-w-xl">
      <SectionTitle title="AI Insights settings" />
      {[
        { key: "auto_generate_match_reports", label: "Auto-generate match reports" },
        { key: "auto_generate_player_reports", label: "Auto-generate player reports" },
        { key: "auto_generate_tournament_reports", label: "Auto-generate tournament reports" },
        { key: "auto_generate_monthly_reports", label: "Auto-generate monthly reports" },
        { key: "coach_review_required", label: "Coach review required before visible" },
      ].map((row) => (
        <div key={row.key} className="flex items-center justify-between gap-4">
          <Label className="text-sm">{row.label}</Label>
          <Switch
            checked={Boolean(s[row.key as keyof typeof s])}
            onCheckedChange={(v) => upd.mutate({ [row.key]: v })}
          />
        </div>
      ))}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Language</Label>
          <Select value={s.language} onValueChange={(v) => upd.mutate({ language: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="hi">Hindi</SelectItem>
              <SelectItem value="mr">Marathi</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Tone</Label>
          <Select value={s.tone} onValueChange={(v) => upd.mutate({ tone: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="coach">Coach</SelectItem>
              <SelectItem value="analyst">Analyst</SelectItem>
              <SelectItem value="parent">Parent-friendly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
}

function AIInsightsPage() {
  const { tenant } = useDashboard();
  const tenantId = tenant.id;
  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Insights"
        description="Deterministic reports generated from Statistics, Career, Tournament, Records and Recognition engines. No cricket calculations here."
        breadcrumbs={[{ label: "Match Center", to: "/match-center/dashboard" }, { label: "AI Insights" }]}
      />
      <GenerateForm tenantId={tenantId} />
      <Tabs defaultValue="match">
        <TabsList className="flex-wrap">
          <TabsTrigger value="match"><Trophy className="size-4 mr-1" />Match</TabsTrigger>
          <TabsTrigger value="player"><User className="size-4 mr-1" />Player</TabsTrigger>
          <TabsTrigger value="team"><Users2 className="size-4 mr-1" />Team</TabsTrigger>
          <TabsTrigger value="tournament"><Trophy className="size-4 mr-1" />Tournament</TabsTrigger>
          <TabsTrigger value="academy"><Medal className="size-4 mr-1" />Academy</TabsTrigger>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="match" className="pt-4"><ReportList tenantId={tenantId} reportType="match" /></TabsContent>
        <TabsContent value="player" className="pt-4"><ReportList tenantId={tenantId} reportType="player" /></TabsContent>
        <TabsContent value="team" className="pt-4"><ReportList tenantId={tenantId} reportType="team" /></TabsContent>
        <TabsContent value="tournament" className="pt-4"><ReportList tenantId={tenantId} reportType="tournament" /></TabsContent>
        <TabsContent value="academy" className="pt-4"><ReportList tenantId={tenantId} reportType="academy_monthly" /></TabsContent>
        <TabsContent value="all" className="pt-4"><ReportList tenantId={tenantId} /></TabsContent>
        <TabsContent value="settings" className="pt-4"><SettingsPanel tenantId={tenantId} /></TabsContent>
      </Tabs>
    </div>
  );
}
