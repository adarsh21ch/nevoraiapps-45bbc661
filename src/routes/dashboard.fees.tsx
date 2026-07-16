import { createFileRoute } from "@tanstack/react-router";
import { OwnerOnly } from "@/components/dashboard/OwnerOnly";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/lib/dashboard-context";
import { fetchPaymentsForPeriods, fetchStudents, qk } from "@/lib/dashboard-queries";
import { recordPayment } from "@/lib/billing";

// M2a bridge helpers — route-local, no lib changes.
function buildQuickCollectRemarks(period: string, existingRemarks: string | null | undefined) {
  const prefix = `[period:${period}]`;
  const rest = (existingRemarks ?? "").trim();
  return rest ? `${prefix} ${rest}` : prefix;
}
function quickCollectIdempotencyKey(studentId: string, period: string, amount: number) {
  return `fees:quick:${studentId}:${period}:${amount}`;
}
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
import { StudentProfilePanel } from "@/components/dashboard/StudentProfilePanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { FilterTabs } from "@/components/shared/FilterTabs";
import { DashboardSearch } from "@/components/dashboard-ui";
import {
  Banknote,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  MessageCircle,
  MoreHorizontal,
  PartyPopper,
  Search,
  Smartphone,
  UserPlus,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VirtualList } from "@/components/ds/VirtualList";
import { FeesTabsBar } from "@/components/dashboard/FeesTabsBar";

export const Route = createFileRoute("/dashboard/fees")({
  validateSearch: (search: Record<string, unknown>): { filter?: Filter } => {
    const f = search.filter;
    return f === "pending" || f === "paid" || f === "all" || f === "overdue" ? { filter: f } : {};
  },

  component: () => (
    <OwnerOnly>
      <FeeRegister />
    </OwnerOnly>
  ),
});

type Filter = "all" | "pending" | "paid" | "overdue";

