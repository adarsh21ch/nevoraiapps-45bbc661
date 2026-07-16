/**
 * Parent-facing guided payment flow (4 steps + confirmation).
 *   1) Choose method (UPI / QR / Bank)
 *   2) Show payment info with copy buttons
 *   3) Submit proof (screenshot + UTR + amount + date + notes)
 *   4) Confirmation screen with status
 *
 * Reuses uploadTenantFile (R2) and submitManualPayment server function.
 */
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UploadCloud,
  Loader2,
  Copy,
  Check,
  QrCode,
  Smartphone,
  Landmark,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
} from "lucide-react";
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
import { cn } from "@/lib/utils";
import { uploadTenantFile, signedUrl } from "@/lib/storage";
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

type Method = "upi" | "qr" | "bank_transfer";
type Step = 1 | 2 | 3 | 4;

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
  const [step, setStep] = useState<Step>(1);
  const [method, setMethod] = useState<Method>("upi");
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
          method,
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
      qc.invalidateQueries({ queryKey: ["parent"] });
      setStep(4);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to submit"),
  });

  function reset() {
    setStep(1);
    setMethod("upi");
    setAmount(String(invoice.balance));
    setUtr("");
    setPaidAt(new Date().toISOString().slice(0, 10));
    setNotes("");
    setFile(null);
  }

  function close(v: boolean) {
    if (!v) {
      onOpenChange(false);
      if (step === 4) onSubmitted();
      setTimeout(reset, 200);
    } else {
      onOpenChange(true);
    }
  }

  function copy(v: string | null | undefined, key: string) {
    if (!v) return;
    void navigator.clipboard.writeText(v);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  const methods: Array<{ id: Method; label: string; icon: any; available: boolean }> = [
    { id: "upi", label: "UPI ID", icon: Smartphone, available: !!setup.upi_id },
    { id: "qr", label: "QR Code", icon: QrCode, available: !!setup.upi_qr_url },
    {
      id: "bank_transfer",
      label: "Bank Transfer",
      icon: Landmark,
      available: !!(setup.bank_account_number || setup.bank_ifsc),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === 4
              ? "Payment submitted"
              : `Pay ${formatMoney(invoice.balance, invoice.currency)}`}
          </DialogTitle>
          <DialogDescription>
            {step === 4 ? (
              <>Your proof is pending owner verification.</>
            ) : (
              <>
                {invoice.number ?? "Invoice"} · Step {step} of 3
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {step < 4 && (
          <div className="flex gap-1 mb-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-full",
                  s <= step ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>
        )}

        {/* Step 1 — choose method */}
        {step === 1 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Choose how you'd like to pay</p>
            {methods.map((m) => (
              <button
                key={m.id}
                type="button"
                disabled={!m.available}
                onClick={() => {
                  setMethod(m.id);
                  setStep(2);
                }}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-lg border text-left transition",
                  m.available
                    ? "hover:bg-muted/60 cursor-pointer"
                    : "opacity-40 cursor-not-allowed",
                )}
              >
                <m.icon className="size-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm font-medium">{m.label}</p>
                  {!m.available && (
                    <p className="text-[10px] text-muted-foreground">Not configured</p>
                  )}
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
              </button>
            ))}
          </div>
        )}

        {/* Step 2 — payment info */}
        {step === 2 && (
          <div className="space-y-3">
            {method === "qr" && setup.upi_qr_url && (
              <div className="rounded-lg border p-3 space-y-2 bg-muted/30 text-center">
                <p className="text-xs font-semibold">Scan this QR</p>
                <img
                  src={setup.upi_qr_url}
                  alt="UPI QR"
                  className="mx-auto rounded-md max-h-56"
                />
                <p className="text-[11px] text-muted-foreground">
                  Open any UPI app and scan
                </p>
              </div>
            )}

            {method === "upi" && setup.upi_id && (
              <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                <p className="text-xs font-semibold">Pay to UPI ID</p>
                <button
                  type="button"
                  onClick={() => copy(setup.upi_id, "upi")}
                  className="w-full flex items-center justify-between text-sm px-3 py-2 rounded border bg-background hover:bg-muted"
                >
                  <span className="truncate font-mono">{setup.upi_id}</span>
                  {copied === "upi" ? (
                    <Check className="size-4 text-emerald-500" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </button>
              </div>
            )}

            {method === "bank_transfer" && (
              <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                <p className="text-xs font-semibold">Bank transfer details</p>
                {setup.bank_account_name && (
                  <p className="text-xs">
                    <span className="text-muted-foreground">Name: </span>
                    {setup.bank_account_name}
                  </p>
                )}
                {setup.bank_account_number && (
                  <button
                    type="button"
                    onClick={() => copy(setup.bank_account_number, "acc")}
                    className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded border bg-background hover:bg-muted"
                  >
                    <span className="font-mono">A/c {setup.bank_account_number}</span>
                    {copied === "acc" ? (
                      <Check className="size-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                )}
                {setup.bank_ifsc && (
                  <button
                    type="button"
                    onClick={() => copy(setup.bank_ifsc, "ifsc")}
                    className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded border bg-background hover:bg-muted"
                  >
                    <span className="font-mono">IFSC {setup.bank_ifsc}</span>
                    {copied === "ifsc" ? (
                      <Check className="size-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                )}
              </div>
            )}

            <div className="rounded-lg border p-3 bg-primary/5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Amount to pay
              </p>
              <p className="text-2xl font-bold">
                {formatMoney(invoice.balance, invoice.currency)}
              </p>
            </div>

            {setup.payment_instructions && (
              <p className="text-xs text-muted-foreground whitespace-pre-line">
                {setup.payment_instructions}
              </p>
            )}
          </div>
        )}

        {/* Step 3 — submit proof */}
        {step === 3 && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              After completing the payment, submit proof so the owner can verify.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="mp-amount" className="text-xs">
                  Amount paid
                </Label>
                <Input
                  id="mp-amount"
                  type="number"
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="mp-date" className="text-xs">
                  Payment date
                </Label>
                <Input
                  id="mp-date"
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="mp-utr" className="text-xs">
                UTR / Transaction ID
              </Label>
              <Input
                id="mp-utr"
                value={utr}
                onChange={(e) => setUtr(e.target.value)}
                placeholder="e.g. 4123456789"
                maxLength={120}
              />
            </div>
            <div>
              <Label htmlFor="mp-file" className="text-xs">
                Screenshot
              </Label>
              <label
                htmlFor="mp-file"
                className="flex items-center gap-2 rounded-md border border-dashed p-3 text-xs cursor-pointer hover:bg-muted/40"
              >
                <UploadCloud className="size-4 text-muted-foreground" />
                {file ? (
                  <span className="truncate">{file.name}</span>
                ) : (
                  "Tap to attach payment screenshot"
                )}
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
              <Label htmlFor="mp-notes" className="text-xs">
                Notes (optional)
              </Label>
              <Textarea
                id="mp-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={1000}
              />
            </div>
          </div>
        )}

        {/* Step 4 — confirmation */}
        {step === 4 && (
          <div className="space-y-4 py-4 text-center">
            <div className="mx-auto size-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="size-8 text-emerald-500" />
            </div>
            <div className="space-y-1">
              <p className="font-semibold">Payment Proof Submitted</p>
              <p className="text-xs text-muted-foreground">
                {formatMoney(Number(amount), invoice.currency)} · {method.replace("_", " ")}
              </p>
            </div>
            <div className="rounded-lg border p-3 bg-muted/30 text-left space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <Clock className="size-3.5 text-amber-500" />
                <span className="font-medium">Pending verification</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                The owner will review your payment shortly, typically within a few
                hours. You'll be notified once it's approved and your receipt is ready.
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {step === 1 && (
            <Button variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
          )}
          {step === 2 && (
            <>
              <Button variant="ghost" onClick={() => setStep(1)}>
                <ArrowLeft className="size-4 mr-1" /> Back
              </Button>
              <Button onClick={() => setStep(3)}>
                I've paid <ArrowRight className="size-4 ml-1" />
              </Button>
            </>
          )}
          {step === 3 && (
            <>
              <Button
                variant="ghost"
                onClick={() => setStep(2)}
                disabled={submitMut.isPending}
              >
                <ArrowLeft className="size-4 mr-1" /> Back
              </Button>
              <Button
                onClick={() => submitMut.mutate()}
                disabled={submitMut.isPending || !amount || Number(amount) <= 0}
              >
                {(submitMut.isPending || uploading) && (
                  <Loader2 className="size-4 animate-spin mr-1" />
                )}
                Submit proof
              </Button>
            </>
          )}
          {step === 4 && (
            <Button className="w-full" onClick={() => close(false)}>
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
