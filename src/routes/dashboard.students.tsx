import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, Camera, ChevronRight, Inbox } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { BulkImportStudents } from "@/components/dashboard/BulkImportStudents";
import { PersonAvatar } from "@/components/site/PersonAvatar";
import { StudentProfilePanel } from "@/components/dashboard/StudentProfilePanel";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/dashboard/students")({
  validateSearch: (search: Record<string, unknown>): { status?: string } => {
    const s = search.status;
    if (s === "active" || s === "paused" || s === "left" || s === "all") return { status: s };
    return {};
  },
  component: StudentsPage,
});

function StudentsPage() {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const cycle = tenantFeeCycle(tenant);

  const initialStatus = Route.useSearch().status ?? "active";

  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>(initialStatus);
  const [batch, setBatch] = useState<string>("all");
  const [gender, setGender] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  const students = useQuery({
    queryKey: qk.students(tenant.id),
    queryFn: () => fetchStudents(tenant.id),
  });
  const batches = useQuery({
    queryKey: qk.batches(tenant.id),
    queryFn: () => fetchBatches(tenant.id),
  });

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

  const filtered = useMemo(() => {
    const list = students.data ?? [];
    return list.filter((s: any) => {
      if (status !== "all" && s.status !== status) return false;
      if (batch !== "all" && s.batch_id !== batch) return false;
      if (gender !== "all" && (s.gender ?? "").toLowerCase() !== gender) return false;
      if (q) {
        const needle = q.toLowerCase();
        if (
          !s.name.toLowerCase().includes(needle) &&
          !(s.phone || "").includes(q) &&
          !(s.player_id || "").toLowerCase().includes(needle)
        )
          return false;
      }
      return true;
    });
  }, [students.data, q, status, batch, gender]);

  const counts = useMemo(() => {
    const list = students.data ?? [];
    return {
      all: list.length,
      active: list.filter((s: any) => s.status === "active").length,
      paused: list.filter((s: any) => s.status === "paused").length,
      left: list.filter((s: any) => s.status === "left").length,
    };
  }, [students.data]);

  const statusTabs = [
    { key: "active", label: "Active", count: counts.active },
    { key: "left", label: "Left", count: counts.left },
    { key: "all", label: "All", count: counts.all },
  ];


  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {counts.all} total · {counts.active} active
          </p>
        </div>
        <div className="flex items-center gap-2">
          <BulkImportStudents />
          <Button
            onClick={() => setAddOpen(true)}
            className="rounded-full h-10 px-5 font-semibold"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-ink)" }}
          >
            <Plus className="size-4 mr-1" /> Add
          </Button>
        </div>
      </header>

      {/* Row 1: Status tabs + gender */}
      <div className="flex items-center gap-2">
        <div className="inline-flex flex-1 items-center gap-1 rounded-full bg-card border border-border shadow-sm p-1 overflow-x-auto">
          {statusTabs.map((t) => {
            const active = status === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setStatus(t.key)}
                className={cn(
                  "shrink-0 flex-1 h-9 px-3 rounded-full text-sm font-medium transition-colors",
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/60",
                )}
              >
                {t.label}
                <span
                  className={cn(
                    "ml-1 text-xs tabular-nums",
                    active ? "opacity-70" : "text-muted-foreground/70",
                  )}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>
        <Select value={gender} onValueChange={setGender}>
          <SelectTrigger className="w-[110px] shrink-0 h-11 rounded-full bg-card border-border shadow-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border">
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Row 2: Search + batch */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="size-4 absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, Player ID"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-10 h-11 rounded-full bg-card border-border shadow-sm"
          />
        </div>
        <Select value={batch} onValueChange={setBatch}>
          <SelectTrigger className="w-[120px] shrink-0 h-11 rounded-full bg-card border-border shadow-sm">
            <SelectValue placeholder="Batch" />
          </SelectTrigger>
          <SelectContent className="bg-popover text-popover-foreground border-border">
            <SelectItem value="all">All batches</SelectItem>
            {(batches.data ?? []).map((b: any) => (
              <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>



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
          <div className="p-10 text-center text-sm text-muted-foreground">
            No students match. {status === "active" ? "Add your first student to get started." : ""}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((s: any, i: number) => {
              const paidThisMonth = paidSet.has(s.id);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      qc.setQueryData(qk.student(s.id), s);
                      setProfileId(s.id);
                    }}
                    onMouseEnter={() => qc.setQueryData(qk.student(s.id), s)}
                    className="w-full text-left flex items-center gap-3 md:gap-4 p-4 md:px-5 hover:bg-accent/60 transition-colors"
                  >
                    <div className="hidden md:flex w-6 text-xs text-muted-foreground tabular-nums justify-center">
                      {i + 1}
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
                    </div>
                    {s.status === "active" ? (
                      <StatusPill paid={paidThisMonth} />
                    ) : (
                      <span className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">
                        {s.status}
                      </span>
                    )}
                    <ChevronRight className="size-4 text-muted-foreground shrink-0" />
                  </button>
                </li>
              );
            })}
          </ul>

        )}
      </section>

      <AddStudentSheet open={addOpen} onOpenChange={setAddOpen} />
      <ProfileSheet id={profileId} onOpenChange={(open) => !open && setProfileId(null)} />
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
        className={cn(
          "w-1.5 h-1.5 rounded-full mr-1.5",
          paid ? "bg-emerald-500" : "bg-rose-500",
        )}
      />
      {paid ? "Paid" : "Due"}
    </span>
  );
}

