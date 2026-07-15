import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RunsButton, ExtraButton, ScoreButton } from "./scoring-ui";
import {
  MoreHorizontal,
  RefreshCw,
  UserPlus,
  UserCog,
  Undo2,
  Trash2,
  Flag,
  StopCircle,
  HeartPulse,
} from "lucide-react";

/**
 * Frequency-first scoring actions.
 * Runs and extras are always visible. All secondary actions live in a
 * bottom sheet reachable through a single "More" button. Destructive
 * actions (End Match, Finish Innings, Delete last ball) go through a
 * confirmation dialog.
 */
export interface ScoringActionsProps {
  disabled?: boolean;
  onRun: (r: 0 | 1 | 2 | 3 | 4 | 6) => void;
  onExtra: (kind: "Wide" | "No Ball" | "Bye" | "Leg Bye") => void;
  onOut: () => void;
  onUndo: () => void;
  onSwapStrike: () => void;
  onChangeStriker: () => void;
  onChangeNonStriker: () => void;
  onChangeBowler: () => void;
  onRetiredHurt: () => void;
  onFinishInnings?: () => void;
  onEndMatch: () => void;
  showFinishInnings?: boolean;
  hideEndMatch?: boolean;
}

export function ScoringActions(props: ScoringActionsProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | {
    kind: "end-match" | "finish-innings" | "delete-ball";
  }>(null);

  const closeAll = () => {
    setMoreOpen(false);
    setConfirm(null);
  };

  const confirmMeta = (() => {
    if (!confirm) return null;
    if (confirm.kind === "end-match") {
      return {
        title: "End match?",
        description:
          "This finalises the match. The action cannot be undone once the match is locked.",
        action: "End match",
        run: () => {
          closeAll();
          props.onEndMatch();
        },
      };
    }
    if (confirm.kind === "finish-innings") {
      return {
        title: "Finish innings?",
        description:
          "The current innings will be marked complete. You can start the next innings after confirming.",
        action: "Finish innings",
        run: () => {
          closeAll();
          props.onFinishInnings?.();
        },
      };
    }
    return {
      title: "Delete last ball?",
      description:
        "The most recent delivery will be removed and the score will be recomputed from the event log.",
      action: "Delete ball",
      run: () => {
        closeAll();
        props.onUndo();
      },
    };
  })();

  return (
    <>
      <div className="flex flex-col gap-2.5">
        {/* Runs 3x2 */}
        <div className="grid grid-cols-3 gap-2">
          {([0, 1, 2, 3, 4, 6] as const).map((r) => (
            <RunsButton key={r} value={r} onClick={() => !props.disabled && props.onRun(r)} />
          ))}
        </div>

        {/* Extras row */}
        <div className="grid grid-cols-4 gap-2">
          <ExtraButton label="Wide" onClick={() => !props.disabled && props.onExtra("Wide")} />
          <ExtraButton
            label="No Ball"
            onClick={() => !props.disabled && props.onExtra("No Ball")}
          />
          <ExtraButton label="Bye" onClick={() => !props.disabled && props.onExtra("Bye")} />
          <ExtraButton
            label="Leg Bye"
            onClick={() => !props.disabled && props.onExtra("Leg Bye")}
          />
        </div>

        {/* OUT — full width, prominent */}
        <ScoreButton
          label="OUT"
          tone="wicket"
          size="xl"
          onClick={() => !props.disabled && props.onOut()}
          className="w-full"
        />

        {/* Undo + More row */}
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <Button
            variant="outline"
            size="lg"
            className="h-12 gap-2 text-sm font-semibold"
            onClick={props.onUndo}
            disabled={props.disabled}
          >
            <Undo2 className="size-4" /> Undo
          </Button>
          <Button
            variant="secondary"
            size="lg"
            className="h-12 gap-2 px-4 text-sm font-semibold"
            onClick={() => setMoreOpen(true)}
          >
            <MoreHorizontal className="size-4" /> More
          </Button>
        </div>
      </div>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle>More actions</SheetTitle>
            <SheetDescription>
              Rarely used controls live here so the scoring surface stays fast.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 space-y-4 pb-6">
            <Section title="Batting">
              <SheetRow
                icon={<RefreshCw className="size-4" />}
                label="Swap strike"
                onClick={() => {
                  setMoreOpen(false);
                  props.onSwapStrike();
                }}
              />
              <SheetRow
                icon={<UserCog className="size-4" />}
                label="Change striker"
                onClick={() => {
                  setMoreOpen(false);
                  props.onChangeStriker();
                }}
              />
              <SheetRow
                icon={<UserCog className="size-4" />}
                label="Change non-striker"
                onClick={() => {
                  setMoreOpen(false);
                  props.onChangeNonStriker();
                }}
              />
              <SheetRow
                icon={<HeartPulse className="size-4" />}
                label="Retired hurt"
                onClick={() => {
                  setMoreOpen(false);
                  props.onRetiredHurt();
                }}
              />
            </Section>

            <Section title="Bowling">
              <SheetRow
                icon={<UserPlus className="size-4" />}
                label="Change bowler"
                onClick={() => {
                  setMoreOpen(false);
                  props.onChangeBowler();
                }}
              />
            </Section>

            <Section title="Corrections">
              <SheetRow
                icon={<Trash2 className="size-4" />}
                label="Delete last ball"
                onClick={() => setConfirm({ kind: "delete-ball" })}
              />
            </Section>

            <Section title="Danger zone" danger>
              {props.showFinishInnings && props.onFinishInnings && (
                <SheetRow
                  icon={<Flag className="size-4" />}
                  label="Finish innings"
                  tone="danger"
                  onClick={() => setConfirm({ kind: "finish-innings" })}
                />
              )}
              {!props.hideEndMatch && (
                <SheetRow
                  icon={<StopCircle className="size-4" />}
                  label="End match"
                  tone="danger"
                  onClick={() => setConfirm({ kind: "end-match" })}
                />
              )}
            </Section>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirm} onOpenChange={(v) => !v && setConfirm(null)}>
        <AlertDialogContent>
          {confirmMeta && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{confirmMeta.title}</AlertDialogTitle>
                <AlertDialogDescription>{confirmMeta.description}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={confirmMeta.run}
                >
                  {confirmMeta.action}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function Section({
  title,
  danger,
  children,
}: {
  title: string;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <div>
      <div
        className={
          "mb-1.5 text-[10px] font-semibold uppercase tracking-widest " +
          (danger ? "text-destructive" : "text-muted-foreground")
        }
      >
        {title}
      </div>
      <div className="overflow-hidden rounded-xl border bg-card">{children}</div>
    </div>
  );
}

function SheetRow({
  icon,
  label,
  onClick,
  tone,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex w-full items-center gap-3 border-b px-4 py-3 text-left text-sm font-medium last:border-b-0 active:bg-muted " +
        (tone === "danger" ? "text-destructive" : "text-foreground")
      }
    >
      <span
        className={
          "grid size-8 place-items-center rounded-lg " +
          (tone === "danger" ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground")
        }
      >
        {icon}
      </span>
      <span className="flex-1">{label}</span>
    </button>
  );
}
