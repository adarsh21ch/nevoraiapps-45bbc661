import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EditMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string;
  teamA: { id: string; name: string };
  teamB: { id: string; name: string };
  overs: number | null;
  matchFormat: string | null;
  onUpdated: () => void;
}

export function EditMatchDialog({
  open,
  onOpenChange,
  matchId,
  teamA,
  teamB,
  overs,
  matchFormat,
  onUpdated,
}: EditMatchDialogProps) {
  const [teamAName, setTeamAName] = useState(teamA.name);
  const [teamBName, setTeamBName] = useState(teamB.name);
  const [matchOvers, setMatchOvers] = useState(overs?.toString() ?? "");
  const [format, setFormat] = useState(matchFormat ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTeamAName(teamA.name);
      setTeamBName(teamB.name);
      setMatchOvers(overs?.toString() ?? "");
      setFormat(matchFormat ?? "");
    }
  }, [open, teamA.name, teamB.name, overs, matchFormat]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Update team A
      const { error: errA } = await supabase
        .from("mc_teams")
        .update({ name: teamAName })
        .eq("id", teamA.id);
      if (errA) throw errA;

      // Update team B
      const { error: errB } = await supabase
        .from("mc_teams")
        .update({ name: teamBName })
        .eq("id", teamB.id);
      if (errB) throw errB;

      // Update match
      const { error: errM } = await supabase
        .from("mc_matches")
        .update({
          overs: matchOvers ? parseInt(matchOvers, 10) : null,
          match_format: format,
        })
        .eq("id", matchId);
      if (errM) throw errM;

      toast.success("Match details updated");
      onUpdated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error updating match:", error);
      toast.error("Failed to update match details");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Match Details</DialogTitle>
          <DialogDescription>
            Change team names or match settings. These changes update globally.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="teamA">Team A Name</Label>
            <Input
              id="teamA"
              value={teamAName}
              onChange={(e) => setTeamAName(e.target.value)}
              placeholder="e.g. Mumbai Indians"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="teamB">Team B Name</Label>
            <Input
              id="teamB"
              value={teamBName}
              onChange={(e) => setTeamBName(e.target.value)}
              placeholder="e.g. Chennai Super Kings"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="overs">Overs</Label>
              <Input
                id="overs"
                type="number"
                value={matchOvers}
                onChange={(e) => setMatchOvers(e.target.value)}
                placeholder="20"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="format">Format</Label>
              <Input
                id="format"
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                placeholder="T20"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
