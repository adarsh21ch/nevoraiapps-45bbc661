import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchStudent,
  fetchBatches,
  fetchFeePlans,
  fetchPaymentsForPeriods,
  qk,
} from "@/lib/dashboard-queries";
import { useServerFn } from "@tanstack/react-start";
import { deleteStudentPermanently } from "@/lib/students-manage.functions";

import { useDashboard } from "@/lib/dashboard-context";
import { uploadTenantFile } from "@/lib/storage";
import { generateReportCardPdf } from "@/lib/report-card-pdf";
import { generateIdCardPdf } from "@/lib/id-card-pdf";
import { candidatePeriods, periodKey, tenantFeeCycle } from "@/lib/fees";
import { PersonAvatar } from "@/components/site/PersonAvatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Camera,
  Phone,
  MessageCircle,
  Download,
  Pencil,
  Check,
  X,
  UserRoundX,
  UserRoundCheck,
  Eye,
  Loader2,
} from "lucide-react";

type Props = {
  studentId: string;
  compact?: boolean;
};

export function StudentProfilePanel({ studentId, compact }: Props) {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const cycle = tenantFeeCycle(tenant);
  const deleteStudent = useServerFn(deleteStudentPermanently);


  const studentQ = useQuery({
    queryKey: qk.student(studentId),
    queryFn: () => fetchStudent(studentId),
  });
  const batches = useQuery({
    queryKey: qk.batches(tenant.id),
    queryFn: () => fetchBatches(tenant.id),
  });
  const feePlans = useQuery({
    queryKey: qk.feePlans(tenant.id),
    queryFn: () => fetchFeePlans(tenant.id),
  });

  const today = new Date();
  const periods = cycle === "joining_date" ? candidatePeriods(today) : [periodKey(today)];
  const paymentsQ = useQuery({
    queryKey: ["d", "student-current-pay", studentId, periods.join(",")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("period")
        .eq("student_id", studentId)
        .in("period", periods);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [uploading, setUploading] = useState(false);
  const [editFeeOpen, setEditFeeOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [confirmReactivate, setConfirmReactivate] = useState(false);
  const [editingCore, setEditingCore] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteStep, setDeleteStep] = useState(1);


  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.student(studentId) });
    qc.invalidateQueries({ queryKey: qk.students(tenant.id) });
    qc.invalidateQueries({ queryKey: ["d", "fees"] });
    qc.invalidateQueries({ queryKey: qk.kpis(tenant.id) });
  };

  const patch = useMutation({
    mutationFn: async (payload: Record<string, any>) => {
      const { error } = await (supabase.from("students") as any)
        .update(payload)
        .eq("id", studentId);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const isGenderPricingEnabled = (tenant as any).gender_pricing_enabled === true;

  if (studentQ.isLoading) {
    return <div className="p-8 text-sm text-muted-foreground text-center">Loading…</div>;
  }
  const s: any = studentQ.data;
  if (!s) return <div className="p-8 text-sm text-muted-foreground text-center">Not found.</div>;

  const plan = s.fee_plans as { id: string; name: string; amount: number; female_amount: number | null } | null;
  const batch = s.batches as { id: string; name: string } | null;

  let baseAmount = Number(plan?.amount ?? 0);
  const isFemale = s.gender === "female" || (typeof s.gender === "string" && s.gender.toLowerCase() === "girl");
  if (isGenderPricingEnabled && isFemale && plan?.female_amount != null) {
    baseAmount = Number(plan.female_amount);
  }

  const effectiveFee = s.custom_fee != null ? Number(s.custom_fee) : baseAmount;
  const paidCurrent = (paymentsQ.data ?? []).length > 0;

  const waPhone = (s.phone || "").replace(/\D/g, "");
  const isLeft = s.status === "left";

  const handlePhoto = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const path = await uploadTenantFile(tenant.id, "students", file);
      await patch.mutateAsync({ photo_url: path });
      toast.success("Photo updated");
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={cn("space-y-4", compact ? "" : "pb-4")}>
      {/* Compact header: DP on the LEFT, name + Player ID + actions on the RIGHT */}
      <div className="flex items-start gap-4">
        <label className="relative cursor-pointer group shrink-0">
          <PersonAvatar
            name={s.name}
            src={s.photo_url}
            className="h-20 w-20 md:h-24 md:w-24 ring-2 ring-border shadow-sm"
          />
          <span
            className="absolute inset-0 rounded-full flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity text-white"
            aria-hidden
          >
            <Camera className="size-5" />
          </span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handlePhoto(f);
              e.target.value = "";
            }}
          />
        </label>
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <div className="text-lg md:text-xl font-bold truncate">{s.name}</div>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              {s.player_id && (
                <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] font-mono font-semibold tracking-wider text-foreground">
                  {s.player_id}
                </span>
              )}
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  isLeft
                    ? "bg-muted text-muted-foreground"
                    : paidCurrent
                      ? "bg-emerald-500/15 text-emerald-500"
                      : "bg-rose-500/15 text-rose-500",
                )}
              >
                {isLeft ? "Left" : paidCurrent ? "Paid this month" : "Pending this month"}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild size="sm" variant="outline" className="rounded-full h-8">
              <a href={`tel:${s.phone}`}>
                <Phone className="size-3.5 mr-1" /> Call
              </a>
            </Button>
            <Button
              asChild
              size="sm"
              className="rounded-full h-8 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <a href={`https://wa.me/${waPhone}`} target="_blank" rel="noreferrer">
                <MessageCircle className="size-3.5 mr-1" /> WhatsApp
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Fee card */}
      <div
        className="rounded-2xl p-4 border shadow-sm bg-card flex items-center justify-between gap-3"
        style={{ borderColor: "color-mix(in oklab, var(--brand) 40%, var(--border))" }}
      >
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium">
            Monthly fee
          </div>
          <div className="flex items-baseline gap-2">
            <div className="text-2xl font-bold tabular-nums">
              ₹{effectiveFee.toLocaleString("en-IN")}
            </div>
            {s.custom_fee != null && (
              <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-medium uppercase tracking-wider">
                Manual Edit
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {s.custom_fee != null
              ? `Manual edit active (System price: ₹${baseAmount.toLocaleString("en-IN")})`
              : plan?.name || "No plan"}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() => setEditFeeOpen(true)}
        >
          <Pencil className="size-4 mr-1" /> Edit fee
        </Button>
      </div>

      {editFeeOpen && (
        <EditFeeInline
          currentCustom={s.custom_fee}
          planAmount={baseAmount}

          onClose={() => setEditFeeOpen(false)}
          onSave={async (val) => {
            await patch.mutateAsync({ custom_fee: val });
            setEditFeeOpen(false);
            toast.success(val == null ? "Synced to system price" : "Manual fee saved");
          }}
        />
      )}

      {/* Details */}
      <div className="rounded-2xl border border-border shadow-sm bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="text-sm font-semibold">Details</div>
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setEditingCore((v) => !v)}
          >
            {editingCore ? (
              "Done"
            ) : (
              <>
                <Pencil className="size-3.5 mr-1" /> Edit
              </>
            )}
          </Button>
        </div>
        {editingCore ? (
          <CoreEditor
            student={s}
            batches={batches.data ?? []}
            feePlans={feePlans.data ?? []}
            onSave={async (payload) => {
              await patch.mutateAsync(payload);
              setEditingCore(false);
              toast.success("Details updated");
            }}
            isGenderPricingEnabled={isGenderPricingEnabled}
          />

        ) : (
          <dl className="divide-y divide-border text-sm">
            <Row label="Guardian" value={s.guardian_name || "—"} />
            <Row label="Guardian phone" value={s.guardian_phone || "—"} />
            <Row
              label="Date of birth"
              value={
                s.dob
                  ? new Date(s.dob).toLocaleDateString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })
                  : "—"
              }
            />
            <Row
              label="Gender"
              value={
                s.gender === "male" ? "Boy" : s.gender === "female" ? "Girl" : s.gender ? String(s.gender).charAt(0).toUpperCase() + String(s.gender).slice(1) : "—"
              }
            />
            <Row label="Address" value={s.address || "—"} multiline />
            {s.current_address && (
              <Row label="Current Address" value={s.current_address} multiline />
            )}
            <Row label="Phone" value={s.phone} />
            <IdProofRow label="Aadhaar Front" path={s.aadhaar_front_url} />
            <IdProofRow label="Aadhaar Back" path={s.aadhaar_back_url} />
            <Row label="Batch" value={batch?.name || "—"} />
            <Row label="Fee plan" value={plan?.name || "—"} />
            <Row
              label="Joined"
              value={new Date(s.joined_at).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            />
          </dl>
        )}
      </div>

      {/* Notes */}
      <NotesEditor
        initial={s.notes ?? ""}
        onSave={async (notes) => {
          await patch.mutateAsync({ notes });
          toast.success("Note saved");
        }}
      />

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button
          variant="outline"
          className="rounded-xl h-12 justify-start"
          onClick={async () => {
            await generateReportCardPdf(tenant, {
              playerId: s.player_id,
              name: s.name,
              guardianName: s.guardian_name,
              dob: s.dob,
              address: s.address,
              currentAddress: s.current_address,
              phone: s.phone,
              guardianPhone: s.guardian_phone,
              batchName: batch?.name ?? null,
              planName: plan?.name ?? null,
              fee: effectiveFee || null,
              joinedAt: s.joined_at,
              photoPath: s.photo_url ?? null,
              aadhaarFrontPath: s.aadhaar_front_url ?? null,
              aadhaarBackPath: s.aadhaar_back_url ?? null,
            });
          }}
        >
          <Download className="size-4 mr-2" /> Download report card
        </Button>
        <Button
          variant="outline"
          className="rounded-xl h-12 justify-start"
          onClick={async () => {
            await generateIdCardPdf(tenant, {
              playerId: s.player_id,
              name: s.name,
              guardianName: s.guardian_name,
              dob: s.dob,
              phone: s.phone,
              guardianPhone: s.guardian_phone,
              batchName: batch?.name ?? null,
              joinedAt: s.joined_at,
              photoPath: s.photo_url ?? null,
              cardToken: (s as { card_token?: string | null }).card_token ?? null,
            });
          }}
        >
          <Download className="size-4 mr-2" /> Download ID card
        </Button>
        {isLeft ? (
          <div className="sm:col-span-2 grid grid-cols-2 gap-2">
            <Button
              className="rounded-xl h-12 justify-start"
              style={{ backgroundColor: "var(--brand)", color: "white" }}
              onClick={() => setConfirmReactivate(true)}
            >
              <UserRoundCheck className="size-4 mr-2" /> Reactivate
            </Button>
            <Button
              variant="outline"
              className="rounded-xl h-12 justify-start text-rose-600 hover:text-rose-700 hover:bg-rose-50"
              onClick={() => {
                setDeleteStep(1);
                setConfirmDelete(true);
              }}
            >
              <X className="size-4 mr-2" /> Delete Permanently
            </Button>

          </div>
        ) : (
          <Button
            variant="outline"
            className="rounded-xl h-12 justify-start text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            onClick={() => setConfirmLeave(true)}
          >
            <UserRoundX className="size-4 mr-2" /> Mark as Left
          </Button>
        )}
      </div>

      {/* Mark left confirm */}
      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Mark {s.name} as Left?</AlertDialogTitle>
            <AlertDialogDescription>
              They will no longer appear in Active students or this month's fee follow-ups. You can
              reactivate later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                await patch.mutateAsync({ status: "left" });
                setConfirmLeave(false);
                toast.success("Marked as Left");
              }}
            >
              Mark as Left
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reactivate: reconfirm batch + fee plan */}
      {confirmReactivate && (
        <ReactivateDialog
          student={s}
          batches={batches.data ?? []}
          feePlans={feePlans.data ?? []}
          onClose={() => setConfirmReactivate(false)}
          isGenderPricingEnabled={isGenderPricingEnabled}
          onConfirm={async ({ batch_id, fee_plan_id }) => {

            await patch.mutateAsync({ status: "active", batch_id, fee_plan_id });
            setConfirmReactivate(false);
            toast.success(`${s.name} is active again`);
          }}
        />
      )}
      {/* Double confirmation delete */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deleteStep === 1 ? "Permanent Deletion" : "Final Confirmation"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteStep === 1 ? (
                <>
                  Are you absolutely sure you want to delete <strong>{s.name}</strong>?
                  This will erase all historical data, payments, and attendance.
                  <br /><br />
                  <em>Note: You can keep them in the "Left" tab if you want to store their data for future reference.</em>
                </>
              ) : (
                "This is the last step. Once deleted, this student's profile and all related records cannot be recovered. Are you really sure?"
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteStep(1)}>Cancel</AlertDialogCancel>
            {deleteStep === 1 ? (
              <Button
                variant="destructive"
                className="rounded-xl"
                onClick={() => setDeleteStep(2)}
              >
                Yes, continue
              </Button>
            ) : (
              <AlertDialogAction
                className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
                onClick={async () => {
                  try {
                    await deleteStudent({ data: { studentId } });
                    toast.success("Student profile deleted permanently");
                    qc.invalidateQueries({ queryKey: qk.students(tenant.id) });
                    invalidate();
                    setConfirmDelete(false);
                  } catch (err: any) {
                    toast.error(err.message || "Deletion failed");
                  }
                }}
              >
                Confirm Permanent Delete
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

  );
}

function Row({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="px-4 py-3 grid grid-cols-[110px_minmax(0,1fr)] gap-3 items-start">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</dt>
      <dd
        className={cn(
          "font-medium text-foreground",
          multiline ? "whitespace-pre-wrap" : "truncate",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function IdProofRow({ label, path }: { label: string; path?: string | null }) {
  const [loading, setLoading] = useState(false);
  const view = async () => {
    if (!path) return;
    setLoading(true);
    try {
      const url = await import("@/lib/storage").then((m) => m.signedUrl(path));
      if (url) window.open(url, "_blank");
      else toast.error("Could not generate view link");
    } catch (err: any) {
      toast.error(err.message || "Failed to open");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 py-3 grid grid-cols-[110px_minmax(0,1fr)] gap-3 items-center">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground font-medium">{label}</dt>
      <dd className="font-medium text-foreground flex items-center justify-between">
        {path ? (
          <>
            <span className="text-emerald-600 flex items-center gap-1.5">
              <Check className="size-3.5" /> Uploaded
            </span>
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={view} disabled={loading}>
              {loading ? <Loader2 className="size-3 animate-spin mr-1" /> : <Eye className="size-3 mr-1" />}
              View
            </Button>
          </>
        ) : (
          <span className="text-muted-foreground italic">Not provided</span>
        )}
      </dd>
    </div>
  );
}

function EditFeeInline({
  currentCustom,
  planAmount,
  onClose,
  onSave,
}: {
  currentCustom: number | null;
  planAmount: number;
  onClose: () => void;
  onSave: (val: number | null) => Promise<void>;
}) {
  const [value, setValue] = useState(
    currentCustom != null ? String(currentCustom) : String(planAmount || ""),
  );
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const commit = async (val: number | null) => {
    setSaving(true);
    try {
      await onSave(val);
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) {
      setErr("Enter a valid amount (0 or more)");
      return;
    }
    if (n > 10_000_000) {
      setErr("Amount too large");
      return;
    }
    setErr(null);
    // If entered amount is exactly the system price, store as null (synced)
    await commit(n === planAmount ? null : n);
  };

  return (
    <div className="rounded-2xl border border-border shadow-sm bg-card p-4 space-y-3">
      <div className="text-sm font-semibold">Manual fee edit</div>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute inset-y-0 left-3 flex items-center text-neutral-500 font-semibold">
            ₹
          </span>
          <Input
            type="number"
            inputMode="numeric"
            className="pl-7 h-11 text-lg font-semibold"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <Button
          onClick={submit}
          disabled={saving}
          className="rounded-xl h-11"
          style={{ backgroundColor: "var(--brand)", color: "white" }}
        >
          <Check className="size-4 mr-1" /> Save
        </Button>
      </div>
      {err && <div className="text-xs text-rose-600">{err}</div>}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Plan amount is ₹{planAmount.toLocaleString("en-IN")}</span>
        <div className="flex gap-2">
          {currentCustom != null && (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground underline"
              disabled={saving}
              onClick={() => commit(null)}
            >
              Sync to system price
            </button>
          )}
          <button type="button" className="hover:text-foreground" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function CoreEditor({
  student,
  batches,
  feePlans,
  onSave,
  isGenderPricingEnabled,
}: {

  student: any;
  batches: any[];
  feePlans: any[];
  onSave: (payload: Record<string, any>) => Promise<void>;
  isGenderPricingEnabled?: boolean;
}) {

  const [f, setF] = useState({
    name: student.name ?? "",
    phone: student.phone ?? "",
    guardian_name: student.guardian_name ?? "",
    guardian_phone: student.guardian_phone ?? "",
    dob: student.dob ?? "",
    gender: student.gender ?? "",
    address: student.address ?? "",
    batch_id: student.batch_id ?? "",
    fee_plan_id: student.fee_plan_id ?? "",
    custom_fee: student.custom_fee as number | null,
  });

  const selectedBatch = batches.find((b) => b.id === f.batch_id);
  const selectedPlan = feePlans.find((p) => p.id === (selectedBatch?.fee_plan_id || f.fee_plan_id));
  
  let systemPrice = Number(selectedPlan?.amount ?? 0);
  if (isGenderPricingEnabled && f.gender === "female" && selectedPlan?.female_amount != null) {
    systemPrice = Number(selectedPlan.female_amount);
  }

  const isManualDiff = f.custom_fee != null && Number(f.custom_fee) !== systemPrice;

  const [saving, setSaving] = useState(false);
  return (
    <form
      className="p-4 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await onSave({
            name: f.name,
            phone: f.phone,
            guardian_name: f.guardian_name || null,
            guardian_phone: f.guardian_phone || null,
            dob: f.dob || null,
            gender: f.gender || null,
            address: f.address || null,
            batch_id: f.batch_id || null,
            fee_plan_id: f.fee_plan_id || null,
            custom_fee: f.custom_fee,
          });

        } finally {
          setSaving(false);
        }
      }}
    >
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
      <div className="grid grid-cols-2 gap-2">
        <FormField
          label="Guardian"
          value={f.guardian_name}
          onChange={(v) => setF({ ...f, guardian_name: v })}
        />
        <FormField
          label="Guardian phone"
          value={f.guardian_phone}
          onChange={(v) => setF({ ...f, guardian_phone: v })}
        />
      </div>
      <div className="space-y-1.5">
        <Label>Gender</Label>
        <Select value={f.gender} onValueChange={(v) => setF({ ...f, gender: v })}>
          <SelectTrigger>
            <SelectValue placeholder="Select" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="male">Boy</SelectItem>
            <SelectItem value="female">Girl</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label>Address</Label>
        <Textarea
          value={f.address}
          onChange={(e) => setF({ ...f, address: e.target.value })}
          rows={2}
        />
      </div>

      {isGenderPricingEnabled && f.gender === "female" && isManualDiff && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex gap-2">
          <p>
            <strong>Price mismatch:</strong> This student has a manual price of ₹{Number(f.custom_fee).toLocaleString("en-IN")}. The system price is ₹{systemPrice.toLocaleString("en-IN")}. 
            <button 
              type="button" 
              className="ml-1 underline font-bold"
              onClick={() => setF({ ...f, custom_fee: null })}
            >
              Sync to system price
            </button>
          </p>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Session</Label>
        <Select
          value={f.batch_id}
          onValueChange={(v) => {
            const b = batches.find((x) => x.id === v);
            setF({ ...f, batch_id: v, fee_plan_id: b?.fee_plan_id ?? "" });
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select session" />
          </SelectTrigger>
          <SelectContent>
            {batches.map((b) => {
              const p = feePlans.find((x) => x.id === b.fee_plan_id);
              let amt = p?.amount;
              if (isGenderPricingEnabled && f.gender === "female" && p?.female_amount != null) {
                amt = p.female_amount;
              }
              return (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                  {amt ? ` · ₹${Number(amt).toLocaleString("en-IN")}/mo` : " · fee not set"}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          The monthly fee is automatically set based on the session and gender.
        </p>
      </div>


      <Button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl h-12"
        style={{ backgroundColor: "var(--brand)", color: "white" }}
      >
        Save details
      </Button>
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
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function NotesEditor({
  initial,
  onSave,
}: {
  initial: string;
  onSave: (val: string) => Promise<void>;
}) {
  const [val, setVal] = useState(initial);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setVal(initial);
    setDirty(false);
  }, [initial]);
  return (
    <div className="rounded-2xl border border-border shadow-sm bg-card p-4 space-y-2">
      <div className="text-sm font-semibold">Notes</div>
      <Textarea
        value={val}
        placeholder="Add a note about this student…"
        rows={3}
        onChange={(e) => {
          setVal(e.target.value);
          setDirty(e.target.value !== initial);
        }}
      />
      {dirty && (
        <div className="flex gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setVal(initial);
              setDirty(false);
            }}
          >
            <X className="size-4 mr-1" /> Cancel
          </Button>
          <Button
            size="sm"
            style={{ backgroundColor: "var(--brand)", color: "white" }}
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await onSave(val);
                setDirty(false);
              } finally {
                setSaving(false);
              }
            }}
          >
            <Check className="size-4 mr-1" /> Save note
          </Button>
        </div>
      )}
    </div>
  );
}

function ReactivateDialog({
  student,
  batches,
  feePlans,
  onClose,
  onConfirm,
  isGenderPricingEnabled,
}: {
  student: any;
  batches: any[];
  feePlans: any[];
  onClose: () => void;
  onConfirm: (v: { batch_id: string | null; fee_plan_id: string | null }) => Promise<void>;
  isGenderPricingEnabled?: boolean;
}) {

  const [batch_id, setBatchId] = useState<string>(student.batch_id ?? "");
  const [fee_plan_id, setFeePlanId] = useState<string>(student.fee_plan_id ?? "");
  const [saving, setSaving] = useState(false);
  return (
    <AlertDialog open onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent className="rounded-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>Reactivate {student.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Confirm their session before they return to Active — the fee follows the session.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Session</Label>
            <Select
              value={batch_id}
              onValueChange={(v) => {
                setBatchId(v);
                setFeePlanId(batches.find((b) => b.id === v)?.fee_plan_id ?? "");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select session" />
              </SelectTrigger>
              <SelectContent>
                {batches.map((b) => {
                  const p = feePlans.find((x) => x.id === b.fee_plan_id);
                  let amt = p?.amount;
                  if (isGenderPricingEnabled && student.gender === "female" && p?.female_amount != null) {
                    amt = p.female_amount;
                  }

                  return (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                      {amt ? ` · ₹${Number(amt).toLocaleString("en-IN")}/mo` : " · fee not set"}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={saving}
            onClick={async (e) => {
              e.preventDefault();
              setSaving(true);
              try {
                await onConfirm({
                  batch_id: batch_id || null,
                  fee_plan_id: fee_plan_id || null,
                });
              } finally {
                setSaving(false);
              }
            }}
          >
            Reactivate
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
