import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  User,
  Radio,
  Trophy,
  Medal,
  Award,
  Clock,
  BarChart3,
  Search,
  LogOut,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { listParentChildren, getChildSummary, type ParentChild, type ChildSummary } from "@/lib/mc-parent-portal";

export const Route = createFileRoute("/parent-portal")({
  head: () => ({
    meta: [
      { title: "Parent Portal · Academy OS" },
      { name: "description", content: "Follow your child's cricket development — matches, achievements and recognitions." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ParentPortal,
});

function ParentPortal() {
  const navigate = useNavigate();
  const [userChecked, setUserChecked] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setSignedIn(Boolean(data.user));
      setUserChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setSignedIn(Boolean(session?.user));
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const kidsQ = useQuery({
    queryKey: ["parent-children"],
    queryFn: () => listParentChildren(),
    enabled: signedIn,
  });

  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!selected && kidsQ.data && kidsQ.data.length > 0) setSelected(kidsQ.data[0].student_id);
  }, [kidsQ.data, selected]);

  if (!userChecked) return <PageSkeleton />;
  if (!signedIn) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <Card className="p-6 max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold">Sign in required</h1>
          <p className="text-sm text-muted-foreground">Please sign in with the account linked to your child.</p>
          <Button onClick={() => navigate({ to: "/auth" })}>Go to sign in</Button>
        </Card>
      </div>
    );
  }
  if (kidsQ.isLoading) return <PageSkeleton />;
  const kids = kidsQ.data ?? [];
  if (kids.length === 0) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <Card className="p-6 max-w-md text-center space-y-3">
          <h1 className="text-xl font-semibold">No linked children</h1>
          <p className="text-sm text-muted-foreground">Ask your academy admin to link your account to your child's profile.</p>
          <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}>
            <LogOut className="size-4 mr-1" /> Sign out
          </Button>
        </Card>
      </div>
    );
  }

  const active = kids.find((k) => k.student_id === selected) ?? kids[0];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-muted-foreground uppercase tracking-wide">Parent Portal</div>
            <h1 className="text-2xl font-bold truncate">{active.student_name}</h1>
            <p className="text-xs text-muted-foreground">
              {active.relationship}{active.is_primary ? " · primary" : ""}{active.player_id ? ` · ${active.player_id}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {kids.length > 1 && (
              <ChildSwitcher kids={kids} selected={active.student_id} onChange={setSelected} />
            )}
            <Button variant="outline" size="sm" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/auth" }); }}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto p-4">
        <ChildTabs studentId={active.student_id} kid={active} />
      </main>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-4">
      <Skeleton className="h-24" />
      <Skeleton className="h-96" />
    </div>
  );
}

function ChildSwitcher({ kids, selected, onChange }: { kids: ParentChild[]; selected: string; onChange: (id: string) => void }) {
  return (
    <div className="flex gap-1 flex-wrap">
      {kids.map((k) => (
        <Button
          key={k.student_id}
          size="sm"
          variant={k.student_id === selected ? "default" : "outline"}
          onClick={() => onChange(k.student_id)}
        >
          {k.student_name}
        </Button>
      ))}
    </div>
  );
}

function ChildTabs({ studentId, kid }: { studentId: string; kid: ParentChild }) {
  const q = useQuery({
    queryKey: ["parent-child-summary", studentId],
    queryFn: () => getChildSummary(studentId),
    refetchInterval: 30_000,
  });

  useEffect(() => {
    // Realtime nudge: when any ball event changes for a match our child was in,
    // silently refetch. Broad channel scoped to their tenant.
    const channel = supabase
      .channel(`parent-portal-${studentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mc_ball_events" }, () => q.refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId, q]);

  if (q.isLoading || !q.data) return <Skeleton className="h-96" />;
  const s = q.data;

  return (
    <Tabs defaultValue="dashboard">
      <TabsList className="flex-wrap">
        <TabsTrigger value="dashboard"><User className="size-4 mr-1" />Dashboard</TabsTrigger>
        <TabsTrigger value="matches"><Trophy className="size-4 mr-1" />Matches</TabsTrigger>
        <TabsTrigger value="performance"><BarChart3 className="size-4 mr-1" />Performance</TabsTrigger>
        <TabsTrigger value="recognitions"><Award className="size-4 mr-1" />Recognitions</TabsTrigger>
        <TabsTrigger value="achievements"><Medal className="size-4 mr-1" />Achievements</TabsTrigger>
        <TabsTrigger value="timeline"><Clock className="size-4 mr-1" />Timeline</TabsTrigger>
      </TabsList>

      <TabsContent value="dashboard" className="pt-4"><DashboardTab summary={s} kid={kid} /></TabsContent>
      <TabsContent value="matches" className="pt-4"><MatchesTab summary={s} /></TabsContent>
      <TabsContent value="performance" className="pt-4"><PerformanceTab summary={s} /></TabsContent>
      <TabsContent value="recognitions" className="pt-4"><RecognitionsTab summary={s} /></TabsContent>
      <TabsContent value="achievements" className="pt-4"><AchievementsTab summary={s} /></TabsContent>
      <TabsContent value="timeline" className="pt-4"><TimelineTab summary={s} /></TabsContent>
    </Tabs>
  );
}

function DashboardTab({ summary, kid }: { summary: ChildSummary; kid: ParentChild }) {
  const c = (summary.career ?? {}) as Record<string, number | string | null>;
  const cp = (summary.cricket_profile ?? {}) as Record<string, string | number | null>;
  const student = (summary.student ?? {}) as Record<string, string | null>;
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="p-4 md:col-span-1">
        <div className="flex items-center gap-3">
          {kid.photo_url ? (
            <img src={kid.photo_url} alt="" className="size-16 rounded-full object-cover" />
          ) : (
            <div className="size-16 rounded-full bg-muted grid place-items-center"><User className="size-6 text-muted-foreground" /></div>
          )}
          <div>
            <div className="font-semibold">{kid.student_name}</div>
            <div className="text-xs text-muted-foreground">{kid.player_id ?? ""}</div>
          </div>
        </div>
        <div className="mt-4 text-sm space-y-1">
          <div><span className="text-muted-foreground">Role:</span> {String(cp.playing_role ?? "—")}</div>
          <div><span className="text-muted-foreground">Batting:</span> {String(cp.batting_style ?? "—")}</div>
          <div><span className="text-muted-foreground">Bowling:</span> {String(cp.bowling_style ?? "—")}</div>
          <div><span className="text-muted-foreground">DOB:</span> {String(student.dob ?? "—")}</div>
        </div>
      </Card>

      <Card className="p-4 md:col-span-2">
        <div className="text-xs uppercase text-muted-foreground mb-2">Career summary</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Stat label="Matches" value={c.matches ?? 0} />
          <Stat label="Runs" value={c.runs ?? 0} />
          <Stat label="Wickets" value={c.wickets ?? 0} />
          <Stat label="Avg" value={c.average != null ? Number(c.average).toFixed(2) : "—"} />
          <Stat label="SR" value={c.strike_rate != null ? Number(c.strike_rate).toFixed(1) : "—"} />
          <Stat label="Highest" value={`${c.highest_score ?? 0}${c.highest_score_not_out ? "*" : ""}`} />
          <Stat label="Best bowl" value={String(c.best_bowling ?? "—")} />
          <Stat label="POM" value={c.player_of_match ?? 0} />
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function MatchesTab({ summary }: { summary: ChildSummary }) {
  const [q, setQ] = useState("");
  const matches = summary.recent_matches ?? [];
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return matches;
    return matches.filter((m) =>
      `${m.result ?? ""} ${m.scheduled_date ?? ""}`.toLowerCase().includes(t),
    );
  }, [q, matches]);
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search matches…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-9" />
      </div>
      {filtered.length === 0 && <Card className="p-6 text-sm text-muted-foreground">No matches yet.</Card>}
      {filtered.map((m) => (
        <Card key={m.match_id} className="p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground">{m.scheduled_date ?? ""}</div>
            <div className="font-medium">{m.result ?? (m.match_locked ? "Finalized" : "In progress")}</div>
          </div>
          {m.match_locked ? <Badge>Finalized</Badge> : <Badge variant="outline"><Radio className="size-3 mr-1" />Live</Badge>}
        </Card>
      ))}
    </div>
  );
}

