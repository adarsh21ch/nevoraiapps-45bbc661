import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useDashboard } from "@/lib/dashboard-context";
import { fetchKpis, qk } from "@/lib/dashboard-queries";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  IndianRupee,
  Plus,
  ArrowRight,
  ChevronRight,
  Inbox,
  Phone,
  MessageCircle,
  PartyPopper,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { niche } from "@/lib/niche";
import { getFeatures } from "@/lib/tenant";
import { candidatePeriods, periodKey, studentDue, tenantFeeCycle } from "@/lib/fees";
import { PersonAvatar } from "@/components/site/PersonAvatar";
import { useT } from "@/lib/i18n";
import { format } from "date-fns";

export const Route = createFileRoute("/dashboard/")({
  component: DashboardHome,
});

const money = (n: number) => `₹${Number(n || 0).toLocaleString("en-IN")}`;

function DashboardHome() {
  const { tenant } = useDashboard();
  const { t, lang } = useT();
  const n = niche(tenant.niche);
  const features = getFeatures(tenant);
  const kpisQ = useQuery({
    queryKey: qk.kpis(tenant.id),
    queryFn: () => fetchKpis(tenant),
  });

  const cycle = tenantFeeCycle(tenant);
  const now = new Date();
  const monthLabel = format(now, "MMMM yyyy");

  const pendingListQ = useQuery({
    enabled: features.fee_tracking !== false,
    queryKey: ["d", "home-pending", tenant.id],
    queryFn: async () => {
      const periods = cycle === "joining_date" ? candidatePeriods(now) : [periodKey(now)];
      const [studentsRes, paidRes] = await Promise.all([
        supabase
          .from("students")
          .select("id, name, joined_at, phone, guardian_phone, photo_url, custom_fee, fee_plans!inner(name, amount, type)")
          .eq("tenant_id", tenant.id)
          .eq("status", "active")
          .eq("fee_plans.type", "monthly")
          .order("name"),
        supabase
          .from("payments")
          .select("student_id, period, amount")
          .eq("tenant_id", tenant.id)
          .in("period", periods),
      ]);
      const paidByStudent = new Map<string, Set<string>>();
      for (const p of paidRes.data ?? []) {
        if (!p.student_id || !p.period) continue;
        const s = paidByStudent.get(p.student_id) ?? new Set<string>();
        s.add(p.period);
        paidByStudent.set(p.student_id, s);
      }
      const rows = (studentsRes.data ?? []).map((s: any) => {
        const due = studentDue({
          cycle,
          joinedAt: s.joined_at,
          selectedMonth: now,
          paidPeriods: paidByStudent.get(s.id) ?? new Set(),
          today: now,
        });
        const effectiveFee = Number(s.custom_fee ?? s.fee_plans?.amount ?? 0);
        return {
          id: s.id as string,
          name: s.name as string,
          phone: (s.phone ?? s.guardian_phone ?? "") as string,
          photoUrl: (s.photo_url ?? null) as string | null,
          effectiveFee,
          due,
        };
      });
      const totalStudents = rows.length;
      const paidCount = rows.filter((r) => r.due.state === "paid").length;
      const pendingRows = rows
        .filter((r) => r.due.state === "pending")
        .sort((a, b) => {
          const ao = a.due.state === "pending" ? a.due.overdueDays : 0;
          const bo = b.due.state === "pending" ? b.due.overdueDays : 0;
          return bo - ao;
        });
      const expected = rows.reduce((s, r) => s + r.effectiveFee, 0);
      const collected = rows
        .filter((r) => r.due.state === "paid")
        .reduce((s, r) => s + r.effectiveFee, 0);
      return { pendingRows, totalStudents, paidCount, expected, collected };
    },
  });

  const kpis = kpisQ.data;
  const active = kpis?.activeStudents ?? 0;
  const collectedMonth = pendingListQ.data?.collected ?? kpis?.collectionThisMonth ?? 0;
  const expectedMonth = pendingListQ.data?.expected ?? 0;
  const pendingCount = kpis?.pendingFeeCount ?? pendingListQ.data?.pendingRows.length ?? 0;
  const paidCount = pendingListQ.data?.paidCount ?? 0;
  const totalMonthly = pendingListQ.data?.totalStudents ?? 0;
  const newRegs = kpis?.newRegsThisWeek ?? 0;
  const pct = expectedMonth > 0 ? Math.round((collectedMonth / expectedMonth) * 100) : 0;

  const empty = !kpisQ.isLoading && active === 0 && newRegs === 0;
  const allPaid = !pendingListQ.isLoading && totalMonthly > 0 && pendingCount === 0;

  const feeEnabled = features.fee_tracking !== false;

  return (
    <div className="space-y-5 md:space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("Welcome back")}</h1>
        <p className="text-sm text-muted-foreground">
          {tenant.name} · {t("at a glance")} · {monthLabel}
        </p>
      </header>

      {/* KPI grid — clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <KpiCard
          to="/dashboard/students"
          search={{ status: "active" }}
          icon={<Users className="size-5" />}
          label={t("Active students")}
          value={kpisQ.isLoading ? null : String(active)}
          accent="brand"
          hint={n.students.toLowerCase()}
        />
        {feeEnabled ? (
          <KpiCard
            to="/dashboard/fees"
            search={{ filter: "paid" }}
            icon={<IndianRupee className="size-5" />}
            label={t("Collected this month")}
            value={kpisQ.isLoading && pendingListQ.isLoading ? null : money(collectedMonth)}
            accent="emerald"
            hint={`${paidCount} ${t("paid")}`}
          />
        ) : null}
        {feeEnabled ? (
          <KpiCard
            to="/dashboard/fees"
            search={{ filter: "pending" }}
            icon={<AlertCircle className="size-5" />}
            label={t("Pending this month")}
            value={pendingListQ.isLoading ? null : String(pendingCount)}
            accent="rose"
            hint={`${n.students.toLowerCase()} · ${t("pending")}`}
            emphasize
          />
        ) : null}
        <KpiCard
          to="/dashboard/registrations"
          icon={<Inbox className="size-5" />}
          label={t("New registrations")}
          value={kpisQ.isLoading ? null : String(newRegs)}
          accent="brand"
          hint={t("This week")}
        />
      </div>

      {/* Monthly collection progress */}
      {feeEnabled ? (
        <Card className="p-5 md:p-6">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {t("This month")} · {monthLabel}
              </div>
              <div className="mt-1 text-lg md:text-xl font-semibold">
                <span className="tabular-nums">{money(collectedMonth)}</span>{" "}
                <span className="text-muted-foreground text-sm font-normal">
                  {t("collected of")} {money(expectedMonth)} {t("expected")}
                </span>
              </div>
            </div>
            <div className="text-2xl font-bold tabular-nums" style={{ color: "var(--brand)" }}>
              {pct}%
            </div>
          </div>
          <div className="mt-4 h-2.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, pct)}%`, backgroundColor: "var(--brand, #0ea5e9)" }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <span className="text-emerald-700 font-medium">
              {paidCount} {t("of")} {totalMonthly} {t("paid")}
            </span>
            <Link
              to="/dashboard/fees"
              search={{ filter: "pending" }}
              className="text-rose-600 font-semibold hover:underline"
            >
              {pendingCount} {t("pending")} →
            </Link>
          </div>
        </Card>
      ) : null}

      {/* Follow-up list */}
      {feeEnabled ? (
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-3 md:px-5">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-muted-foreground">
                {t("Pending")}
              </div>
              <div className="text-sm font-semibold">{t("Students to follow up")}</div>
            </div>
            <Link
              to="/dashboard/fees"
              search={{ filter: "pending" }}
              className="text-xs font-medium inline-flex items-center gap-1"
              style={{ color: "var(--brand)" }}
            >
              {t("Open register")} <ArrowRight className="size-3" />
            </Link>
          </div>

          {pendingListQ.isLoading ? (
            <div className="p-4 space-y-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : allPaid ? (
            <div className="px-5 py-10 text-center">
              <div
                className="mx-auto grid size-12 place-items-center rounded-full"
                style={{ backgroundColor: "color-mix(in oklab, #10b981 15%, transparent)" }}
              >
                <PartyPopper className="size-6 text-emerald-600" />
              </div>
              <div className="mt-3 text-base font-semibold">
                {t("All fees collected for")} {monthLabel} 🎉
              </div>
              <div className="text-xs text-muted-foreground mt-1">{t("All caught up")}</div>
            </div>
          ) : (
            <ul className="divide-y">
              {(pendingListQ.data?.pendingRows ?? []).slice(0, 8).map((row) => {
                const overdue = row.due.state === "pending" ? row.due.overdueDays : 0;
                const phone = normalizePhone(row.phone);
                return (
                  <li key={row.id} className="flex items-center gap-3 px-3 py-3 md:px-5">
                    <Link
                      to="/dashboard/students/$id"
                      params={{ id: row.id }}
                      className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80"
                    >
                      <PersonAvatar name={row.name} src={row.photoUrl} size={40} />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold truncate">{row.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {money(row.effectiveFee)}
                          {overdue > 0 ? ` · ${overdue} ${t("days overdue")}` : ` · ${t("due")}`}
                        </div>
                      </div>
                    </Link>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {phone ? (
                        <a
                          href={`tel:${phone}`}
                          className="inline-grid place-items-center size-9 rounded-full border border-border bg-background hover:bg-muted transition-colors"
                          aria-label={t("Call")}
                          title={t("Call")}
                        >
                          <Phone className="size-4" style={{ color: "var(--brand)" }} />
                        </a>
                      ) : null}
                      {phone ? (
                        <a
                          href={`https://wa.me/${waFormat(phone)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-grid place-items-center size-9 rounded-full bg-emerald-600 hover:bg-emerald-700 transition-colors"
                          aria-label={t("WhatsApp")}
                          title={t("WhatsApp")}
                        >
                          <MessageCircle className="size-4 text-white" />
                        </a>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      ) : null}

      {empty ? (
        <Card className="p-8 text-center">
          <div
            className="mx-auto grid size-12 place-items-center rounded-full"
            style={{ backgroundColor: "color-mix(in oklab, var(--brand) 15%, transparent)" }}
          >
            <Users className="size-6" style={{ color: "var(--brand)" }} />
          </div>
          <h2 className="mt-4 text-lg font-semibold">{t("No students yet")}</h2>
          <Link
            to="/dashboard/students"
            className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm"
            style={{ backgroundColor: "var(--brand)" }}
          >
            <Plus className="size-4" /> {t("Add your first student")}
          </Link>
        </Card>
      ) : null}
    </div>
  );
}

function KpiCard({
  to,
  search,
  icon,
  label,
  value,
  hint,
  accent,
  emphasize,
}: {
  to: "/dashboard/students" | "/dashboard/fees" | "/dashboard/registrations";
  search?: Record<string, string>;
  icon: React.ReactNode;
  label: string;
  value: string | null;
  hint?: string;
  accent: "brand" | "emerald" | "rose";
  emphasize?: boolean;
}) {
  const { t } = useT();
  const accentStyles: Record<string, { bg: string; fg: string; ring?: string }> = {
    brand: {
      bg: "color-mix(in oklab, var(--brand) 12%, transparent)",
      fg: "var(--brand)",
    },
    emerald: {
      bg: "color-mix(in oklab, #10b981 14%, transparent)",
      fg: "#047857",
    },
    rose: {
      bg: "color-mix(in oklab, #f43f5e 14%, transparent)",
      fg: "#be123c",
    },
  };
  const s = accentStyles[accent];
  return (
    <Link
      to={to}
      search={search as never}
      className="group block"
    >
      <Card
        className={`p-4 md:p-5 h-full transition-all hover:-translate-y-0.5 hover:shadow-md ${
          emphasize ? "ring-1 ring-rose-200" : ""
        }`}
      >
        <div className="flex items-start justify-between">
          <div
            className="grid size-9 place-items-center rounded-xl"
            style={{ backgroundColor: s.bg, color: s.fg }}
          >
            {icon}
          </div>
          <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
        <div className="mt-3 text-[11px] uppercase tracking-widest text-muted-foreground font-medium">
          {label}
        </div>
        <div className="mt-1 text-2xl md:text-3xl font-bold tabular-nums" style={{ color: emphasize ? s.fg : undefined }}>
          {value === null ? <Skeleton className="h-8 w-20" /> : value}
        </div>
        {hint ? <div className="text-[11px] text-muted-foreground mt-1">{hint}</div> : null}
        <div className="mt-2 text-[11px] font-semibold inline-flex items-center gap-1" style={{ color: s.fg }}>
          {t("View")} <ArrowRight className="size-3" />
        </div>
      </Card>
    </Link>
  );
}

function normalizePhone(raw: string): string {
  return (raw || "").replace(/[^\d+]/g, "");
}

function waFormat(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  // If 10 digits assume India, prefix 91
  if (digits.length === 10) return `91${digits}`;
  return digits;
}
