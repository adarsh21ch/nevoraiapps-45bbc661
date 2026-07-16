/**
 * Owner → Payments verification queue.
 *
 * Reuses:
 *   - listPendingManualPayments / approveManualPayment / reviewManualPayment /
 *     recordOfflinePayment (server functions)
 *   - Billing Engine via `record_billing_payment`
 *   - Automation Engine (events emitted server-side)
 *   - Existing design tokens (Card / Badge / Dialog / Button)
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Copy,
  Image as ImageIcon,
  Loader2,
  Receipt,
  Banknote,
  Eye,
  User as UserIcon,
  FileText,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FilterTabs } from "@/components/shared/FilterTabs";
import { toast } from "sonner";
import { OwnerOnly } from "@/components/dashboard/OwnerOnly";
import { useDashboard } from "@/lib/dashboard-context";
import {
  listPendingManualPayments,
  approveManualPayment,
  reviewManualPayment,
  signManualPaymentScreenshot,
  markManualPaymentViewed,
} from "@/lib/payments/manual.functions";
import { formatMoney } from "@/lib/billing";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/payment-verification")({
  head: () => ({
    meta: [
      { title: "Payment verification — Owner" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <OwnerOnly>
      <PaymentVerificationPage />
    </OwnerOnly>
  ),
});

type Row = {
  id: string;
  tenant_id: string;
  student_id: string;
  invoice_id: string | null;
  method: string;
  amount: number;
  currency: string;
  utr: string | null;
  paid_at: string | null;
  screenshot_path: string | null;
  notes: string | null;
  status: string;
  review_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
  student: {
    id: string;
    name: string;
    phone: string | null;
    guardian_name: string | null;
    guardian_phone: string | null;
  } | null;
  invoice: {
    id: string;
    number: string | null;
    total: number;
    balance: number;
    due_date: string | null;
    status: string;
  } | null;
};

function PaymentVerificationPage() {
  const { tenant } = useDashboard();
  const [status, setStatus] = useState<"pending" | "reviewed">("pending");
  const listFn = useServerFn(listPendingManualPayments);
  const q = useQuery({
    queryKey: ["owner", "manual-payments", tenant.id, status],
    queryFn: () =>
      listFn({
        data: {
          tenantId: tenant.id,
          status: status === "pending" ? "pending" : null,
          limit: 100,
        },
      }),
  });

  const rows = (q.data ?? []) as Row[];
  const filtered = useMemo(() => {
    if (status === "pending") return rows.filter((r) => r.status === "pending" || r.status === "needs_reupload");
    return rows.filter((r) => r.status !== "pending");
  }, [rows, status]);

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payment Verification</h1>
          <p className="text-xs text-muted-foreground">
            Review parent-submitted UPI/QR/bank transfers. Approvals post through the billing engine.
          </p>
        </div>
        <Link
          to="/dashboard/fees"
          className="text-xs text-primary hover:underline"
        >
          Back to Fees
        </Link>
      </header>

      <Tabs value={status} onValueChange={(v) => setStatus(v as "pending" | "reviewed")}>
        <TabsList>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="reviewed">History</TabsTrigger>
        </TabsList>
        <TabsContent value={status} className="mt-4">
          {q.isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          ) : filtered.length === 0 ? (
            <Card className="p-8 text-center space-y-2">
              <Receipt className="size-8 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium">
                {status === "pending" ? "No pending submissions" : "No history yet"}
              </p>
              <p className="text-xs text-muted-foreground">
                Parents' payment proofs will appear here for review.
              </p>
            </Card>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filtered.map((r) => (
                <SubmissionCard key={r.id} row={r} onChange={() => q.refetch()} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  duplicate: "Duplicate",
  needs_reupload: "Needs re-upload",
};
const STATUS_VARIANT = (s: string): "secondary" | "destructive" | "outline" | "default" =>
  s === "approved" ? "secondary" : s === "rejected" || s === "duplicate" ? "destructive" : "outline";

const REJECT_REASONS = [
  "Wrong Amount",
  "Invalid Screenshot",
  "Duplicate",
  "Payment Not Received",
  "Wrong UTR",
  "Other",
] as const;

function SubmissionCard({ row, onChange }: { row: Row; onChange: () => void }) {
  const qc = useQueryClient();
  const approve = useServerFn(approveManualPayment);
  const review = useServerFn(reviewManualPayment);
  const signFn = useServerFn(signManualPaymentScreenshot);
  const viewedFn = useServerFn(markManualPaymentViewed);

  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [loadingScreenshot, setLoadingScreenshot] = useState(false);
  const [reviewAction, setReviewAction] = useState<"reject" | "duplicate" | "needs_reupload" | null>(
    null,
  );
  const [reason, setReason] = useState<string>(REJECT_REASONS[0]);
  const [reasonNotes, setReasonNotes] = useState("");
  const [confirmApprove, setConfirmApprove] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Fire-once "viewed" event when the card is expanded / screenshot loaded.
  useEffect(() => {
    if (!expanded || row.status !== "pending") return;
    void viewedFn({ data: { submissionId: row.id } }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const approveMut = useMutation({
    mutationFn: () => approve({ data: { submissionId: row.id } }),
    onSuccess: () => {
      toast.success("Payment approved & receipt generated");
      setConfirmApprove(false);
      qc.invalidateQueries({ queryKey: ["owner", "manual-payments"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
      onChange();
    },
    onError: (e: any) => toast.error(e?.message ?? "Approval failed"),
  });

  const reviewMut = useMutation({
    mutationFn: () => {
      if (!reviewAction) throw new Error("no action");
      const full = reasonNotes.trim() ? `${reason} — ${reasonNotes.trim()}` : reason;
      return review({ data: { submissionId: row.id, action: reviewAction, reason: full } });
    },
    onSuccess: () => {
      toast.success("Parent has been notified");
      setReviewAction(null);
      setReasonNotes("");
      qc.invalidateQueries({ queryKey: ["owner", "manual-payments"] });
      onChange();
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  async function loadScreenshot() {
    if (screenshotUrl || !row.screenshot_path) return;
    setLoadingScreenshot(true);
    try {
      const { url } = await signFn({ data: { submissionId: row.id } });
      setScreenshotUrl(url);
      setExpanded(true);
    } finally {
      setLoadingScreenshot(false);
    }
  }

  const submitted = Number(row.amount);
  const invoiceBalance = row.invoice ? Number(row.invoice.balance) : null;
  const diff = invoiceBalance != null ? submitted - invoiceBalance : 0;
  const amountMatch = invoiceBalance == null || Math.abs(diff) < 0.01;

  return (
    <Card className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{row.student?.name ?? "—"}</p>
          <p className="text-[11px] text-muted-foreground truncate">
            {row.student?.guardian_name ? (
              <>
                <UserIcon className="inline size-3 mr-0.5 -mt-0.5" />
                {row.student.guardian_name}
              </>
            ) : row.student?.phone ? (
              row.student.phone
            ) : (
              ""
            )}
            {row.student?.guardian_phone && ` · ${row.student.guardian_phone}`}
          </p>
        </div>
        <Badge variant={STATUS_VARIANT(row.status)}>{STATUS_LABEL[row.status] ?? row.status}</Badge>
      </div>

      {/* Amount comparison */}
      <div className="grid grid-cols-3 gap-2 text-xs rounded-lg border p-2">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase">Submitted</p>
          <p className="font-semibold text-sm">
            {formatMoney(submitted, row.currency)}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase">Due</p>
          <p className="font-semibold text-sm">
            {invoiceBalance != null ? formatMoney(invoiceBalance, row.currency) : "—"}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase">Diff</p>
          <p
            className={cn(
              "font-semibold text-sm",
              amountMatch
                ? "text-emerald-600"
                : diff > 0
                  ? "text-blue-600"
                  : "text-amber-600",
            )}
          >
            {amountMatch ? "✓" : `${diff > 0 ? "+" : ""}${formatMoney(diff, row.currency)}`}
          </p>
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground text-[10px] uppercase">Method</p>
          <p className="font-medium capitalize">{row.method.replace("_", " ")}</p>
        </div>
        <div>
          <p className="text-muted-foreground text-[10px] uppercase">Paid</p>
          <p className="font-medium">
            {row.paid_at ? new Date(row.paid_at).toLocaleDateString() : "—"}
          </p>
        </div>
      </div>

      {row.utr && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground text-[10px] uppercase">UTR</span>
          <code className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono">{row.utr}</code>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 w-7 p-0"
            onClick={() => {
              void navigator.clipboard.writeText(row.utr ?? "");
              toast.success("Copied");
            }}
          >
            <Copy className="size-3.5" />
          </Button>
        </div>
      )}

      {row.notes && (
        <p className="text-xs text-muted-foreground bg-muted/40 rounded p-2">{row.notes}</p>
      )}

      {row.screenshot_path && (
        <div>
          {screenshotUrl ? (
            <a
              href={screenshotUrl}
              target="_blank"
              rel="noreferrer"
              className="block rounded-md overflow-hidden border"
            >
              <img
                src={screenshotUrl}
                alt="Payment proof"
                className="w-full max-h-56 object-contain bg-muted"
              />
            </a>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={loadScreenshot}
              disabled={loadingScreenshot}
            >
              {loadingScreenshot ? (
                <Loader2 className="size-3.5 animate-spin mr-1" />
              ) : (
                <ImageIcon className="size-3.5 mr-1" />
              )}
              View screenshot
            </Button>
          )}
        </div>
      )}

      {row.review_reason && row.status !== "pending" && (
        <p className="text-xs italic text-muted-foreground">Reason: {row.review_reason}</p>
      )}

      {/* Actions */}
      {(row.status === "pending" || row.status === "needs_reupload") && (
        <div className="grid grid-cols-2 gap-2 pt-2 border-t">
          <Button
            size="sm"
            className="col-span-2"
            onClick={() => setConfirmApprove(true)}
            disabled={approveMut.isPending}
          >
            <CheckCircle2 className="size-3.5 mr-1" /> Approve & post
          </Button>
          <Button size="sm" variant="outline" onClick={() => setReviewAction("needs_reupload")}>
            <RotateCcw className="size-3.5 mr-1" /> Re-upload
          </Button>
          <Button size="sm" variant="outline" onClick={() => setReviewAction("duplicate")}>
            <Banknote className="size-3.5 mr-1" /> Duplicate
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="col-span-2"
            onClick={() => setReviewAction("reject")}
          >
            <XCircle className="size-3.5 mr-1" /> Reject
          </Button>
        </div>
      )}

      {/* Quick nav */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground pt-1">
        <span>{new Date(row.created_at).toLocaleString()}</span>
        {row.invoice && (
          <Link to="/dashboard/billing" className="hover:underline inline-flex items-center gap-1">
            <FileText className="size-3" /> {row.invoice.number ?? "Invoice"}
          </Link>
        )}
        {row.student?.id && (
          <Link
            to="/dashboard/students/$id"
            params={{ id: row.student.id }}
            className="hover:underline inline-flex items-center gap-1"
          >
            <Eye className="size-3" /> Student
          </Link>
        )}
      </div>

      {/* Approve confirmation dialog */}
      <Dialog open={confirmApprove} onOpenChange={setConfirmApprove}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Approve payment</DialogTitle>
            <DialogDescription>
              This posts through the Billing Engine and generates a receipt automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2 rounded-lg border p-2">
              <div>
                <p className="text-muted-foreground text-[10px] uppercase">Student</p>
                <p className="font-medium">{row.student?.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px] uppercase">Amount</p>
                <p className="font-semibold">{formatMoney(submitted, row.currency)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px] uppercase">Invoice</p>
                <p className="font-medium truncate">{row.invoice?.number ?? "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-[10px] uppercase">Method</p>
                <p className="font-medium capitalize">{row.method.replace("_", " ")}</p>
              </div>
            </div>
            {!amountMatch && (
              <p className="text-amber-600 text-[11px]">
                ⚠︎ Amount doesn't match invoice balance ({formatMoney(diff, row.currency)} diff).
              </p>
            )}
            {screenshotUrl && (
              <img
                src={screenshotUrl}
                alt="Preview"
                className="rounded border max-h-40 w-full object-contain bg-muted"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmApprove(false)}>
              Cancel
            </Button>
            <Button onClick={() => approveMut.mutate()} disabled={approveMut.isPending}>
              {approveMut.isPending && <Loader2 className="size-3.5 animate-spin mr-1" />}
              Confirm approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject / duplicate / re-upload dialog */}
      <Dialog open={!!reviewAction} onOpenChange={(o) => !o && setReviewAction(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "reject"
                ? "Reject submission"
                : reviewAction === "duplicate"
                  ? "Mark as duplicate"
                  : "Request re-upload"}
            </DialogTitle>
            <DialogDescription>
              The parent will be notified with the reason below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {reviewAction === "reject" && (
              <div className="space-y-1.5">
                <Label className="text-xs">Reason</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  {REJECT_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className={cn(
                        "text-xs px-2 py-1.5 rounded border text-left transition",
                        reason === r
                          ? "border-primary bg-primary/10 text-primary"
                          : "hover:bg-muted",
                      )}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="review-notes" className="text-xs">
                {reviewAction === "reject" ? "Notes (optional)" : "Message to parent"}
              </Label>
              <Textarea
                id="review-notes"
                rows={3}
                value={reasonNotes}
                onChange={(e) => setReasonNotes(e.target.value)}
                placeholder={
                  reviewAction === "reject"
                    ? "Add any details for the parent"
                    : reviewAction === "duplicate"
                      ? "Which payment does this duplicate?"
                      : "What should the parent re-upload?"
                }
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setReviewAction(null)}>
              Cancel
            </Button>
            <Button
              variant={reviewAction === "reject" ? "destructive" : "default"}
              onClick={() => reviewMut.mutate()}
              disabled={reviewMut.isPending}
            >
              {reviewMut.isPending && <Loader2 className="size-3.5 animate-spin mr-1" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

