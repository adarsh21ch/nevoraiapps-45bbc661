import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/lib/dashboard-context";
import { fetchPaymentsForPeriods, fetchStudents, qk } from "@/lib/dashboard-queries";
import {
  candidatePeriods,
  periodKey,
  periodLabel,
  reminderMessage,
  studentDue,
  tenantFeeCycle,
  type DueStatus,
} from "@/lib/fees";
import { getFeatures } from "@/lib/tenant";
import { generateReceiptPdf } from "@/lib/receipt-pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PersonAvatar } from "@/components/site/PersonAvatar";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  MessageCircle,
  PartyPopper,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/dashboard/fees")({
  component: FeeRegister,
});

type Filter = "pending" | "paid" | "all";

type RegisterRow = {
  studentId: string;
  name: string;
  photoUrl: string | null;
  batchName: string | null;
  planName: string | null;
  amount: number; // effective (custom_fee ?? plan amount)
  planAmount: number;
  hasCustomFee: boolean;
  phone: string;
  guardianName: string | null;
  guardianPhone: string | null;
  due: DueStatus;
  paidPayment: PaidPayment | null;
};

type PaidPayment = {
  id: string;
  receipt_no: number;
  amount: number;
  method: string;
  type: string;
  period: string | null;
  created_at: string;
};

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

