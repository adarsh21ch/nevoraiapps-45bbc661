import React, { useState, useEffect } from "react";
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle, 
  SheetDescription 
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Pencil, 
  Trash2, 
  UserPlus, 
  ArrowLeftRight, 
  Search, 
  Settings2,
  Check,
  X,
  User
} from "lucide-react";
import { MobileViewportShell } from "@/components/ds/MobileViewportShell";
import { 
  renameGuestSquadPlayer, 
  replaceSquadPlayer, 
  removeSquadPlayer, 
  addSquadPlayer, 
  renameMatchTeam, 
  reorderSquad 
} from "@/lib/mc-squad-editing.functions";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Avatar } from "@/components/match-center/athlete-ui";
import { listStudents } from "@/lib/mc-teams";
import { useServerFn } from "@tanstack/react-start";

interface SquadEditorSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  matchId: string;
  session: any;
  teams: any[];
  nameMap: Record<string, string>;
  onRefresh: () => void;
}

export function SquadEditorSheet({
  open,
  onOpenChange,
  matchId,
  session,
  teams,
  nameMap,
  onRefresh
}: SquadEditorSheetProps) {
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [teamNameValue, setTeamNameValue] = useState("");
  const [replacingSquadId, setReplacingSquadId] = useState<string | null>(null);
  const [addingToTeamId, setAddingToTeamId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const renameTeamMutation = useMutation({
    mutationFn: renameMatchTeam,
    onSuccess: () => {
      onRefresh();
      setEditingTeamId(null);
      toast.success("Team name updated");
    }
  });

  const removePlayerMutation = useMutation({
    mutationFn: removeSquadPlayer,
    onSuccess: () => {
      onRefresh();
      toast.success("Player removed");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to remove player");
    }
  });

  // Fetch students for the picker
  const studentsQ = useQuery({
    queryKey: ["academy-students-picker", searchQuery],
    queryFn: () => listStudents(session.match?.tenant_id || ""),
    enabled: !!(replacingSquadId || addingToTeamId)
  });

  const replacePlayerFn = useServerFn(replaceSquadPlayer);
  const addPlayerFn = useServerFn(addSquadPlayer);

  const handleSelectPlayer = async (player: { id: string; name: string } | string) => {
    try {
      if (replacingSquadId) {
        await replacePlayerFn({
          data: {
            squadRowId: replacingSquadId,
            replaceWith: typeof player === "string" ? { guestName: player } : { athleteProfileId: player.id }
          }
        });
        toast.success("Player replaced");
        setReplacingSquadId(null);
      } else if (addingToTeamId) {
        await addPlayerFn({
          data: {
            matchId,
            teamId: addingToTeamId,
            player: typeof player === "string" ? { guestName: player } : { athleteProfileId: player.id }
          }
        });
        toast.success("Player added");
        setAddingToTeamId(null);
      }
      onRefresh();
      setSearchQuery("");
    } catch (err: any) {
      toast.error(err.message || "Operation failed");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[90vh] p-0 overflow-hidden rounded-t-2xl">
        <MobileViewportShell>
          <div className="flex flex-col h-full bg-background">
            <SheetHeader className="p-4 border-b shrink-0">
              <SheetTitle>Match Squads</SheetTitle>
              <SheetDescription>Edit team names and squads for this match.</SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto p-4 space-y-8">
              {teams.map((team) => {
                const squad = session.matchSquads.filter((s: any) => s.team_id === team.id);
                return (
                  <div key={team.id} className="space-y-4">
                    <div className="flex items-center justify-between">
                      {editingTeamId === team.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input 
                            value={teamNameValue} 
                            onChange={e => setTeamNameValue(e.target.value)}
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" onClick={() => renameTeamMutation.mutate({ data: { matchId, teamId: team.id, newName: teamNameValue } })}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditingTeamId(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <h3 className="text-lg font-bold">{team.name}</h3>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                            onClick={() => {
                              setEditingTeamId(team.id);
                              setTeamNameValue(team.name);
                            }}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      <Button variant="outline" size="sm" onClick={() => setAddingToTeamId(team.id)}>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Add
                      </Button>
                    </div>

                    <div className="bg-muted/30 rounded-xl divide-y border overflow-hidden">
                      {squad.sort((a: any, b: any) => (a.batting_order || 99) - (b.batting_order || 99)).map((player: any) => {
                        const name = player.external_player_name || nameMap[player.athlete_profile_id] || "Unknown";
                        const isGuest = !player.athlete_profile_id;
                        
                        return (
                          <div key={player.id} className="flex items-center justify-between p-3 bg-card/50">
                            <div className="flex items-center gap-3">
                              <Avatar 
                                name={name} 
                                src={null} 
                                className="h-8 w-8 text-[10px]"
                              />
                              <div>
                                <div className="text-sm font-medium flex items-center gap-2">
                                  {name}
                                  {isGuest && <span className="text-[10px] px-1 bg-blue-100 text-blue-700 rounded font-normal">Guest</span>}
                                </div>
                                <div className="text-[10px] text-muted-foreground">#{player.batting_order || '-'}</div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8"
                                onClick={() => setReplacingSquadId(player.id)}
                              >
                                <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-8 w-8 text-destructive"
                                onClick={() => removePlayerMutation.mutate({ data: { squadRowId: player.id } })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </MobileViewportShell>

        {/* Picker Modal */}
        {(replacingSquadId || addingToTeamId) && (
          <div className="absolute inset-0 bg-background z-50 flex flex-col">
            <div className="p-4 border-b flex items-center gap-3 shrink-0">
              <Button variant="ghost" size="icon" onClick={() => { setReplacingSquadId(null); setAddingToTeamId(null); }}>
                <X className="h-5 w-5" />
              </Button>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search student or type guest name..." 
                  className="pl-9"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <div className="p-2 space-y-1">
                {searchQuery.length > 0 && !studentsQ.data?.find(s => s.name.toLowerCase() === searchQuery.toLowerCase()) && (
                  <Button 
                    variant="ghost" 
                    className="w-full justify-start h-14"
                    onClick={() => handleSelectPlayer(searchQuery)}
                  >
                    <UserPlus className="h-4 w-4 mr-3 text-blue-500" />
                    <div className="text-left">
                      <div className="text-sm font-medium">Add "{searchQuery}"</div>
                      <div className="text-[10px] text-muted-foreground">as a guest player</div>
                    </div>
                  </Button>
                )}

                {studentsQ.data?.map(s => (
                  <Button 
                    key={s.id}
                    variant="ghost" 
                    className="w-full justify-start h-14"
                    onClick={() => handleSelectPlayer({ id: s.id, name: s.name })}
                  >
                    <Avatar name={s.name} src={null} className="h-8 w-8 mr-3" />
                    <div className="text-left">
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="text-[10px] text-muted-foreground">Academy Student</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
