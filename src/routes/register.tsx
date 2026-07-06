import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Copy, Download, Loader2, MessageCircle } from "lucide-react";
import { TenantGate } from "@/components/site/TenantGate";
import { useTenant } from "@/lib/tenant-context";
import { batchesQuery, feePlansQuery } from "@/lib/site-queries";
import { supabase } from "@/integrations/supabase/client";
import { generateBlankRegistrationPdf } from "@/lib/registration-pdf";
import { upiQrDataUrl } from "@/lib/upi";

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
  const amount = (selectedFee?.amount ?? 0) + (regFee && regFee.id !== selectedFee?.id ? regFee.amount : 0);

  // Generate QR when we hit the payment step
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  useEffect(() => {
    if (step !== "payment") return;
    if (tenant.upi_qr_url) return; // uploaded QR wins
    if (!tenant.upi_id) return;
    let active = true;
    upiQrDataUrl(
      { upiId: tenant.upi_id, name: tenant.name, amount, note: `Registration - ${form.name}`.slice(0, 40) },
      tenant.primary_color,
    ).then((u) => { if (active) setQrDataUrl(u); }).catch(() => {});
    return () => { active = false; };
  }, [step, tenant.upi_id, tenant.upi_qr_url, tenant.name, tenant.primary_color, amount, form.name]);

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.fee_plan_id) {
      toast.error("Please fill name, phone and fee plan.");
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.rpc("submit_registration" as never, {
      _tenant_id: tenant.id,
      _name: form.name.trim(),
      _phone: form.phone.trim(),
      _fee_plan_id: form.fee_plan_id,
      _batch_id: form.batch_id || null,
      _dob: form.dob || null,
      _guardian_name: form.guardian_name.trim() || null,
      _guardian_phone: form.guardian_phone.trim() || null,
      _whatsapp: form.whatsapp.trim() || null,
    } as never);
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not submit. Please try again.");
      console.error(error);
      return;
    }
    setRegId(data as unknown as string);
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
    const { error } = await supabase.rpc("attach_payment_ref" as never, {
      _registration_id: regId,
      _payment_ref: paymentRef.trim(),
    } as never);
    setSaving(false);
    if (error) {
      toast.error(error.message ?? "Could not save payment reference.");
      console.error(error);
      return;
    }
    setStep("done");
  }


  function downloadPdf() {
    generateBlankRegistrationPdf(tenant, fees, batches);
  }

  function copyUpi() {
    if (!tenant.upi_id) return;
    navigator.clipboard.writeText(tenant.upi_id).then(
      () => toast.success("UPI ID copied"),
      () => toast.error("Could not copy"),
    );
  }

  const wa = (tenant.whatsapp ?? tenant.phone ?? "").replace(/[^\d]/g, "");
  const waHref = wa
    ? `https://wa.me/${wa}?text=${encodeURIComponent(
        `Hi ${tenant.name}, I just registered (${form.name}). My UPI transaction reference is ${paymentRef}. Please confirm.`,
      )}`
    : null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-20">
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
          <span className="hidden sm:inline">Offline PDF form</span>
          <span className="sm:hidden">PDF</span>
        </button>
      </div>

      {/* Stepper */}
      <div className="mt-8 grid grid-cols-3 gap-2 sm:gap-3">
        <StepPill n={1} label="Fill form" active={step === "form"} done={step !== "form"} />
        <StepPill n={2} label="Pay via UPI" active={step === "payment"} done={step === "done"} />
        <StepPill n={3} label="Enter reference" active={step === "done"} done={step === "done"} />
      </div>

      {step === "form" ? (
        <form onSubmit={submitForm} className="mt-10 space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
        <div className="mt-10 space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Amount to pay</div>
            <div className="mt-1 text-4xl font-bold text-foreground">
              ₹{amount.toLocaleString("en-IN")}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {selectedFee?.name}
              {regFee && regFee.id !== selectedFee?.id ? ` + ${regFee.name}` : ""}
            </div>

            <div className="mt-6 flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <div className="rounded-2xl border border-border bg-white p-3 shadow-inner">
                {tenant.upi_qr_url ? (
                  <img src={tenant.upi_qr_url} alt="UPI QR" className="h-44 w-44 object-contain" />
                ) : qrDataUrl ? (
                  <img src={qrDataUrl} alt="UPI QR" className="h-44 w-44 object-contain" />
                ) : tenant.upi_id ? (
                  <div className="grid h-44 w-44 place-items-center text-xs text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : (
                  <div className="grid h-44 w-44 place-items-center text-center text-xs text-muted-foreground">
                    UPI not configured
                  </div>
                )}
              </div>
              <div className="flex-1 text-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">UPI ID</div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="select-all break-all font-mono text-base font-semibold text-foreground">
                    {tenant.upi_id ?? "—"}
                  </span>
                  {tenant.upi_id ? (
                    <button
                      type="button"
                      onClick={copyUpi}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-foreground hover:bg-muted"
                    >
                      <Copy className="h-3 w-3" /> Copy
                    </button>
                  ) : null}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Scan with any UPI app (GPay, PhonePe, Paytm). Amount is pre-filled.
                  After payment, copy the transaction reference below.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={confirmPayment} className="space-y-4">
            <Field
              label="UPI transaction reference *"
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
        <div className="mt-10 rounded-2xl border border-border/60 bg-card p-8 text-center shadow-sm animate-in fade-in zoom-in-95 duration-300">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: "var(--brand)" }}>
            <CheckCircle2 className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-foreground">Registration submitted 🎉</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Your registration will be confirmed by {tenant.name} after payment verification.
            You'll usually hear back within a day.
          </p>
          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-white shadow-md hover:opacity-95"
            >
              <MessageCircle className="h-4 w-4" fill="currentColor" />
              Send confirmation on WhatsApp
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function StepPill({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  const on = active || done;
  return (
    <div
      className="flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium transition-colors"
      style={{
        borderColor: on ? "var(--brand)" : "hsl(var(--border))",
        color: on ? "var(--brand)" : "hsl(var(--muted-foreground))",
        backgroundColor: active ? "color-mix(in oklab, var(--brand) 8%, transparent)" : "transparent",
      }}
    >
      <span
        className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold tabular-nums text-white"
        style={{ backgroundColor: on ? "var(--brand)" : "hsl(var(--muted-foreground))" }}
      >
        {done ? "✓" : n}
      </span>
      <span className="truncate">{label}</span>
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
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
  label, value, onChange, options,
}: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
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
