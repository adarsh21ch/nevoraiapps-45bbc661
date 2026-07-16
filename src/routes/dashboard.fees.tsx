/**
 * Fees — Owner workflow (restored, canonical backend).
 *
 * Three tabs only: Pending · Paid · All.
 *
 * UI language: "fee", "amount", "collect", "paid". No invoice/bill/collection
 * accounting terms are surfaced to the owner.
 *
 * Backend (implementation detail, never exposed):
 *   • Pending — aggregates open `billing_invoices` (issued, partially_paid,
 *     overdue, past_due) per student. Balance = sum of open balances.
 *   • Paid   — reads succeeded `billing_payments` per student.
 *   • Collect — records a succeeded `billing_payment` allocated across the
 *     student's open invoices (oldest first) via the canonical
 *     `record_billing_payment` RPC.
 *
 * Every finance surface (Home KPIs, NevorAI, Reports) already reads from the
 * same billing tables, so numbers here match everywhere.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/lib/dashboard-context";
import { OwnerOnly } from "@/components/dashboard/OwnerOnly";
import {
  DashboardPage,
  DashboardHeader,
  DashboardSearch,
  DashboardKPIRow,
  DashboardKPICard,
  DashboardList,
  DashboardListRow,
  DashboardEmptyState,
  DashboardLoadingState,
  DashboardErrorState,
  DashboardBadge,
  FilterTabs,
} from "@/components/dashboard-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatMoney,
  newIdempotencyKey,
  recordPayment,
  type PaymentMethod,
} from "@/lib/billing";

// -----------------------------------------------------------------------------
// Types + query keys
// -----------------------------------------------------------------------------
type OpenInvoice = {
  id: string;
  student_id: string;
  balance: number;
  total: number;
  due_date: string | null;
  status: string;
  currency: string;
  issue_date: string | null;
};
type StudentRow = { id: string; name: string; photo_url: string | null };
type PaymentRow = {
  id: string;
  student_id: string | null;
  amount: number;
  method: string | null;
  collected_at: string | null;
  reference_number: string | null;
  currency: string;
};

type PendingStudent = {
  student: StudentRow;
  balance: number;
  oldestDueDate: string | null;
  overdue: boolean;
  invoiceCount: number;
  invoices: OpenInvoice[];
};

const feesKeys = {
  pending: (t: string) => ["fees", "pending", t] as const,
  paid: (t: string) => ["fees", "paid", t] as const,
};

// -----------------------------------------------------------------------------
// Data loaders
// -----------------------------------------------------------------------------
async function loadPending(tenantId: string): Promise<PendingStudent[]> {
  const { data: invs, error } = await supabase
    .from("billing_invoices")
    .select("id, student_id, balance, total, due_date, status, currency, issue_date")
    .eq("tenant_id", tenantId)
    .in("status", ["issued", "partially_paid", "overdue", "past_due"])
    .order("due_date", { ascending: true });
  if (error) throw error;

  const invoices = (invs ?? []).filter((i) => Number(i.balance ?? 0) > 0) as OpenInvoice[];
  const studentIds = Array.from(
    new Set(invoices.map((i) => i.student_id).filter((x): x is string => !!x)),
  );
  if (studentIds.length === 0) return [];

  const { data: students, error: sErr } = await supabase
    .from("students")
    .select("id, name, photo_url")
    .in("id", studentIds);
  if (sErr) throw sErr;

  const byId = new Map<string, StudentRow>((students ?? []).map((s) => [s.id, s as StudentRow]));
  const today = new Date().toISOString().slice(0, 10);
  const grouped = new Map<string, PendingStudent>();
  for (const inv of invoices) {
    if (!inv.student_id) continue;
    const s = byId.get(inv.student_id);
    if (!s) continue;
    const bucket =
      grouped.get(inv.student_id) ??
      ({
        student: s,
        balance: 0,
        oldestDueDate: null,
        overdue: false,
        invoiceCount: 0,
        invoices: [],
      } as PendingStudent);
    bucket.balance += Number(inv.balance ?? 0);
    bucket.invoiceCount += 1;
    bucket.invoices.push(inv);
    if (inv.due_date) {
      if (!bucket.oldestDueDate || inv.due_date < bucket.oldestDueDate) {
        bucket.oldestDueDate = inv.due_date;
      }
      if (inv.due_date < today) bucket.overdue = true;
    }
    grouped.set(inv.student_id, bucket);
  }
  return Array.from(grouped.values()).sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    return b.balance - a.balance;
  });
}

async function loadPaid(tenantId: string): Promise<Array<PaymentRow & { student: StudentRow | null }>> {
  const { data, error } = await supabase
    .from("billing_payments")
    .select("id, student_id, amount, method, collected_at, reference_number, currency, students(id, name, photo_url)")
    .eq("tenant_id", tenantId)
    .eq("status", "succeeded")
    .order("collected_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id,
    student_id: r.student_id,
    amount: Number(r.amount ?? 0),
    method: r.method,
    collected_at: r.collected_at,
    reference_number: r.reference_number,
    currency: (r as { currency?: string }).currency ?? "INR",
    student: (r as { students?: StudentRow | null }).students ?? null,
  }));
}

// -----------------------------------------------------------------------------
// Route
// -----------------------------------------------------------------------------
export const Route = createFileRoute("/dashboard/fees")({
  validateSearch: (search: Record<string, unknown>): { filter?: string } => {
    const f = search.filter;
    return typeof f === "string" ? { filter: f } : {};
  },
  component: () => (
    <OwnerOnly>
      <FeesPage />
    </OwnerOnly>
  ),
});

type Tab = "pending" | "paid" | "all";

function FeesPage() {
  const { tenant } = useDashboard();
  const tenantId = tenant?.id ?? "";
  const search = Route.useSearch();
  const initialTab: Tab =
    search.filter === "paid" ? "paid" : search.filter === "all" ? "all" : "pending";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [q, setQ] = useState("");
  const [collectFor, setCollectFor] = useState<PendingStudent | null>(null);

  const pendingQ = useQuery({
    queryKey: feesKeys.pending(tenantId),
    queryFn: () => loadPending(tenantId),
    enabled: !!tenantId,
    staleTime: 30_000,
  });
  const paidQ = useQuery({
    queryKey: feesKeys.paid(tenantId),
    queryFn: () => loadPaid(tenantId),
    enabled: !!tenantId,
    staleTime: 30_000,
  });

  const totals = useMemo(() => {
    const pending = pendingQ.data ?? [];
    const paid = paidQ.data ?? [];
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const collectedMonth = paid
      .filter((p) => (p.collected_at ?? "") >= monthStart)
      .reduce((s, p) => s + p.amount, 0);
    return {
      pendingStudents: pending.length,
      pendingAmount: pending.reduce((s, p) => s + p.balance, 0),
      collectedMonth,
    };
  }, [pendingQ.data, paidQ.data]);

  const filteredPending = useMemo(() => {
    const rows = pendingQ.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => r.student.name.toLowerCase().includes(term));
  }, [pendingQ.data, q]);

  const filteredPaid = useMemo(() => {
    const rows = paidQ.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => (r.student?.name ?? "").toLowerCase().includes(term));
  }, [paidQ.data, q]);

  return (
    <DashboardPage>
      <DashboardHeader
        title="Fees"
        subtitle="Track pending fees and record collections."
      />

      <DashboardKPIRow>
        <DashboardKPICard
          label="Pending"
          value={String(totals.pendingStudents)}
          delta={`${formatMoney(totals.pendingAmount, "INR")} due`}
        />
        <DashboardKPICard
          label="Collected this month"
          value={formatMoney(totals.collectedMonth, "INR")}
        />
        <DashboardKPICard
          label="Payments recorded"
          value={String((paidQ.data ?? []).length)}
        />
      </DashboardKPIRow>

      <FilterTabs
        value={tab}
        onChange={(v) => setTab(v as Tab)}
        items={[
          { key: "pending", label: "Pending", count: totals.pendingStudents || undefined },
          { key: "paid", label: "Paid" },
          { key: "all", label: "All" },
        ]}

      />

      <DashboardSearch
        value={q}
        onChange={setQ}
        placeholder="Search by student name"
      />

      {tab === "pending" && (
        <PendingList
          data={filteredPending}
          isLoading={pendingQ.isLoading}
          error={pendingQ.error}
          onCollect={setCollectFor}
        />
      )}
      {tab === "paid" && (
        <PaidList data={filteredPaid} isLoading={paidQ.isLoading} error={paidQ.error} />
      )}
      {tab === "all" && (
        <div className="space-y-4">
          <PendingList
            data={filteredPending}
            isLoading={pendingQ.isLoading}
            error={pendingQ.error}
            onCollect={setCollectFor}
          />
          <PaidList data={filteredPaid} isLoading={paidQ.isLoading} error={paidQ.error} />
        </div>
      )}

      <CollectDialog
        entry={collectFor}
        tenantId={tenantId}
        onClose={() => setCollectFor(null)}
      />
    </DashboardPage>
  );
}

// -----------------------------------------------------------------------------
// Lists
// -----------------------------------------------------------------------------
function PendingList({
  data,
  isLoading,
  error,
  onCollect,
}: {
  data: PendingStudent[];
  isLoading: boolean;
  error: unknown;
  onCollect: (s: PendingStudent) => void;
}) {
  if (isLoading) return <DashboardLoadingState />;
  if (error) return <DashboardErrorState title="Could not load pending fees." />;
  if (data.length === 0) {
    return (
      <DashboardEmptyState
        title="Nothing pending"
        description="Every active student is up to date on fees."
      />
    );
  }
  return (
    <DashboardList>
      {data.map((row) => (
        <DashboardListRow
          key={row.student.id}
          title={<span className="font-medium">{row.student.name}</span>}
          subtitle={
            row.oldestDueDate ? (
              <span>
                Due {formatDate(row.oldestDueDate)}
                {row.invoiceCount > 1 ? ` · ${row.invoiceCount} periods` : ""}
              </span>
            ) : row.invoiceCount > 1 ? (
              <span>{row.invoiceCount} periods pending</span>
            ) : null
          }
          status={
            <div className="flex items-center gap-2">
              <span className="font-semibold">{formatMoney(row.balance, "INR")}</span>
              {row.overdue ? <DashboardBadge tone="danger">Overdue</DashboardBadge> : null}
            </div>
          }
          action={
            <Button size="sm" onClick={() => onCollect(row)}>
              Collect
            </Button>
          }
        />
      ))}
    </DashboardList>
  );
}

function PaidList({
  data,
  isLoading,
  error,
}: {
  data: Array<PaymentRow & { student: StudentRow | null }>;
  isLoading: boolean;
  error: unknown;
}) {
  if (isLoading) return <DashboardLoadingState />;
  if (error) return <DashboardErrorState title="Could not load payments." />;
  if (data.length === 0) {
    return (
      <DashboardEmptyState
        title="No payments yet"
        description="Recorded payments will appear here."
      />
    );
  }
  return (
    <DashboardList>
      {data.map((p) => (
        <DashboardListRow
          key={p.id}
          title={<span className="font-medium">{p.student?.name ?? "Unknown"}</span>}
          subtitle={
            <span>
              {p.collected_at ? formatDate(p.collected_at) : ""}
              {p.method ? ` · ${p.method}` : ""}
            </span>
          }
          status={<span className="font-semibold">{formatMoney(p.amount, p.currency)}</span>}
        />
      ))}
    </DashboardList>
  );
}

// -----------------------------------------------------------------------------
// Collect dialog — records a canonical billing_payment.
// -----------------------------------------------------------------------------
function CollectDialog({
  entry,
  tenantId,
  onClose,
}: {
  entry: PendingStudent | null;
  tenantId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState<string>("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [reference, setReference] = useState("");

  const open = !!entry;

  // Sync default amount when opening for a new student.
  useMemo(() => {
    if (entry) {
      setAmount(String(entry.balance));
      setMethod("cash");
      setReference("");
    }
  }, [entry?.student.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const m = useMutation({
    mutationFn: async () => {
      if (!entry) throw new Error("no entry");
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) throw new Error("Enter a valid amount.");
      // Allocate against open invoices oldest-first until amount is exhausted.
      const sorted = [...entry.invoices].sort((a, b) =>
        (a.due_date ?? a.issue_date ?? "").localeCompare(b.due_date ?? b.issue_date ?? ""),
      );
      let remaining = amt;
      const allocations: Array<{ invoice_id: string; amount: number }> = [];
      for (const inv of sorted) {
        if (remaining <= 0) break;
        const take = Math.min(remaining, Number(inv.balance ?? 0));
        if (take > 0) {
          allocations.push({ invoice_id: inv.id, amount: take });
          remaining -= take;
        }
      }
      if (allocations.length === 0) throw new Error("Nothing to collect.");
      return recordPayment({
        tenant_id: tenantId,
        student_id: entry.student.id,
        amount: amt,
        method,
        allocations,
        reference_number: reference || undefined,
        idempotency_key: newIdempotencyKey(),
      });
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      qc.invalidateQueries({ queryKey: feesKeys.pending(tenantId) });
      qc.invalidateQueries({ queryKey: feesKeys.paid(tenantId) });
      qc.invalidateQueries({ queryKey: ["d", "kpis"] });
      qc.invalidateQueries({ queryKey: ["billing"] });
      onClose();
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Could not record payment.";
      toast.error(msg);
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Collect fee</DialogTitle>
        </DialogHeader>
        {entry ? (
          <div className="space-y-3">
            <div className="rounded-xl bg-muted/40 p-3 text-sm">
              <div className="font-medium">{entry.student.name}</div>
              <div className="text-muted-foreground">
                Pending {formatMoney(entry.balance, "INR")}
                {entry.oldestDueDate ? ` · due ${formatDate(entry.oldestDueDate)}` : ""}
              </div>
            </div>
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Method</Label>
              <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Reference (optional)</Label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="UTR / cheque no. / receipt"
              />
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={m.isPending}>
            Cancel
          </Button>
          <Button onClick={() => m.mutate()} disabled={m.isPending || !entry}>
            {m.isPending ? "Saving…" : "Record payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -----------------------------------------------------------------------------
// Utils
// -----------------------------------------------------------------------------
function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return iso;
  }
}