/* ---------- Profile sheet (opened from list) ---------- */

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
              <SheetTitle className="text-left sr-only">Student profile</SheetTitle>
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

/* ---------- Add student ---------- */

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
              <SheetTitle className="text-left">Add student</SheetTitle>
            </SheetHeader>
            {inner}
          </div>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add student</DialogTitle>
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
  const [f, setF] = useState({
    name: "",
    phone: "",
    guardian_name: "",
    guardian_phone: "",
    dob: "",
    gender: "",
    address: "",
    batch_id: "",
    fee_plan_id: "",
    joined_at: new Date().toISOString().slice(0, 10),
  });

  const save = useMutation({
    mutationFn: async () => {
      let photo_url: string | null = null;
      if (photoFile) {
        photo_url = await uploadTenantFile(tenant.id, "students", photoFile);
      }
      const { data, error } = await (supabase.from("students") as any)
        .insert({
          tenant_id: tenant.id,
          name: f.name,
          phone: f.phone,
          guardian_name: f.guardian_name || null,
          guardian_phone: f.guardian_phone || null,
          dob: f.dob || null,
          gender: f.gender || null,
          address: f.address || null,
          batch_id: f.batch_id || null,
          fee_plan_id: f.fee_plan_id || null,
          joined_at: f.joined_at,
          photo_url,
          status: "active",
        })
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

      <FormField label="Name" required value={f.name} onChange={(v) => setF({ ...f, name: v })} />
      <div className="grid grid-cols-2 gap-2">
        <FormField
          label="Phone"
          required
          value={f.phone}
          onChange={(v) => setF({ ...f, phone: v })}
        />
        <FormField label="DOB" type="date" value={f.dob} onChange={(v) => setF({ ...f, dob: v })} />
      </div>
      <div className="space-y-1.5">
        <Label>Gender</Label>
        <Select value={f.gender} onValueChange={(v) => setF({ ...f, gender: v })}>
          <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="male">Male</SelectItem>
            <SelectItem value="female">Female</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FormField
          label="Parent name"
          value={f.guardian_name}
          onChange={(v) => setF({ ...f, guardian_name: v })}
        />
        <FormField
          label="Parent phone"
          value={f.guardian_phone}
          onChange={(v) => setF({ ...f, guardian_phone: v })}
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
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label>Batch</Label>
          <Select value={f.batch_id} onValueChange={(v) => setF({ ...f, batch_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              {(batches.data ?? []).map((b: any) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Fee plan</Label>
          <Select value={f.fee_plan_id} onValueChange={(v) => setF({ ...f, fee_plan_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
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
      <FormField
        label="Joining date"
        type="date"
        value={f.joined_at}
        onChange={(v) => setF({ ...f, joined_at: v })}
      />

      <Button
        type="submit"
        disabled={save.isPending || !f.name || !f.phone}
        className="w-full h-12 rounded-xl font-semibold"
        style={{ backgroundColor: "var(--brand)", color: "white" }}
      >
        {save.isPending ? "Saving…" : "Add student"}
      </Button>
      <p className="text-xs text-center text-muted-foreground">
        A Player ID will be assigned automatically.
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