function PerformanceTab({ summary }: { summary: ChildSummary }) {
  const c = (summary.career ?? {}) as Record<string, number>;
  if (!summary.career) return <Card className="p-6 text-sm text-muted-foreground">No performance data yet.</Card>;
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-4">
        <div className="text-xs uppercase text-muted-foreground mb-2">Batting</div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Stat label="Innings" value={c.innings ?? 0} />
          <Stat label="Runs" value={c.runs ?? 0} />
          <Stat label="Avg" value={c.average ? Number(c.average).toFixed(2) : "—"} />
          <Stat label="SR" value={c.strike_rate ? Number(c.strike_rate).toFixed(1) : "—"} />
          <Stat label="50s" value={c.fifties ?? 0} />
          <Stat label="100s" value={c.hundreds ?? 0} />
          <Stat label="4s" value={c.fours ?? 0} />
          <Stat label="6s" value={c.sixes ?? 0} />
        </div>
      </Card>
      <Card className="p-4">
        <div className="text-xs uppercase text-muted-foreground mb-2">Bowling</div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Stat label="Wickets" value={c.wickets ?? 0} />
          <Stat label="Overs" value={c.overs ?? 0} />
          <Stat label="Econ" value={c.economy ? Number(c.economy).toFixed(2) : "—"} />
          <Stat label="Best" value={String((c as unknown as { best_bowling?: string }).best_bowling ?? "—")} />
          <Stat label="5-fer" value={c.five_wicket_hauls ?? 0} />
          <Stat label="Maidens" value={c.maidens ?? 0} />
        </div>
      </Card>
      <Card className="p-4">
        <div className="text-xs uppercase text-muted-foreground mb-2">Fielding</div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Stat label="Catches" value={c.catches ?? 0} />
          <Stat label="Stumpings" value={c.stumpings ?? 0} />
          <Stat label="Run outs" value={c.run_outs ?? 0} />
        </div>
      </Card>
      <Card className="p-4">
        <div className="text-xs uppercase text-muted-foreground mb-2">Captaincy</div>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Stat label="Led" value={c.captain_matches ?? 0} />
          <Stat label="Wins" value={c.captain_wins ?? 0} />
          <Stat label="Losses" value={c.captain_losses ?? 0} />
        </div>
      </Card>
    </div>
  );
}

