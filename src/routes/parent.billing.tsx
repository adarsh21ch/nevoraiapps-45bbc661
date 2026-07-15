/**
 * Parent → Billing / Payments page.
 *
 * Reuses:
 *   - fetchChildBillingSummary (parent-app)
 *   - createPaymentOrder / verifyClientPayment (PaymentService)
 *   - Existing design tokens
 *
 * Loads Razorpay checkout script on demand; other providers fall back to
 * whatever the adapter returns (Stripe/Cashfree/etc. can be plugged in later).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { CreditCard, Receipt, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useParentChild } from "@/hooks/use-parent-child";
import { fetchChildBillingSummary, parentKeys } from "@/lib/parent-app";
import { createPaymentOrder, verifyClientPayment, listPaymentTransactions } from "@/lib/payments/service.functions";
import { formatMoney } from "@/lib/billing";

export const Route = createFileRoute("/parent/billing")({
  head: () => ({
    meta: [
      { title: "Payments — Parent Portal" },
      { name: "description", content: "View and pay academy invoices." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ParentBillingPage,
});

function ParentBillingPage() {
  const { child } = useParentChild();
  const billQ = useQuery({
    queryKey: child ? parentKeys.billing(child.student_id) : ["parent", "billing", "none"],
    queryFn: () => fetchChildBillingSummary(child!.student_id, child!.tenant_id),
    enabled: !!child,
  });

  const listTx = useServerFn(listPaymentTransactions);
  const txQ = useQuery({
    queryKey: ["parent", "payment-tx", child?.tenant_id ?? "none"],
    queryFn: () => listTx({ data: { scope: "tenant", tenantId: child!.tenant_id, limit: 20 } }),
    enabled: !!child,
  });

  if (!child) return <p className="text-sm text-muted-foreground">Select a child to view billing.</p>;
  if (billQ.isLoading) return <Skeleton className="h-40 w-full" />;

  const summary = billQ.data;
  if (!summary?.enabled) {
    return (
      <Card className="p-6 text-center space-y-2">
        <Receipt className="size-8 mx-auto text-muted-foreground" />
        <p className="font-medium">Billing not shared</p>
        <p className="text-xs text-muted-foreground">
          Your academy hasn't enabled parent-visible billing yet.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4 pb-6">
      <Card className="p-4 bg-gradient-to-br from-primary/10 to-primary/5">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Outstanding</p>
        <p className="text-3xl font-bold">
          {formatMoney(summary.outstanding, summary.currency)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          {summary.invoices.length} open invoice{summary.invoices.length === 1 ? "" : "s"}
        </p>
      </Card>

      {summary.invoices.length === 0 ? (
        <Card className="p-6 text-center">
          <CheckCircle2 className="size-8 mx-auto text-emerald-500 mb-2" />
          <p className="font-medium">All caught up</p>
          <p className="text-xs text-muted-foreground">No pending invoices right now.</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {summary.invoices.map((inv) => (
            <InvoiceCard
              key={inv.id}
              invoice={inv}
              tenantId={child.tenant_id}
              onPaid={() => {
                billQ.refetch();
                txQ.refetch();
              }}
            />
          ))}
        </div>
      )}

      <PaymentHistory rows={txQ.data ?? []} loading={txQ.isLoading} />
    </div>
  );
}

function InvoiceCard({
  invoice,
  tenantId,
  onPaid,
}: {
  invoice: {
    id: string;
    number: string | null;
    total: number;
    balance: number;
    due_date: string | null;
    status: string;
    currency: string;
  };
  tenantId: string;
  onPaid: () => void;
}) {
  const [paying, setPaying] = useState(false);
  const createOrder = useServerFn(createPaymentOrder);
  const verifyPayment = useServerFn(verifyClientPayment);

  const overdue = useMemo(() => {
    if (!invoice.due_date) return false;
    return new Date(invoice.due_date) < new Date();
  }, [invoice.due_date]);

  async function loadRazorpay(): Promise<boolean> {
    if (typeof window === "undefined") return false;
    if ((window as any).Razorpay) return true;
    return new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });
  }

  async function handlePay() {
    setPaying(true);
    try {
      const order = await createOrder({
        data: {
          scope: "tenant",
          tenantId,
          amount: Number(invoice.balance),
          currency: (invoice.currency as "INR") ?? "INR",
          purpose: "outstanding",
          refType: "invoice",
          refId: invoice.id,
        },
      });

      if (order.provider === "razorpay") {
        const loaded = await loadRazorpay();
        if (!loaded) throw new Error("Failed to load checkout");
        await new Promise<void>((resolve, reject) => {
          const rzp = new (window as any).Razorpay({
            key: order.keyId,
            amount: order.amountPaise,
            currency: order.currency,
            order_id: order.providerOrderId,
            name: "Academy Fees",
            description: invoice.number ?? "Invoice payment",
            handler: async (response: any) => {
              try {
                await verifyPayment({
                  data: {
                    transactionId: order.transactionId,
                    providerOrderId: order.providerOrderId,
                    providerPaymentId: response.razorpay_payment_id,
                    providerSignature: response.razorpay_signature,
                  },
                });
                toast.success("Payment successful");
                onPaid();
                resolve();
              } catch (e) {
                reject(e);
              }
            },
            modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
            theme: { color: "#6366f1" },
          });
          rzp.open();
        });
      } else {
        toast.info("This provider is not yet supported in-browser. Please use manual transfer.");
      }
    } catch (e: any) {
      const msg = e?.message ?? "Payment failed";
      if (msg !== "Payment cancelled") toast.error(msg);
    } finally {
      setPaying(false);
    }
  }

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {invoice.number ?? "Invoice"}
          </p>
          <p className="text-xs text-muted-foreground">
            Due {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString() : "—"}
          </p>
        </div>
        <Badge variant={overdue ? "destructive" : "secondary"}>
          {overdue ? "Overdue" : invoice.status}
        </Badge>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Balance</p>
          <p className="text-2xl font-bold">
            {formatMoney(invoice.balance, invoice.currency)}
          </p>
        </div>
        <Button onClick={handlePay} disabled={paying || invoice.balance <= 0}>
          {paying ? <Loader2 className="size-4 animate-spin" /> : <CreditCard className="size-4 mr-1" />}
          {paying ? "Processing…" : "Pay Now"}
        </Button>
      </div>
    </Card>
  );
}

function PaymentHistory({
  rows,
  loading,
}: {
  rows: Array<{
    id: string;
    provider: string;
    status: string;
    amount_paise: number;
    currency: string;
    purpose: string;
    created_at: string;
  }>;
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-24 w-full" />;
  if (!rows.length) return null;
  return (
    <div>
      <h2 className="text-sm font-semibold mb-2 mt-6">Payment history</h2>
      <div className="space-y-2">
        {rows.map((r) => {
          const success = r.status === "success";
          const failed = r.status === "failed";
          return (
            <Card key={r.id} className="p-3 flex items-center gap-3">
              {success ? (
                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              ) : failed ? (
                <AlertCircle className="size-4 text-destructive shrink-0" />
              ) : (
                <Loader2 className="size-4 animate-spin shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {formatMoney(Number(r.amount_paise) / 100, r.currency)} · {r.purpose}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(r.created_at).toLocaleString()} · {r.provider}
                </p>
              </div>
              <Badge variant={success ? "secondary" : failed ? "destructive" : "outline"}>
                {r.status}
              </Badge>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
