import { supabase } from "@/integrations/supabase/client";
import { emitEvent } from "@/lib/automation/emit-client";

export type PipelineStage =
  | "new"
  | "contacted"
  | "counselling"
  | "trial"
  | "decision"
  | "approved"
  | "rejected"
  | "converted";

export const PIPELINE_STAGES: { key: PipelineStage; label: string; hint: string; tone: string }[] =
  [
    { key: "new", label: "New", hint: "Fresh enquiry", tone: "bg-blue-100 text-blue-700" },
    { key: "contacted", label: "Contacted", hint: "Reached out", tone: "bg-sky-100 text-sky-700" },
    {
      key: "counselling",
      label: "Counselling",
      hint: "Talking to family",
      tone: "bg-violet-100 text-violet-700",
    },
    { key: "trial", label: "Trial", hint: "On-ground trial", tone: "bg-amber-100 text-amber-700" },
    {
      key: "decision",
      label: "Decision",
      hint: "Awaiting yes/no",
      tone: "bg-orange-100 text-orange-700",
    },
    {
      key: "approved",
      label: "Approved",
      hint: "Ready to register",
      tone: "bg-emerald-100 text-emerald-700",
    },
    {
      key: "converted",
      label: "Enrolled",
      hint: "Student created",
      tone: "bg-emerald-600 text-white",
    },
    {
      key: "rejected",
      label: "Rejected",
      hint: "Did not convert",
      tone: "bg-rose-100 text-rose-700",
    },
  ];

export const STAGE_LABEL: Record<PipelineStage, string> = Object.fromEntries(
  PIPELINE_STAGES.map((s) => [s.key, s.label]),
) as Record<PipelineStage, string>;

export const STAGE_TONE: Record<PipelineStage, string> = Object.fromEntries(
  PIPELINE_STAGES.map((s) => [s.key, s.tone]),
) as Record<PipelineStage, string>;

export type PipelineLead = {
  id: string;
  tenant_id: string;
  name: string;
  phone: string;
  message: string | null;
  source: string;
  status: string;
  notes: string | null;
  created_at: string;
  pipeline_stage: PipelineStage;
  assigned_to: string | null;
  counselling_at: string | null;
  trial_at: string | null;
  trial_rating: number | null;
  trial_remarks: string | null;
  converted_registration_id: string | null;
  converted_student_id: string | null;
};

export type AdmissionEvent = {
  id: string;
  tenant_id: string;
  lead_id: string | null;
  registration_id: string | null;
  student_id: string | null;
  event_type: string;
  from_stage: string | null;
  to_stage: string | null;
  remark: string | null;
  actor_id: string | null;
  created_at: string;
};

export function leadsPipelineQuery(tenantId: string) {
  return {
    queryKey: ["admissions", "leads", tenantId],
    queryFn: async (): Promise<PipelineLead[]> => {
      const { data, error } = await supabase
        .from("leads" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as PipelineLead[];
    },
  };
}

export function admissionTimelineQuery(params: {
  tenantId: string;
  leadId?: string | null;
  studentId?: string | null;
}) {
  const { tenantId, leadId, studentId } = params;
  return {
    queryKey: ["admissions", "timeline", tenantId, leadId ?? null, studentId ?? null],
    enabled: Boolean(tenantId && (leadId || studentId)),
    queryFn: async (): Promise<AdmissionEvent[]> => {
      let q = supabase
        .from("admission_timeline" as never)
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (leadId) q = q.eq("lead_id", leadId);
      if (studentId) q = q.eq("student_id", studentId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as AdmissionEvent[];
    },
  };
}

export async function advanceLeadStage(leadId: string, newStage: PipelineStage, remark?: string) {
  const { error } = await supabase.rpc(
    "advance_lead_stage" as never,
    {
      _lead_id: leadId,
      _new_stage: newStage,
      _remark: remark ?? null,
    } as never,
  );
  if (error) throw error;
}

export async function scheduleTrial(leadId: string, trialAt: string, assignedTo?: string | null) {
  const { error } = await supabase
    .from("leads" as never)
    .update({
      trial_at: trialAt,
      assigned_to: assignedTo ?? null,
      pipeline_stage: "trial",
    } as never)
    .eq("id", leadId);
  if (error) throw error;
}

export async function recordTrial(leadId: string, rating: number, remarks: string) {
  const { error } = await supabase
    .from("leads" as never)
    .update({ trial_rating: rating, trial_remarks: remarks, pipeline_stage: "decision" } as never)
    .eq("id", leadId);
  if (error) throw error;
}

export async function scheduleCounselling(leadId: string, at: string) {
  const { error } = await supabase
    .from("leads" as never)
    .update({ counselling_at: at, pipeline_stage: "counselling" } as never)
    .eq("id", leadId);
  if (error) throw error;
}

export function isTerminalStage(s: PipelineStage) {
  return s === "converted" || s === "rejected";
}
