import { createFileRoute } from "@tanstack/react-router";
import { OwnerOnly } from "@/components/dashboard/OwnerOnly";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/lib/dashboard-context";
import { useCurrentRole } from "@/hooks/use-current-role";
import {
  bqk,
  createDraftInvoice,
  createSubscription,
  fetchBillingKpis,
  fetchInvoiceLines,
  fetchInvoices,
  fetchRecentPayments,
  fetchSubscriptions,
  formatMoney,
  invoiceStatusLabel,
  issueInvoice,
  newIdempotencyKey,
  paymentMethodLabel,
  recordPayment,
  voidInvoice,
  type BillingCycle,
  type Invoice,
  type PaymentMethod,
  type Subscription,
} from "@/lib/billing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Banknote, CheckCircle2, Coins, FileText, IndianRupee, Lock, Plus, Receipt, Users } from "lucide-react";
import { format } from "date-fns";

export const Route = createFileRoute("/dashboard/billing")({
  head: () => ({
    meta: [
      { title: "Fees · AcademyOS" },
      { name: "description", content: "Manage student fee plans, fee bills and fee collections." },
    ],
  }),
  component: () => (<OwnerOnly><BillingPage /></OwnerOnly>),
});

function BillingPage() {
  const role = useCurrentRole();
  if (role !== "owner") return <NotAllowed />;
  return <BillingWorkspace />;
}

function NotAllowed() {
  return (
    <div className="min-h-[70vh] grid place-items-center px-6">
      <div className="max-w-sm text-center space-y-3">
        <div className="mx-auto grid place-items-center w-12 h-12 rounded-full bg-muted">
          <Lock className="w-5 h-5 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold">Fees are Owner-only</h1>
        <p className="text-sm text-muted-foreground">
          Fee records are visible only to the academy owner. Admins, coaches, students, and parents don't
          have access.
        </p>
      </div>
    </div>
  );
}

