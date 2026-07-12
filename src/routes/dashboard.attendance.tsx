import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { toast } from "sonner";
import { MessageCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { supabase } from "@/integrations/supabase/client";
import { fetchBatches, fetchStudents, qk } from "@/lib/dashboard-queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Status = "present" | "absent" | "late";
type Mark = { id: string; student_id: string; status: Status; note: string | null };

export const Route = createFileRoute("/dashboard/attendance")({
  head: () => ({ meta: [{ title: "Attendance · Academy dashboard" }] }),
  component: AttendancePage,
});

function todayISO() {
  return format(new Date(), "yyyy-MM-dd");
}

function AttendancePage() {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const [batchId, setBatchId] = useState<string>("");
  const [date, setDate] = useState<string>(todayISO());

  const batchesQ = useQuery({ queryKey: qk.batches(tenant.id), queryFn: () => fetchBatches(tenant.id) });
  const studentsQ = useQuery({ queryKey: qk.students(tenant.id), queryFn: () => fetchStudents(tenant.id) });

  const activeBatches = useMemo(
    () => (batchesQ.data ?? []).filter((b) => b.active),
    [batchesQ.data],
  );
  // default to first batch once loaded
  if (!batchId && activeBatches.length && activeBatches[0]) {
    queueMicrotask(() => setBatchId(activeBatches[0]!.id));
  }

  const batchStudents = useMemo(
    () =>
      (studentsQ.data ?? []).filter(
        (s) => s.batch_id === batchId && s.status === "active",
      ),
    [studentsQ.data, batchId],
  );

  const sessionQ = useQuery({
    queryKey: ["d", "att-session", tenant.id, batchId, date],
    enabled: !!batchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_sessions" as never)
        .select("*, attendance_marks(*)")
        .eq("tenant_id", tenant.id)
        .eq("batch_id", batchId)
        .eq("session_date", date)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as { id: string; attendance_marks: Mark[] } | null;
    },
  });

  const marks = new Map<string, Mark>();
  (sessionQ.data?.attendance_marks ?? []).forEach((m) => marks.set(m.student_id, m));

  const ensureSession = async (): Promise<string> => {
    if (sessionQ.data?.id) return sessionQ.data.id;
    const { data, error } = await supabase
      .from("attendance_sessions" as never)
      .insert({ tenant_id: tenant.id, batch_id: batchId, session_date: date } as never)
      .select("id")
      .single();
    if (error) throw error;
    return (data as unknown as { id: string }).id;
  };

  const mark = useMutation({
    mutationFn: async ({ studentId, status }: { studentId: string; status: Status }) => {
      const sessionId = await ensureSession();
      const { error } = await supabase
        .from("attendance_marks" as never)
        .upsert(
          {
            session_id: sessionId,
            tenant_id: tenant.id,
            student_id: studentId,
            status,
          } as never,
          { onConflict: "session_id,student_id" },
        );
      if (error) throw error;
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["d", "att-session", tenant.id, batchId, date] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const shiftDate = (delta: number) => {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + delta);
    setDate(format(d, "yyyy-MM-dd"));
  };

  const counts = { present: 0, absent: 0, late: 0, unmarked: 0 };
  batchStudents.forEach((s) => {
    const m = marks.get(s.id);
    if (!m) counts.unmarked++;
    else counts[m.status]++;
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
        <p className="text-sm text-muted-foreground">
          Slide right for present, left for absent. Nudge absentees on WhatsApp.
        </p>
      </header>

      <Card className="p-3 flex flex-wrap items-center gap-2">
        <div className="min-w-[180px]">
          <Select value={batchId} onValueChange={setBatchId}>
            <SelectTrigger><SelectValue placeholder="Choose batch" /></SelectTrigger>
            <SelectContent>
              {activeBatches.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" onClick={() => shiftDate(-1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <Button variant="outline" size="icon" onClick={() => shiftDate(1)}>
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setDate(todayISO())}>Today</Button>
        </div>
        <div className="ml-auto flex gap-2 text-xs">
          <Badge tone="emerald">{counts.present} present</Badge>
          <Badge tone="rose">{counts.absent} absent</Badge>
          {counts.late > 0 && <Badge tone="amber">{counts.late} late</Badge>}
          {counts.unmarked > 0 && <Badge tone="slate">{counts.unmarked} unmarked</Badge>}
        </div>
      </Card>

      {!batchId && <p className="text-sm text-muted-foreground">Pick a batch to start.</p>}

      <div className="space-y-2">
        {batchStudents.map((s) => {
          const m = marks.get(s.id);
          return (
            <StudentRow
              key={s.id}
              name={s.name}
              phone={s.guardian_phone || s.phone}
              tenantName={tenant.name}
              date={date}
              status={m?.status}
              onSet={(status) => mark.mutate({ studentId: s.id, status })}
            />
          );
        })}
        {batchId && batchStudents.length === 0 && (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No active students in this batch.
          </Card>
        )}
      </div>
    </div>
  );
}

function StudentRow({
  name, phone, tenantName, date, status, onSet,
}: {
  name: string;
  phone: string | null;
  tenantName: string;
  date: string;
  status?: Status;
  onSet: (s: Status) => void;
}) {
  const waDigits = (phone ?? "").replace(/\D/g, "");
  const waNumber = waDigits.length === 10 ? `91${waDigits}` : waDigits;
  const waText = `Namaste ji, ${name} aaj (${date}) ${tenantName} me nahi aaye. Sab theek hai? Kripya inform karein. Dhanyavaad 🙏`;
  const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}` : null;

  return (
    <Card
      className={cn(
        "flex items-center gap-3 p-3 transition select-none border-l-4",
        status === "present" && "border-l-emerald-500 bg-emerald-50/40",
        status === "absent" && "border-l-rose-500 bg-rose-50/40",
        status === "late" && "border-l-amber-500 bg-amber-50/40",
        !status && "border-l-transparent",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{name}</div>
        <div className="text-xs text-muted-foreground">{phone || "No phone"}</div>
      </div>
      <div className="flex items-center gap-2">
        <AttendanceToggle status={status} onSet={onSet} />
        {status === "absent" && waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-[#25D366] px-2.5 py-1 text-[11px] font-semibold text-white"
          >
            <MessageCircle className="size-3" fill="currentColor" /> Notify
          </a>
        )}
      </div>
    </Card>
  );
}

function AttendanceToggle({
  status,
  onSet,
}: {
  status?: Status;
  onSet: (s: Status) => void;
}) {
  // Two-state slide switch: left = absent (red), right = present (green).
  // Default (unmarked) sits centered in muted grey. Tap either half to set.
  const isPresent = status === "present";
  const isAbsent = status === "absent";
  const bg = isPresent
    ? "bg-emerald-500"
    : isAbsent
    ? "bg-rose-500"
    : "bg-muted";
  const knobPos = isPresent
    ? "translate-x-9"
    : isAbsent
    ? "translate-x-0"
    : "translate-x-[18px]";
  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        aria-label="Toggle attendance"
        onClick={() => onSet(isPresent ? "absent" : "present")}
        className={cn(
          "relative h-8 w-[74px] rounded-full transition-colors duration-200 shadow-inner",
          bg,
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-7 w-7 rounded-full bg-white shadow-md transition-transform duration-200 grid place-items-center text-[10px] font-bold",
            knobPos,
            isPresent
              ? "text-emerald-600"
              : isAbsent
              ? "text-rose-600"
              : "text-muted-foreground",
          )}
        >
          {isPresent ? "P" : isAbsent ? "A" : "—"}
        </span>
        <span className="absolute inset-y-0 left-2 flex items-center text-[10px] font-bold text-white/90 select-none pointer-events-none">
          {isAbsent ? "" : "A"}
        </span>
        <span className="absolute inset-y-0 right-2 flex items-center text-[10px] font-bold text-white/90 select-none pointer-events-none">
          {isPresent ? "" : "P"}
        </span>
      </button>
    </div>
  );
}

function StudentRow({
  name, phone, tenantName, date, status, onCycle, onSet,
}: {
  name: string;
  phone: string | null;
  tenantName: string;
  date: string;
  status?: Status;
  onCycle: () => void;
  onSet: (s: Status) => void;
}) {
  const waDigits = (phone ?? "").replace(/\D/g, "");
  const waNumber = waDigits.length === 10 ? `91${waDigits}` : waDigits;
  const waText = `Namaste ji, ${name} aaj (${date}) ${tenantName} me nahi aaye. Sab theek hai? Kripya inform karein. Dhanyavaad 🙏`;
  const waUrl = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}` : null;

  return (
    <Card
      onClick={onCycle}
      className={cn(
        "flex items-center gap-3 p-3 cursor-pointer active:scale-[0.995] transition select-none border-l-4",
        status === "present" && "border-l-emerald-500 bg-emerald-50/40",
        status === "absent" && "border-l-rose-500 bg-rose-50/40",
        status === "late" && "border-l-amber-500 bg-amber-50/40",
        !status && "border-l-transparent",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{name}</div>
        <div className="text-xs text-muted-foreground">{phone || "No phone"}</div>
      </div>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        <IconBtn active={status === "present"} tone="emerald" onClick={() => onSet("present")} title="Present">
          <Check className="size-4" />
        </IconBtn>
        <IconBtn active={status === "absent"} tone="rose" onClick={() => onSet("absent")} title="Absent">
          <X className="size-4" />
        </IconBtn>
        <IconBtn active={status === "late"} tone="amber" onClick={() => onSet("late")} title="Late">
          <Clock className="size-4" />
        </IconBtn>
        {status === "absent" && waUrl && (
          <a
            href={waUrl}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="ml-1 inline-flex items-center gap-1 rounded-full bg-[#25D366] px-2.5 py-1 text-[11px] font-semibold text-white"
          >
            <MessageCircle className="size-3" fill="currentColor" /> Notify
          </a>
        )}
      </div>
    </Card>
  );
}

function IconBtn({
  active, tone, onClick, title, children,
}: {
  active: boolean;
  tone: "emerald" | "rose" | "amber";
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const styles: Record<string, string> = {
    emerald: active ? "bg-emerald-600 text-white" : "text-emerald-700 hover:bg-emerald-100",
    rose: active ? "bg-rose-600 text-white" : "text-rose-700 hover:bg-rose-100",
    amber: active ? "bg-amber-500 text-white" : "text-amber-700 hover:bg-amber-100",
  };
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn("size-8 grid place-items-center rounded-full transition", styles[tone])}
    >
      {children}
    </button>
  );
}

function Badge({ tone, children }: { tone: "emerald" | "rose" | "amber" | "slate"; children: React.ReactNode }) {
  const styles: Record<string, string> = {
    emerald: "bg-emerald-100 text-emerald-800",
    rose: "bg-rose-100 text-rose-800",
    amber: "bg-amber-100 text-amber-800",
    slate: "bg-slate-100 text-slate-700",
  };
  return <span className={cn("rounded-full px-2 py-0.5 font-medium", styles[tone])}>{children}</span>;
}
