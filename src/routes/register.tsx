import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Download, Loader2, MessageCircle } from "lucide-react";
import { TenantGate } from "@/components/site/TenantGate";
import { useTenant } from "@/lib/tenant-context";
import {
  batchesQuery,
  feePlansQuery,
  publishedPoliciesQuery,
  POLICY_LABELS,
  type PolicyDocument,
  type PolicyKind,
} from "@/lib/site-queries";
import { supabase } from "@/integrations/supabase/client";
import { generateBlankRegistrationPdf } from "@/lib/registration-pdf";

// Policies that must be accepted before registration submits (if the academy
// has published them). Missing policies are silently skipped — never block
// registration on paperwork the academy hasn't uploaded yet.
const REQUIRED_POLICIES: PolicyKind[] = ["terms", "privacy", "fee", "medical"];

type RegisterSearch = { lead?: string };

export const Route = createFileRoute("/register")({
  validateSearch: (s: Record<string, unknown>): RegisterSearch => ({
    lead: typeof s.lead === "string" ? s.lead : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Register" },
      { name: "description", content: "Register online with your academy — no payment needed here." },
      { property: "og:title", content: "Register" },
      { property: "og:description", content: "Register online with your academy — no payment needed here." },
    ],
  }),
  component: () => (
    <TenantGate>
      <RegisterContent />
    </TenantGate>
  ),
});

