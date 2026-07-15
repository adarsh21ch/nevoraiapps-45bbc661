import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageCircle, Phone, Trash2, ChevronRight, UserPlus, Star, Calendar } from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { BulkImportLeads } from "@/components/dashboard/BulkImportLeads";
import {
  AdmissionChecklist,
  AdmissionTimelineList,
} from "@/components/dashboard/AdmissionChecklist";
import {
  PIPELINE_STAGES,
  STAGE_TONE,
  advanceLeadStage,
  scheduleTrial,
  scheduleCounselling,
  recordTrial,
  leadsPipelineQuery,
  admissionTimelineQuery,
  type PipelineLead,
  type PipelineStage,
} from "@/lib/admissions";

export const Route = createFileRoute("/dashboard/leads")({
  head: () => ({ meta: [{ title: "Admissions pipeline · Academy dashboard" }] }),
  component: LeadsPipelineRoute,
});

function LeadsPipelineRoute() {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<PipelineStage | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery(leadsPipelineQuery(tenant.id));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admissions", "leads", tenant.id] });
    qc.invalidateQueries({ queryKey: ["admissions", "timeline"] });
  };

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: data.length };
    for (const s of PIPELINE_STAGES) c[s.key] = 0;
    for (const l of data) c[l.pipeline_stage] = (c[l.pipeline_stage] ?? 0) + 1;
    return c;
  }, [data]);

  const visible = useMemo(
    () => (filter === "all" ? data : data.filter((l) => l.pipeline_stage === filter)),
    [data, filter],
  );

  const openLead = data.find((l) => l.id === openId) ?? null;

  const advance = useMutation({
    mutationFn: async (v: { id: string; stage: PipelineStage; remark?: string }) =>
      advanceLeadStage(v.id, v.stage, v.remark),
    onSuccess: (_d, v) => {
      toast.success(`Moved to ${v.stage}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("leads" as never)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead removed");
      invalidate();
      setOpenId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Admissions pipeline</h1>
          <p className="text-sm text-muted-foreground">
            Lead → Trial → Registration → Enrolled. Every stage is time-stamped and audited.
          </p>
        </div>
        <BulkImportLeads />
      </header>

      <div className="flex flex-wrap gap-2 overflow-x-auto">
        <StageChip
          active={filter === "all"}
          label="All"
          count={counts.all ?? 0}
          onClick={() => setFilter("all")}
        />
        {PIPELINE_STAGES.map((s) => (
          <StageChip
            key={s.key}
            active={filter === s.key}
            label={s.label}
            count={counts[s.key] ?? 0}
            tone={s.tone}
            onClick={() => setFilter(s.key)}
          />
        ))}
      </div>

      {isLoading && <div className="text-sm text-muted-foreground">Loading…</div>}
      {!isLoading && visible.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          No leads {filter === "all" ? "yet" : `in "${filter}"`}. Share your website — enquiries
          land here.
        </Card>
      )}

      <div className="space-y-3">
        {visible.map((l) => (
          <LeadRow
            key={l.id}
            lead={l}
            tenantName={tenant.name}
            onOpen={() => setOpenId(l.id)}
            onAdvance={(stage, remark) => advance.mutate({ id: l.id, stage, remark })}
          />
        ))}
      </div>

      {openLead && (
        <LeadDrawer
          lead={openLead}
          tenantSlug={tenant.slug}
          onClose={() => setOpenId(null)}
          onDelete={() => remove.mutate(openLead.id)}
          onChanged={invalidate}
        />
      )}
    </div>
  );
}

function StageChip({
  active,
  label,
  count,
  tone,
  onClick,
}: {
  active: boolean;
  label: string;
  count: number;
  tone?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
        active
          ? "border-transparent text-white"
          : "border-border bg-background text-muted-foreground hover:text-foreground"
      }`}
      style={active ? { backgroundColor: "var(--brand)" } : undefined}
    >
      {label} <span className="opacity-70">({count})</span>
      {tone && !active && (
        <span className={`ml-1.5 inline-block size-1.5 rounded-full ${tone.split(" ")[0]}`} />
      )}
    </button>
  );
}

function LeadRow({
  lead,
  tenantName,
  onOpen,
  onAdvance,
}: {
  lead: PipelineLead;
  tenantName: string;
  onOpen: () => void;
  onAdvance: (stage: PipelineStage, remark?: string) => void;
}) {
  const waDigits = lead.phone.replace(/\D/g, "");
  const waNumber = waDigits.length === 10 ? `91${waDigits}` : waDigits;
  const waText = `Hi ${lead.name}, thanks for reaching out to ${tenantName}. When's a good time to chat?`;
  const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waText)}`;

  const nextStage: Record<PipelineStage, PipelineStage | null> = {
    new: "contacted",
    contacted: "counselling",
    counselling: "trial",
    trial: "decision",
    decision: "approved",
    approved: "converted",
    converted: null,
    rejected: null,
  };
  const next = nextStage[lead.pipeline_stage];

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <button className="flex-1 min-w-0 text-left" onClick={onOpen}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold truncate">{lead.name}</span>
            <Badge
              className={`${STAGE_TONE[lead.pipeline_stage]} border-0 capitalize`}
              variant="secondary"
            >
              {lead.pipeline_stage}
            </Badge>
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
              {lead.source}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Phone className="size-3" /> {lead.phone}
            </span>
            {lead.trial_at && (
              <span className="inline-flex items-center gap-1">
                <Calendar className="size-3" /> Trial{" "}
                {new Date(lead.trial_at).toLocaleDateString("en-IN")}
              </span>
            )}
            {lead.trial_rating != null && (
              <span className="inline-flex items-center gap-1">
                <Star className="size-3" /> {lead.trial_rating}/5
              </span>
            )}
            <span>{new Date(lead.created_at).toLocaleDateString("en-IN")}</span>
          </div>
        </button>
        <ChevronRight className="size-4 text-muted-foreground shrink-0 mt-1" />
      </div>

      <div className="flex flex-wrap gap-2">
        <a
          href={waUrl}
          target="_blank"
          rel="noreferrer"
          onClick={() =>
            lead.pipeline_stage === "new" && onAdvance("contacted", "WhatsApp reply sent")
          }
          className="inline-flex items-center gap-1.5 rounded-full bg-[#25D366] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:brightness-110"
        >
          <MessageCircle className="size-3.5" fill="currentColor" /> WhatsApp
        </a>
        <a
          href={`tel:${lead.phone}`}
          onClick={() => lead.pipeline_stage === "new" && onAdvance("contacted", "Called")}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <Phone className="size-3.5" /> Call
        </a>
        {next && (
          <Button size="sm" variant="outline" onClick={() => onAdvance(next)}>
            Advance → {next}
          </Button>
        )}
        {lead.pipeline_stage === "approved" && !lead.converted_registration_id && (
          <Link
            to="/register"
            search={{ lead: lead.id } as never}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:brightness-110"
          >
            <UserPlus className="size-3.5" /> Convert to registration
          </Link>
        )}
        {lead.pipeline_stage !== "rejected" && lead.pipeline_stage !== "converted" && (
          <Button
            size="sm"
            variant="ghost"
            className="text-rose-600 hover:text-rose-700 ml-auto"
            onClick={() => onAdvance("rejected", "Not proceeding")}
          >
            Reject
          </Button>
        )}
      </div>
    </Card>
  );
}

function LeadDrawer({
  lead,
  tenantSlug,
  onClose,
  onDelete,
  onChanged,
}: {
  lead: PipelineLead;
  tenantSlug: string;
  onClose: () => void;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<"overview" | "trial" | "timeline">("overview");
  const [counsellingAt, setCounsellingAt] = useState(lead.counselling_at?.slice(0, 16) ?? "");
  const [trialDate, setTrialDate] = useState(lead.trial_at?.slice(0, 16) ?? "");
  const [rating, setRating] = useState<number>(lead.trial_rating ?? 3);
  const [remarks, setRemarks] = useState(lead.trial_remarks ?? "");
  const [remark, setRemark] = useState("");

  const { data: events = [] } = useQuery(
    admissionTimelineQuery({ tenantId: lead.tenant_id, leadId: lead.id }),
  );

  const saveCounselling = async () => {
    if (!counsellingAt) return toast.error("Pick a date");
    try {
      await scheduleCounselling(lead.id, new Date(counsellingAt).toISOString());
      await advanceLeadStage(lead.id, "counselling", "Counselling scheduled");
      toast.success("Counselling scheduled");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const saveTrialSchedule = async () => {
    if (!trialDate) return toast.error("Pick a date");
    try {
      await scheduleTrial(lead.id, new Date(trialDate).toISOString());
      await advanceLeadStage(lead.id, "trial", "Trial scheduled");
      toast.success("Trial scheduled");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const saveTrialResult = async () => {
    try {
      await recordTrial(lead.id, rating, remarks);
      await advanceLeadStage(lead.id, "decision", `Trial rated ${rating}/5`);
      toast.success("Trial recorded");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const addRemark = async () => {
    if (!remark.trim()) return;
    try {
      await advanceLeadStage(lead.id, lead.pipeline_stage, remark.trim());
      setRemark("");
      toast.success("Note added");
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-background shadow-xl border"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-background border-b p-4 flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold truncate">{lead.name}</h2>
              <Badge
                className={`${STAGE_TONE[lead.pipeline_stage]} border-0 capitalize`}
                variant="secondary"
              >
                {lead.pipeline_stage}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground">
              {lead.phone} · {lead.source}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onDelete}>
              <Trash2 className="size-4" />
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        <div className="flex gap-1 p-2 border-b bg-muted/30">
          {(["overview", "trial", "timeline"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize ${
                tab === t ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-4">
          {tab === "overview" && (
            <>
              <AdmissionChecklist lead={lead} />

              {lead.message && (
                <div className="rounded-md bg-muted/60 p-3 text-sm">{lead.message}</div>
              )}

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Counselling
                </div>
                <div className="flex gap-2">
                  <Input
                    type="datetime-local"
                    value={counsellingAt}
                    onChange={(e) => setCounsellingAt(e.target.value)}
                  />
                  <Button size="sm" onClick={saveCounselling}>
                    Schedule
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Add note
                </div>
                <Textarea
                  value={remark}
                  onChange={(e) => setRemark(e.target.value)}
                  rows={2}
                  placeholder="Internal note — timestamped in the audit log."
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={addRemark} disabled={!remark.trim()}>
                    Add note
                  </Button>
                </div>
              </div>

              {lead.converted_registration_id && (
                <Link
                  to="/dashboard/registrations"
                  className="block rounded-md border border-dashed p-3 text-sm hover:bg-muted/50"
                >
                  → Open linked registration
                </Link>
              )}
              {lead.converted_student_id && (
                <Link
                  to="/dashboard/students/$id"
                  params={{ id: lead.converted_student_id }}
                  className="block rounded-md border border-dashed p-3 text-sm hover:bg-muted/50"
                >
                  → Open student profile
                </Link>
              )}
            </>
          )}

          {tab === "trial" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Schedule trial
                </div>
                <div className="flex gap-2">
                  <Input
                    type="datetime-local"
                    value={trialDate}
                    onChange={(e) => setTrialDate(e.target.value)}
                  />
                  <Button size="sm" onClick={saveTrialSchedule}>
                    Schedule
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Record trial
                </div>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      onClick={() => setRating(r)}
                      className={`size-8 rounded-full text-sm font-semibold ${rating >= r ? "bg-amber-400 text-white" : "bg-muted text-muted-foreground"}`}
                    >
                      {r}
                    </button>
                  ))}
                  <span className="text-xs text-muted-foreground ml-2">Performance rating</span>
                </div>
                <Textarea
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Coach observations, strengths, next steps…"
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" onClick={saveTrialResult}>
                    Save trial → Decision
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await advanceLeadStage(lead.id, "approved", "Trial approved");
                    onChanged();
                    toast.success("Approved");
                  }}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-rose-600"
                  onClick={async () => {
                    await advanceLeadStage(lead.id, "rejected", "Not proceeding after trial");
                    onChanged();
                    toast.success("Rejected");
                  }}
                >
                  Reject
                </Button>
                {lead.pipeline_stage === "approved" && !lead.converted_registration_id && (
                  <Link
                    to="/register"
                    search={{ lead: lead.id } as never}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                  >
                    <UserPlus className="size-3.5" /> Convert to registration
                  </Link>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Site: /{tenantSlug} · WhatsApp opens with pre-filled text on the row action.
              </p>
            </div>
          )}

          {tab === "timeline" && <AdmissionTimelineList events={events} />}
        </div>
      </div>
    </div>
  );
}