function FeeRegister() {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const cycle = tenantFeeCycle(tenant);
  const features = getFeatures(tenant);
  const today = new Date();

  const [monthOffset, setMonthOffset] = useState(0);
  const selectedMonth = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const selectedPeriod = periodKey(selectedMonth);
  const periods = cycle === "joining_date" ? candidatePeriods(today) : [selectedPeriod];

  const [filter, setFilter] = useState<Filter>("pending");
  const [payRow, setPayRow] = useState<RegisterRow | null>(null);

  const studentsQ = useQuery({
    queryKey: qk.students(tenant.id),
    queryFn: () => fetchStudents(tenant.id),
  });
  const paymentsQ = useQuery({
    queryKey: qk.feeRegister(tenant.id, periods.join(",")),
    queryFn: () => fetchPaymentsForPeriods(tenant.id, periods),
  });

  const rows: RegisterRow[] = useMemo(() => {
    const paidByStudent = new Map<string, Set<string>>();
    const paymentByStudentPeriod = new Map<string, PaidPayment>();
    for (const p of paymentsQ.data ?? []) {
      if (!p.student_id || !p.period) continue;
      const set = paidByStudent.get(p.student_id) ?? new Set<string>();
      set.add(p.period);
      paidByStudent.set(p.student_id, set);
      paymentByStudentPeriod.set(`${p.student_id}:${p.period}`, p as PaidPayment);
    }

    return (studentsQ.data ?? [])
      .filter((s: any) => s.status === "active" && s.fee_plans?.type === "monthly")
      .map((s: any): RegisterRow => {
        const due = studentDue({
          cycle,
          joinedAt: s.joined_at,
          selectedMonth,
          paidPeriods: paidByStudent.get(s.id) ?? new Set(),
          today,
        });
        const paidPayment =
          due.state === "paid"
            ? (paymentByStudentPeriod.get(`${s.id}:${due.period}`) ?? null)
            : null;
        const planAmount = Number(s.fee_plans?.amount ?? 0);
        const custom = s.custom_fee == null ? null : Number(s.custom_fee);
        const amount = custom != null && !Number.isNaN(custom) ? custom : planAmount;
        return {
          studentId: s.id,
          name: s.name,
          photoUrl: s.photo_url ?? null,
          batchName: s.batches?.name ?? null,
          planName: s.fee_plans?.name ?? null,
          amount,
          planAmount,
          hasCustomFee: custom != null,
          phone: s.phone,
          guardianName: s.guardian_name,
          guardianPhone: s.guardian_phone,
          due,
          paidPayment,
        };
      })
      .filter((r) => r.due.state !== "not_due")
      .sort((a, b) => {
        const ap = a.due.state === "pending" ? 0 : 1;
        const bp = b.due.state === "pending" ? 0 : 1;
        if (ap !== bp) return ap - bp;
        if (a.due.state === "pending" && b.due.state === "pending")
          return b.due.overdueDays - a.due.overdueDays;
        return a.name.localeCompare(b.name);
      });
  }, [studentsQ.data, paymentsQ.data, cycle, selectedPeriod]);

  const pendingRows = rows.filter((r) => r.due.state === "pending");
  const paidRows = rows.filter((r) => r.due.state === "paid");
  const collectedAmount = paidRows.reduce(
    (s, r) => s + Number(r.paidPayment?.amount ?? r.amount),
    0,
  );
  const pendingAmount = pendingRows.reduce((s, r) => s + r.amount, 0);

  const visible = filter === "pending" ? pendingRows : filter === "paid" ? paidRows : rows;
  const loading = studentsQ.isLoading || paymentsQ.isLoading;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["d", "fees"] });
    qc.invalidateQueries({ queryKey: qk.kpis(tenant.id) });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fees</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Collect this month's fees and follow up on pending.
          </p>
        </div>
        {cycle === "calendar_month" && (
          <div
            className="flex items-center gap-1 rounded-full bg-white border border-black/[0.06] shadow-sm px-1 py-1"
          >
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-9 w-9"
              aria-label="Previous month"
              onClick={() => setMonthOffset((m) => m - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="text-sm font-semibold w-32 text-center tabular-nums">
              {format(selectedMonth, "MMMM yyyy")}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-9 w-9"
              aria-label="Next month"
              disabled={monthOffset >= 0}
              onClick={() => setMonthOffset((m) => Math.min(0, m + 1))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        )}
      </header>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <SummaryCard
          label="Pending"
          amount={pendingAmount}
          hint={`${pendingRows.length} student${pendingRows.length === 1 ? "" : "s"} to follow up`}
          tone="danger"
          emphasized
        />
        <SummaryCard
          label="Collected"
          amount={collectedAmount}
          hint={`${paidRows.length} paid`}
          tone="success"
        />
      </div>

      {/* Segmented toggle */}
      <SegmentedToggle
        value={filter}
        onChange={setFilter}
        counts={{ pending: pendingRows.length, paid: paidRows.length, all: rows.length }}
      />

      {/* List */}
      <section
        className="rounded-2xl bg-white border border-black/[0.06] shadow-sm overflow-hidden"
      >
        {loading ? (
          <SkeletonList />
        ) : visible.length === 0 ? (
          <EmptyState filter={filter} monthLabel={format(selectedMonth, "MMMM")} />
        ) : (
          <ul className="divide-y divide-black/[0.06]">
            {visible.map((r, i) => (
              <FeeRow
                key={r.studentId}
                index={i + 1}
                row={r}
                tenantName={tenant.name}
                whatsappEnabled={features.whatsapp_reminders !== false}
                onCollect={() => setPayRow(r)}
                onReceipt={() => {
                  if (!r.paidPayment) return;
                  generateReceiptPdf(tenant, {
                    receiptNo: r.paidPayment.receipt_no,
                    studentName: r.name,
                    amount: Number(r.paidPayment.amount),
                    type: r.paidPayment.type,
                    period: r.paidPayment.period,
                    method: r.paidPayment.method,
                    paidAt: r.paidPayment.created_at,
                  });
                }}
              />
            ))}
          </ul>
        )}
      </section>

      <CollectFlow
        row={payRow}
        tenantId={tenant.id}
        onClose={() => setPayRow(null)}
        onDone={() => {
          setPayRow(null);
          invalidate();
        }}
      />
    </div>
  );
}

/* ---------- Summary cards ---------- */

function SummaryCard({
  label,
  amount,
  hint,
  tone,
  emphasized,
}: {
  label: string;
  amount: number;
  hint: string;
  tone: "danger" | "success";
  emphasized?: boolean;
}) {
  const color = tone === "danger" ? "text-rose-600" : "text-emerald-600";
  return (
    <div
      className={cn(
        "rounded-2xl bg-white border shadow-sm p-5",
        emphasized ? "border-rose-100 ring-1 ring-rose-100/60" : "border-black/[0.06]",
      )}
    >
      <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
        {label}
      </div>
      <div className={cn("mt-1 font-bold tabular-nums", color, emphasized ? "text-4xl" : "text-3xl")}>
        {money(amount)}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{hint}</div>
    </div>
  );
}

/* ---------- Segmented toggle ---------- */

function SegmentedToggle({
  value,
  onChange,
  counts,
}: {
  value: Filter;
  onChange: (v: Filter) => void;
  counts: { pending: number; paid: number; all: number };
}) {
  const items: { key: Filter; label: string; count: number }[] = [
    { key: "pending", label: "Pending", count: counts.pending },
    { key: "paid", label: "Collected", count: counts.paid },
    { key: "all", label: "All", count: counts.all },
  ];
  return (
    <div className="inline-flex w-full sm:w-auto items-center gap-1 rounded-full bg-white border border-black/[0.06] shadow-sm p-1">
      {items.map((it) => {
        const active = value === it.key;
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            className={cn(
              "flex-1 sm:flex-none h-10 px-4 rounded-full text-sm font-medium transition-colors",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
              active
                ? "text-white shadow-sm"
                : "text-neutral-600 hover:text-neutral-900 hover:bg-black/[0.03]",
            )}
            style={active ? { backgroundColor: "var(--brand)" } : undefined}
          >
            {it.label}{" "}
            <span
              className={cn(
                "ml-1 text-xs tabular-nums",
                active ? "text-white/80" : "text-neutral-400",
              )}
            >
              {it.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Row ---------- */

function FeeRow({
  index,
  row,
  tenantName,
  whatsappEnabled,
  onCollect,
  onReceipt,
}: {
  index: number;
  row: RegisterRow;
  tenantName: string;
  whatsappEnabled: boolean;
  onCollect: () => void;
  onReceipt: () => void;
}) {
  const due = row.due;
  const remindPhone = (row.guardianPhone || row.phone || "").replace(/\D/g, "");
  const isPending = due.state === "pending";

  return (
    <li className="p-4 md:px-5 md:py-4 hover:bg-black/[0.015] transition-colors">
      <div className="flex items-center gap-3 md:gap-4">
        <div className="hidden md:flex w-6 text-xs text-neutral-400 tabular-nums justify-center">
          {index}
        </div>

        <PersonAvatar name={row.name} src={row.photoUrl} className="h-11 w-11" />

        <div className="min-w-0 flex-1">
          <button
            type="button"
            className="font-semibold text-[15px] truncate block hover:underline text-left"
            title={row.name}
            onClick={() => {
              // Student profile popup lives in a later prompt.
              toast.message(row.name, { description: "Student profile — coming soon" });
            }}
          >
            {row.name}
          </button>
          <div className="text-xs text-muted-foreground truncate mt-0.5">
            <span className="md:hidden">#{index} · </span>
            {[row.batchName, row.planName].filter(Boolean).join(" · ") || "—"}
          </div>
          {isPending && due.overdueDays > 0 && (
            <div className="mt-1">
              <span className="inline-flex items-center rounded-full bg-rose-50 text-rose-700 text-[11px] font-semibold px-2 py-0.5">
                Overdue {due.overdueDays}d
              </span>
              <span className="ml-2 text-[11px] text-muted-foreground">
                {periodLabel(due.period)}
              </span>
            </div>
          )}
          {isPending && due.overdueDays === 0 && (
            <div className="mt-1">
              <span className="inline-flex items-center rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold px-2 py-0.5">
                Due today
              </span>
              <span className="ml-2 text-[11px] text-muted-foreground">
                {periodLabel(due.period)}
              </span>
            </div>
          )}
          {due.state === "paid" && row.paidPayment && (
            <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium">
              <CheckCircle2 className="size-3.5" />
              Paid · {format(new Date(row.paidPayment.created_at), "d MMM")} ·{" "}
              {row.paidPayment.method.toUpperCase()}
            </div>
          )}
        </div>

        <div className="text-right shrink-0">
          <div className="font-bold tabular-nums text-[15px]">{money(row.amount)}</div>
          {row.hasCustomFee && (
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">
              custom
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {isPending ? (
            <>
              {whatsappEnabled && remindPhone && (
                <Button
                  asChild
                  size="icon"
                  variant="ghost"
                  className="rounded-full h-10 w-10 text-[#25D366] hover:bg-[#25D366]/10"
                  aria-label="Remind on WhatsApp"
                >
                  <a
                    href={`https://wa.me/${remindPhone}?text=${encodeURIComponent(
                      reminderMessage({
                        tenantName,
                        studentName: row.name,
                        guardianName: row.guardianName,
                        amount: row.amount,
                        period: due.period,
                      }),
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="size-5" />
                  </a>
                </Button>
              )}
              <Button
                onClick={onCollect}
                className="rounded-full h-10 px-5 font-semibold"
                style={{ backgroundColor: "var(--brand)", color: "white" }}
              >
                Collect
              </Button>
            </>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full h-10 w-10"
              aria-label="Download receipt"
              onClick={onReceipt}
            >
              <Download className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

/* ---------- Empty / loading ---------- */

function SkeletonList() {
  return (
    <ul className="divide-y divide-black/[0.06]">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="p-4 md:px-5 md:py-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="hidden md:block w-6" />
            <div className="h-11 w-11 rounded-full bg-black/5 animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-40 rounded bg-black/5 animate-pulse" />
              <div className="h-3 w-24 rounded bg-black/5 animate-pulse" />
            </div>
            <div className="h-5 w-16 rounded bg-black/5 animate-pulse" />
            <div className="h-10 w-24 rounded-full bg-black/5 animate-pulse" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({ filter, monthLabel }: { filter: Filter; monthLabel: string }) {
  if (filter === "pending") {
    return (
      <div className="p-10 text-center">
        <div
          className="mx-auto h-14 w-14 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "color-mix(in oklab, var(--brand) 12%, white)" }}
        >
          <PartyPopper className="size-7" style={{ color: "var(--brand)" }} />
        </div>
        <div className="mt-3 font-semibold text-lg">All fees collected for {monthLabel}</div>
        <div className="text-sm text-muted-foreground mt-1">
          Nothing pending. Enjoy the quiet 🎉
        </div>
      </div>
    );
  }
  return (
    <div className="p-10 text-center text-sm text-muted-foreground">
      Nothing here yet.
    </div>
  );
}

/* ---------- Collect flow (responsive: bottom-sheet on mobile, modal on desktop) ---------- */

function CollectFlow({
  row,
  tenantId,
  onClose,
  onDone,
}: {
  row: RegisterRow | null;
  tenantId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const isMobile = useIsMobile();
  const open = !!row;

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl p-0 border-0 max-h-[92vh] overflow-y-auto"
        >
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-black/10" />
          <div className="p-5 pt-4">
            <SheetHeader>
              <SheetTitle>
                {row ? `Collect fee — ${row.name}` : "Collect fee"}
              </SheetTitle>
            </SheetHeader>
            {row && <CollectForm row={row} tenantId={tenantId} onDone={onDone} />}
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{row ? `Collect fee — ${row.name}` : "Collect fee"}</DialogTitle>
        </DialogHeader>
        {row && <CollectForm row={row} tenantId={tenantId} onDone={onDone} />}
      </DialogContent>
    </Dialog>
  );
}

function CollectForm({
  row,
  tenantId,
  onDone,
}: {
  row: RegisterRow;
  tenantId: string;
  onDone: () => void;
}) {
  const due = row.due;
  const period = due.state === "pending" ? due.period : periodKey(new Date());
  const [amount, setAmount] = useState(String(row.amount || ""));
  const [method, setMethod] = useState<"cash" | "upi" | null>(null);
  const [note, setNote] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      if (!method) throw new Error("Choose a payment method");
      const { error } = await supabase.from("payments").insert({
        tenant_id: tenantId,
        student_id: row.studentId,
        amount: Number(amount),
        type: "monthly",
        period,
        method,
        note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${row.name} marked paid ✓`);
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const numeric = Number(amount);
  const disabled = save.isPending || !numeric || numeric <= 0 || !method;

  return (
    <div className="space-y-5 pt-2">
      <div className="text-xs text-muted-foreground">
        Period: <span className="font-medium text-neutral-700">{periodLabel(period)}</span>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Amount</Label>
        <div className="relative">
          <span className="absolute inset-y-0 left-4 flex items-center text-lg font-semibold text-neutral-500">
            ₹
          </span>
          <Input
            type="number"
            inputMode="numeric"
            className="text-2xl font-bold h-14 pl-9 rounded-xl"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Fee is {money(row.amount)}
          {row.hasCustomFee ? " (custom for this student)" : ""}. Edit for partial or
          discounted amounts.
        </p>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Payment method</Label>
        <div className="grid grid-cols-2 gap-3">
          <MethodButton
            label="Cash"
            icon={<Banknote className="size-5" />}
            active={method === "cash"}
            onClick={() => setMethod("cash")}
          />
          <MethodButton
            label="UPI"
            icon={<Smartphone className="size-5" />}
            active={method === "upi"}
            onClick={() => setMethod("upi")}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm text-muted-foreground">Note (optional)</Label>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. paid half, rest next week"
          className="h-11 rounded-xl"
        />
      </div>

      <Button
        onClick={() => save.mutate()}
        disabled={disabled}
        className="w-full h-14 text-base font-semibold rounded-xl"
        style={{ backgroundColor: "var(--brand)", color: "white" }}
      >
        {save.isPending ? "Saving…" : "Confirm payment"}
      </Button>
    </div>
  );
}

function MethodButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-16 rounded-xl border-2 flex items-center justify-center gap-2 text-base font-semibold transition-all",
        active
          ? "text-white shadow-sm"
          : "bg-white text-neutral-700 border-black/[0.08] hover:border-black/20",
      )}
      style={
        active
          ? { backgroundColor: "var(--brand)", borderColor: "var(--brand)" }
          : undefined
      }
    >
      {icon}
      {label}
    </button>
  );
}
