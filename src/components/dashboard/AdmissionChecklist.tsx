import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { PipelineLead } from "@/lib/admissions";

type Step = { key: string; label: string; done: boolean; hint?: string };

/**
 * Reads the lead + its converted registration + student + parent link and
 * derives a completion checklist. Zero writes; pure derivation.
 */
export function AdmissionChecklist({ lead }: { lead: PipelineLead }) {
  const regId = lead.converted_registration_id;
  const studentId = lead.converted_student_id;

  const regQ = useQuery({
    enabled: !!regId,
    queryKey: ["admissions", "reg", regId],
    queryFn: async () => {
      const { data } = await supabase
        .from("registrations")
        .select("id, status, payment_status")
        .eq("id", regId!)
        .maybeSingle();
      return data;
    },
  });

  const studentQ = useQuery({
    enabled: !!studentId,
    queryKey: ["admissions", "student", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, player_id, user_id, email")
        .eq("id", studentId!)
        .maybeSingle();
      return data;
    },
  });

  const parentQ = useQuery({
    enabled: !!studentId,
    queryKey: ["admissions", "parent", studentId],
    queryFn: async () => {
      const { data } = await supabase
        .from("mc_parent_links")
        .select("id")
        .eq("student_id", studentId!)
        .limit(1);
      return data ?? [];
    },
  });

  const steps = useMemo<Step[]>(() => {
    const contacted = lead.pipeline_stage !== "new";
    const trialDone =
      !!lead.trial_rating || ["decision", "approved", "converted"].includes(lead.pipeline_stage);
    const regSubmitted = !!regId;
    const regApproved = regQ.data?.status === "approved";
    const studentCreated = !!studentId;
    const parentLinked = (parentQ.data ?? []).length > 0;

    return [
      { key: "contact", label: "Contacted family", done: contacted },
      {
        key: "counselling",
        label: "Counselling",
        done:
          !!lead.counselling_at ||
          ["trial", "decision", "approved", "converted"].includes(lead.pipeline_stage),
      },
      {
        key: "trial",
        label: "Trial completed",
        done: trialDone,
        hint: lead.trial_rating ? `${lead.trial_rating}/5` : undefined,
      },
      { key: "registration", label: "Registration submitted", done: regSubmitted },
      { key: "approved", label: "Registration approved", done: regApproved },
      {
        key: "student",
        label: "Player profile created",
        done: studentCreated,
        hint: studentQ.data?.player_id ?? undefined,
      },
      { key: "parent", label: "Parent linked", done: parentLinked },
    ];
  }, [lead, regId, studentId, regQ.data, studentQ.data, parentQ.data]);

  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">Admission checklist</div>
        <div className="text-xs text-muted-foreground">
          {doneCount}/{steps.length} · {pct}%
        </div>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-1.5 text-sm">
        {steps.map((s) => (
          <li key={s.key} className="flex items-center gap-2">
            {s.done ? (
              <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
            ) : (
              <Circle className="size-4 text-muted-foreground shrink-0" />
            )}
            <span className={s.done ? "text-foreground" : "text-muted-foreground"}>{s.label}</span>
            {s.hint && <span className="text-xs text-muted-foreground">· {s.hint}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AdmissionTimelineList({
  events,
}: {
  events: {
    id: string;
    event_type: string;
    from_stage: string | null;
    to_stage: string | null;
    remark: string | null;
    created_at: string;
  }[];
}) {
  if (!events.length) {
    return <div className="text-sm text-muted-foreground">No admission events yet.</div>;
  }
  return (
    <ul className="space-y-2">
      {events.map((e) => (
        <li key={e.id} className="flex items-start gap-2 text-sm">
          <Clock className="size-4 mt-0.5 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <div className="font-medium capitalize">
              {e.event_type.replaceAll("_", " ")}
              {e.to_stage && <span className="text-muted-foreground"> → {e.to_stage}</span>}
            </div>
            {e.remark && <div className="text-xs text-muted-foreground">{e.remark}</div>}
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {new Date(e.created_at).toLocaleString("en-IN")}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
