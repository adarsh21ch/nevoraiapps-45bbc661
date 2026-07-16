import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDashboard } from "@/lib/dashboard-context";
import {
  fetchBatches,
  fetchFeePlans,
  fetchPaymentsForPeriods,
  fetchStudents,
  qk,
} from "@/lib/dashboard-queries";
import { supabase } from "@/integrations/supabase/client";
import { uploadTenantFile } from "@/lib/storage";
import { candidatePeriods, periodKey, tenantFeeCycle } from "@/lib/fees";
import {
  PLAYER_STATUSES,
  PLAYING_ROLES,
  BATTING_STYLES,
  BOWLING_STYLES,
  BLOOD_GROUPS,
  AGE_GROUPS,
  ageFromDob,
  inAgeGroup,
  exportStudents,
  setStudentStatus,
  type PlayerStatus,
} from "@/lib/students-manage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  Camera,
  ChevronRight,
  Inbox,
  X,
  Download,
  SlidersHorizontal,
  ArchiveRestore,
  Archive,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BulkImportStudents } from "@/components/dashboard/BulkImportStudents";
import { PersonAvatar } from "@/components/site/PersonAvatar";
import { StudentProfilePanel } from "@/components/dashboard/StudentProfilePanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { VirtualList } from "@/components/ds/VirtualList";
import { usePermissions } from "@/hooks/use-permissions";
import { fetchMyBatches, type MyBatch } from "@/lib/coach/queries";
import { FilterTabs } from "@/components/shared/FilterTabs";

export const Route = createFileRoute("/dashboard/students")({
  validateSearch: (search: Record<string, unknown>): { status?: string } => {
    const s = search.status;
    if (typeof s === "string") return { status: s };
    return {};
  },
  component: StudentsPage,
});

// Primary status tabs — only the two states operators actually manage day-to-day.
// Everything else (trial, paused, suspended, graduated, transferred) is still
// stored in the DB and reachable through Advanced Filters below.
const PRIMARY_STATUS_TABS: { key: string; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "left", label: "Left" },
  { key: "all", label: "All" },
];
const ADVANCED_STATUSES: PlayerStatus[] = [
  "trial",
  "paused",
  "suspended",
  "graduated",
  "transferred",
];

