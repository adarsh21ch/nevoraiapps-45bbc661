import { X, Trash2, Edit2 } from "lucide-react";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { OverHistoryRow } from "@/lib/mc-statistics-engine";
import { formatBallNotation } from "@/lib/mc-ball-events-core";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { MCBallEvent } from "@/lib/mc-ball-events";
import { useState, useEffect } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ExtraType, DismissalType } from "@/lib/mc-ball-events-core";
import { deliveryTotalRuns } from "@/lib/mc-commentary";

export interface OverHistorySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: OverHistoryRow[];
  inningsLabel?: string;
  onDeleteBall?: (eventId: string) => void;
  onUpdateBall?: (input: any) => void;
  allEvents?: MCBallEvent[];
}

function chipTone(label: string): string {
  const t = label.trim().toUpperCase();
  if (t === "W" || t.startsWith("W") || t.endsWith("W"))
    return "bg-destructive/15 text-destructive border-destructive/30";
  if (t === "4" || t.endsWith("+4")) return "bg-primary/12 text-primary border-primary/30";
  if (t === "6" || t.endsWith("+6")) return "bg-primary/20 text-primary border-primary/40";
  if (t === "•" || t === "0") return "bg-muted text-muted-foreground border-border/50";
  if (/^(WD|NB|B|LB)/.test(t))
    return "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400";
  return "bg-card text-foreground border-border/60";
}