function BillingWorkspace() {
  const { tenant } = useDashboard();
  const tenantId = tenant.id;
  const qc = useQueryClient();

  const kpisQ = useQuery({ queryKey: bqk.kpis(tenantId), queryFn: () => fetchBillingKpis(tenantId) });
  const invoicesQ = useQuery({ queryKey: bqk.invoices(tenantId), queryFn: () => fetchInvoices(tenantId, { limit: 200 }) });
  const paymentsQ = useQuery({ queryKey: bqk.payments(tenantId), queryFn: () => fetchRecentPayments(tenantId, 100) });
  const subsQ = useQuery({ queryKey: bqk.subscriptions(tenantId), queryFn: () => fetchSubscriptions(tenantId) });

  const studentsQ = useQuery({
    queryKey: ["billing", "students-lite", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, name, player_id")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .order("name")
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["billing"] });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 pb-24 space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Student Fees</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage student fee plans, fee bills and fee collections · Owner-only
          </p>
        </div>
        <div className="flex gap-2">
          <NewSubscriptionButton
            tenantId={tenantId}
            students={studentsQ.data ?? []}
            onDone={invalidateAll}
          />
          <NewInvoiceButton
            tenantId={tenantId}
            students={studentsQ.data ?? []}
            subscriptions={subsQ.data ?? []}
            onDone={invalidateAll}
          />
        </div>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<IndianRupee className="w-4 h-4" />}
          label="Pending fees"
          value={formatMoney(kpisQ.data?.outstanding ?? 0)}
          loading={kpisQ.isLoading}
        />
        <KpiCard
          icon={<Coins className="w-4 h-4" />}
          label="Fees collected"
          value={formatMoney(kpisQ.data?.collectedThisMonth ?? 0)}
          loading={kpisQ.isLoading}
        />
        <KpiCard
          icon={<FileText className="w-4 h-4" />}
          label="Pending bills"
          value={String(kpisQ.data?.openInvoices ?? 0)}
          loading={kpisQ.isLoading}
        />
        <KpiCard
          icon={<Receipt className="w-4 h-4" />}
          label="Overdue fees"
          value={String(kpisQ.data?.overdue ?? 0)}
          loading={kpisQ.isLoading}
          tone={kpisQ.data && kpisQ.data.overdue > 0 ? "warn" : undefined}
        />
      </section>

      <Tabs defaultValue="invoices">
        <TabsList>
          <TabsTrigger value="invoices">
            <FileText className="w-4 h-4 mr-1.5" /> Bills
          </TabsTrigger>
          <TabsTrigger value="payments">
            <Banknote className="w-4 h-4 mr-1.5" /> Collections
          </TabsTrigger>
          <TabsTrigger value="subs">
            <Users className="w-4 h-4 mr-1.5" /> Fee plans
          </TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="mt-4">
          <InvoicesTable
            tenantId={tenantId}
            invoices={invoicesQ.data ?? []}
            students={studentsQ.data ?? []}
            loading={invoicesQ.isLoading}
            onDone={invalidateAll}
          />
        </TabsContent>
        <TabsContent value="payments" className="mt-4">
          <PaymentsTable
            payments={paymentsQ.data ?? []}
            students={studentsQ.data ?? []}
            loading={paymentsQ.isLoading}
          />
        </TabsContent>
        <TabsContent value="subs" className="mt-4">
          <SubscriptionsTable
            subs={subsQ.data ?? []}
            students={studentsQ.data ?? []}
            loading={subsQ.isLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ------------- KPI Card ----------------------------------------------------
function KpiCard({
  icon,
  label,
  value,
  loading,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  loading?: boolean;
  tone?: "warn";
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
        {icon}
        <span>{label}</span>
      </div>
      <div
        className={`mt-2 text-2xl font-semibold tracking-tight ${
          tone === "warn" ? "text-amber-600 dark:text-amber-400" : ""
        }`}
      >
        {loading ? "—" : value}
      </div>
    </div>
  );
}

// ------------- Invoices table ---------------------------------------------
type StudentLite = { id: string; name: string; player_id: string | null };

function InvoicesTable({
  tenantId,
  invoices,
  students,
  loading,
  onDone,
}: {
  tenantId: string;
  invoices: Invoice[];
  students: StudentLite[];
  loading: boolean;
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<Invoice | null>(null);
  const sMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);

  if (loading) return <SkeletonList />;
  if (invoices.length === 0)
    return <EmptyState title="No fee bills created yet" hint="Generate your first fee bill to start tracking student fees." />;

  return (
    <>
      <div className="rounded-2xl border overflow-hidden bg-card">
        <div className="grid grid-cols-12 px-4 py-2.5 text-xs font-medium text-muted-foreground border-b bg-muted/30">
          <div className="col-span-2">Number</div>
          <div className="col-span-3">Student</div>
          <div className="col-span-2">Due</div>
          <div className="col-span-2 text-right">Total</div>
          <div className="col-span-2 text-right">Balance</div>
          <div className="col-span-1 text-right">Status</div>
        </div>
        {invoices.map((inv) => {
          const stu = sMap.get(inv.student_id);
          return (
            <button
              key={inv.id}
              onClick={() => setSelected(inv)}
              className="grid grid-cols-12 px-4 py-3 items-center text-sm border-b last:border-b-0 hover:bg-muted/40 text-left w-full"
            >
              <div className="col-span-2 font-mono text-xs">{inv.number ?? <span className="text-muted-foreground">Draft</span>}</div>
              <div className="col-span-3 truncate">{stu?.name ?? "—"}</div>
              <div className="col-span-2 text-muted-foreground">{inv.due_date ?? "—"}</div>
              <div className="col-span-2 text-right tabular-nums">{formatMoney(inv.total, inv.currency)}</div>
              <div className="col-span-2 text-right tabular-nums">
                {inv.balance > 0 ? (
                  <span className="text-amber-600 dark:text-amber-400">{formatMoney(inv.balance, inv.currency)}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
              <div className="col-span-1 text-right">
                <StatusPill status={inv.status} />
              </div>
            </button>
          );
        })}
      </div>
      <InvoiceDetailDialog
        tenantId={tenantId}
        invoice={selected}
        students={students}
        onClose={() => setSelected(null)}
        onDone={() => {
          onDone();
          setSelected(null);
        }}
      />
    </>
  );
}

function StatusPill({ status }: { status: Invoice["status"] }) {
  const tone: Record<Invoice["status"], string> = {
    draft: "bg-muted text-muted-foreground",
    issued: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    partially_paid: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    void: "bg-muted text-muted-foreground line-through",
    uncollectible: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${tone[status]}`}>
      {invoiceStatusLabel[status]}
    </span>
  );
}

// ------------- Invoice detail dialog --------------------------------------
function InvoiceDetailDialog({
  tenantId,
  invoice,
  students,
  onClose,
  onDone,
}: {
  tenantId: string;
  invoice: Invoice | null;
  students: StudentLite[];
  onClose: () => void;
  onDone: () => void;
}) {
  const open = !!invoice;
  const linesQ = useQuery({
    enabled: open,
    queryKey: invoice ? bqk.invoiceLines(invoice.id) : ["noop"],
    queryFn: () => fetchInvoiceLines(invoice!.id),
  });
  const [payOpen, setPayOpen] = useState(false);

  const issueM = useMutation({
    mutationFn: () => issueInvoice(invoice!.id),
    onSuccess: () => {
      toast.success("Fee bill sent");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const voidM = useMutation({
    mutationFn: (reason: string) => voidInvoice(invoice!.id, reason),
    onSuccess: () => {
      toast.success("Fee bill cancelled");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const student = students.find((s) => s.id === invoice?.student_id);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        {invoice && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span>Fee bill {invoice.number ?? "(Draft)"}</span>
                <StatusPill status={invoice.status} />
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <Row label="Student" value={student?.name ?? "—"} />
              <Row label="Player ID" value={student?.player_id ?? "—"} />
              <Row label="Bill date" value={invoice.issue_date ?? "—"} />
              <Row label="Due date" value={invoice.due_date ?? "—"} />
              <Row label="Total" value={formatMoney(invoice.total, invoice.currency)} />
              <Row label="Pending" value={formatMoney(invoice.balance, invoice.currency)} />
            </div>

            <div className="border rounded-xl overflow-hidden">
              <div className="grid grid-cols-12 px-3 py-2 text-xs font-medium bg-muted/40 text-muted-foreground">
                <div className="col-span-7">Description</div>
                <div className="col-span-2 text-right">Qty</div>
                <div className="col-span-3 text-right">Amount</div>
              </div>
              {(linesQ.data ?? []).map((l) => (
                <div key={l.id} className="grid grid-cols-12 px-3 py-2 text-sm border-t">
                  <div className="col-span-7">
                    <div>{l.description}</div>
                    <div className="text-xs text-muted-foreground">{l.line_type}</div>
                  </div>
                  <div className="col-span-2 text-right tabular-nums">{l.quantity}</div>
                  <div className="col-span-3 text-right tabular-nums">
                    {formatMoney(l.amount, invoice.currency)}
                  </div>
                </div>
              ))}
              {(linesQ.data ?? []).length === 0 && (
                <div className="px-3 py-4 text-sm text-muted-foreground">No lines.</div>
              )}
            </div>

            {invoice.notes && (
              <div className="text-xs text-muted-foreground whitespace-pre-wrap">{invoice.notes}</div>
            )}

            <DialogFooter className="gap-2 flex-wrap">
              {invoice.status === "draft" && (
                <Button onClick={() => issueM.mutate()} disabled={issueM.isPending}>
                  Send fee bill
                </Button>
              )}
              {(invoice.status === "issued" || invoice.status === "partially_paid") && invoice.balance > 0 && (
                <Button onClick={() => setPayOpen(true)}>
                  <Banknote className="w-4 h-4 mr-1.5" /> Record fee collection
                </Button>
              )}
              {(invoice.status === "draft" || invoice.status === "issued") && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const r = window.prompt("Reason for cancelling this fee bill?");
                    if (r && r.trim()) voidM.mutate(r.trim());
                  }}
                  disabled={voidM.isPending}
                >
                  Cancel bill
                </Button>
              )}
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>

            <PaymentDialog
              open={payOpen}
              onOpenChange={setPayOpen}
              tenantId={tenantId}
              invoice={invoice}
              onDone={() => {
                setPayOpen(false);
                onDone();
              }}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value}</div>
    </div>
  );
}

// ------------- Record payment dialog --------------------------------------
function PaymentDialog({
  open,
  onOpenChange,
  tenantId,
  invoice,
  onDone,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId: string;
  invoice: Invoice;
  onDone: () => void;
}) {
  const [amount, setAmount] = useState<string>(String(invoice.balance));
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");
  const [remarks, setRemarks] = useState("");
  const [idem] = useState(() => newIdempotencyKey());

  const m = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!(amt > 0)) throw new Error("Amount must be positive");
      if (amt > invoice.balance + 0.005) throw new Error("Amount exceeds outstanding balance");
      return recordPayment({
        tenant_id: tenantId,
        student_id: invoice.student_id,
        amount: amt,
        method,
        allocations: [{ invoice_id: invoice.id, amount: amt }],
        reference_number: reference || undefined,
        remarks: remarks || undefined,
        idempotency_key: idem,
      });
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Amount</Label>
            <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <div className="text-xs text-muted-foreground mt-1">
              Outstanding: {formatMoney(invoice.balance, invoice.currency)}
            </div>
          </div>
          <div>
            <Label>Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["cash", "upi", "qr", "bank_transfer", "cheque", "card", "other"] as PaymentMethod[]).map((m) => (
                  <SelectItem key={m} value={m}>
                    {paymentMethodLabel[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Reference (optional)</Label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI txn ID, cheque no." />
          </div>
          <div>
            <Label>Remarks (optional)</Label>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending}>
            <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------- Payments tab ------------------------------------------------
function PaymentsTable({
  payments,
  students,
  loading,
}: {
  payments: Array<import("@/lib/billing").Payment>;
  students: StudentLite[];
  loading: boolean;
}) {
  const sMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  if (loading) return <SkeletonList />;
  if (payments.length === 0) return <EmptyState title="No payments yet" hint="Record a payment on any issued invoice." />;
  return (
    <div className="rounded-2xl border overflow-hidden bg-card">
      <div className="grid grid-cols-12 px-4 py-2.5 text-xs font-medium text-muted-foreground border-b bg-muted/30">
        <div className="col-span-3">Date</div>
        <div className="col-span-3">Student</div>
        <div className="col-span-2">Method</div>
        <div className="col-span-2">Reference</div>
        <div className="col-span-2 text-right">Amount</div>
      </div>
      {payments.map((p) => (
        <div key={p.id} className="grid grid-cols-12 px-4 py-3 items-center text-sm border-b last:border-b-0">
          <div className="col-span-3 text-muted-foreground">
            {format(new Date(p.collected_at), "dd MMM yyyy, HH:mm")}
          </div>
          <div className="col-span-3 truncate">{sMap.get(p.student_id)?.name ?? "—"}</div>
          <div className="col-span-2">{paymentMethodLabel[p.method]}</div>
          <div className="col-span-2 text-xs font-mono truncate">{p.reference_number ?? "—"}</div>
          <div className="col-span-2 text-right tabular-nums font-medium">{formatMoney(p.amount, p.currency)}</div>
        </div>
      ))}
    </div>
  );
}

// ------------- Subscriptions tab ------------------------------------------
function SubscriptionsTable({
  subs,
  students,
  loading,
}: {
  subs: Subscription[];
  students: StudentLite[];
  loading: boolean;
}) {
  const sMap = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  if (loading) return <SkeletonList />;
  if (subs.length === 0) return <EmptyState title="No subscriptions yet" hint="Create a subscription to auto-track billing periods." />;
  return (
    <div className="rounded-2xl border overflow-hidden bg-card">
      <div className="grid grid-cols-12 px-4 py-2.5 text-xs font-medium text-muted-foreground border-b bg-muted/30">
        <div className="col-span-4">Student</div>
        <div className="col-span-2">Cycle</div>
        <div className="col-span-2 text-right">Amount</div>
        <div className="col-span-2">Since</div>
        <div className="col-span-2 text-right">Status</div>
      </div>
      {subs.map((s) => (
        <div key={s.id} className="grid grid-cols-12 px-4 py-3 items-center text-sm border-b last:border-b-0">
          <div className="col-span-4 truncate">{sMap.get(s.student_id)?.name ?? "—"}</div>
          <div className="col-span-2 capitalize">{s.billing_cycle.replace("_", " ")}</div>
          <div className="col-span-2 text-right tabular-nums">{formatMoney(s.unit_amount, s.currency)}</div>
          <div className="col-span-2 text-muted-foreground">{s.start_date}</div>
          <div className="col-span-2 text-right">
            <Badge variant={s.status === "active" ? "default" : "secondary"} className="capitalize">
              {s.status.replace("_", " ")}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

// ------------- New Subscription -------------------------------------------
function NewSubscriptionButton({
  tenantId,
  students,
  onDone,
}: {
  tenantId: string;
  students: StudentLite[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [cycle, setCycle] = useState<BillingCycle>("monthly");
  const [anchor, setAnchor] = useState("1");

  const m = useMutation({
    mutationFn: () =>
      createSubscription({
        tenant_id: tenantId,
        student_id: studentId,
        unit_amount: Number(amount),
        billing_cycle: cycle,
        cycle_anchor_day: Number(anchor) || 1,
      }),
    onSuccess: () => {
      toast.success("Subscription created");
      setOpen(false);
      setStudentId("");
      setAmount("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Users className="w-4 h-4 mr-1.5" /> New subscription
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New subscription</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Student</Label>
            <StudentPicker students={students} value={studentId} onChange={setStudentId} />
          </div>
          <div>
            <Label>Unit amount</Label>
            <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Cycle</Label>
              <Select value={cycle} onValueChange={(v) => setCycle(v as BillingCycle)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="half_yearly">Half yearly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                  <SelectItem value="one_time">One time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Anchor day (1–28)</Label>
              <Input type="number" min="1" max="28" value={anchor} onChange={(e) => setAnchor(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!studentId || !amount || m.isPending} onClick={() => m.mutate()}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------- New Invoice -------------------------------------------------
function NewInvoiceButton({
  tenantId,
  students,
  subscriptions,
  onDone,
}: {
  tenantId: string;
  students: StudentLite[];
  subscriptions: Subscription[];
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [description, setDescription] = useState("Monthly tuition");
  const [amount, setAmount] = useState("");
  const [discount, setDiscount] = useState("");
  const [dueDate, setDueDate] = useState<string>("");
  const [issue, setIssue] = useState(true);

  const studentSubs = subscriptions.filter((s) => s.student_id === studentId && s.status === "active");
  const suggestedSub = studentSubs[0];

  const m = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!(amt > 0)) throw new Error("Amount must be positive");
      const disc = Number(discount) || 0;
      const lines: Parameters<typeof createDraftInvoice>[0]["lines"] = [
        { line_type: "charge", description, unit_amount: amt },
      ];
      if (disc > 0)
        lines.push({ line_type: "discount", description: "Discount", unit_amount: -Math.abs(disc) });

      const inv = await createDraftInvoice({
        tenant_id: tenantId,
        student_id: studentId,
        subscription_id: suggestedSub?.id ?? null,
        due_date: dueDate || null,
        lines,
      });
      if (issue) await issueInvoice(inv.id);
      return inv;
    },
    onSuccess: () => {
      toast.success(issue ? "Invoice issued" : "Draft saved");
      setOpen(false);
      setStudentId("");
      setAmount("");
      setDiscount("");
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-1.5" /> New invoice
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New invoice</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Student</Label>
            <StudentPicker students={students} value={studentId} onChange={setStudentId} />
            {suggestedSub && (
              <div className="text-xs text-muted-foreground mt-1">
                Active subscription: {formatMoney(suggestedSub.unit_amount)} /{" "}
                {suggestedSub.billing_cycle.replace("_", " ")}
              </div>
            )}
          </div>
          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={suggestedSub ? String(suggestedSub.unit_amount) : ""}
              />
            </div>
            <div>
              <Label>Discount (optional)</Label>
              <Input type="number" step="0.01" min="0" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Due date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={issue} onChange={(e) => setIssue(e.target.checked)} />
            Issue immediately (locks the invoice)
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled={!studentId || !amount || m.isPending} onClick={() => m.mutate()}>
            {issue ? "Create & issue" : "Save draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ------------- Student picker (searchable) --------------------------------
function StudentPicker({
  students,
  value,
  onChange,
}: {
  students: StudentLite[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return students.slice(0, 50);
    return students
      .filter((s) => s.name.toLowerCase().includes(term) || (s.player_id ?? "").toLowerCase().includes(term))
      .slice(0, 50);
  }, [students, q]);
  const selected = students.find((s) => s.id === value);
  return (
    <div className="space-y-1.5">
      <Input placeholder="Search by name or player ID…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="border rounded-md max-h-40 overflow-auto">
        {filtered.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className={`w-full text-left px-3 py-1.5 text-sm hover:bg-muted ${
              value === s.id ? "bg-muted font-medium" : ""
            }`}
          >
            {s.name} <span className="text-muted-foreground text-xs">{s.player_id ?? ""}</span>
          </button>
        ))}
        {filtered.length === 0 && <div className="px-3 py-2 text-xs text-muted-foreground">No matches</div>}
      </div>
      {selected && <div className="text-xs text-muted-foreground">Selected: {selected.name}</div>}
    </div>
  );
}

// ------------- Empty / skeleton -------------------------------------------
function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-2xl border bg-card p-10 text-center">
      <div className="mx-auto grid place-items-center w-10 h-10 rounded-full bg-muted mb-3">
        <FileText className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="font-medium">{title}</div>
      <div className="text-sm text-muted-foreground mt-1">{hint}</div>
    </div>
  );
}
function SkeletonList() {
  return (
    <div className="rounded-2xl border bg-card divide-y">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="px-4 py-3 animate-pulse flex items-center justify-between">
          <div className="h-3 bg-muted rounded w-1/3" />
          <div className="h-3 bg-muted rounded w-16" />
        </div>
      ))}
    </div>
  );
}
