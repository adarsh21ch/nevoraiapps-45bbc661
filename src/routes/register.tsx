import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, Download, Info, Loader2, MessageCircle, Eye, EyeOff, Lock, X, Upload, FileCheck, MapPin, Building2, Map as MapIcon } from "lucide-react";
import { TenantGate } from "@/components/site/TenantGate";
import { StoragedImage } from "@/components/site/StoragedImage";
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
import { signedUrl, uploadTenantFile } from "@/lib/storage";
import { toE164 } from "@/lib/phone";
import { attachPhoneToApplicant } from "@/lib/registration/attach-phone.functions";
import { cleanupOrphanedApplicant } from "@/lib/registration/cleanup.functions";
import { cn } from "@/lib/utils";
import { INDIAN_STATES } from "@/lib/location";
import { normalizeGender, resolveMonthlyFee } from "@/lib/gender";

const REQUIRED_POLICIES: PolicyKind[] = ["terms", "privacy", "fee", "medical"];
const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;

const STEP_TITLES = [
  "Create your account",
  "Student details",
  "Optional details",
  "Review & submit",
] as const;
type Step = 1 | 2 | 3 | 4;

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
    <TenantGate chrome="focus">
      <RegisterContent />
    </TenantGate>
  ),
});

function formatFeeLabel(plan: (Partial<FeePlan> & { amount: number }) | undefined): string {
  if (!plan) return "";
  const cur = (plan.currency || "INR").toUpperCase();
  const sym = cur === "INR" ? "₹" : cur + " ";
  const cycle = plan.billing_cycle === "annual" || plan.type === "annual" ? "/year" : plan.billing_cycle === "quarterly" ? "/quarter" : plan.type === "registration" ? " (one-time)" : "/month";
  const amount = Number(plan.amount) || 0;
  return `${sym}${amount}${cycle}`;
}

function batchFeePlan(batch: Batch, fees: FeePlan[]): FeePlan | undefined {
  const monthly = fees.filter(f => f.type !== "registration" && (f.billing_cycle ?? "monthly") !== "annual");
  const bn = (batch.name || "").toLowerCase();
  if (!bn) return undefined;
  if (bn.includes("personal") || bn.includes("1-on-1") || bn.includes("one-on-one")) {
    return monthly.find(f => {
      const fn = (f.name || "").toLowerCase();
      return fn.includes("personal") || fn.includes("coaching");
    });
  }
  const isBoth = bn.includes("both") || (bn.includes("morning") && (bn.includes("eve") || bn.includes("evening")));
  if (isBoth) {
    const hit = monthly.find(f => (f.name || "").toLowerCase().includes("both"));
    if (hit) return hit;
  } else {
    const hit = monthly.find(f => (f.name || "").toLowerCase().includes("single"));
    if (hit) return hit;
  }
  const direct = monthly.find(f => {
    const fn = (f.name || "").toLowerCase();
    return fn && (fn.includes(bn) || bn.includes(fn));
  });
  if (direct) return direct;
  return monthly[0];
}

function batchFeeText(batch: Batch, fees: FeePlan[], gender?: string, tenant?: any): string {
  const plan = batchFeePlan(batch, fees);
  if (!plan) return "Contact academy";
  const isGenderPricingEnabled = tenant?.gender_pricing_enabled === true;
  const resolved = isGenderPricingEnabled ? resolveMonthlyFee(plan as any, gender) : Number(plan.amount);
  return formatFeeLabel({ ...plan, amount: resolved }) || "Contact academy";
}