function RegisterContent() {
  const tenant = useTenant();
  const { lead: leadId } = Route.useSearch();
  const { data: batches = [] } = useQuery(batchesQuery(tenant.id));
  const { data: fees = [] } = useQuery(feePlansQuery(tenant.id));
  const { data: policies = [] } = useQuery(publishedPoliciesQuery(tenant.id));

  const requiredPolicies = REQUIRED_POLICIES
    .map((kind) => policies.find((p) => p.kind === kind))
    .filter((p): p is PolicyDocument => Boolean(p));

  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState({
    name: "",
    guardian_name: "",
    phone: "",
    batch_id: "",
    dob: "",
    address: "",
    gender: "",
  });

  // Prefill from originating lead when arriving via /register?lead=<id>
  useEffect(() => {
    if (!leadId) return;
    let cancelled = false;
    supabase
      .from("leads")
      .select("name, phone, message, tenant_id")
      .eq("id", leadId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data || data.tenant_id !== tenant.id) return;
        setForm((f) => ({
          ...f,
          name: f.name || data.name || "",
          phone: f.phone || data.phone || "",
        }));
      });
    return () => { cancelled = true; };
  }, [leadId, tenant.id]);

  const allRequiredAccepted = requiredPolicies.every((p) => accepted[p.id]);

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim()) {
      toast.error("Please fill name and phone.");
      return;
    }
    if (requiredPolicies.length > 0 && !allRequiredAccepted) {
      toast.error("Please accept the academy policies to continue.");
      return;
    }
    const defaultPlan =
      fees.find((f) => f.type === "monthly") ?? fees.find((f) => f.type !== "registration") ?? fees[0];
    if (!defaultPlan) {
      toast.error("Registrations aren't set up yet. Please contact the academy directly.");
      return;
    }

    const now = new Date().toISOString();
    const acceptances = requiredPolicies.map((p) => ({
      policy_id: p.id,
      kind: p.kind,
      version: p.version,
      accepted_at: now,
    }));

    setSaving(true);
    const { data, error } = await supabase.rpc("submit_registration" as never, {
      _tenant_id: tenant.id,
      _name: form.name.trim(),
      _phone: form.phone.trim(),
      _fee_plan_id: defaultPlan.id,
      _batch_id: form.batch_id || null,
      _dob: form.dob || null,
      _guardian_name: form.guardian_name.trim() || null,
      _guardian_phone: null,
      _whatsapp: null,
      _policy_acceptances: acceptances as unknown as never,
    } as never);
    const extras: Record<string, string> = {};
    if (form.address.trim()) extras.address = form.address.trim();
    if (form.gender) extras.gender = form.gender;
    if (!error && data && Object.keys(extras).length > 0) {
      await supabase
        .from("registrations")
        .update(extras as never)
        .eq("id", data as unknown as string);
    }
    setSaving(false);
    if (error || !data) {
      toast.error(error?.message ?? "Could not submit. Please try again.");
      console.error(error);
      return;
    }
    setDone(true);
  }

  function downloadPdf() {
    generateBlankRegistrationPdf(tenant, fees, batches);
  }


  const wa = (tenant.whatsapp ?? tenant.phone ?? "").replace(/[^\d]/g, "");
  const waMsg = encodeURIComponent(
    `Hi ${tenant.name}, I just registered ${form.name} for training. Please share the next steps.`,
  );
  const waHref = wa ? `https://wa.me/${wa}?text=${waMsg}` : null;

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
      <p className="mt-3 text-sm text-muted-foreground">
        Fill in a few details — no payment needed here. The coach will confirm your spot on WhatsApp.
      </p>

      {!done ? (
        <form onSubmit={submitForm} className="mt-8 space-y-5">
          <Field label="Student name *" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Parent / guardian name" value={form.guardian_name} onChange={(v) => setForm({ ...form, guardian_name: v })} />
          <Field label="Contact phone *" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="10-digit mobile" />
          {batches.length > 0 ? (
            <SelectField
              label="Preferred batch"
              value={form.batch_id}
              onChange={(v) => setForm({ ...form, batch_id: v })}
              options={[
                { value: "", label: "No preference" },
                ...batches.map((b) => ({
                  value: b.id,
                  label: b.timing ? `${b.name} — ${b.timing}` : b.name,
                })),
              ]}
            />
          ) : null}
          <Field label="Date of birth" type="date" value={form.dob} onChange={(v) => setForm({ ...form, dob: v })} />
          <SelectField
            label="Gender"
            value={form.gender}
            onChange={(v) => setForm({ ...form, gender: v })}
            options={[
              { value: "", label: "Prefer not to say" },
              { value: "male", label: "Male" },
              { value: "female", label: "Female" },
              { value: "other", label: "Other" },
            ]}
          />
          <TextArea label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />

          {requiredPolicies.length > 0 ? (
            <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Academy policies
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Please read and accept the following before submitting.
              </p>
              <ul className="mt-3 space-y-2">
                {requiredPolicies.map((p) => (
                  <li key={p.id} className="flex items-start gap-2">
                    <input
                      id={`acc-${p.id}`}
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-border"
                      checked={!!accepted[p.id]}
                      onChange={(e) => setAccepted((prev) => ({ ...prev, [p.id]: e.target.checked }))}
                    />
                    <label htmlFor={`acc-${p.id}`} className="text-sm text-foreground">
                      I accept the{" "}
                      <Link
                        to="/policies/$kind"
                        params={{ kind: p.kind }}
                        target="_blank"
                        className="font-medium underline"
                        style={{ color: "var(--brand)" }}
                      >
                        {p.title || POLICY_LABELS[p.kind]}
                      </Link>{" "}
                      <span className="text-xs text-muted-foreground">(v{p.version})</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={saving || (requiredPolicies.length > 0 && !allRequiredAccepted)}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
            style={{ backgroundColor: "var(--brand)" }}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit registration
          </button>
        </form>
      ) : (
        <div className="mt-10 rounded-2xl border border-border/60 bg-card p-8 text-center shadow-sm">
          <div
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
            style={{ backgroundColor: "var(--brand)" }}
          >
            <CheckCircle2 className="h-8 w-8 text-white" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-foreground">Registration submitted 🎉</h2>
          <p className="mt-3 text-sm text-muted-foreground">
            {tenant.name} will get in touch shortly. Tap the button below to say hi on WhatsApp.
          </p>
          {waHref ? (
            <a
              href={waHref}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-3 text-sm font-semibold text-white shadow-md hover:opacity-95"
            >
              <MessageCircle className="h-4 w-4" fill="currentColor" />
              Message us on WhatsApp
            </a>
          ) : null}
        </div>
      )}
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

function TextArea({
  label, value, onChange,
}: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground shadow-sm outline-none focus:border-transparent focus:ring-2"
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
