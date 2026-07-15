import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Human-readable title, e.g. "Remove player" */
  title: string;
  /** Full destructive warning shown to the user */
  description: string;
  /** Text the user must type verbatim to enable the confirm button. Omit for simple confirm. */
  confirmText?: string;
  /** Label of the confirm button. Defaults to "Remove". */
  confirmLabel?: string;
  /** Async destructive action. */
  onConfirm: () => Promise<void>;
};

/** Reusable, red-styled confirmation dialog for permanent-removal flows. */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText,
  confirmLabel = "Remove",
  onConfirm,
}: Props) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      setTyped("");
      setBusy(false);
    }
  }, [open]);

  const canConfirm = !busy && (!confirmText || typed.trim().toLowerCase() === confirmText.trim().toLowerCase());

  async function handleConfirm() {
    if (!canConfirm) return;
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-w-md border-destructive/40">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="size-5" />
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription className="pt-1 text-sm">{description}</DialogDescription>
        </DialogHeader>

        {confirmText ? (
          <div className="space-y-2">
            <Label className="text-xs">
              Type <span className="font-semibold text-destructive">{confirmText}</span> to confirm
            </Label>
            <Input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={confirmText}
              className="border-destructive/40"
            />
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {busy ? <Loader2 className="size-4 mr-1 animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
