/**
 * Parent-facing dialog to submit proof of a UPI / QR / Bank / Cash payment.
 * Uploads the screenshot to the existing `tenant-assets` bucket, then calls
 * `submitManualPayment` which inserts the row and emits automation events.
 */
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UploadCloud, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { uploadTenantFile } from "@/lib/storage";
import { submitManualPayment } from "@/lib/payments/manual.functions";
import { formatMoney } from "@/lib/billing";

export type PaymentSetup = {
  online_payments_enabled: boolean;
  upi_id: string | null;
  upi_qr_url: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_ifsc: string | null;
  payment_instructions: string | null;
};

export function ManualPaymentDialog({
  open,
  onOpenChange,
  tenantId,
  studentId,
  invoice,
  setup,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId: string;
  studentId: string;
  invoice: { id: string; number: string | null; balance: number; currency: string };
  setup: PaymentSetup;
  onSubmitted: () => void;
}) {
  const [amount, setAmount] = useState(String(invoice.balance));
  const [utr, setUtr] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const submitFn = useServerFn(submitManualPayment);
  const qc = useQueryClient();
  const submitMut = useMutation({
    mutationFn: async () => {
      let screenshotPath: string | null = null;
      if (file) {
        setUploading(true);
        try {
          screenshotPath = await uploadTenantFile(tenantId, "payments/proofs", file);
        } finally {
          setUploading(false);
        }
      }
      return submitFn({
        data: {
          tenantId,
          studentId,
          invoiceId: invoice.id,
          method: "upi",
          amount: Number(amount),
          currency: invoice.currency,
          utr: utr.trim() || null,
          paidAt: paidAt ? new Date(paidAt).toISOString() : null,
          screenshotPath,
          notes: notes.trim() || null,
        },
      });
    },
    onSuccess: () => {
      toast.success("Payment submitted for verification");
      qc.invalidateQueries({ queryKey: ["parent"] });
      onSubmitted();
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to submit"),
  });

  function copy(v: string | null | undefined, key: string) {
    if (!v) return;
    void navigator.clipboard.writeText(v);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pay {formatMoney(invoice.balance, invoice.currency)}</DialogTitle>
          <DialogDescription>
            {invoice.number ?? "Invoice"} · Pay via UPI/QR/bank, then submit proof below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {(setup.upi_qr_url || setup.upi_id) && (
            <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
              <p className="text-xs font-semibold">Pay via UPI</p>
              {setup.upi_qr_url && (
                <img
                  src={setup.upi_qr_url}
                  alt="UPI QR"
                  className="mx-auto rounded-md max-h-40"
                />
              )}
              {setup.upi_id && (
                <button
                  type="button"
                  onClick={() => copy(setup.upi_id, "upi")}
                  className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded border bg-background hover:bg-muted"
                >
                  <span className="truncate">{setup.upi_id}</span>
                  {copied === "upi" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </button>
              )}
            </div>
          )}

          {(setup.bank_account_number || setup.bank_ifsc) && (
            <div className="rounded-lg border p-3 space-y-1 bg-muted/30 text-xs">
              <p className="font-semibold">Bank transfer</p>
              {setup.bank_account_name && <p>Name: {setup.bank_account_name}</p>}
              {setup.bank_account_number && (
                <button
                  type="button"
                  onClick={() => copy(setup.bank_account_number, "acc")}
                  className="w-full flex items-center justify-between px-2 py-1 rounded border bg-background hover:bg-muted"
                >
                  <span>A/c {setup.bank_account_number}</span>
                  {copied === "acc" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </button>
              )}
              {setup.bank_ifsc && (
                <button
                  type="button"
                  onClick={() => copy(setup.bank_ifsc, "ifsc")}
                  className="w-full flex items-center justify-between px-2 py-1 rounded border bg-background hover:bg-muted"
                >
                  <span>IFSC {setup.bank_ifsc}</span>
                  {copied === "ifsc" ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                </button>
              )}
            </div>
          )}

          {setup.payment_instructions && (
            <p className="text-xs text-muted-foreground whitespace-pre-line">
              {setup.payment_instructions}
            </p>
          )}

          <div className="border-t pt-3 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Submit proof
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="mp-amount" className="text-xs">Amount paid</Label>
                <Input
                  id="mp-amount"
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="mp-date" className="text-xs">Payment date</Label>
                <Input
                  id="mp-date"
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="mp-utr" className="text-xs">UTR / Transaction ID (optional)</Label>
              <Input
                id="mp-utr"
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
                placeholder="e.g. 4123456789"
                maxLength={120}
              />
            </div>
            <div>
              <Label htmlFor="mp-file" className="text-xs">Screenshot</Label>
              <label
                htmlFor="mp-file"
                className="flex items-center gap-2 rounded-md border border-dashed p-3 text-xs cursor-pointer hover:bg-muted/40"
              >
                <UploadCloud className="size-4 text-muted-foreground" />
                {file ? <span className="truncate">{file.name}</span> : "Tap to attach screenshot"}
              </label>
              <input
                id="mp-file"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <div>
              <Label htmlFor="mp-notes" className="text-xs">Notes (optional)</Label>
              <Textarea
                id="mp-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1000}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitMut.isPending}>
            Cancel
          </Button>
          <Button
            onClick={() => submitMut.mutate()}
            disabled={submitMut.isPending || !amount || Number(amount) <= 0}
          >
            {(submitMut.isPending || uploading) && (
              <Loader2 className="size-4 animate-spin mr-1" />
            )}
            Submit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
