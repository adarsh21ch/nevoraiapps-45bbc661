import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy, Globe, Loader2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  matchId: string;
  academyId: string;
}

type PublicRow = {
  id: string;
  match_id: string;
  academy_id: string;
  public_slug: string;
  is_public: boolean;
  allow_live_score: boolean;
  allow_scorecard: boolean;
  allow_player_profiles: boolean;
  allow_match_summary: boolean;
};

function generateSlug() {
  return Math.random().toString(36).slice(2, 8) + Math.random().toString(36).slice(2, 6);
}

export function ShareMatchDialog({ open, onOpenChange, matchId, academyId }: Props) {
  const qc = useQueryClient();
  const [local, setLocal] = useState<PublicRow | null>(null);

  const q = useQuery({
    enabled: open,
    queryKey: ["mc-public-match", matchId],
    queryFn: async (): Promise<PublicRow | null> => {
      const { data, error } = await supabase
        .from("mc_public_matches")
        .select("*")
        .eq("match_id", matchId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (q.data) setLocal(q.data);
  }, [q.data]);

  const updateM = useMutation({
    mutationFn: async (patch: Partial<PublicRow>) => {
      if (!local) return;
      const { error } = await supabase
        .from("mc_public_matches")
        .update(patch)
        .eq("id", local.id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mc-public-match", matchId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createM = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("mc_public_matches").insert({
        match_id: matchId,
        academy_id: academyId,
        public_slug: generateSlug(),
        is_public: true,
        allow_live_score: true,
        allow_scorecard: true,
        allow_player_profiles: true,
        allow_match_summary: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["mc-public-match", matchId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });


  const url = local
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/m/${local.public_slug}`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="size-4" /> Share live match
          </DialogTitle>
          <DialogDescription>
            Public viewers see live score and scorecard only. Fees, contact info and personal data are never exposed.
          </DialogDescription>
        </DialogHeader>

        {q.isLoading ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin inline mr-1.5" /> Loading…
          </div>
        ) : !local ? (
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              This match isn't public yet. Enable sharing to generate a link.
            </p>
            <Button onClick={() => createM.mutate()} disabled={createM.isPending}>
              {createM.isPending ? "Creating…" : "Enable public sharing"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Input readOnly value={url} className="font-mono text-xs" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void navigator.clipboard.writeText(url);
                  toast.success("Link copied");
                }}
              >
                <Copy className="size-3.5" />
              </Button>
            </div>

            <div className="space-y-3 rounded-lg border border-border p-3">
              <ToggleRow
                label="Publicly accessible"
                desc="Turn off to make the link stop working."
                value={local.is_public}
                onChange={(v) => updateM.mutate({ is_public: v })}
              />
              <ToggleRow
                label="Show live score"
                desc="Runs, wickets, current batters and bowler."
                value={local.allow_live_score}
                onChange={(v) => updateM.mutate({ allow_live_score: v })}
              />
              <ToggleRow
                label="Show scorecard"
                desc="Detailed batting and bowling figures."
                value={local.allow_scorecard}
                onChange={(v) => updateM.mutate({ allow_scorecard: v })}
              />
              <ToggleRow
                label="Show player names"
                desc="Squad and roles. Names only — no contact info."
                value={local.allow_player_profiles}
                onChange={(v) => updateM.mutate({ allow_player_profiles: v })}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToggleRow({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <Label className="text-sm font-medium">{label}</Label>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} />
    </div>
  );
}
