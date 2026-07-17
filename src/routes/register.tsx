import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Download, Info, Loader2, MessageCircle } from "lucide-react";
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
import type { Batch, FeePlan } from "@/lib/tenant";
import { supabase } from "@/integrations/supabase/client";
import { checkRateLimit } from "@/lib/bulk-ops";
import { signedUrl } from "@/lib/storage";

// Policies that must be accepted before registration submits (if the academy
// has published them). Missing policies are silently skipped — never block
// registration on paperwork the academy hasn't uploaded yet.
const REQUIRED_POLICIES: PolicyKind[] = ["terms", "privacy", "fee", "medical"];

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

type RegisterSearch = { lead?: string };

export const Route = createFileRoute("/register")({
  validateSearch: (s: Record<string, unknown>): RegisterSearch => ({
    lead: typeof s.lead === "string" ? s.lead : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Register" },
      {
        name: "description",
        content: "Register online with your academy — no payment needed here.",
      },
      { property: "og:title", content: "Register" },
      {
        property: "og:description",
        content: "Register online with your academy — no payment needed here.",
      },
    ],
  }),
  component: () => (
    <TenantGate>
      <RegisterContent />
    </TenantGate>
  ),
});

// Formats a fee plan amount inline next to a batch label.
function formatFeeLabel(plan: FeePlan | undefined): string {
  if (!plan) return "";
  const cur = (plan.currency || "INR").toUpperCase();
  const sym = cur === "INR" ? "₹" : cur + " ";
  const cycle =
    plan.billing_cycle === "annual" || plan.type === "annual"
      ? "/year"
      : plan.billing_cycle === "quarterly"
        ? "/quarter"
        : plan.type === "registration"
          ? " (one-time)"
          : "/month";
  return `${sym}${plan.amount}${cycle}`;
}

// Best-effort mapping: given a batch, find the fee plan that represents its
// monthly (or recurring) fee. Uses keyword matching against active recurring plans.
function batchFeePlan(batch: Batch, fees: FeePlan[]): FeePlan | undefined {
  const monthly = fees.filter(
    (f) => f.type !== "registration" && (f.billing_cycle ?? "monthly") !== "annual",
  );
  const bn = (batch.name || "").toLowerCase();
  if (!bn) return undefined;
  // Personal coaching → look for a plan whose name mentions personal/coaching
  if (bn.includes("personal") || bn.includes("1-on-1") || bn.includes("one-on-one")) {
    return monthly.find((f) => {
      const fn = (f.name || "").toLowerCase();
      return fn.includes("personal") || fn.includes("coaching");
    });
  }
  // "Both" sessions (morning + evening) → prefer a plan named "both"
  const isBoth =
    bn.includes("both") ||
    (bn.includes("morning") && (bn.includes("eve") || bn.includes("evening")));
  if (isBoth) {
    const hit = monthly.find((f) => (f.name || "").toLowerCase().includes("both"));
    if (hit) return hit;
  } else {
    // Single-session batches (morning / evening / night) → prefer "single"
    const hit = monthly.find((f) => (f.name || "").toLowerCase().includes("single"));
    if (hit) return hit;
  }
  // Direct substring match either direction
  const direct = monthly.find((f) => {
    const fn = (f.name || "").toLowerCase();
    return fn && (fn.includes(bn) || bn.includes(fn));
  });
  if (direct) return direct;
  // Fall back to the tenant's default monthly plan
  return monthly[0];
}

function batchFeeText(batch: Batch, fees: FeePlan[]): string {
  const plan = batchFeePlan(batch, fees);
  return formatFeeLabel(plan) || "Contact academy";
}

