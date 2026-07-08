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
  Inbox,
  Phone,
  MessageCircle,
  PartyPopper,
  BellRing,
  ClipboardCheck,
  Clock,
  TrendingUp,
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
  const { t } = useT();
  const n = niche(tenant.niche);
  const features = getFeatures(tenant);
  const kpisQ = useQuery({
    queryKey: qk.kpis(tenant.id),
    queryFn: () => fetchKpis(tenant),
  });

  const cycle = tenantFeeCycle(tenant);
  const now = new Date();
  const monthLabel = format(now, "MMMM yyyy");
  const todayISO = format(now, "yyyy-MM-dd");

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

  // Attendance today
  const attendanceQ = useQuery({
    queryKey: ["d", "att-today", tenant.id, todayISO],
    queryFn: async () => {
      const [presentRes, activeRes] = await Promise.all([
        supabase
          .from("attendance" as never)
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .eq("date", todayISO)
          .eq("status", "present"),
        supabase
          .from("students")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .eq("status", "active"),
      ]);
      return { present: presentRes.count ?? 0, total: activeRes.count ?? 0 };
    },
  });

  // Next session (upcoming batch today)
  const nextSessionQ = useQuery({
    queryKey: ["d", "next-session", tenant.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("batches")
        .select("name, timing")
        .eq("tenant_id", tenant.id)
        .order("timing");
      const list = (data ?? []).filter((b) => b.timing);
      return list[0] ?? null;
    },
  });

  const kpis = kpisQ.data;
  const active = kpis?.activeStudents ?? 0;
  const collectedMonth = pendingListQ.data?.collected ?? kpis?.collectionThisMonth ?? 0;
  const pendingCount = kpis?.pendingFeeCount ?? pendingListQ.data?.pendingRows.length ?? 0;
  const newLeads = kpis?.newRegsThisWeek ?? 0;
  const empty = !kpisQ.isLoading && active === 0 && newLeads === 0;
  const allPaid = !pendingListQ.isLoading && (pendingListQ.data?.totalStudents ?? 0) > 0 && pendingCount === 0;
  const feeEnabled = features.fee_tracking !== false;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header>
        <h1 className="text-3xl md:text-4xl font-black tracking-tight">
          {t("Welcome back")} <span className="inline-block">👋</span>
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {tenant.name} · {t("here's your month at a glance")} · {monthLabel}
        </p>
      </header>

      {/* HERO CARD — This month */}
      {feeEnabled ? (
        <div className="relative overflow-hidden rounded-3xl p-6 md:p-8 shadow-lg bg-primary text-primary-foreground">
          {/* Decorative grid dots */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: "radial-gradient(currentColor 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          <div className="relative">
            <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] opacity-80">
              <TrendingUp className="size-3.5" />
              {t("This month")}
            </div>

            <div className="mt-2 flex items-baseline gap-2 flex-wrap">
              <div className="text-5xl md:text-6xl font-black tabular-nums leading-none">
                {kpisQ.isLoading && pendingListQ.isLoading ? "…" : money(collectedMonth)}
              </div>
              <div className="text-sm md:text-base opacity-80 font-medium">{t("Collected").toLowerCase()}</div>
            </div>

            {/* Two inline stat pills */}
            <div className="mt-6 grid grid-cols-2 gap-3 max-w-md">
              <HeroStat
                label={t("Pending")}
                value={pendingListQ.isLoading ? "…" : String(pendingCount)}
                sub={pendingCount === 1 ? t("student") : t("students")}
              />
              <HeroStat
                label={t("Active")}
                value={kpisQ.isLoading ? "…" : String(active)}
                sub={t("students")}
              />
            </div>

            {/* CTAs */}
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link
                to="/dashboard/fees"
                className="inline-flex items-center gap-1.5 rounded-full bg-background text-foreground px-5 py-2.5 text-sm font-bold shadow-sm hover:opacity-90 transition-opacity"
              >
                <IndianRupee className="size-4" /> {t("Manage fees")} <ArrowRight className="size-4" />
              </Link>
              <Link
                to="/dashboard/reminders"
                className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground/10 border border-primary-foreground/20 text-primary-foreground px-5 py-2.5 text-sm font-bold hover:bg-primary-foreground/15 transition-colors"
              >
                <BellRing className="size-4" /> {t("Send reminders")}
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* Follow-up list */}
      {feeEnabled ? (
        <Card className="overflow-hidden p-0 border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 md:px-5 py-3.5">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] font-bold text-muted-foreground">
                {t("Pending")}
              </div>
              <div className="mt-0.5 text-base font-bold">
                {pendingCount} {pendingCount === 1 ? t("student") : t("students")} {t("Students to follow up").toLowerCase()}
              </div>
            </div>
            <Link
              to="/dashboard/fees"
              search={{ filter: "pending" }}
              className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            >
              {t("Open register")} <ArrowRight className="size-3" />
            </Link>
          </div>

          {pendingListQ.isLoading ? (
            <div className="p-4 space-y-3">
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : allPaid ? (
            <div className="px-5 py-10 text-center">
              <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/15">
                <PartyPopper className="size-6 text-primary" />
              </div>
              <div className="mt-3 text-base font-bold">
                {t("All fees collected for")} {monthLabel} 🎉
              </div>
              <div className="text-xs text-muted-foreground mt-1">{t("All caught up")}</div>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {(pendingListQ.data?.pendingRows ?? []).slice(0, 6).map((row, idx) => {
                const overdue = row.due.state === "pending" ? row.due.overdueDays : 0;
                const phone = normalizePhone(row.phone);
                return (
                  <li key={row.id} className="flex items-center gap-3 px-3 md:px-5 py-3">
                    <div className="text-xs font-bold text-muted-foreground tabular-nums w-6 text-center shrink-0">
                      {idx + 1}
                    </div>
                    <Link
                      to="/dashboard/students/$id"
                      params={{ id: row.id }}
                      className="flex items-center gap-3 min-w-0 flex-1 hover:opacity-80"
                    >
                      <PersonAvatar name={row.name} src={row.photoUrl} className="size-10 text-sm shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold truncate">{row.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {money(row.effectiveFee)} ·{" "}
                          <span className={overdue > 0 ? "text-destructive font-semibold" : ""}>
                            {overdue > 0 ? `${overdue} ${t("days overdue")}` : t("due")}
                          </span>
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
                          <Phone className="size-4 text-primary" />
                        </a>
                      ) : null}
                      {phone ? (
                        <a
                          href={`https://wa.me/${waFormat(phone)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-grid place-items-center size-9 rounded-full bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                          aria-label={t("WhatsApp")}
                          title={t("WhatsApp")}
                        >
                          <MessageCircle className="size-4" />
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

      {/* Three secondary tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SecondaryTile
          to="/dashboard/attendance"
          icon={<ClipboardCheck className="size-4" />}
          label={t("Attendance today")}
          value={attendanceQ.isLoading ? "…" : `${attendanceQ.data?.present ?? 0}`}
          sub={`/ ${attendanceQ.data?.total ?? 0}`}
        />
        <SecondaryTile
          to="/dashboard/leads"
          icon={<Inbox className="size-4" />}
          label={t("New leads")}
          value={String(newLeads)}
          sub={t("This week")}
        />
        <SecondaryTile
          to="/dashboard/batches"
          icon={<Clock className="size-4" />}
          label={t("Next session")}
          value={nextSessionQ.data?.timing ?? "—"}
          sub={nextSessionQ.data?.name ?? t("No sessions")}
        />
      </div>

      {empty ? (
        <Card className="p-8 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-primary/15">
            <Users className="size-6 text-primary" />
          </div>
          <h2 className="mt-4 text-lg font-bold">{t("No students yet")}</h2>
          <Link
            to="/dashboard/students"
            className="mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold bg-primary text-primary-foreground shadow-sm hover:opacity-90"
          >
            <Plus className="size-4" /> {t("Add your first student")} · {n.students.toLowerCase()}
          </Link>
        </Card>
      ) : null}
    </div>
  );
}

function HeroStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl bg-primary-foreground/10 border border-primary-foreground/15 px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.14em] font-bold opacity-80">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <div className="text-3xl font-black tabular-nums leading-none">{value}</div>
        <div className="text-xs opacity-75 font-medium">{sub}</div>
      </div>
    </div>
  );
}

function SecondaryTile({
  to,
  icon,
  label,
  value,
  sub,
}: {
  to: "/dashboard/attendance" | "/dashboard/leads" | "/dashboard/batches";
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Link
      to={to}
      className="group block rounded-2xl border border-border bg-card p-4 md:p-5 hover:border-primary/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <span className="grid size-7 place-items-center rounded-lg bg-primary/15 text-primary">{icon}</span>
        <span className="text-[10px] uppercase tracking-[0.14em] font-bold">{label}</span>
      </div>
      <div className="mt-3 flex items-baseline gap-1.5">
        <div className="text-2xl md:text-3xl font-black tabular-nums leading-none">{value}</div>
        <div className="text-xs text-muted-foreground font-medium truncate">{sub}</div>
      </div>
    </Link>
  );
}

function normalizePhone(raw: string): string {
  return (raw || "").replace(/[^\d+]/g, "");
}

function waFormat(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 10) return `91${digits}`;
  return digits;
}
