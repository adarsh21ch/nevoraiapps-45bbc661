import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useDashboard } from "@/lib/dashboard-context";
import { fetchKpis, fetchDashboardInsights, qk } from "@/lib/dashboard-queries";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  IndianRupee,
  Plus,
  ArrowRight,
  Inbox,
  Phone,
  MessageCircle,
  PartyPopper,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Cake,
  ClipboardCheck,
} from "lucide-react";
import { niche } from "@/lib/niche";
import { getFeatures } from "@/lib/tenant";
import { candidatePeriods, periodKey, studentDue, tenantFeeCycle } from "@/lib/fees";
import { PersonAvatar } from "@/components/site/PersonAvatar";
import { useT } from "@/lib/i18n";
import { useNewRegistrationsCount } from "@/hooks/use-new-registrations";
import { useInAcademyCount } from "@/lib/attendance/queries";
import { LiveBadge } from "@/components/ds";
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
  const newRegs = useNewRegistrationsCount(tenant.id);
  const kpisQ = useQuery({
    queryKey: qk.kpis(tenant.id),
    queryFn: () => fetchKpis(tenant),
  });
  const insightsQ = useQuery({
    queryKey: qk.insights(tenant.id),
    queryFn: () => fetchDashboardInsights(tenant.id),
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
  const newRegsThisWeek = kpis?.newRegsThisWeek ?? 0;
  const pct = expectedMonth > 0 ? Math.round((collectedMonth / expectedMonth) * 100) : 0;

  const empty = !kpisQ.isLoading && active === 0 && newRegs === 0;
  const allPaid = !pendingListQ.isLoading && totalMonthly > 0 && pendingCount === 0;

  const feeEnabled = features.fee_tracking !== false;

  return (
    <div className="space-y-4 md:space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">{t("Welcome back")}</h1>
        <p className="text-sm text-muted-foreground">
          {tenant.name} · {t("at a glance")} · {monthLabel}
        </p>
      </header>

      {newRegs > 0 ? (
        <Link
          to="/dashboard/registrations"
          className="flex items-center gap-3 h-12 px-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-sm font-semibold text-rose-600 hover:bg-rose-500/15 transition-colors"
        >
          <Inbox className="size-4 shrink-0" />
          <span className="flex-1 truncate">
            {newRegs} {newRegs === 1 ? t("new registration") : t("new registrations")}
          </span>
          <ArrowRight className="size-4 shrink-0" />
        </Link>
      ) : null}

      <InAcademyLiveStrip tenantId={tenant.id} />

      {/* Compact KPI hero — 2×2 on mobile, 4-across on desktop, all in one card */}
      <Card className="p-0 overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-border">
          <KpiCell
            to="/dashboard/students"
            search={{ status: "active" }}
            icon={<Users className="size-4" />}
            label={t("Active students")}
            value={kpisQ.isLoading ? null : String(active)}
            hint={n.students.toLowerCase()}
          />
          {feeEnabled ? (
            <KpiCell
              to="/dashboard/fees"
              search={{ filter: "paid" }}
              icon={<IndianRupee className="size-4" />}
              label={t("Collected")}
              value={kpisQ.isLoading && pendingListQ.isLoading ? null : money(collectedMonth)}
              hint={`${paidCount} ${t("paid")}`}
              tone="emerald"
            />
          ) : null}
          {feeEnabled ? (
            <KpiCell
              to="/dashboard/fees"
              search={{ filter: "pending" }}
              icon={<AlertCircle className="size-4" />}
              label={t("Pending")}
              value={pendingListQ.isLoading ? null : String(pendingCount)}
              hint={t("pending")}
              tone="rose"
              emphasize={pendingCount > 0}
            />
          ) : null}
          <KpiCell
            to="/dashboard/registrations"
            icon={<Inbox className="size-4" />}
            label={t("New")}
            value={kpisQ.isLoading ? null : String(newRegs)}
            hint={t("This week")}
          />
        </div>
      </Card>

      {/* Insights row: revenue trend, today's attendance, upcoming birthdays */}
      <div className="grid gap-4 md:grid-cols-3">
        <RevenueCard insightsQ={insightsQ} t={t} />
        <AttendanceCard insightsQ={insightsQ} t={t} />
        <BirthdaysCard insightsQ={insightsQ} t={t} tenantId={tenant.id} />
      </div>


      {/* Student-focused progress — compact strip */}
      {feeEnabled && totalMonthly > 0 ? (
        <Card className="p-4 md:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">
                {monthLabel}
              </div>
              <div className="mt-0.5 text-base md:text-lg font-bold">
                <span className="tabular-nums">{paidCount}</span>{" "}
                <span className="text-muted-foreground font-normal">{t("of")}</span>{" "}
                <span className="tabular-nums">{totalMonthly}</span>{" "}
                <span className="text-muted-foreground font-normal">{t("students")} {t("paid")}</span>
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                {money(collectedMonth)} <span className="opacity-70">/ {money(expectedMonth)}</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-2xl font-bold tabular-nums" style={{ color: "var(--brand)" }}>
                {pct}%
              </div>
              {pendingCount > 0 ? (
                <Link
                  to="/dashboard/fees"
                  search={{ filter: "pending" }}
                  className="text-[11px] font-semibold text-rose-500 hover:underline"
                >
                  {pendingCount} {t("pending")} →
                </Link>
              ) : (
                <div className="text-[11px] font-semibold text-emerald-500 inline-flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> {t("All caught up")}
                </div>
              )}
            </div>
          </div>
          <div className="mt-3 h-1.5 w-full rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${totalMonthly > 0 ? Math.round((paidCount / totalMonthly) * 100) : 0}%`,
                backgroundColor: "var(--brand)",
              }}
            />
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
                      <PersonAvatar name={row.name} src={row.photoUrl} className="size-10 text-sm" />
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

function KpiCell({
  to,
  search,
  icon,
  label,
  value,
  hint,
  tone = "brand",
  emphasize,
}: {
  to: "/dashboard/students" | "/dashboard/fees" | "/dashboard/registrations";
  search?: Record<string, string>;
  icon: React.ReactNode;
  label: string;
  value: string | null;
  hint?: string;
  tone?: "brand" | "emerald" | "rose";
  emphasize?: boolean;
}) {
  const toneColor =
    tone === "emerald" ? "#10b981" : tone === "rose" ? "#f43f5e" : "var(--brand)";
  return (
    <Link
      to={to}
      search={search as never}
      className="group block p-3 md:p-4 hover:bg-accent/60 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span
          className="grid size-6 md:size-7 place-items-center rounded-md"
          style={{
            backgroundColor: `color-mix(in oklab, ${toneColor} 18%, transparent)`,
            color: toneColor,
          }}
        >
          {icon}
        </span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold truncate">
          {label}
        </span>
      </div>
      <div
        className="mt-2 text-2xl md:text-3xl font-bold tabular-nums leading-none"
        style={emphasize ? { color: toneColor } : undefined}
      >
        {value === null ? <Skeleton className="h-7 w-16" /> : value}
      </div>
      {hint ? (
        <div className="mt-1 text-[10px] text-muted-foreground truncate">{hint}</div>
      ) : null}
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

// -----------------------------------------------------------------------------
// Insight cards
// -----------------------------------------------------------------------------

type InsightsQ = ReturnType<typeof useQuery<Awaited<ReturnType<typeof fetchDashboardInsights>>>>;

function RevenueCard({ insightsQ, t }: { insightsQ: InsightsQ; t: (s: string) => string }) {
  const data = insightsQ.data;
  const points = data?.revenue ?? [];
  const max = Math.max(1, ...points.map((p) => p.amount));
  const total = data?.revenueTotal ?? 0;
  const lastLabel = points.at(-1)?.label ?? "";

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            <TrendingUp className="size-3" /> {t("Revenue")} · 6M
          </div>
          <div className="mt-1 text-2xl font-bold tabular-nums">
            {insightsQ.isLoading ? <Skeleton className="h-7 w-24" /> : money(total)}
          </div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {t("Last 6 months")}
          </div>
        </div>
      </div>
      <div className="mt-4 flex h-16 items-end gap-1.5">
        {(insightsQ.isLoading ? Array.from({ length: 6 }, (_, i) => ({ amount: 0, label: "", month: String(i) })) : points).map((p, i) => {
          const h = insightsQ.isLoading ? 40 : (p.amount / max) * 100;
          const isLast = i === (points.length - 1);
          return (
            <div key={p.month + i} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-md transition-all"
                style={{
                  height: `${Math.max(4, h)}%`,
                  backgroundColor: isLast ? "var(--brand)" : "color-mix(in oklab, var(--brand) 30%, transparent)",
                }}
              />
              <div className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">
                {p.label.slice(0, 3)}
              </div>
            </div>
          );
        })}
      </div>
      {!insightsQ.isLoading && lastLabel ? (
        <div className="mt-2 text-[11px] text-muted-foreground tabular-nums">
          {lastLabel}: {money(points.at(-1)?.amount ?? 0)}
        </div>
      ) : null}
    </Card>
  );
}

function AttendanceCard({ insightsQ, t }: { insightsQ: InsightsQ; t: (s: string) => string }) {
  const a = insightsQ.data?.attendanceToday;
  const percent = a?.percent ?? 0;
  const tone = percent >= 80 ? "#10b981" : percent >= 60 ? "#f59e0b" : "#f43f5e";

  return (
    <Link
      to="/dashboard/attendance"
      className="block rounded-xl border bg-card p-4 md:p-5 transition-colors hover:bg-accent/40"
    >
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
        <ClipboardCheck className="size-3" /> {t("Today's attendance")}
      </div>
      {insightsQ.isLoading ? (
        <div className="mt-3"><Skeleton className="h-16 w-full" /></div>
      ) : a && a.sessions === 0 ? (
        <div className="mt-4 text-sm text-muted-foreground">
          {t("No sessions today")}
        </div>
      ) : a && a.total === 0 ? (
        <div className="mt-4 text-sm text-muted-foreground">
          {t("Not marked yet")}
        </div>
      ) : (
        <>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums" style={{ color: tone }}>
              {percent}%
            </span>
            <span className="text-xs text-muted-foreground">
              {a?.present}/{a?.total} {t("present")}
            </span>
          </div>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${percent}%`, backgroundColor: tone }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{a?.sessions} {t("sessions")}</span>
            <span className="inline-flex items-center gap-1 font-medium" style={{ color: "var(--brand)" }}>
              {t("Open")} <ArrowRight className="size-3" />
            </span>
          </div>
        </>
      )}
    </Link>
  );
}

function BirthdaysCard({
  insightsQ,
  t,
  tenantId: _tenantId,
}: {
  insightsQ: InsightsQ;
  t: (s: string) => string;
  tenantId: string;
}) {
  const list = insightsQ.data?.birthdays ?? [];

  return (
    <Card className="p-4 md:p-5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
        <Cake className="size-3" /> {t("Birthdays this week")}
      </div>
      {insightsQ.isLoading ? (
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
        </div>
      ) : list.length === 0 ? (
        <div className="mt-4 text-sm text-muted-foreground">
          {t("No birthdays coming up")}
        </div>
      ) : (
        <ul className="mt-3 space-y-2">
          {list.slice(0, 4).map((b) => (
            <li key={b.id} className="flex items-center gap-2.5">
              <PersonAvatar name={b.name} src={b.photoUrl} className="size-8 text-xs shrink-0" />
              <Link
                to="/dashboard/students/$id"
                params={{ id: b.id }}
                className="flex-1 min-w-0 hover:opacity-80"
              >
                <div className="text-sm font-semibold truncate">{b.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {b.daysAway === 0 ? (
                    <span className="font-semibold text-pink-500">🎂 {t("Today")} · {b.age}</span>
                  ) : b.daysAway === 1 ? (
                    <span>{t("Tomorrow")} · {b.age}</span>
                  ) : (
                    <span>{t("In")} {b.daysAway} {t("days")} · {b.age}</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

