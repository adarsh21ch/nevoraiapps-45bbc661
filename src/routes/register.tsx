import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Download, Loader2 } from "lucide-react";
import { TenantGate } from "@/components/site/TenantGate";
import { useTenant } from "@/lib/tenant-context";
import { batchesQuery, feePlansQuery } from "@/lib/site-queries";
import { supabase } from "@/integrations/supabase/client";
import { generateBlankRegistrationPdf } from "@/lib/registration-pdf";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Register" }, { name: "description", content: "Register online" }] }),
  component: () => (
    <TenantGate>
      <RegisterContent />
    </TenantGate>
  ),
});

type Step = "form" | "payment" | "done";

function RegisterContent() {
  const tenant = useTenant();
  const { data: batches = [] } = useQuery(batchesQuery(tenant.id));
  const { data: fees = [] } = useQuery(feePlansQuery(tenant.id));

  const [step, setStep] = useState<Step>("form");
  const [saving, setSaving] = useState(false);
  const [regId, setRegId] = useState<string | null>(null);
  const [paymentRef, setPaymentRef] = useState("");

  const [form, setForm] = useState({
    name: "",
    dob: "",
    guardian_name: "",
    guardian_phone: "",
    phone: "",
    whatsapp: "",
    batch_id: "",
    fee_plan_id: "",
  });

  const selectedFee = fees.find((f) => f.id === form.fee_plan_id);
  const regFee = fees.find((f) => f.type === "registration");

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.fee_plan_id) {
      toast.error("Please fill name, phone and fee plan.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase
      .from("registrations")
      .insert({
        tenant_id: tenant.id,
        name: form.name.trim(),
        dob: form.dob || null,
        guardian_name: form.guardian_name.trim() || null,
        guardian_phone: form.guardian_phone.trim() || null,
        phone: form.phone.trim(),
        whatsapp: form.whatsapp.trim() || null,
        batch_id: form.batch_id || null,
        fee_plan_id: form.fee_plan_id,
        status: "new",
        payment_status: "pending",
      })
      .select("id")
      .maybeSingle();
    setSaving(false);
    if (error || !data) {
      toast.error("Could not submit. Please try again.");
      console.error(error);
      return;
    }
    setRegId(data.id);
    setStep("payment");
  }

  async function confirmPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentRef.trim()) {
      toast.error("Please enter the UPI transaction reference.");
      return;
    }
    if (!regId) return;
    setSaving(true);
    // Insert a fresh row with the payment claim; the initial 'pending' row remains as audit trail.
    const { error } = await supabase.from("registrations").insert({
      tenant_id: tenant.id,
      name: form.name.trim(),
      phone: form.phone.trim(),
      whatsapp: form.whatsapp.trim() || null,
      guardian_name: form.guardian_name.trim() || null,
      guardian_phone: form.guardian_phone.trim() || null,
      dob: form.dob || null,
      batch_id: form.batch_id || null,
      fee_plan_id: form.fee_plan_id,
      status: "new",
      payment_status: "claimed_paid",
      payment_ref: paymentRef.trim(),
    });
    setSaving(false);
    if (error) {
      toast.error("Could not save payment reference.");
      console.error(error);
      return;
    }
    setStep("done");
  }

  function downloadPdf() {
    generateBlankRegistrationPdf(tenant, fees, batches);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 sm:py-20">
      <div className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--brand)" }}>
        Join {tenant.name}
      </div>
      <div className="mt-3 flex items-start justify-between gap-4">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">Register</h1>
        <button
          type="button"
          onClick={downloadPdf}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
        >
          <Download className="h-3.5 w-3.5" />
          Offline PDF form
        </button>
      </div>

      {/* Stepper */}
      <div className="mt-8 flex items-center gap-2 text-xs">
        <StepPill n={1} label="Details" active={step === "form"} done={step !== "form"} />
        <div className="h-px flex-1 bg-border" />
        <StepPill n={2} label="Pay" active={step === "payment"} done={step === "done"} />
        <div className="h-px flex-1 bg-border" />
        <StepPill n={3} label="Done" active={step === "done"} done={step === "done"} />
      </div>

      {step === "form" ? (
        <form onSubmit={submitForm} className="mt-10 space-y-5">
          <Field label="Student name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Date of birth" type="date" value={form.dob} onChange={(v) => setForm({ ...form, dob: v })} />
          <Field label="Guardian name" value={form.guardian_name} onChange={(v) => setForm({ ...form, guardian_name: v })} />
          <Field label="Guardian phone" value={form.guardian_phone} onChange={(v) => setForm({ ...form, guardian_phone: v })} />
          <Field label="Contact phone *" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
          <Field label="WhatsApp number" value={form.whatsapp} onChange={(v) => setForm({ ...form, whatsapp: v })} />

          {batches.length > 0 ? (
            <SelectField
              label="Batch"
              value={form.batch_id}
              onChange={(v) => setForm({ ...form, batch_id: v })}
              options={[{ value: "", label: "Select a batch" }, ...batches.map((b) => ({
                value: b.id, label: b.timing ? `${b.name} — ${b.timing}` : b.name,
              }))]}
            />
          ) : null}

          <SelectField
            label="Fee plan *"
            value={form.fee_plan_id}
            onChange={(v) => setForm({ ...form, fee_plan_id: v })}
            options={[{ value: "", label: "Select a plan" }, ...fees.map((f) => ({
              value: f.id,
              label: `${f.name} — ₹${f.amount.toLocaleString("en-IN")}${f.type === "monthly" ? "/mo" : ""}`,
            }))]}
          />

          <button
            type="submit"
            disabled={saving}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
            style={{ backgroundColor: "var(--brand)" }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Continue to payment
          </button>
        </form>
      ) : null}

      {step === "payment" ? (
        <div className="mt-10 space-y-6">
          <div className="rounded-2xl border border-border/60 bg-card p-6">
            <div className="text-sm text-muted-foreground">Amount to pay</div>
            <div className="mt-1 text-3xl font-bold text-foreground">
              ₹{((selectedFee?.amount ?? 0) + (regFee && regFee.id !== selectedFee?.id ? regFee.amount : 0)).toLocaleString("en-IN")}
            </div>
            <div className="mt-2 text-xs text-muted-foreground">
              {selectedFee?.name}
              {regFee && regFee.id !== selectedFee?.id ? ` + ${regFee.name}` : ""}
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-[auto_1fr] sm:items-center">
              {tenant.upi_qr_url ? (
                <img src={tenant.upi_qr_url} alt="UPI QR" className="h-40 w-40 rounded-lg border border-border" />
              ) : (
                <div className="flex h-40 w-40 items-center justify-center rounded-lg border border-dashed border-border bg-muted/40 text-center text-xs text-muted-foreground">
                  UPI QR not uploaded yet
                </div>
              )}
              <div className="text-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">UPI ID</div>
                <div className="mt-1 select-all text-lg font-mono font-semibold text-foreground">
                  {tenant.upi_id ?? "—"}
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  Pay via any UPI app (GPay, PhonePe, Paytm) to the ID above, then paste the transaction reference below.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={confirmPayment} className="space-y-4">
            <Field
              label="UPI transaction reference"
              value={paymentRef}
              onChange={setPaymentRef}
              placeholder="e.g. 4XXXXXXXXX12"
            />
            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white disabled:opacity-60"
              style={{ backgroundColor: "var(--brand)" }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              I have paid — submit
            </button>
          </form>
        </div>
      ) : null}

      {step === "done" ? (
        <div className="mt-10 rounded-2xl border border-border/60 bg-card p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: "var(--brand)" }}>
            <CheckCircle2 className="h-7 w-7 text-white" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-foreground">Registration submitted</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Your registration will be confirmed by {tenant.name} after payment verification. You'll usually
            hear back within a day.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function StepPill({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full border px-3 py-1 font-medium"
      style={{
        borderColor: active || done ? "var(--brand)" : "hsl(var(--border))",
        color: active || done ? "var(--brand)" : "hsl(var(--muted-foreground))",
      }}
    >
      <span className="tabular-nums">{done ? "✓" : n}</span>
      <span>{label}</span>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground shadow-sm outline-none focus:border-transparent focus:ring-2"
        style={{ boxShadow: "none" }}
        onFocus={(e) => (e.currentTarget.style.borderColor = "var(--brand)")}
        onBlur={(e) => (e.currentTarget.style.borderColor = "")}
      />
    </label>
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
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground shadow-sm outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