function StudentsPage() {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const cycle = tenantFeeCycle(tenant);

  const initialStatus = Route.useSearch().status ?? "active";

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>(initialStatus);
  const [batch, setBatch] = useState<string>("all");
  const [gender, setGender] = useState<string>("all");
  const [role, setRole] = useState<string>("all");
  const [ageGroup, setAgeGroup] = useState<string>("all");
  const [joinYear, setJoinYear] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  // Coach "My batches only" toggle. Owners/admins default OFF; coaches default ON.
  const perms = usePermissions();
  const isAnyCoach = perms.isCoach || perms.isHeadCoach || perms.isAssistantCoach;
  const [myBatchesOnly, setMyBatchesOnly] = useState<boolean>(isAnyCoach);
  const myBatchesQ = useQuery({
    enabled: isAnyCoach,
    queryKey: ["coach", "my-batches", tenant.id],
    queryFn: fetchMyBatches,
    staleTime: 60_000,
  });
  const myBatchIds = useMemo(
    () => new Set(((myBatchesQ.data ?? []) as MyBatch[]).map((b) => b.batch_id)),
    [myBatchesQ.data],
  );

  const students = useQuery({
    queryKey: qk.students(tenant.id),
    queryFn: () => fetchStudents(tenant.id),
  });
  const batches = useQuery({
    queryKey: qk.batches(tenant.id),
    queryFn: () => fetchBatches(tenant.id),
  });


  const pendingRegs = useQuery({
    queryKey: ["d", "regs-plus-leads-count", tenant.id],
    queryFn: async () => {
      const [regs, leads] = await Promise.all([
        supabase
          .from("registrations")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .eq("status", "new"),
        supabase
          .from("leads" as never)
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenant.id)
          .eq("status", "new"),
      ]);
      return (regs.count ?? 0) + (leads.count ?? 0);
    },
    refetchInterval: 30_000,
  });

  const dismissKey = `regs-banner-ack:${tenant.id}`;
  const [ackCount, setAckCount] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(dismissKey);
    const n = raw ? Number(raw) : 0;
    setAckCount(Number.isFinite(n) ? n : 0);
  }, [dismissKey]);
  const pendingCount = pendingRegs.data ?? 0;
  const showRegsBanner = pendingCount > ackCount;
  const ackBanner = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(dismissKey, String(pendingCount));
    }
    setAckCount(pendingCount);
  };

  const today = new Date();
  const periods = cycle === "joining_date" ? candidatePeriods(today) : [periodKey(today)];
  const monthPays = useQuery({
    queryKey: qk.feeRegister(tenant.id, periods.join(",")),
    queryFn: () => fetchPaymentsForPeriods(tenant.id, periods),
  });

  const paidSet = useMemo(() => {
    const set = new Set<string>();
    for (const p of monthPays.data ?? []) {
      if (p.student_id) set.add(p.student_id);
    }
    return set;
  }, [monthPays.data]);

  const batchNameById = useMemo(
    () => new Map<string, string>((batches.data ?? []).map((b: any) => [b.id, b.name])),
    [batches.data],
  );

  const joinYears = useMemo(() => {
    const set = new Set<string>();
    for (const s of (students.data ?? []) as any[]) {
      const y = s.joined_at ? String(s.joined_at).slice(0, 4) : null;
      if (y) set.add(y);
    }
    return Array.from(set).sort().reverse();
  }, [students.data]);

  const filtered = useMemo(() => {
    const list = (students.data ?? []) as any[];
    return list.filter((s) => {
      if (status !== "all" && s.status !== status) return false;
      if (batch !== "all" && s.batch_id !== batch) return false;
      if (isAnyCoach && myBatchesOnly && !myBatchIds.has(s.batch_id ?? "")) return false;
      if (gender !== "all" && (s.gender ?? "").toLowerCase() !== gender) return false;
      if (role !== "all" && (s.playing_role ?? "") !== role) return false;
      if (ageGroup !== "all" && !inAgeGroup(ageFromDob(s.dob), ageGroup)) return false;
      if (joinYear !== "all" && !(s.joined_at ?? "").startsWith(joinYear)) return false;
      if (q) {
        const needle = q.toLowerCase();
        const hay = [
          s.name,
          s.phone,
          s.player_id,
          s.email,
          s.guardian_name,
          s.guardian_phone,
          s.city,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [students.data, q, status, batch, gender, role, ageGroup, joinYear, isAnyCoach, myBatchesOnly, myBatchIds]);

  const counts = useMemo(() => {
    const list = (students.data ?? []) as any[];
    const by: Record<string, number> = { all: list.length };
    for (const meta of PLAYER_STATUSES) by[meta.value] = 0;
    for (const s of list) {
      const key = s.status as string;
      if (key in by) by[key]++;
    }
    return by;
  }, [students.data]);

  const activeFilterCount =
    (batch !== "all" ? 1 : 0) +
    (gender !== "all" ? 1 : 0) +
    (role !== "all" ? 1 : 0) +
    (ageGroup !== "all" ? 1 : 0) +
    (joinYear !== "all" ? 1 : 0);

  const doExport = (fmt: "csv" | "xlsx") => {
    try {
      exportStudents(filtered, batchNameById, fmt);
      toast.success(`Exported ${filtered.length} players`);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 sm:items-end sm:gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight leading-tight">Players</h1>
          <p className="text-[12.5px] sm:text-sm text-muted-foreground mt-0.5 truncate">
            {counts.all} total · {counts.active} active
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full h-9">
                <Download className="size-4 sm:mr-1.5" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs">
                {filtered.length} rows · current filters
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => doExport("csv")}>CSV (.csv)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => doExport("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <BulkImportStudents />
          <Button
            onClick={() => setAddOpen(true)}
            className="rounded-full h-9 sm:h-10 px-3 sm:px-5 font-semibold"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
          >
            <Plus className="size-4 sm:mr-1" /> <span className="hidden sm:inline">Add</span>
          </Button>
        </div>
      </header>

      {showRegsBanner ? (
        <div className="group flex items-center gap-3 rounded-2xl border border-rose-500/30 bg-rose-500/5 px-4 py-3">
          <Link
            to="/dashboard/registrations"
            onClick={ackBanner}
            className="flex items-center gap-3 min-w-0 flex-1"
          >
            <span className="grid place-items-center size-9 rounded-full bg-rose-600 text-white shrink-0">
              <Inbox className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground">
                {pendingCount} pending registration{pendingCount === 1 ? "" : "s"}
              </div>
              <div className="text-xs text-muted-foreground">
                New admission requests waiting for review
              </div>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" />
          </Link>
          <button
            type="button"
            onClick={ackBanner}
            aria-label="Dismiss"
            className="grid place-items-center size-8 rounded-full text-muted-foreground hover:bg-rose-500/10 hover:text-foreground shrink-0"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {/* Primary status tabs — All / Active / Left. Advanced statuses live inside the Filters panel. */}
      <FilterTabs
        value={PRIMARY_STATUS_TABS.some((t) => t.key === status) ? status : "all"}
        onChange={(k: string) => setStatus(k)}
        items={PRIMARY_STATUS_TABS.map((t) => ({
          key: t.key,
          label: t.label,
          count:
            t.key === "all"
              ? counts.all
              : t.key === "left"
                ? counts.left ?? 0
                : counts[t.key] ?? 0,
        }))}
        ariaLabel="Student status"
      />

      {/* Search + filters toggle */}
      <div className="flex items-center gap-2">
        <DashboardSearch
          value={q}
          onChange={setQ}
          placeholder="Search name, phone, Player ID, parent, city"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowFilters((v) => !v)}
          className={cn(
            "shrink-0 h-11 rounded-full",
            activeFilterCount > 0 && "border-foreground/30",
          )}
        >
          <SlidersHorizontal className="size-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <span className="ml-1.5 grid place-items-center size-5 rounded-full bg-foreground text-background text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
        </Button>
      </div>

      {isAnyCoach && (
        <div className="flex items-center justify-between rounded-full bg-card border border-border px-3 py-1.5 shadow-sm">
          <span className="text-xs text-muted-foreground">
            {myBatchesOnly
              ? `Showing only your ${myBatchIds.size} assigned ${myBatchIds.size === 1 ? "batch" : "batches"}`
              : "Showing all students in the academy"}
          </span>
          <label className="inline-flex items-center gap-2 text-xs font-medium cursor-pointer">
            My batches only
            <input
              type="checkbox"
              className="size-4 accent-foreground"
              checked={myBatchesOnly}
              onChange={(e) => setMyBatchesOnly(e.target.checked)}
            />
          </label>
        </div>
      )}


      {showFilters && (
        <div className="rounded-2xl bg-card border border-border shadow-sm p-3 grid grid-cols-2 md:grid-cols-3 gap-2">
          <FilterSelect
            label="Batch"
            value={batch}
            onChange={setBatch}
            options={[
              { value: "all", label: "All batches" },
              ...(batches.data ?? []).map((b: any) => ({ value: b.id, label: b.name })),
            ]}
          />
          <FilterSelect
            label="Gender"
            value={gender}
            onChange={setGender}
            options={[
              { value: "all", label: "All genders" },
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
              { value: "other", label: "Other" },
            ]}
          />
          <FilterSelect
            label="Playing role"
            value={role}
            onChange={setRole}
            options={[
              { value: "all", label: "All roles" },
              ...PLAYING_ROLES.map((r) => ({ value: r, label: r })),
            ]}
          />
          <FilterSelect
            label="Age group"
            value={ageGroup}
            onChange={setAgeGroup}
            options={[
              { value: "all", label: "All ages" },
              ...AGE_GROUPS.map((g) => ({ value: g.key, label: g.label })),
            ]}
          />
          <FilterSelect
            label="Joining year"
            value={joinYear}
            onChange={setJoinYear}
            options={[
              { value: "all", label: "All years" },
              ...joinYears.map((y) => ({ value: y, label: y })),
            ]}
          />
          <FilterSelect
            label="Advanced status"
            value={ADVANCED_STATUSES.includes(status as PlayerStatus) ? status : "all"}
            onChange={(v) => setStatus(v === "all" ? "active" : v)}
            options={[
              { value: "all", label: "None" },
              ...ADVANCED_STATUSES.map((k) => ({
                value: k,
                label: PLAYER_STATUSES.find((p) => p.value === k)?.label ?? k,
              })),
            ]}
          />
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setBatch("all");
                setGender("all");
                setRole("all");
                setAgeGroup("all");
                setJoinYear("all");
              }}
              className="text-xs font-medium text-muted-foreground hover:text-foreground self-end pb-2"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* List */}
      <section className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden">
        {students.isLoading ? (
          <ul className="divide-y divide-border">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="p-4 flex items-center gap-3">
                <div className="h-11 w-11 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-24 rounded bg-muted animate-pulse" />
                </div>
              </li>
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-sm font-semibold text-foreground">
              {q.trim()
                ? "No players match your search."
                : status === "active"
                  ? "No active players found."
                  : status === "left"
                    ? "No players have left the academy."
                    : "No players yet."}
            </div>
            {!q.trim() && (status === "active" || status === "all") ? (
              <div className="mt-3">
                <Button
                  onClick={() => setAddOpen(true)}
                  className="rounded-full h-9 px-4 font-semibold text-sm"
                  style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
                >
                  <Plus className="size-4 mr-1" />
                  Add Player
                </Button>
              </div>
            ) : null}
          </div>
        ) : (
          <VirtualList
            items={filtered}
            estimateSize={84}
            overscan={10}
            className="max-h-[calc(100vh-320px)] min-h-[400px]"
            getKey={(s: any) => s.id}
            renderItem={(s: any, i: number) => (
              <div className="border-b border-border last:border-b-0">
                <PlayerRow
                  index={i}
                  s={s}
                  paid={paidSet.has(s.id)}
                  onOpen={() => {
                    qc.setQueryData(qk.student(s.id), s);
                    setProfileId(s.id);
                  }}
                  onArchiveDone={() => {
                    qc.invalidateQueries({ queryKey: qk.students(tenant.id) });
                  }}
                />
              </div>
            )}
          />
        )}
      </section>

      <AddStudentSheet open={addOpen} onOpenChange={setAddOpen} />
      <ProfileSheet id={profileId} onOpenChange={(open) => !open && setProfileId(null)} />
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 h-9 px-3 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
        active
          ? "bg-foreground text-background shadow-sm"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
      )}
    >
      {label}
      <span
        className={cn(
          "ml-1 text-xs tabular-nums",
          active ? "opacity-70" : "text-muted-foreground/70",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 rounded-xl bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function PlayerRow({
  index,
  s,
  paid,
  onOpen,
  onArchiveDone,
}: {
  index: number;
  s: any;
  paid: boolean;
  onOpen: () => void;
  onArchiveDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const meta = PLAYER_STATUSES.find((m) => m.value === s.status);
  const isActive = s.status === "active";
  const isArchived = s.status === "left";

  const doStatus = async (next: PlayerStatus) => {
    setBusy(true);
    try {
      await setStudentStatus(s.id, next);
      toast.success(next === "active" ? "Player reactivated" : `Status → ${next}`);
      onArchiveDone();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-2 md:gap-3 pr-2">
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 flex items-center gap-3 md:gap-4 p-4 md:px-5 hover:bg-accent/60 transition-colors text-left"
      >
        <div className="hidden md:flex w-6 text-xs text-muted-foreground tabular-nums justify-center">
          {index + 1}
        </div>
        <PersonAvatar name={s.name} src={s.photo_url} className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-[15px] truncate text-foreground">{s.name}</span>
            {s.player_id && (
              <span className="text-[10px] font-bold tracking-wider text-muted-foreground">
                {s.player_id}
              </span>
            )}
          </div>
          {(s.playing_role || s.phone) && (
            <div className="text-[11.5px] text-muted-foreground truncate mt-0.5">
              {[s.playing_role, s.phone].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
        {isActive ? (
          <StatusPill paid={paid} />
        ) : (
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide",
              "bg-muted text-muted-foreground",
            )}
          >
            {meta?.label ?? s.status}
          </span>
        )}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="grid place-items-center size-9 rounded-full text-muted-foreground hover:bg-accent shrink-0"
            aria-label="Player actions"
            disabled={busy}
          >
            <ChevronRight className="size-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onOpen}>Open profile</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
            Change status
          </DropdownMenuLabel>
          {PLAYER_STATUSES.filter((m) => m.value !== s.status).map((m) => (
            <DropdownMenuItem key={m.value} onClick={() => doStatus(m.value)}>
              {m.value === "left" ? (
                <Archive className="size-3.5 mr-2" />
              ) : m.value === "active" && isArchived ? (
                <ArchiveRestore className="size-3.5 mr-2" />
              ) : null}
              {m.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function StatusPill({ paid }: { paid: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        paid ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700",
      )}
    >
      <span
        className={cn("w-1.5 h-1.5 rounded-full mr-1.5", paid ? "bg-emerald-500" : "bg-rose-500")}
      />
      {paid ? "Paid" : "Due"}
    </span>
  );
}

/* ---------- Profile sheet ---------- */

function ProfileSheet({
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
              <SheetTitle className="text-left sr-only">Player profile</SheetTitle>
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
          <DialogTitle className="sr-only">Player profile</DialogTitle>
        </DialogHeader>
        {id && <StudentProfilePanel studentId={id} />}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Add player ---------- */

function AddStudentSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const isMobile = useIsMobile();
  const inner = <AddStudentForm onDone={() => onOpenChange(false)} />;
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
              <SheetTitle className="text-left">Add player</SheetTitle>
            </SheetHeader>
            {inner}
          </div>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add player</DialogTitle>
        </DialogHeader>
        {inner}
      </DialogContent>
    </Dialog>
  );
}

function AddStudentForm({ onDone }: { onDone: () => void }) {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const batches = useQuery({
    queryKey: qk.batches(tenant.id),
    queryFn: () => fetchBatches(tenant.id),
  });
  const feePlans = useQuery({
    queryKey: qk.feePlans(tenant.id),
    queryFn: () => fetchFeePlans(tenant.id),
  });

  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [section, setSection] = useState<"basic" | "cricket" | "contact" | "medical">("basic");
  const [f, setF] = useState({
    name: "",
    phone: "",
    email: "",
    dob: "",
    gender: "",
    playing_role: "",
    batting_style: "",
    bowling_style: "",
    bowling_arm: "",
    guardian_name: "",
    guardian_phone: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    address: "",
    city: "",
    state: "",
    pincode: "",
    school_college: "",
    blood_group: "",
    medical_notes: "",
    batch_id: "",
    fee_plan_id: "",
    coach_name: "",
    joined_at: new Date().toISOString().slice(0, 10),
  });

  const save = useMutation({
    mutationFn: async () => {
      let photo_url: string | null = null;
      if (photoFile) {
        photo_url = await uploadTenantFile(tenant.id, "students", photoFile);
      }
      const payload = {
        tenant_id: tenant.id,
        name: f.name,
        phone: f.phone,
        email: f.email || null,
        guardian_name: f.guardian_name || null,
        guardian_phone: f.guardian_phone || null,
        emergency_contact_name: f.emergency_contact_name || null,
        emergency_contact_phone: f.emergency_contact_phone || null,
        dob: f.dob || null,
        gender: f.gender || null,
        playing_role: f.playing_role || null,
        batting_style: f.batting_style || null,
        bowling_style: f.bowling_style || null,
        bowling_arm: f.bowling_arm || null,
        address: f.address || null,
        city: f.city || null,
        state: f.state || null,
        pincode: f.pincode || null,
        school_college: f.school_college || null,
        blood_group: f.blood_group || null,
        medical_notes: f.medical_notes || null,
        batch_id: f.batch_id || null,
        fee_plan_id: f.fee_plan_id || null,
        coach_name: f.coach_name || null,
        joined_at: f.joined_at,
        photo_url,
        status: "active",
      };
      const { data, error } = await (supabase.from("students") as any)
        .insert(payload)
        .select("id, player_id")
        .single();
      if (error) throw error;
      return data as { id: string; player_id: string };
    },
    onSuccess: (row) => {
      toast.success(`Added — Player ID ${row.player_id}`);
      qc.invalidateQueries({ queryKey: qk.students(tenant.id) });
      qc.invalidateQueries({ queryKey: qk.kpis(tenant.id) });
      onDone();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      className="space-y-4 pt-2"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <div className="flex justify-center">
        <label className="relative cursor-pointer group">
          <PersonAvatar
            name={f.name || "?"}
            src={photoPreview}
            className="h-20 w-20 ring-4 ring-white shadow-sm"
          />
          <span className="absolute inset-0 rounded-full flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs">
            <Camera className="size-4" />
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f2 = e.target.files?.[0];
              if (f2) {
                setPhotoFile(f2);
                setPhotoPreview(URL.createObjectURL(f2));
              }
            }}
          />
        </label>
      </div>

      {/* Section pills */}
      <div className="flex items-center gap-1 rounded-full bg-muted p-1 text-xs font-medium">
        {(
          [
            ["basic", "Basic"],
            ["cricket", "Cricket"],
            ["contact", "Contact"],
            ["medical", "Medical"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setSection(k)}
            className={cn(
              "flex-1 h-8 rounded-full transition-colors",
              section === k ? "bg-background shadow-sm" : "text-muted-foreground",
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {section === "basic" && (
        <>
          <FormField
            label="Full name"
            required
            value={f.name}
            onChange={(v) => setF({ ...f, name: v })}
          />
          <div className="grid grid-cols-2 gap-2">
            <FormField
              label="Mobile"
              required
              value={f.phone}
              onChange={(v) => setF({ ...f, phone: v })}
            />
            <FormField
              label="Email"
              type="email"
              value={f.email}
              onChange={(v) => setF({ ...f, email: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FormField
              label="Date of birth"
              type="date"
              value={f.dob}
              onChange={(v) => setF({ ...f, dob: v })}
            />
            <SelectField
              label="Gender"
              value={f.gender}
              onChange={(v) => setF({ ...f, gender: v })}
              options={[
                { value: "male", label: "Male" },
                { value: "female", label: "Female" },
                { value: "other", label: "Other" },
              ]}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>Batch</Label>
              <Select value={f.batch_id} onValueChange={(v) => setF({ ...f, batch_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {(batches.data ?? []).map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Fee plan</Label>
              <Select value={f.fee_plan_id} onValueChange={(v) => setF({ ...f, fee_plan_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {(feePlans.data ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · ₹{p.amount}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FormField
              label="Joining date"
              type="date"
              value={f.joined_at}
              onChange={(v) => setF({ ...f, joined_at: v })}
            />
            <FormField
              label="Coach"
              value={f.coach_name}
              onChange={(v) => setF({ ...f, coach_name: v })}
            />
          </div>
        </>
      )}

      {section === "cricket" && (
        <>
          <SelectField
            label="Playing role"
            value={f.playing_role}
            onChange={(v) => setF({ ...f, playing_role: v })}
            options={PLAYING_ROLES.map((r) => ({ value: r, label: r }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <SelectField
              label="Batting style"
              value={f.batting_style}
              onChange={(v) => setF({ ...f, batting_style: v })}
              options={BATTING_STYLES.map((r) => ({ value: r, label: r }))}
            />
            <SelectField
              label="Bowling arm"
              value={f.bowling_arm}
              onChange={(v) => setF({ ...f, bowling_arm: v })}
              options={[
                { value: "Right", label: "Right" },
                { value: "Left", label: "Left" },
              ]}
            />
          </div>
          <SelectField
            label="Bowling style"
            value={f.bowling_style}
            onChange={(v) => setF({ ...f, bowling_style: v })}
            options={BOWLING_STYLES.map((r) => ({ value: r, label: r }))}
          />
        </>
      )}

      {section === "contact" && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <FormField
              label="Parent name"
              value={f.guardian_name}
              onChange={(v) => setF({ ...f, guardian_name: v })}
            />
            <FormField
              label="Parent mobile"
              value={f.guardian_phone}
              onChange={(v) => setF({ ...f, guardian_phone: v })}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <FormField
              label="Emergency contact"
              value={f.emergency_contact_name}
              onChange={(v) => setF({ ...f, emergency_contact_name: v })}
            />
            <FormField
              label="Emergency phone"
              value={f.emergency_contact_phone}
              onChange={(v) => setF({ ...f, emergency_contact_phone: v })}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Address</Label>
            <Textarea
              rows={2}
              value={f.address}
              onChange={(e) => setF({ ...f, address: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <FormField label="City" value={f.city} onChange={(v) => setF({ ...f, city: v })} />
            <FormField label="State" value={f.state} onChange={(v) => setF({ ...f, state: v })} />
            <FormField
              label="Pincode"
              value={f.pincode}
              onChange={(v) => setF({ ...f, pincode: v })}
            />
          </div>
          <FormField
            label="School / College"
            value={f.school_college}
            onChange={(v) => setF({ ...f, school_college: v })}
          />
        </>
      )}

      {section === "medical" && (
        <>
          <SelectField
            label="Blood group"
            value={f.blood_group}
            onChange={(v) => setF({ ...f, blood_group: v })}
            options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))}
          />
          <div className="space-y-1.5">
            <Label>Medical notes</Label>
            <Textarea
              rows={3}
              placeholder="Allergies, injuries, conditions the coach should know about"
              value={f.medical_notes}
              onChange={(e) => setF({ ...f, medical_notes: e.target.value })}
            />
          </div>
        </>
      )}

      <Button
        type="submit"
        disabled={save.isPending || !f.name || !f.phone}
        className="w-full h-12 rounded-xl font-semibold"
        style={{ backgroundColor: "var(--brand)", color: "white" }}
      >
        {save.isPending ? "Saving…" : "Add player"}
      </Button>
      <p className="text-xs text-center text-muted-foreground">
        A Player ID like{" "}
        <span className="font-mono">
          {tenant.player_prefix ?? "SSA"}-{new Date().getFullYear()}-0001
        </span>{" "}
        will be assigned automatically.
      </p>
    </form>
  );
}

function FormField({
  label,
  value,
  onChange,
  required,
  type,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </Label>
      <Input
        type={type}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select" />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