function RegisterContent() {
  const tenant = useTenant();
  const { lead: leadId } = Route.useSearch();
  const { data: batches = [] } = useQuery(batchesQuery(tenant.id));
  const { data: fees = [] } = useQuery(feePlansQuery(tenant.id));
  const { data: policies = [] } = useQuery(publishedPoliciesQuery(tenant.id));

  const [existingReg, setExistingReg] = useState<any>(null);
  const [form, setForm] = useState({
    name: "", guardian_name: "", phone: "", email: "", password: "", password2: "",
    batch_id: "", dob: "", address: "", current_address: "", permanent_address: "",
    village_locality: "", city: "", state: "", aadhaar_number: "", aadhaar_front_url: "", aadhaar_back_url: "",
    photo_url: "", gender: "", height_cm: "", weight_kg: "", blood_group: "",
    batting_style: "", bowling_style: "", interests: "", medical_notes: "", guardian_phone: "", whatsapp: ""
  });

  const [step, setStep] = useState<Step>(1);
  const [isMobile, setIsMobile] = useState<boolean>(() => typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      
      const { data: routeData, error: routeErr } = await supabase.rpc("my_post_login_route" as never);
      if (routeErr) console.error("my_post_login_route error", routeErr);

      if (cancelled) return;
      const route = (routeData as unknown as string) ?? "student";
      
      const { data: regData } = await supabase
        .from("registrations")
        .select("*")
        .eq("applicant_user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (cancelled) return;

      if (regData?.review_status === "changes_requested") {
        setExistingReg(regData);
        // Map registration row to form state safely, handling the 'documents' JSON structure
        const docs = regData.documents as any;
        const profile = docs?.profile || {};
        
        setForm(f => ({
          ...f,
          name: regData.name || "",
          phone: regData.phone || "",
          guardian_name: regData.guardian_name || "",
          guardian_phone: regData.guardian_phone || "",
          whatsapp: regData.whatsapp || "",
          batch_id: regData.batch_id || "",
          dob: regData.dob ? regData.dob.split('-').reverse().join('/') : "",
          address: regData.address || "",
          current_address: regData.address || profile.current_address || "",
          permanent_address: profile.permanent_address || "",
          village_locality: profile.village_locality || "",
          city: profile.city || "",
          state: profile.state || "",
          gender: regData.gender || "",
          medical_notes: regData.medical_notes || "",
          aadhaar_number: profile.aadhaar_number || "",
          aadhaar_front_url: profile.aadhaar_front_url || "",
          aadhaar_back_url: profile.aadhaar_back_url || "",
          photo_url: profile.photo_url || "",
          height_cm: profile.height_cm?.toString() || "",
          weight_kg: profile.weight_kg?.toString() || "",
          blood_group: profile.blood_group || "",
          batting_style: profile.batting_style || "",
          bowling_style: profile.bowling_style || "",
          interests: profile.interests || "",
        }));
        setStep(2);
        return;
      }

      const target = route === "platform_admin" ? "/platform-admin" : route === "staff" ? "/dashboard" : "/student";
      window.location.replace(target);
    })();
    return () => { cancelled = true; };
  }, []);

  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pdfHref, setPdfHref] = useState<string>("");

  const registrationPdfPath = (tenant as any).registration_pdf_url ?? "";
  useEffect(() => {
    if (!registrationPdfPath) return;
    signedUrl(registrationPdfPath).then(url => setPdfHref(url));
  }, [registrationPdfPath]);

  function validateStep(n: Step): boolean {
    const e: Record<string, string> = {};
    if (n === 1 && !existingReg) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim().toLowerCase())) e.email = "Invalid email.";
      if (form.password.length < 8) e.password = "8+ chars.";
      if (form.password !== form.password2) e.password2 = "Mismatch.";
    } else if (n === 2) {
      if (!form.name.trim()) e.name = "Required.";
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(form.dob)) e.dob = "DD/MM/YYYY.";
      if (!form.phone.trim()) e.phone = "Required.";
      if (batches.length > 0 && !form.batch_id) e.batch_id = "Required.";
    } else if (n === 3) {
      if (!form.aadhaar_number.trim()) {
        e.aadhaar_number = "Aadhaar number is compulsory.";
      } else if (form.aadhaar_number.length !== 12) {
        e.aadhaar_number = "Must be 12 digits.";
      }
      if (!form.photo_url) {
        e.photo_url = "Photo is important.";
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  const batchOptions = useMemo(() => [
    { value: "", label: "Select a batch", description: "" },
    ...batches.map(b => ({
      value: b.id,
      label: b.timing ? `${b.name} — ${b.timing}` : b.name,
      description: batchFeeText(b, fees, normalizeGender(form.gender) || undefined, tenant)
    }))
  ], [batches, fees, form.gender, tenant]);

  async function submitForm(e: React.FormEvent) {
    e.preventDefault();
    if (!validateStep(step)) return;
    if (step < 4) {
        setStep(s => Math.min(4, s + 1) as Step);
        return;
    }
    if (!termsAccepted) return toast.error("Accept terms.");
    
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let applicantUserId = user?.id || null;
      
      if (!existingReg && !user) {
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: form.email.trim().toLowerCase(),
          password: form.password,
          options: { data: { full_name: form.name.trim(), tenant_slug: tenant.slug } }
        });
        if (authErr) throw authErr;
        applicantUserId = authData.user?.id || null;
      }

      const [d, m, y] = form.dob.split("/");
      const isoDob = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
      const plan = batches.find(b => b.id === form.batch_id) ? batchFeePlan(batches.find(b => b.id === form.batch_id)!, fees) : fees[0];

      if (existingReg) {
        const { error: rErr } = await supabase.rpc("resubmit_registration" as never, {
          _registration_id: existingReg.id,
          _name: form.name.trim(),
          _phone: form.phone.trim(),
          _fee_plan_id: plan?.id,
          _batch_id: form.batch_id || null,
          _dob: isoDob,
          _guardian_name: form.guardian_name || null,
          _address: form.current_address || null,
          _gender: form.gender || null
        } as any);
        if (rErr) throw rErr;
      } else {
        const { data: regId, error: sErr } = await supabase.rpc("submit_registration" as never, {
          _tenant_id: tenant.id, _name: form.name.trim(), _phone: form.phone.trim(),
          _fee_plan_id: plan?.id, _batch_id: form.batch_id || null, _dob: isoDob
        } as any);
        if (sErr) throw sErr;
        
        const profile: Record<string, unknown> = {
            current_address: form.current_address.trim(),
            permanent_address: form.permanent_address.trim(),
            city: form.city.trim(),
            state: form.state.trim(),
            aadhaar_number: form.aadhaar_number.trim(),
            sport: "cricket"
        };
        const documents = { profile };

        await supabase.rpc("attach_applicant_to_registration" as never, {
          _registration_id: regId as any, 
          _email: form.email.trim().toLowerCase(),
          _address: form.current_address || null, 
          _gender: normalizeGender(form.gender),
          _documents: documents
        } as any);
      }
      setDone(true);
      // Automatically redirect to student dashboard after a short delay
      setTimeout(() => {
        window.location.replace("/student");
      }, 1500);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (done) return <div className="p-8 text-center"><CheckCircle2 className="mx-auto size-12 text-emerald-500 mb-4" /><h1>Registration Submitted!</h1></div>;

  return (
    <div className="mx-auto max-w-2xl p-4">
      <header className="mb-8 flex justify-between items-center border-b pb-4">
        <h1 className="text-xl font-bold">{tenant.name} Registration</h1>
        {pdfHref && <a href={pdfHref} target="_blank" className="flex items-center gap-1 text-sm border p-2 rounded"><Download size={14} /> Offline PDF</a>}
      </header>

      {existingReg?.review_notes && (
        <div className="bg-amber-50 p-4 border border-amber-200 rounded mb-6 flex gap-2">
          <MessageCircle className="text-amber-500" />
          <div><p className="font-bold">Reviewer Note</p><p>{existingReg.review_notes}</p></div>
        </div>
      )}

      <form onSubmit={submitForm} className="space-y-6">
        {step === 1 && !existingReg && (
          <div className="space-y-4">
            <h2 className="font-bold">Account Setup</h2>
            <input type="email" placeholder="Email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="w-full border p-2 rounded" />
            <input type="password" placeholder="Password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full border p-2 rounded" />
            <input type="password" placeholder="Confirm Password" value={form.password2} onChange={e => setForm({...form, password2: e.target.value})} className="w-full border p-2 rounded" />
            <button type="button" onClick={() => setStep(2)} className="w-full bg-black text-white p-3 rounded">Continue</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-bold">Student Details</h2>
            <input placeholder="Full Name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full border p-2 rounded" />
            <input placeholder="Phone" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} className="w-full border p-2 rounded" />
            <input placeholder="Date of Birth (DD/MM/YYYY)" value={form.dob} onChange={e => setForm({...form, dob: e.target.value})} className="w-full border p-2 rounded" />
            <select value={form.batch_id} onChange={e => setForm({...form, batch_id: e.target.value})} className="w-full border p-2 rounded">
              {batchOptions.map(o => <option key={o.value} value={o.value}>{o.label} {o.description ? `(${o.description})` : ""}</option>)}
            </select>
            <div className="flex gap-2">
              {!existingReg && <button type="button" onClick={() => setStep(1)} className="flex-1 border p-3 rounded">Back</button>}
              <button type="button" onClick={() => setStep(3)} className="flex-1 bg-black text-white p-3 rounded">Continue</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-bold">Identity Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground ml-1">Profile Photo <span className="text-destructive">*</span></p>
                <div className="flex items-center gap-4 p-3 border rounded bg-muted/30">
                  <div className="size-16 rounded overflow-hidden bg-background border flex-shrink-0">
                    {form.photo_url ? (
                      <StoragedImage path={form.photo_url} alt="Profile preview" className="size-full object-cover" />
                    ) : (
                      <div className="size-full flex items-center justify-center text-muted-foreground"><Upload size={20} /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (!file) return;
                          try {
                            const path = await uploadTenantFile(tenant.id, "registrations/photos", file);
                            setForm(f => ({ ...f, photo_url: path }));
                            toast.success("Photo uploaded");
                          } catch (err: any) {
                            toast.error(err.message);
                          }
                        };
                        input.click();
                      }}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {form.photo_url ? "Change Photo" : "Upload Photo"}
                    </button>
                    {errors.photo_url && <p className="text-[10px] text-destructive mt-1">{errors.photo_url}</p>}
                    {form.photo_url && (
                      <button 
                        type="button" 
                        onClick={() => setForm(f => ({ ...f, photo_url: "" }))}
                        className="block text-xs text-destructive hover:underline mt-1"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground ml-1">Aadhaar Card (Front)</p>
                <div className="flex items-center gap-4 p-3 border rounded bg-muted/30">
                  <div className="size-16 rounded overflow-hidden bg-background border flex-shrink-0">
                    {form.aadhaar_front_url ? (
                      <div className="size-full flex items-center justify-center text-emerald-500 bg-emerald-50"><FileCheck size={24} /></div>
                    ) : (
                      <div className="size-full flex items-center justify-center text-muted-foreground"><Upload size={20} /></div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*,application/pdf';
                        input.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement).files?.[0];
                          if (!file) return;
                          try {
                            const path = await uploadTenantFile(tenant.id, "registrations/aadhaar", file);
                            setForm(f => ({ ...f, aadhaar_front_url: path }));
                            toast.success("Aadhaar uploaded");
                          } catch (err: any) {
                            toast.error(err.message);
                          }
                        };
                        input.click();
                      }}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {form.aadhaar_front_url ? "Change File" : "Upload Aadhaar"}
                    </button>
                    {form.aadhaar_front_url && (
                      <button 
                        type="button" 
                        onClick={() => setForm(f => ({ ...f, aadhaar_front_url: "" }))}
                        className="block text-xs text-destructive hover:underline mt-1"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <input placeholder="Guardian Name" value={form.guardian_name} onChange={e => setForm({...form, guardian_name: e.target.value})} className="w-full border p-2 rounded" />
            <input 
              placeholder="Aadhaar Number (12 digits)" 
              value={form.aadhaar_number} 
              maxLength={12}
              onChange={e => setForm({...form, aadhaar_number: e.target.value.replace(/\D/g, '')})} 
              className={cn("w-full border p-2 rounded", errors.aadhaar_number && "border-destructive")}
            />
            {errors.aadhaar_number && <p className="text-xs text-destructive">{errors.aadhaar_number}</p>}
            <textarea placeholder="Address" value={form.current_address} onChange={e => setForm({...form, current_address: e.target.value})} className="w-full border p-2 rounded" />
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(2)} className="flex-1 border p-3 rounded">Back</button>
              <button type="button" onClick={() => setStep(4)} className="flex-1 bg-black text-white p-3 rounded">Review</button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-bold">Finalize</h2>
            <div className="bg-gray-50 p-4 rounded text-sm"><p><strong>Name:</strong> {form.name}</p><p><strong>Phone:</strong> {form.phone}</p>{form.aadhaar_number && <p><strong>Aadhaar:</strong> {form.aadhaar_number}</p>}</div>
            <label className="flex gap-2 items-center"><input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} /> I accept terms</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setStep(3)} className="flex-1 border p-3 rounded">Back</button>
              <button type="submit" disabled={saving} className="flex-1 bg-black text-white p-3 rounded">{saving ? "Submitting..." : "Submit Registration"}</button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