export function OverHistorySheet({
  open,
  onOpenChange,
  rows,
  inningsLabel,
  onDeleteBall,
  onUpdateBall,
  allEvents,
}: OverHistorySheetProps) {
  const [editingBall, setEditingBall] = useState<MCBallEvent | null>(null);

  // Newest over first — scorers look at the most recent context.
  const ordered = [...rows].reverse();
  
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[80vh] rounded-t-2xl p-0 flex flex-col [&>button.absolute]:hidden"
        >
          <header className="shrink-0 flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
            <SheetTitle className="flex items-baseline gap-2 text-[15px] font-black uppercase tracking-wider">
              Over History
              {inningsLabel && (
                <span className="text-[10.5px] font-bold text-muted-foreground normal-case tracking-normal">
                  {inningsLabel}
                </span>
              )}
            </SheetTitle>
            <SheetClose
              aria-label="Close over history"
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-border/60 bg-background/70 px-3 text-[11px] font-black uppercase tracking-wider text-muted-foreground transition duration-100 hover:text-foreground active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            >
              <X className="size-3.5" />
              Close
            </SheetClose>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain ds-scroll px-3 py-2">
            {ordered.length === 0 ? (
              <div className="flex h-full items-center justify-center text-[13px] text-muted-foreground">
                No overs recorded yet.
              </div>
            ) : (
              <ol className="flex flex-col gap-2 pb-4">
                {ordered.map((row) => (
                  <li
                    key={row.overNumber}
                    className="rounded-xl border border-border/60 bg-card/70 p-3 shadow-sm"
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-baseline gap-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          Over
                        </span>
                        <span className="text-[16px] font-black leading-none tabular-nums">
                          {row.overLabel}
                        </span>
                        {row.bowler && (
                          <span className="min-w-0 truncate text-[11.5px] font-bold text-muted-foreground">
                            {row.bowler}
                          </span>
                        )}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5 tabular-nums">
                        <span className="rounded-md bg-primary/12 px-2 py-0.5 text-[11.5px] font-black text-primary">
                          {row.runs} {row.runs === 1 ? "run" : "runs"}
                        </span>
                        {row.wickets > 0 && (
                          <span className="rounded-md bg-destructive/15 px-2 py-0.5 text-[11.5px] font-black text-destructive">
                            {row.wickets}W
                          </span>
                        )}
                        <span className="rounded-md bg-muted px-2 py-0.5 text-[11.5px] font-black text-muted-foreground">
                          {row.runningScore}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {row.chips.length === 0 ? (
                        <span className="text-[12px] text-muted-foreground">No balls</span>
                      ) : (
                        row.chips.map((chip, i) => {
                          const label = formatBallNotation(chip.label);
                          const ballEvent = allEvents?.find(e => e.id === chip.eventId);



                          return (
                            <div key={`${row.overNumber}-${i}`} className="group relative">
                              <span
                                className={cn(
                                  "inline-flex h-7 min-w-7 items-center justify-center rounded-full border px-1.5 text-[11px] font-black tabular-nums transition-transform",
                                  chipTone(label),
                                )}
                              >
                                {label}
                              </span>
                              {ballEvent && (
                                <div className="absolute -top-9 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-md bg-background/95 p-1 shadow-lg border border-border opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto z-10">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-6 text-muted-foreground hover:text-primary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingBall(ballEvent);
                                    }}
                                  >
                                    <Edit2 className="size-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="size-6 text-muted-foreground hover:text-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDeleteBall?.(ballEvent.id);
                                    }}
                                  >
                                    <Trash2 className="size-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <EditBallDialog 
        ball={editingBall} 
        open={!!editingBall} 
        onOpenChange={(v) => !v && setEditingBall(null)}
        onSave={(data) => {
          if (editingBall) {
            onUpdateBall?.({ eventId: editingBall.id, ...data });
          }
          setEditingBall(null);
        }}
      />

    </>
  );
}

function EditBallDialog({ 
  ball, 
  open, 
  onOpenChange, 
  onSave 
}: { 
  ball: MCBallEvent | null; 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
  onSave: (data: any) => void;
}) {
  const [runs, setRuns] = useState(0);
  const [extraType, setExtraType] = useState<ExtraType | "none">("none");
  const [extraRuns, setExtraRuns] = useState(0);
  const [dismissalType, setDismissalType] = useState<DismissalType | "none">("none");

  useEffect(() => {
    if (ball) {
      setRuns(ball.runs_off_bat ?? 0);
      setExtraType((ball.extra_type as ExtraType) ?? "none");
      setExtraRuns(ball.extra_runs ?? 0);
      setDismissalType((ball.dismissal_type as DismissalType) ?? "none");
    }
  }, [ball]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Delivery</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="runs" className="text-right text-[12px] font-bold uppercase tracking-tight">
              Runs
            </Label>
            <Input
              id="runs"
              type="number"
              value={runs}
              onChange={(e) => setRuns(Number(e.target.value))}
              className="col-span-3 h-9 text-[13px]"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="extra" className="text-right text-[12px] font-bold uppercase tracking-tight">
              Extra
            </Label>
            <Select 
              value={extraType} 
              onValueChange={(v: any) => setExtraType(v)}
            >
              <SelectTrigger className="col-span-3 h-9 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="wide">Wide</SelectItem>
                <SelectItem value="no_ball">No Ball</SelectItem>
                <SelectItem value="bye">Bye</SelectItem>
                <SelectItem value="leg_bye">Leg Bye</SelectItem>
                <SelectItem value="penalty">Penalty</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {extraType !== "none" && (
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="extraRuns" className="text-right text-[12px] font-bold uppercase tracking-tight">
                Extra Runs
              </Label>
              <Input
                id="extraRuns"
                type="number"
                value={extraRuns}
                onChange={(e) => setExtraRuns(Number(e.target.value))}
                className="col-span-3 h-9 text-[13px]"
              />
            </div>
          )}
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="out" className="text-right text-[12px] font-bold uppercase tracking-tight">
              Out
            </Label>
            <Select 
              value={dismissalType} 
              onValueChange={(v: any) => setDismissalType(v)}
            >
              <SelectTrigger className="col-span-3 h-9 text-[13px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not Out</SelectItem>
                <SelectItem value="bowled">Bowled</SelectItem>
                <SelectItem value="caught">Caught</SelectItem>
                <SelectItem value="lbw">LBW</SelectItem>
                <SelectItem value="run_out">Run Out</SelectItem>
                <SelectItem value="stumped">Stumped</SelectItem>
                <SelectItem value="hit_wicket">Hit Wicket</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button 
            className="h-9 px-6 text-[13px] font-black uppercase tracking-wider"
            onClick={() => onSave({
              runsOffBat: runs,
              extraType: extraType === "none" ? null : extraType,
              extraRuns: extraRuns,
              dismissalType: dismissalType === "none" ? null : dismissalType,
            })}
          >
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
