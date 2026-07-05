import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchStudent, fetchStudentPayments, qk, fetchFeePlans } from "@/lib/dashboard-queries";
import { useDashboard } from "@/lib/dashboard-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Phone, MessageCircle, Edit, Plus, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { StudentDialog } from "./dashboard.students";

export const Route = createFileRoute("/dashboard/students/$id")({
  component: StudentDetail,
});

function StudentDetail() {
  const { id } = Route.useParams();
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const student = useQuery({ queryKey: qk.student(id), queryFn: () => fetchStudent(id) });
  const payments = useQuery({ queryKey: qk.studentPayments(id), queryFn: () => fetchStudentPayments(id) });

  const [editOpen, setEditOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);

  if (student.isLoading) return <div className="text-sm text-muted-foreground">Loading…</div>;
  if (!student.data) return <div>Not found.</div>;

  const s = student.data;
  const waPhone = (s.phone || "").replace(/\D/g, "");
  const totalPaid = (payments.data ?? []).reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <div className="space-y-4">
      <Link to="/dashboard/students" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground">
        <ArrowLeft className="size-4" /> All students
      </Link>

      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{s.name}</h1>
              <Badge variant="secondary" className="capitalize">{s.status}</Badge>
            </div>
            <div className="text-sm text-muted-foreground mt-1">Joined {new Date(s.joined_at).toLocaleDateString("en-IN")}</div>
          </div>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Edit className="size-4 mr-1" /> Edit</Button>
            </DialogTrigger>
            <StudentDialog
              onClose={() => setEditOpen(false)}
              initial={{
                id: s.id, name: s.name, phone: s.phone,
                guardian_name: s.guardian_name, guardian_phone: s.guardian_phone,
                dob: s.dob, batch_id: s.batch_id, fee_plan_id: s.fee_plan_id, status: s.status,
              }}
            />
          </Dialog>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
          <Info label="Phone" value={s.phone} />
          <Info label="Guardian" value={s.guardian_name || "—"} />
          <Info label="Guardian phone" value={s.guardian_phone || "—"} />
          <Info label="DOB" value={s.dob ? new Date(s.dob).toLocaleDateString("en-IN") : "—"} />
          <Info label="Batch" value={(s as any).batches?.name || "—"} />
          <Info label="Fee plan" value={(s as any).fee_plans?.name ? `${(s as any).fee_plans.name} · ₹${(s as any).fee_plans.amount}` : "—"} />
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <Button asChild size="sm" variant="outline">
            <a href={`tel:${s.phone}`}><Phone className="size-4 mr-1" /> Call</a>
          </Button>
          <Button asChild size="sm" style={{ backgroundColor: "#25D366", color: "white" }}>
            <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer">
              <MessageCircle className="size-4 mr-1" /> WhatsApp
            </a>
          </Button>
          {s.guardian_phone && (
            <Button asChild size="sm" variant="outline">
              <a href={`tel:${s.guardian_phone}`}><Phone className="size-4 mr-1" /> Call guardian</a>
            </Button>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold">Payments</h2>
            <div className="text-xs text-muted-foreground">Total paid: ₹{totalPaid.toLocaleString("en-IN")}</div>
          </div>
          <Dialog open={payOpen} onOpenChange={setPayOpen}>
            <DialogTrigger asChild>
              <Button size="sm" style={{ backgroundColor: "var(--brand)", color: "white" }}>
                <Plus className="size-4 mr-1" /> Record payment
              </Button>
            </DialogTrigger>
            <RecordPaymentDialog studentId={id} tenantId={tenant.id} onClose={() => {
              setPayOpen(false);
              qc.invalidateQueries({ queryKey: qk.studentPayments(id) });
              qc.invalidateQueries({ queryKey: qk.kpis(tenant.id) });
            }} />
          </Dialog>
        </div>

        <div className="divide-y">
          {(payments.data ?? []).map((p) => (
            <div key={p.id} className="py-3 flex items-center justify-between text-sm">
              <div>
                <div className="font-medium">₹{Number(p.amount).toLocaleString("en-IN")} <span className="text-xs text-muted-foreground">· {p.type}{p.period ? ` (${p.period})` : ""}</span></div>
                <div className="text-xs text-muted-foreground">
                  {new Date(p.created_at).toLocaleString("en-IN")} · {p.method}
                  {p.note ? ` · ${p.note}` : ""}
                </div>
              </div>
              <div className="text-xs text-muted-foreground">#{p.receipt_no}</div>
            </div>
          ))}
          {(payments.data ?? []).length === 0 && (
            <div className="py-6 text-center text-sm text-muted-foreground">No payments yet.</div>
          )}
        </div>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function RecordPaymentDialog({
  studentId, tenantId, onClose,
}: { studentId: string; tenantId: string; onClose: () => void }) {
  const feePlans = useQuery({ queryKey: qk.feePlans(tenantId), queryFn: () => fetchFeePlans(tenantId) });
  const now = new Date();
  const [amount, setAmount] = useState<string>("");
  const [type, setType] = useState("monthly");
  const [period, setPeriod] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [method, setMethod] = useState("upi");
  const [note, setNote] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("payments").insert({
        tenant_id: tenantId,
        student_id: studentId,
        amount: Number(amount),
        type,
        period: type === "monthly" ? period : null,
        method,
        note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <DialogContent className="max-w-sm">
      <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
      <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="space-y-1.5">
          <Label>Fee plan (shortcut)</Label>
          <Select onValueChange={(v) => {
            const p = (feePlans.data ?? []).find((x) => x.id === v);
            if (p) { setAmount(String(p.amount)); setType(p.type); }
          }}>
            <SelectTrigger><SelectValue placeholder="Copy from a fee plan" /></SelectTrigger>
            <SelectContent>
              {(feePlans.data ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name} · ₹{p.amount} ({p.type})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5"><Label>Amount ₹</Label><Input required type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="registration">Registration</SelectItem>
                <SelectItem value="one_time">One-time</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {type === "monthly" && (
          <div className="space-y-1.5">
            <Label>Period (YYYY-MM)</Label>
            <Input value={period} onChange={(e) => setPeriod(e.target.value)} />
          </div>
        )}
        <div className="space-y-1.5">
          <Label>Method</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="upi">UPI</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="bank">Bank transfer</SelectItem>
              <SelectItem value="card">Card</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>Note</Label><Input value={note} onChange={(e) => setNote(e.target.value)} /></div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={save.isPending}>Save</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