type RegisterRow = {
  studentId: string;
  name: string;
  photoUrl: string | null;
  batchName: string | null;
  planName: string | null;
  playerId: string | null;
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

  const initialFilter = Route.useSearch().filter ?? "pending";
  const [filter, setFilter] = useState<Filter>(initialFilter);
  const [search, setSearch] = useState("");
  const [payRow, setPayRow] = useState<RegisterRow | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  const studentsQ = useQuery({
    queryKey: qk.students(tenant.id),
    queryFn: () => fetchStudents(tenant.id),
  });
  const paymentsQ = useQuery({
    queryKey: qk.feeRegister(tenant.id, periods.join(",")),
    queryFn: () => fetchPaymentsForPeriods(tenant.id, periods),
  });

  // Instant profile open — seed the detail query cache from the roster list.
  const openProfile = (studentId: string) => {
    const s = (studentsQ.data ?? []).find((x: any) => x.id === studentId);
    if (s) qc.setQueryData(qk.student(studentId), s);
    setProfileId(studentId);
  };

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
          playerId: s.player_id ?? null,

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
  const overdueRows = pendingRows.filter((r) => r.due.state === "pending" && r.due.overdueDays > 0);
  const collectedAmount = paidRows.reduce(
    (s, r) => s + Number(r.paidPayment?.amount ?? r.amount),
    0,
  );
  const pendingAmount = pendingRows.reduce((s, r) => s + r.amount, 0);
  const expectedAmount = collectedAmount + pendingAmount;
  const collectionPct =
    expectedAmount > 0 ? Math.round((collectedAmount / expectedAmount) * 100) : 0;

  const byFilter =
    filter === "pending"
      ? pendingRows
      : filter === "paid"
        ? paidRows
        : filter === "overdue"
          ? overdueRows
          : rows;

  const q = search.trim().toLowerCase();
  const visible = q
    ? byFilter.filter((r) => {
        const digits = q.replace(/\D/g, "");
        return (
          r.name.toLowerCase().includes(q) ||
          (r.playerId ?? "").toLowerCase().includes(q) ||
          (digits.length >= 3 &&
            ((r.phone ?? "").replace(/\D/g, "").includes(digits) ||
              (r.guardianPhone ?? "").replace(/\D/g, "").includes(digits)))
        );
      })
    : byFilter;
  const loading = studentsQ.isLoading || paymentsQ.isLoading;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["d", "fees"] });
    qc.invalidateQueries({ queryKey: qk.kpis(tenant.id) });
  };

  return (
    <div className="-mt-4 md:-mt-8 space-y-3">
      <FeesTabsBar />
      {/* Header — uniform across dashboard tabs */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 pt-2 pb-1">
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight leading-tight truncate">
            Student Fees
          </h1>
          <p className="text-[11px] text-muted-foreground leading-tight truncate">
            Who's paid, who's pending — collect in one tap.
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {cycle === "calendar_month" && (
            <div className="flex items-center gap-1 rounded-full bg-card border border-border shadow-sm px-1 py-1">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-8 w-8"
                aria-label="Previous month"
                onClick={() => setMonthOffset((m) => m - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <div className="text-xs font-semibold w-20 text-center tabular-nums">
                {format(selectedMonth, "MMM yyyy")}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-8 w-8"
                aria-label="Next month"
                disabled={monthOffset >= 0}
                onClick={() => setMonthOffset((m) => Math.min(0, m + 1))}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-9 w-9 bg-card border border-border shadow-sm"
                aria-label="More actions"
              >
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem asChild>
                <Link to="/dashboard/fee-plans">Manage Fee Plans</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/dashboard/students">Assign to Students</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/dashboard/reminders">Send Reminders</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/dashboard/reports">Reports &amp; Exports</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Compact KPI strip */}
      <KpiStrip
        pending={pendingAmount}
        collected={collectedAmount}
        overdueCount={overdueRows.length}
        pct={collectionPct}
      />

      {/* Sticky search + chip filters */}
      <div className="sticky top-0 z-20 -mx-4 px-4 py-2 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70 space-y-2">
        <DashboardSearch
          value={search}
          onChange={setSearch}
          placeholder="Search name, player ID or mobile"
        />
        <ChipFilters
          value={filter}
          onChange={setFilter}
          counts={{
            all: rows.length,
            pending: pendingRows.length,
            paid: paidRows.length,
            overdue: overdueRows.length,
          }}
        />
      </div>

      <section className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
        {loading ? (
          <SkeletonList />
        ) : visible.length === 0 ? (
          <EmptyState
            filter={filter}
            monthLabel={format(selectedMonth, "MMMM")}
            searching={q.length > 0}
            hasStudents={rows.length > 0}
          />
        ) : (
          <VirtualList
            items={visible}
            estimateSize={84}
            overscan={8}
            className="max-h-[calc(100vh-260px)] min-h-[400px]"
            getKey={(r) => r.studentId}
            renderItem={(r) => (
              <div className="border-b border-border">
                <FeeRow
                  row={r}
                  tenantName={tenant.name}
                  whatsappEnabled={features.whatsapp_reminders !== false}
                  onOpenProfile={() => openProfile(r.studentId)}
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
              </div>
            )}
          />
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

      <FeesProfileSheet id={profileId} onOpenChange={(o) => !o && setProfileId(null)} />
    </div>
  );
}

function FeesProfileSheet({
  id,
  onOpenChange,
}: {
  id: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const open = !!id;
  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl p-0 border-0 max-h-[92vh] overflow-y-auto"
        >
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-muted" />
          <div className="p-5 pt-3">
            <SheetHeader>
              <SheetTitle className="sr-only">Student profile</SheetTitle>
            </SheetHeader>
            {id && <StudentProfilePanel studentId={id} compact />}
          </div>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">Student profile</DialogTitle>
        </DialogHeader>
        {id && <StudentProfilePanel studentId={id} />}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Compact KPI strip ---------- */

function KpiStrip({
  pending,
  collected,
  overdueCount,
  pct,
}: {
  pending: number;
  collected: number;
  overdueCount: number;
  pct: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm px-3 py-2">
      <div className="grid grid-cols-4 gap-2 text-center">
        <KpiCell label="Pending" value={money(pending)} tone="danger" />
        <KpiCell label="Collected" value={money(collected)} tone="success" />
        <KpiCell label="Overdue" value={String(overdueCount)} tone="danger" />
        <KpiCell label="Collection" value={`${pct}%`} tone="neutral" />
      </div>
      <div className="mt-2 h-1 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-foreground transition-all"
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  );
}

function KpiCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "danger" | "success" | "neutral";
}) {
  const color =
    tone === "danger"
      ? "text-rose-600"
      : tone === "success"
        ? "text-emerald-600"
        : "text-foreground";
  return (
    <div className="min-w-0">
      <div className={cn("text-sm font-bold tabular-nums truncate", color)}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground leading-tight">
        {label}
      </div>
    </div>
  );
}

/* ---------- Chip filters ---------- */

function ChipFilters({
  value,
  onChange,
  counts,
}: {
  value: Filter;
  onChange: (v: Filter) => void;
  counts: { all: number; pending: number; paid: number; overdue: number };
}) {
  return (
    <FilterTabs<Filter>
      value={value}
      onChange={onChange}
      items={[
        { key: "pending", label: "Pending", count: counts.pending },
        { key: "paid", label: "Paid", count: counts.paid },
        { key: "all", label: "All", count: counts.all },
      ]}
      ariaLabel="Fee status"
    />
  );
}

/* ---------- Row ---------- */

function FeeRow({
  row,
  tenantName,
  whatsappEnabled,
  onOpenProfile,
  onCollect,
  onReceipt,
}: {
  row: RegisterRow;
  tenantName: string;
  whatsappEnabled: boolean;
  onOpenProfile: () => void;
  onCollect: () => void;
  onReceipt: () => void;
}) {
  const due = row.due;
  const remindPhone = (row.guardianPhone || row.phone || "").replace(/\D/g, "");
  const isPending = due.state === "pending";
  const isOverdue = isPending && due.overdueDays > 0;

  const secondaryLine = isPending
    ? isOverdue
      ? `Overdue · ${due.overdueDays} ${due.overdueDays === 1 ? "day" : "days"}`
      : `Pending · ${periodLabel(due.period)}`
    : "Paid";
  const secondaryClass = isPending
    ? isOverdue
      ? "text-rose-600 dark:text-rose-400"
      : "text-amber-600 dark:text-amber-400"
    : "text-emerald-600 dark:text-emerald-400";

  return (
    <li className="p-3 md:px-5 md:py-3 hover:bg-accent/60 transition-colors">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenProfile}
          className="flex items-center gap-3 min-w-0 flex-1 text-left"
          title={row.name}
        >
          <div className="relative shrink-0">
            <PersonAvatar name={row.name} src={row.photoUrl} className="h-10 w-10" />
            {isOverdue && (
              <span
                className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full ring-2 ring-card bg-rose-500"
                title={`Overdue ${due.overdueDays}d`}
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-semibold text-[15px] truncate">{row.name}</div>
            <div className={cn("text-[11px] truncate leading-tight font-medium", secondaryClass)}>
              {secondaryLine}
            </div>
          </div>
        </button>

        <div className="text-right shrink-0">
          <div className="font-bold tabular-nums text-[15px]">{money(row.amount)}</div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {isPending ? (
            <>
              {whatsappEnabled && remindPhone && (
                <Button
                  asChild
                  size="icon"
                  variant="ghost"
                  className="rounded-full h-9 w-9 text-[#25D366] hover:bg-[#25D366]/10 hidden sm:inline-flex"
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
                className="rounded-full h-9 px-4 font-semibold text-sm"
                style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
              >
                Collect
              </Button>
            </>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              className="rounded-full h-9 w-9"
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
    <ul className="divide-y divide-border">
      {Array.from({ length: 5 }).map((_, i) => (
        <li key={i} className="p-4 md:px-5 md:py-4">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="hidden md:block w-6" />
            <div className="h-11 w-11 rounded-full bg-muted animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-3.5 w-40 rounded bg-muted animate-pulse" />
              <div className="h-3 w-24 rounded bg-muted animate-pulse" />
            </div>
            <div className="h-5 w-16 rounded bg-muted animate-pulse" />
            <div className="h-10 w-24 rounded-full bg-muted animate-pulse" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState({
  filter,
  monthLabel,
  searching,
  hasStudents,
}: {
  filter: Filter;
  monthLabel: string;
  searching: boolean;
  hasStudents: boolean;
}) {
  if (searching) {
    return (
      <div className="p-10 text-center text-sm text-muted-foreground">
        No students match your search.
      </div>
    );
  }
  if (!hasStudents) {
    return (
      <div className="p-10 text-center">
        <div
          className="mx-auto h-14 w-14 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "color-mix(in oklab, var(--brand) 12%, white)" }}
        >
          <UserPlus className="size-7" style={{ color: "var(--brand)" }} />
        </div>
        <div className="mt-3 font-semibold text-lg">No students with a monthly plan</div>
        <div className="text-sm text-muted-foreground mt-1 mb-4">
          Add students or assign a fee plan to start collecting.
        </div>
        <div className="flex items-center justify-center gap-2">
          <Button asChild variant="outline" className="rounded-full">
            <Link to="/dashboard/students">Add Student</Link>
          </Button>
          <Button
            asChild
            className="rounded-full"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
          >
            <Link to="/dashboard/fee-plans">Assign Fee Plan</Link>
          </Button>
        </div>
      </div>
    );
  }
  if (filter === "pending" || filter === "overdue") {
    return (
      <div className="p-10 text-center">
        <div
          className="mx-auto h-14 w-14 rounded-full flex items-center justify-center"
          style={{ backgroundColor: "color-mix(in oklab, var(--brand) 12%, white)" }}
        >
          <PartyPopper className="size-7" style={{ color: "var(--brand)" }} />
        </div>
        <div className="mt-3 font-semibold text-lg">
          {filter === "overdue" ? "Nothing overdue" : `All fees collected for ${monthLabel}`}
        </div>
        <div className="text-sm text-muted-foreground mt-1">Nothing to chase right now 🎉</div>
      </div>
    );
  }
  return <div className="p-10 text-center text-sm text-muted-foreground">Nothing here yet.</div>;
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
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-muted" />
          <div className="p-5 pt-4">
            <SheetHeader>
              <SheetTitle>{row ? `Collect fee — ${row.name}` : "Collect fee"}</SheetTitle>
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

  const qc = useQueryClient();

  // Phase 14 hot-path: close the sheet + toast success in the same frame the
  // user taps "Confirm payment". The Supabase insert + Billing V2 bridge
  // still run — but in the background. On failure we roll the cached fees
  // list back and toast an error the owner can retry.
  const save = useMutation({
    mutationFn: async () => {
      if (!method) throw new Error("Choose a payment method");
      const amt = Number(amount);
      const { error } = await supabase.from("payments").insert({
        tenant_id: tenantId,
        student_id: row.studentId,
        amount: amt,
        type: "monthly",
        period,
        method,
        note: note || null,
      });
      if (error) throw error;

      // M2a bridge: dual-write to Billing V2. Non-blocking on failure.
      try {
        await recordPayment({
          tenant_id: tenantId,
          student_id: row.studentId,
          amount: amt,
          method,
          allocations: [],
          collected_at: new Date().toISOString(),
          remarks: buildQuickCollectRemarks(period, note),
          idempotency_key: quickCollectIdempotencyKey(row.studentId, period, amt),
        });
      } catch (v2err) {
        console.error("[M2a-bridge] recordPayment failed", v2err);
        toast.warning("Payment saved. Sync warning — please refresh.");
      }
    },
    onSuccess: () => {
      // Reconcile in the background — do NOT await; the UI already moved on.
      qc.invalidateQueries({ queryKey: ["d", "fees"] });
    },
    onError: (e: Error) => {
      toast.error(e.message || "Couldn't save payment — tap the student to retry");
      qc.invalidateQueries({ queryKey: ["d", "fees"] });
    },
  });

  const numeric = Number(amount);
  const disabled = !method || !numeric || numeric <= 0;

  return (
    <div className="space-y-5 pt-2">
      <div className="text-xs text-muted-foreground">
        Period: <span className="font-medium text-foreground">{periodLabel(period)}</span>
      </div>

      <div className="space-y-1.5">
        <Label className="text-sm">Amount</Label>
        <div className="relative">
          <span className="absolute inset-y-0 left-4 flex items-center text-lg font-semibold text-muted-foreground">
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
          {row.hasCustomFee ? " (custom for this student)" : ""}. Edit for partial or discounted
          amounts.
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
        onClick={() => {
          if (disabled) return;
          // Fire the write in the background and close the sheet in the same
          // frame. Error rollback + toast is handled inside the mutation.
          save.mutate();
          toast.success(`${row.name} marked paid ✓`);
          onDone();
        }}
        disabled={!method || !numeric || numeric <= 0}
        className="w-full h-14 text-base font-semibold rounded-xl"
        style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
      >
        Confirm payment
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
          ? "shadow-sm text-background"
          : "bg-card text-foreground border-border hover:border-foreground/30",
      )}
      style={
        active
          ? {
              backgroundColor: "var(--brand)",
              borderColor: "var(--brand)",
              color: "var(--brand-ink)",
            }
          : undefined
      }
    >
      {icon}
      {label}
    </button>
  );
}
