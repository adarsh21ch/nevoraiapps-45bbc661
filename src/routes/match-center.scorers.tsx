import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { useDashboard } from "@/lib/dashboard-context";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Trash2, UserPlus, ShieldCheck, Copy } from "lucide-react";

export const Route = createFileRoute("/match-center/scorers")({
  head: () => ({ meta: [{ title: "Scorers · Match Center" }, { name: "robots", content: "noindex" }] }),
  component: ScorersPage,
});

type ScorerRow = {
  id: string;
  user_id: string;
  display_name: string | null;
  status: string;
  created_at: string;
};

type Candidate = { user_id: string; role: string; name: string | null };

function ScorersPage() {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [selectedUser, setSelectedUser] = useState<Candidate | null>(null);
  const [search, setSearch] = useState("");

  const scorersQ = useQuery({
    queryKey: ["mc-scorers", tenant.id],
    queryFn: async (): Promise<ScorerRow[]> => {
      const { data, error } = await supabase
        .from("mc_scorers")
        .select("id,user_id,display_name,status,created_at")
        .eq("tenant_id", tenant.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const candidatesQ = useQuery({
    enabled: addOpen,
    queryKey: ["mc-scorer-candidates", tenant.id],
    queryFn: async (): Promise<Candidate[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id,role")
        .eq("tenant_id", tenant.id);
      if (error) throw error;
      return (data ?? []).map((p) => ({ user_id: p.user_id, role: p.role, name: null }));
    },
  });

  const addM = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error("Pick a user");
      const { error } = await supabase.from("mc_scorers").insert({
        tenant_id: tenant.id,
        user_id: selectedUser.user_id,
        display_name: displayName.trim() || null,
        status: "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Scorer added");
      setAddOpen(false);
      setSelectedUser(null);
      setDisplayName("");
      void qc.invalidateQueries({ queryKey: ["mc-scorers", tenant.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revokeM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mc_scorers").update({ status: "revoked" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Access revoked");
      void qc.invalidateQueries({ queryKey: ["mc-scorers", tenant.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activateM = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("mc_scorers").update({ status: "active" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["mc-scorers", tenant.id] }),
  });

  const scorerLink = `${typeof window !== "undefined" ? window.location.origin : ""}/scorer`;

  return (
    <div>
      <PageHeader
        title="Scorers"
        description="Grant limited scoring access. Scorers can score live matches; they cannot view fees, payments, or academy PII."
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Scorers" },
        ]}
        actions={
          <Button onClick={() => setAddOpen(true)}>
            <UserPlus className="size-4 mr-1.5" /> Add scorer
          </Button>
        }
      />

      <Card className="p-4 mb-4 bg-muted/30">
        <div className="flex items-start gap-3">
          <ShieldCheck className="size-5 mt-0.5 text-primary" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium">Scorer sign-in link</div>
            <div className="text-xs text-muted-foreground mb-2">
              Share this with your assigned scorers. They sign in with their account and see only their scoring surface.
            </div>
            <div className="flex items-center gap-2">
              <Input readOnly value={scorerLink} className="text-xs font-mono" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(scorerLink);
                  toast.success("Link copied");
                }}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        {scorersQ.isLoading ? (
          <div className="p-6 text-sm text-muted-foreground">Loading…</div>
        ) : (scorersQ.data ?? []).length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No scorers yet. Add one to delegate live scoring.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {(scorersQ.data ?? []).map((s) => (
              <li key={s.id} className="flex items-center gap-3 p-3">
                <div className="size-9 rounded-full bg-primary/10 grid place-items-center text-primary font-semibold text-sm">
                  {(s.display_name ?? "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {s.display_name ?? "Unnamed scorer"}
                  </div>
                  <div className="text-[11px] text-muted-foreground font-mono truncate">
                    {s.user_id}
                  </div>
                </div>
                <Badge variant={s.status === "active" ? "default" : "secondary"}>
                  {s.status}
                </Badge>
                {s.status === "active" ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeM.mutate(s.id)}
                    className="text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => activateM.mutate(s.id)}>
                    Reactivate
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add scorer</DialogTitle>
            <DialogDescription>
              Pick an existing member of your academy. They must have signed in at least once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Search by user id…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
              {(candidatesQ.data ?? [])
                .filter((c) => !search || c.user_id.includes(search))
                .map((c) => (
                  <button
                    key={c.user_id}
                    type="button"
                    onClick={() => setSelectedUser(c)}
                    className={`w-full text-left px-3 py-2 text-xs font-mono hover:bg-accent/50 ${
                      selectedUser?.user_id === c.user_id ? "bg-accent" : ""
                    }`}
                  >
                    <div className="truncate">{c.user_id}</div>
                    <div className="text-[10px] text-muted-foreground uppercase">{c.role}</div>
                  </button>
                ))}
              {(candidatesQ.data ?? []).length === 0 && !candidatesQ.isLoading && (
                <div className="p-3 text-xs text-muted-foreground">No academy members found.</div>
              )}
            </div>
            <Input
              placeholder="Display name (optional)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => addM.mutate()}
              disabled={!selectedUser || addM.isPending}
            >
              {addM.isPending ? "Adding…" : "Add scorer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
