import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDashboard } from "@/lib/dashboard-context";
import { fetchBatches, fetchFeePlans, fetchStudents, qk } from "@/lib/dashboard-queries";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Phone, MessageCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard/students")({
  component: StudentsPage,
});

function StudentsPage() {
  const { tenant } = useDashboard();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [batch, setBatch] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);

  const students = useQuery({ queryKey: qk.students(tenant.id), queryFn: () => fetchStudents(tenant.id) });
  const batches = useQuery({ queryKey: qk.batches(tenant.id), queryFn: () => fetchBatches(tenant.id) });

  const filtered = useMemo(() => {
    const list = students.data ?? [];
    return list.filter((s) => {
      if (status !== "all" && s.status !== status) return false;
      if (batch !== "all" && s.batch_id !== batch) return false;
      if (q) {
        const needle = q.toLowerCase();
        if (!s.name.toLowerCase().includes(needle) && !(s.phone || "").includes(q)) return false;
      }
      return true;
    });
  }, [students.data, q, status, batch]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Students</h1>
          <p className="text-sm text-muted-foreground">{students.data?.length ?? 0} total</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button style={{ backgroundColor: "var(--brand)", color: "white" }}>
              <Plus className="size-4 mr-1" /> Add student
            </Button>
          </DialogTrigger>
          <StudentDialog onClose={() => setAddOpen(false)} />
        </Dialog>
      </header>

      <Card className="p-3 md:p-4 flex flex-col md:flex-row gap-2 md:items-center">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search name or phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="left">Left</SelectItem>
            </SelectContent>
          </Select>
          <Select value={batch} onValueChange={setBatch}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Batch" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All batches</SelectItem>
              {(batches.data ?? []).map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Mobile cards */}
      <div className="grid gap-2 md:hidden">
        {filtered.map((s) => (
          <Link key={s.id} to="/dashboard/students/$id" params={{ id: s.id }}>
            <Card className="p-3 active:scale-[0.99] transition-transform">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-semibold truncate">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.phone}</div>
                  <div className="text-xs mt-1">
                    {(s as any).batches?.name ?? "No batch"} ·{" "}
                    {(s as any).fee_plans?.name ?? "No plan"}
                  </div>
                </div>
                <StatusPill status={s.status} />
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Name</th>
              <th className="text-left px-4 py-2 font-medium">Phone</th>
              <th className="text-left px-4 py-2 font-medium">Batch</th>
              <th className="text-left px-4 py-2 font-medium">Fee plan</th>
              <th className="text-left px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className="border-t hover:bg-muted/40">
                <td className="px-4 py-2">
                  <Link to="/dashboard/students/$id" params={{ id: s.id }} className="font-medium hover:underline">
                    {s.name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {s.phone}
                    <a href={`tel:${s.phone}`} className="text-muted-foreground hover:text-foreground">
                      <Phone className="size-3" />
                    </a>
                    <a
                      href={`https://wa.me/${s.phone.replace(/\D/g, "")}`}
                      target="_blank" rel="noreferrer"
                      className="text-emerald-600 hover:text-emerald-700"
                    >
                      <MessageCircle className="size-3" />
                    </a>
                  </div>
                </td>
                <td className="px-4 py-2">{(s as any).batches?.name ?? "—"}</td>
                <td className="px-4 py-2">{(s as any).fee_plans?.name ?? "—"}</td>
                <td className="px-4 py-2"><StatusPill status={s.status} /></td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted-foreground">No students match.</td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700",
    paused: "bg-amber-100 text-amber-700",
    left: "bg-slate-200 text-slate-700",
  };
  return <Badge variant="secondary" className={`${map[status] ?? ""} border-0 capitalize`}>{status}</Badge>;
}

function StudentDialog({
  onClose,
  initial,
}: {
  onClose: () => void;
  initial?: {
    id?: string;
    name?: string;
    phone?: string;
    guardian_name?: string | null;
    guardian_phone?: string | null;
    dob?: string | null;
    batch_id?: string | null;
    fee_plan_id?: string | null;
    status?: string;
  };
}) {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const batches = useQuery({ queryKey: qk.batches(tenant.id), queryFn: () => fetchBatches(tenant.id) });
  const feePlans = useQuery({ queryKey: qk.feePlans(tenant.id), queryFn: () => fetchFeePlans(tenant.id) });

  const [form, setForm] = useState({
    name: initial?.name ?? "",
    phone: initial?.phone ?? "",
    guardian_name: initial?.guardian_name ?? "",
    guardian_phone: initial?.guardian_phone ?? "",
    dob: initial?.dob ?? "",
    batch_id: initial?.batch_id ?? "",
    fee_plan_id: initial?.fee_plan_id ?? "",
    status: initial?.status ?? "active",
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        tenant_id: tenant.id,
        name: form.name,
        phone: form.phone,
        guardian_name: form.guardian_name || null,
        guardian_phone: form.guardian_phone || null,
        dob: form.dob || null,
        batch_id: form.batch_id || null,
        fee_plan_id: form.fee_plan_id || null,
        status: form.status,
      };
      if (initial?.id) {
        const { error } = await supabase.from("students").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("students").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(initial?.id ? "Student updated" : "Student added");
      qc.invalidateQueries({ queryKey: qk.students(tenant.id) });
      if (initial?.id) qc.invalidateQueries({ queryKey: qk.student(initial.id) });
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>{initial?.id ? "Edit student" : "Add student"}</DialogTitle>
      </DialogHeader>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="Name" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Field label="Phone" required value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <div className="grid grid-cols-2 gap-2">
          <Field label="Guardian" value={form.guardian_name} onChange={(v) => setForm({ ...form, guardian_name: v })} />
          <Field label="Guardian phone" value={form.guardian_phone} onChange={(v) => setForm({ ...form, guardian_phone: v })} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>DOB</Label>
            <Input type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
                <SelectItem value="left">Left</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Batch</Label>
          <Select value={form.batch_id} onValueChange={(v) => setForm({ ...form, batch_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select batch" /></SelectTrigger>
            <SelectContent>
              {(batches.data ?? []).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Fee plan</Label>
          <Select value={form.fee_plan_id} onValueChange={(v) => setForm({ ...form, fee_plan_id: v })}>
            <SelectTrigger><SelectValue placeholder="Select fee plan" /></SelectTrigger>
            <SelectContent>
              {(feePlans.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name} · ₹{p.amount}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>{initial?.id ? "Save" : "Add"}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function Field({
  label, value, onChange, required,
}: { label: string; value: string; onChange: (v: string) => void; required?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}{required && <span className="text-rose-500"> *</span>}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} required={required} />
    </div>
  );
}

export { StudentDialog };