function RecognitionsTab({ summary }: { summary: ChildSummary }) {
  const items = summary.recognitions ?? [];
  if (items.length === 0) return <Card className="p-6 text-sm text-muted-foreground">No published recognitions yet.</Card>;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((r) => {
        const rr = r as { id: string; title: string; description?: string; awarded_at?: string; recognition_type: string; badge?: string; image_url?: string };
        return (
          <Card key={rr.id} className="p-4">
            <div className="flex items-start gap-3">
              {rr.image_url && <img src={rr.image_url} alt="" className="size-14 rounded object-cover" />}
              <div className="min-w-0">
                <Badge variant="outline" className="mb-1 capitalize">{rr.recognition_type.replace(/_/g, " ")}</Badge>
                <div className="font-semibold">{rr.title}</div>
                {rr.description && <p className="text-sm text-muted-foreground">{rr.description}</p>}
                {rr.awarded_at && <div className="text-xs text-muted-foreground mt-1">{new Date(rr.awarded_at).toLocaleDateString()}</div>}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function AchievementsTab({ summary }: { summary: ChildSummary }) {
  const items = summary.achievements ?? [];
  if (items.length === 0) return <Card className="p-6 text-sm text-muted-foreground">No achievements yet.</Card>;
  return (
    <div className="space-y-2">
      {items.map((a) => {
        const aa = a as { id: string; title: string; description?: string; event_date?: string; kind?: string };
        return (
          <Card key={aa.id} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-medium">{aa.title}</div>
                {aa.description && <p className="text-sm text-muted-foreground">{aa.description}</p>}
              </div>
              <Badge variant="outline">{aa.kind ?? ""}</Badge>
            </div>
            {aa.event_date && <div className="text-xs text-muted-foreground mt-1">{new Date(aa.event_date).toLocaleDateString()}</div>}
          </Card>
        );
      })}
    </div>
  );
}

function TimelineTab({ summary }: { summary: ChildSummary }) {
  const items = summary.timeline ?? [];
  if (items.length === 0) return <Card className="p-6 text-sm text-muted-foreground">Timeline is empty.</Card>;
  return (
    <div className="space-y-3">
      {items.map((t) => {
        const tt = t as { id: string; title: string; description?: string; event_date?: string; image_url?: string };
        return (
          <Card key={tt.id} className="p-4 flex gap-3">
            {tt.image_url && <img src={tt.image_url} alt="" className="size-14 rounded object-cover" />}
            <div className="min-w-0 flex-1">
              <div className="font-medium">{tt.title}</div>
              {tt.description && <p className="text-sm text-muted-foreground">{tt.description}</p>}
              {tt.event_date && <div className="text-xs text-muted-foreground mt-1">{new Date(tt.event_date).toLocaleDateString()}</div>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