function RegisterContent() {
  const tenant = useTenant();
  const { lead: leadId } = Route.useSearch();
  const { data: batches = [] } = useQuery(batchesQuery(tenant.id));
  const { data: fees = [] } = useQuery(feePlansQuery(tenant.id));
  const { data: policies = [] } = useQuery(publishedPoliciesQuery(tenant.id));

  const requiredPolicies = REQUIRED_POLICIES.map((kind) =>
    policies.find((p) => p.kind === kind),
  ).filter((p): p is PolicyDocument => Boolean(p));

  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [batchInfoOpen, setBatchInfoOpen] = useState(false);
  const [pdfHref, setPdfHref] = useState<string>("");

  const registrationPdfPath = ((tenant as unknown as { registration_pdf_url?: string | null })
    .registration_pdf_url ?? "") as string;

  useEffect(() => {
    let cancelled = false;
    if (!registrationPdfPath) {
      setPdfHref("");
      return;
    }
    signedUrl(registrationPdfPath).then((url) => {
      if (!cancelled) setPdfHref(url);
    });
    return () => {
      cancelled = true;
    };
  }, [registrationPdfPath]);

  const [form, setForm] = useState({
    name: "",
    guardian_name: "",
    phone: "",
    batch_id: "",
    dob: "",
    address: "",
    gender: "",
    height_cm: "",
    weight_kg: "",
    blood_group: "",
    batting_style: "",
    bowling_style: "",
    interests: "",
    medical_notes: "",
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
    return () => {
      cancelled = true;
    };
  }, [leadId, tenant.id]);

  const allRequiredAccepted = requiredPolicies.every((p) => accepted[p.id]);

  const batchOptions = useMemo(
    () => [
      { value: "", label: "No preference", right: "" },
      ...batches.map((b) => ({
        value: b.id,
        label: b.timing ? `${b.name} — ${b.timing}` : b.name,
        right: batchFeeText(b, fees),
      })),
    ],
    [batches, fees],
  );

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (
      !form.name.trim() ||
      !form.guardian_name.trim() ||
      !form.dob ||
      !form.gender ||
      !form.phone.trim()
    ) {
      toast.error("Please fill all required fields.");
      return;
    }
    if (!termsAccepted) {
      toast.error("Please accept the Terms & Conditions to continue.");
      return;
    }
    if (requiredPolicies.length > 0 && !allRequiredAccepted) {
      toast.error("Please accept the academy policies to continue.");
      return;
    }
    const defaultPlan =
      fees.find((f) => f.type === "monthly") ??
      fees.find((f) => f.type !== "registration") ??
      fees[0];
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
    const rlKey = `public-registration:${tenant.id}:${form.phone.trim()}`;
    const allowed = await checkRateLimit(rlKey, 3, 600);
    if (!allowed) {
      setSaving(false);
      toast.error("Too many submissions. Please try again in a few minutes.");
      return;
    }
    const { data, error } = await supabase.rpc(
      "submit_registration" as never,
      {
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
        _lead_id: leadId ?? null,
      } as never,
    );
    const extras: Record<string, unknown> = {};
    if (form.address.trim()) extras.address = form.address.trim();
    if (form.gender) extras.gender = form.gender;
    if (form.medical_notes.trim()) extras.medical_notes = form.medical_notes.trim();
    const profile: Record<string, unknown> = {};
    if (form.height_cm.trim()) profile.height_cm = Number(form.height_cm) || form.height_cm.trim();
    if (form.weight_kg.trim()) profile.weight_kg = Number(form.weight_kg) || form.weight_kg.trim();
    if (form.blood_group) profile.blood_group = form.blood_group;
    if (form.batting_style) profile.batting_style = form.batting_style;
    if (form.bowling_style) profile.bowling_style = form.bowling_style;
    if (form.interests) profile.interests = form.interests;
    profile.terms_accepted = true;
    profile.terms_accepted_at = now;
    profile.sport = "cricket";
    if (Object.keys(profile).length > 0) {
      extras.documents = { profile };
    }
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

  const wa = (tenant.whatsapp ?? tenant.phone ?? "").replace(/[^\d]/g, "");
  const waMsg = encodeURIComponent(
    `Hi ${tenant.name}, I just registered ${form.name} for training. Please share the next steps.`,
  );
  const waHref = wa ? `https://wa.me/${wa}?text=${waMsg}` : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-16">
      <div
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: "var(--brand)" }}
      >
        Join {tenant.name}
      </div>
      <div className="mt-3 flex items-start justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Register</h1>
        {pdfHref ? (
          <a
            href={pdfHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-xs font-medium text-foreground hover:bg-muted"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Offline PDF form</span>
            <span className="sm:hidden">PDF</span>
          </a>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        Fill in a few details — no payment needed here. The coach will confirm your spot on
        WhatsApp.
      </p>

      {!done ? (
        <form onSubmit={submitForm} className="mt-8 space-y-6">
          {/* Section 1 — Basic details */}
          <Section title="Basic details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Student name *"
                value={form.name}
                onChange={(v) => setForm({ ...form, name: v })}
              />
              <Field
                label="Parent / guardian name *"
                value={form.guardian_name}
                onChange={(v) => setForm({ ...form, guardian_name: v })}
              />
              <Field
                label="Date of birth *"
                type="date"
                value={form.dob}
                onChange={(v) => setForm({ ...form, dob: v })}
              />
              <SelectField
                label="Gender *"
                value={form.gender}
                onChange={(v) => setForm({ ...form, gender: v })}
                options={[
                  { value: "", label: "Select gender" },
                  { value: "male", label: "Male" },
                  { value: "female", label: "Female" },
                ]}
              />
              <Field
                label="Contact number *"
                value={form.phone}
                onChange={(v) => setForm({ ...form, phone: v })}
                placeholder="10-digit mobile"
              />
              {batches.length > 0 ? (
                <BatchSelect
                  value={form.batch_id}
                  onChange={(v) => setForm({ ...form, batch_id: v })}
                  options={batchOptions}
                  onInfo={() => setBatchInfoOpen(true)}
                />
              ) : null}
            </div>
            {batches.length > 0 ? (
              <FeeSummary
                batch={batches.find((b) => b.id === form.batch_id)}
                fees={fees}
              />
            ) : null}
          </Section>

          {/* Section 3 — Physical details */}
          <Section title="Physical details">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="Height (cm)"
                type="number"
                value={form.height_cm}
                onChange={(v) => setForm({ ...form, height_cm: v })}
                placeholder="e.g. 165"
              />
              <Field
                label="Weight (kg)"
                type="number"
                value={form.weight_kg}
                onChange={(v) => setForm({ ...form, weight_kg: v })}
                placeholder="e.g. 55"
              />
              <SelectField
                label="Blood group"
                value={form.blood_group}
                onChange={(v) => setForm({ ...form, blood_group: v })}
                options={[
                  { value: "", label: "Select" },
                  ...BLOOD_GROUPS.map((g) => ({ value: g, label: g })),
                ]}
              />
            </div>
          </Section>

          {/* Section 4 — Cricket profile */}
          <Section title="Cricket profile">
            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField
                label="Batting style"
                value={form.batting_style}
                onChange={(v) => setForm({ ...form, batting_style: v })}
                options={[
                  { value: "", label: "Not sure yet" },
                  { value: "right-hand", label: "Right hand" },
                  { value: "left-hand", label: "Left hand" },
                ]}
              />
              <SelectField
                label="Bowling style"
                value={form.bowling_style}
                onChange={(v) => setForm({ ...form, bowling_style: v })}
                options={[
                  { value: "", label: "Not sure yet" },
                  { value: "right-arm", label: "Right arm" },
                  { value: "left-arm", label: "Left arm" },
                ]}
              />
              <SelectField
                label="Playing role"
                value={form.interests}
                onChange={(v) => setForm({ ...form, interests: v })}
                options={[
                  { value: "", label: "Not sure yet" },
                  { value: "batter", label: "Batter" },
                  { value: "bowler", label: "Bowler" },
                  { value: "all-rounder", label: "All rounder" },
                  { value: "wicket-keeper-batter", label: "Wicketkeeper batsman" },
                ]}
              />
            </div>
          </Section>

          {/* Section 5 — Address */}
          <Section title="Address">
            <TextArea
              label="Full address"
              value={form.address}
              onChange={(v) => setForm({ ...form, address: v })}
            />
          </Section>

          {/* Section 6 — Medical */}
          <Section title="Medical (optional)">
            <TextArea
              label="Allergies, conditions or other notes"
              value={form.medical_notes}
              onChange={(v) => setForm({ ...form, medical_notes: v })}
            />
          </Section>

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
                      onChange={(e) =>
                        setAccepted((prev) => ({ ...prev, [p.id]: e.target.checked }))
                      }
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

          <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-border"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
              />
              <span className="text-sm text-foreground">
                I / We accept the{" "}
                <Link
                  to="/policies/$kind"
                  params={{ kind: "terms" }}
                  target="_blank"
                  className="font-medium underline"
                  style={{ color: "var(--brand)" }}
                >
                  Terms &amp; Conditions
                </Link>{" "}
                of {tenant.name}, including fees, refunds, code of conduct and use of images /
                videos.
              </span>
            </label>
          </div>

          <div className="sticky bottom-4 z-10 pt-2">
            <button
              type="submit"
              disabled={
                saving ||
                !termsAccepted ||
                (requiredPolicies.length > 0 && !allRequiredAccepted)
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold text-white shadow-lg disabled:opacity-60"
              style={{ backgroundColor: "var(--brand)" }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Submit registration
            </button>
          </div>
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

      {batchInfoOpen ? (
        <BatchInfoDialog
          batches={batches}
          fees={fees}
          onClose={() => setBatchInfoOpen(false)}
        />
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/40 p-4 sm:p-5">
      <div className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      {children}
    </section>
  );
}

function BatchSelect({
  value,
  onChange,
  options,
  onInfo,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; right: string }[];
  onInfo: () => void;
}) {
  const selected = options.find((o) => o.value === value);
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Preferred batch *
        </span>
        <button
          type="button"
          onClick={onInfo}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Info className="h-3.5 w-3.5" /> Fee details
        </button>
      </div>
      <div className="relative mt-1.5">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="block w-full appearance-none rounded-lg border border-border bg-background px-3 py-2.5 pr-24 text-sm text-foreground shadow-sm outline-none"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.right ? `${o.label}  •  ${o.right}` : o.label}
            </option>
          ))}
        </select>
        {selected?.right ? (
          <span
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ backgroundColor: "color-mix(in oklab, var(--brand) 12%, transparent)", color: "var(--brand)" }}
          >
            {selected.right}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function FeeSummary({ batch, fees }: { batch: Batch | undefined; fees: FeePlan[] }) {
  const registration = fees.find((f) => f.type === "registration");
  const monthly = batch ? batchFeePlan(batch, fees) : undefined;
  const cur = (registration?.currency || monthly?.currency || "INR").toUpperCase();
  const sym = cur === "INR" ? "₹" : cur + " ";
  const fmt = (n: number | undefined) => (n == null ? "—" : `${sym}${n}`);
  const bn = (batch?.name || "").toLowerCase();
  const isPersonal =
    bn.includes("personal") || bn.includes("1-on-1") || bn.includes("one-on-one");
  const monthlyText = !batch
    ? "Select a batch to see monthly fee"
    : isPersonal && !monthly
      ? "Contact academy"
      : monthly
        ? fmt(monthly.amount)
        : "Contact academy";
  const total =
    !isPersonal && monthly && registration ? monthly.amount + registration.amount : null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        Fees
      </span>
      <span className="flex items-baseline gap-1.5">
        <span className="text-muted-foreground">Admission</span>
        <span className="font-semibold text-foreground">{fmt(registration?.amount)}</span>
      </span>
      <span className="text-border">•</span>
      <span className="flex items-baseline gap-1.5">
        <span className="text-muted-foreground">Monthly</span>
        <span className="font-semibold text-foreground">{monthlyText}</span>
      </span>
      {total != null ? (
        <span className="ml-auto flex items-baseline gap-1.5">
          <span className="text-muted-foreground">Due at joining</span>
          <span className="font-semibold text-foreground">{fmt(total)}</span>
        </span>
      ) : null}
    </div>
  );
}

function BatchInfoDialog({
  batches,
  fees,
  onClose,
}: {
  batches: Batch[];
  fees: FeePlan[];
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-background p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-semibold text-foreground">Available batches</div>
        <ul className="mt-3 divide-y divide-border/60">
          {batches.map((b) => (
            <li key={b.id} className="flex items-start justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">{b.name}</div>
                {b.timing ? (
                  <div className="text-xs text-muted-foreground">{b.timing}</div>
                ) : null}
              </div>
              <div
                className="shrink-0 text-sm font-semibold"
                style={{ color: "var(--brand)" }}
              >
                {batchFeeText(b, fees)}
              </div>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onClose}
          className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
        >
          Close
        </button>
      </div>
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
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
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
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
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
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground shadow-sm outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
