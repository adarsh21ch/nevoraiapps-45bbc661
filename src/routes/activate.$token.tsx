import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getActivationDetails, claimActivation } from "@/lib/admissions/activation.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2, Clock, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { AcademyLogo } from "@/components/auth/AcademyLogo";


export const Route = createFileRoute("/activate/$token")({
  head: () => ({
    meta: [
      { title: "Activate your account" },
      { name: "description", content: "Create your login and finish your academy profile." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ActivatePage,
});

type Details = Awaited<ReturnType<typeof getActivationDetails>> extends never
  ? any
  : any;

const GENDERS = [
  { value: "", label: "Select…" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

function ActivatePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const load = useServerFn(getActivationDetails);
  const claim = useServerFn(claimActivation);

  const [details, setDetails] = useState<Details | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "claimed" | "expired" | "invalid" | "error">("loading");
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string>("");
  const [done, setDone] = useState(false);

  const [creds, setCreds] = useState({ email: "", password: "", password2: "" });
  const [form, setForm] = useState({
    phone: "",
    dob: "",
    gender: "",
    address: "",
    city: "",
    guardian_name: "",
    guardian_phone: "",
    emergency_contact_name: "",
    emergency_contact_phone: "",
    blood_group: "",
    school_college: "",
    playing_role: "",
    batting_style: "",
    bowling_style: "",
    medical_notes: "",
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res: any = await load({ data: { token } });
        if (cancelled) return;
        if (res.status !== "ok") {
          setStatus(res.status);
          return;
        }
        setDetails(res);
        setCreds((c) => ({ ...c, email: res.student.email || "" }));
        setForm((f) => ({
          ...f,
          phone: res.student.phone || "",
          dob: res.student.dob || "",
          gender: res.student.gender || "",
          address: res.student.address || "",
          city: res.student.city || "",
          guardian_name: res.student.guardian_name || "",
          guardian_phone: res.student.guardian_phone || "",
          emergency_contact_name: res.student.emergency_contact_name || "",
          emergency_contact_phone: res.student.emergency_contact_phone || "",
          blood_group: res.student.blood_group || "",
          school_college: res.student.school_college || "",
          playing_role: res.student.playing_role || "",
          batting_style: res.student.batting_style || "",
          bowling_style: res.student.bowling_style || "",
          medical_notes: res.student.medical_notes || "",
        }));
        setStatus("ok");
      } catch {
        if (!cancelled) setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, load]);

  const brand = details?.tenant?.primary_color || undefined;
  const brandStyle = useMemo(
    () => (brand ? ({ ["--brand" as any]: brand } as React.CSSProperties) : undefined),
    [brand],
  );

  const validateCreds = () => {
    const e: Record<string, string> = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(creds.email.trim())) e.email = "Enter a valid email";
    if (creds.password.length < 8) e.password = "At least 8 characters";
    if (creds.password !== creds.password2) e.password2 = "Passwords don't match";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateProfile = () => {
    const e: Record<string, string> = {};
    if (!form.phone.replace(/\D/g, "")) e.phone = "Contact number is required";
    if (!form.dob) e.dob = "Date of birth is required";
    if (!form.gender) e.gender = "Select gender";
    if (!form.address.trim()) e.address = "Address is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    if (!validateProfile()) return;
    setBusy(true);
    setBanner("");
    try {
      const res: any = await claim({
        data: { token, email: creds.email.trim().toLowerCase(), password: creds.password, profile: form },
      });
      if (!res.ok) {
        const map: Record<string, string> = {
          email_in_use: "That email already has an account. Use a different email, or sign in instead.",
          claimed: "This link has already been used.",
          expired: "This link has expired — ask your academy for a new one.",
          invalid: "This link isn't valid.",
        };
        setBanner(map[res.reason] ?? res.message ?? "Something went wrong. Please try again.");
        if (res.reason === "email_in_use") setStep(1);
        setBusy(false);
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({
        email: creds.email.trim().toLowerCase(),
        password: creds.password,
      });
      setDone(true);
      setBusy(false);
      setTimeout(() => navigate({ to: error ? "/auth" : "/student" }), 1200);
    } catch (err: any) {
      setBanner(err?.message ?? "Something went wrong. Please try again.");
      setBusy(false);
    }
  };

  if (status === "loading") {
    return (
      <Centered>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Checking your link…
        </div>
      </Centered>
    );
  }

  if (status !== "ok") {
    const copy = {
      claimed: {
        icon: <CheckCircle2 className="size-10 text-emerald-500" />,
        title: "Already activated",
        body: "This account is already set up. Sign in with your email or mobile number.",
        cta: "Go to sign in",
      },
      expired: {
        icon: <Clock className="size-10 text-amber-500" />,
        title: "Link expired",
        body: "Ask your academy to send you a fresh activation link.",
        cta: "Back to sign in",
      },
      invalid: {
        icon: <XCircle className="size-10 text-destructive" />,
        title: "Invalid link",
        body: "This activation link isn't valid. Please check with your academy.",
        cta: "Back to sign in",
      },
      error: {
        icon: <XCircle className="size-10 text-destructive" />,
        title: "Something went wrong",
        body: "We couldn't check this link. Please try again in a moment.",
        cta: "Back to sign in",
      },
    }[status];
    return (
      <Centered>
        <div className="flex flex-col items-center gap-3 text-center">
          {copy.icon}
          <h1 className="text-lg font-semibold">{copy.title}</h1>
          <p className="text-sm text-muted-foreground">{copy.body}</p>
          <Button asChild className="mt-2 rounded-full">
            <Link to="/auth">{copy.cta}</Link>
          </Button>
        </div>
      </Centered>
    );
  }

  if (done) {
    return (
      <Centered>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 className="size-12 text-emerald-500" />
          <h1 className="text-lg font-semibold">You're all set!</h1>
          <p className="text-sm text-muted-foreground">Taking you to your dashboard…</p>
        </div>
      </Centered>
    );
  }

  const t = details.tenant;

  return (
    <div className="min-h-dvh bg-muted/30" style={brandStyle}>
      {/* Sticky branded header */}
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
          <AcademyLogo
            path={t.logo_url}
            name={t.name}
            initials={t.name.slice(0, 1)}
            accent={brand ?? "hsl(var(--primary))"}
            className="size-9"
          />

          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{t.name}</div>
            <div className="text-[11px] text-muted-foreground">Student account activation</div>
          </div>
        </div>
        <div className="h-1 w-full bg-muted">
          <div
            className="h-1 transition-all"
            style={{ width: step === 1 ? "50%" : "100%", backgroundColor: brand ?? "hsl(var(--primary))" }}
          />
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-32 pt-5">
        {/* Identity card */}
        <div className="rounded-2xl border border-border/60 bg-background p-4 shadow-sm">
          <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Enrolled by your academy
          </div>
          <div className="mt-1 text-lg font-semibold">{details.student.name}</div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {details.session ? (
              <span className="rounded-full bg-muted px-2.5 py-1">
                {details.session.name}
                {details.session.timing ? ` · ${details.session.timing}` : ""}
              </span>
            ) : null}
            {details.feePlan ? (
              <span className="rounded-full bg-muted px-2.5 py-1">
                {details.feePlan.name} · ₹{details.feePlan.amount.toLocaleString("en-IN")}
              </span>
            ) : null}
          </div>
        </div>

        {banner ? (
          <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {banner}
          </div>
        ) : null}

        {step === 1 ? (
          <section className="mt-4 space-y-4 rounded-2xl border border-border/60 bg-background p-4 shadow-sm">
            <div>
              <h2 className="text-base font-semibold">Create your login</h2>
              <p className="text-xs text-muted-foreground">
                You'll use this to check attendance, fees and match stats.
              </p>
            </div>
            <Field
              label="Email *"
              type="email"
              value={creds.email}
              onChange={(v) => setCreds({ ...creds, email: v })}
              placeholder="you@example.com"
              error={errors.email}
              autoComplete="email"
            />
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Password *
              </span>
              <div className="relative mt-1.5">
                <input
                  type={showPw ? "text" : "password"}
                  value={creds.password}
                  onChange={(e) => setCreds({ ...creds, password: e.target.value })}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className={cn(
                    "block w-full rounded-lg border bg-background px-3 py-2.5 pr-11 text-sm outline-none",
                    errors.password ? "border-red-500" : "border-border",
                  )}
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {errors.password ? (
                <span className="mt-1 block text-xs text-red-600">{errors.password}</span>
              ) : null}
            </label>
            <Field
              label="Confirm password *"
              type="password"
              value={creds.password2}
              onChange={(v) => setCreds({ ...creds, password2: v })}
              placeholder="Re-enter password"
              error={errors.password2}
              autoComplete="new-password"
            />
            <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
              <ShieldCheck className="mt-px size-3.5 shrink-0" />
              Only you know this password. You can change it anytime from your profile.
            </p>
          </section>
        ) : (
          <section className="mt-4 space-y-4 rounded-2xl border border-border/60 bg-background p-4 shadow-sm">
            <div>
              <h2 className="text-base font-semibold">Complete your details</h2>
              <p className="text-xs text-muted-foreground">
                Your name and session are already set by the academy.
              </p>
            </div>
            <Field label="Contact number *" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} inputMode="tel" placeholder="10-digit mobile" error={errors.phone} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Date of birth *" type="date" value={form.dob} onChange={(v) => setForm({ ...form, dob: v })} error={errors.dob} />
              <SelectField label="Gender *" value={form.gender} onChange={(v) => setForm({ ...form, gender: v })} options={GENDERS} error={errors.gender} />
            </div>
            <TextArea label="Full address *" value={form.address} onChange={(v) => setForm({ ...form, address: v })} error={errors.address} />
            <Field label="City" value={form.city} onChange={(v) => setForm({ ...form, city: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Parent / guardian name" value={form.guardian_name} onChange={(v) => setForm({ ...form, guardian_name: v })} />
              <Field label="Guardian phone" value={form.guardian_phone} onChange={(v) => setForm({ ...form, guardian_phone: v })} inputMode="tel" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Emergency contact" value={form.emergency_contact_name} onChange={(v) => setForm({ ...form, emergency_contact_name: v })} />
              <Field label="Emergency phone" value={form.emergency_contact_phone} onChange={(v) => setForm({ ...form, emergency_contact_phone: v })} inputMode="tel" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Blood group" value={form.blood_group} onChange={(v) => setForm({ ...form, blood_group: v })} placeholder="O+" />
              <Field label="School / college" value={form.school_college} onChange={(v) => setForm({ ...form, school_college: v })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Batting style" value={form.batting_style} onChange={(v) => setForm({ ...form, batting_style: v })} placeholder="Right-hand" />
              <Field label="Bowling style" value={form.bowling_style} onChange={(v) => setForm({ ...form, bowling_style: v })} placeholder="Right-arm medium" />
            </div>
            <Field label="Playing role" value={form.playing_role} onChange={(v) => setForm({ ...form, playing_role: v })} placeholder="Batter / Bowler / All-rounder" />
            <TextArea label="Allergies, conditions or other notes" value={form.medical_notes} onChange={(v) => setForm({ ...form, medical_notes: v })} />
          </section>
        )}
      </main>

      {/* Sticky footer nav */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border/60 bg-background/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          {step === 2 ? (
            <Button variant="outline" className="flex-1 rounded-full" onClick={() => setStep(1)} disabled={busy}>
              Back
            </Button>
          ) : null}
          <Button
            className="flex-1 rounded-full text-white"
            style={{ backgroundColor: brand ?? undefined }}
            disabled={busy}
            onClick={() => {
              if (step === 1) {
                if (validateCreds()) {
                  setErrors({});
                  setStep(2);
                }
              } else {
                void submit();
              }
            }}
          >
            {busy ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" /> Creating account…
              </>
            ) : step === 1 ? (
              "Continue"
            ) : (
              "Finish & enter dashboard"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-muted/30 p-6">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-background p-6 shadow-sm">
        {children}
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
  error,
  inputMode,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        aria-invalid={error ? true : undefined}
        className={cn(
          "mt-1.5 block w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground outline-none",
          error ? "border-red-500" : "border-border",
        )}
      />
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        aria-invalid={error ? true : undefined}
        className={cn(
          "mt-1.5 block w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground outline-none",
          error ? "border-red-500" : "border-border",
        )}
      />
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error ? true : undefined}
        className={cn(
          "mt-1.5 block w-full rounded-lg border bg-background px-3 py-2.5 text-sm text-foreground outline-none",
          error ? "border-red-500" : "border-border",
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
