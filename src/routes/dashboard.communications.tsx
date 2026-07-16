import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Megaphone,
  Send,
  Clock,
  FileText,
  History,
  Plus,
  Search,
  Users,
  Trash2,
  X,
  Sparkles,
} from "lucide-react";
import { useDashboard } from "@/lib/dashboard-context";
import { useCurrentRole } from "@/hooks/use-current-role";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { FilterTabs } from "@/components/shared/FilterTabs";
import { DashboardSearch } from "@/components/dashboard-ui";
import { ModuleHeader } from "@/components/shared/ModuleHeader";

import {
  useCampaigns,
  useTemplates,
  useCreateCampaign,
  useSendCampaign,
  useCancelCampaign,
  useScheduleCampaign,
  useSaveTemplate,
  useDeleteTemplate,
  statusTone,
  audienceLabel,
  MESSAGE_TYPES,
  VARIABLES,
  type Audience,
  type Channel,
  type CommCampaign,
  type CommTemplate,
} from "@/lib/communications";
import type { NotificationCategory } from "@/lib/notifications";

export const Route = createFileRoute("/dashboard/communications")({
  head: () => ({
    meta: [{ title: "Communications · Academy" }, { name: "robots", content: "noindex" }],
  }),
  component: CommunicationsHub,
});

const CHANNELS: { value: Channel; label: string }[] = [
  { value: "in_app", label: "In-App" },
  { value: "push", label: "Push" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
];

function CommunicationsHub() {
  const { tenant } = useDashboard();
  const role = useCurrentRole();
  const isOwner = role === "owner";
  const campaigns = useCampaigns(tenant.id);
  const templates = useTemplates(tenant.id);
  const [tab, setTab] = useState("broadcasts");
  const [q, setQ] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<CommTemplate | null>(null);

  const list = campaigns.data ?? [];
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle
      ? list.filter(
          (c) =>
            c.name.toLowerCase().includes(needle) ||
            c.title.toLowerCase().includes(needle) ||
            (c.body ?? "").toLowerCase().includes(needle),
        )
      : list;
  }, [list, q]);

  const scheduled = filtered.filter((c) => c.status === "scheduled");
  const history = filtered.filter((c) => ["sent", "failed", "cancelled"].includes(c.status));
  const announcements = filtered.filter((c) => c.category === "system" && c.status !== "cancelled");

  return (
    <div className="space-y-4 pb-4">
      <ModuleHeader
        overline="Academy"
        title="Communications"
        backTo="/dashboard/academy"
        action={
          <Button size="sm" onClick={() => setComposerOpen(true)} className="h-9 rounded-full px-3">
            <Plus className="size-4 mr-1" /> New
          </Button>
        }
      />

      <DashboardSearch
        value={q}
        onChange={setQ}
        placeholder="Search campaigns, templates…"
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="hidden">
          <TabsTrigger value="broadcasts" />
          <TabsTrigger value="announcements" />
          <TabsTrigger value="scheduled" />
          <TabsTrigger value="templates" />
          <TabsTrigger value="history" />
        </TabsList>
        <FilterTabs
          value={tab}
          onChange={setTab}
          items={[
            { key: "broadcasts", label: "All" },
            { key: "announcements", label: "Announcements" },
            { key: "scheduled", label: "Scheduled" },
            { key: "templates", label: "Templates" },
            { key: "history", label: "History" },
          ]}
          ariaLabel="Communications"
        />

        <TabsContent value="broadcasts" className="mt-4">
          <CampaignList items={filtered} loading={campaigns.isLoading} />
        </TabsContent>
        <TabsContent value="announcements" className="mt-4">
          <CampaignList items={announcements} loading={campaigns.isLoading} />
        </TabsContent>
        <TabsContent value="scheduled" className="mt-4">
          <CampaignList items={scheduled} loading={campaigns.isLoading} />
        </TabsContent>
        <TabsContent value="templates" className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={() => setEditTemplate({} as CommTemplate)}>
              <Plus className="size-4 mr-1.5" /> New template
            </Button>
          </div>
          <TemplateList
            items={templates.data ?? []}
            loading={templates.isLoading}
            onEdit={setEditTemplate}
            tenantId={tenant.id}
          />
        </TabsContent>
        <TabsContent value="history" className="mt-4">
          <CampaignList items={history} loading={campaigns.isLoading} />
        </TabsContent>
      </Tabs>

      {composerOpen ? (
        <Composer
          tenantId={tenant.id}
          isOwner={isOwner}
          templates={templates.data ?? []}
          onClose={() => setComposerOpen(false)}
        />
      ) : null}

      {editTemplate ? (
        <TemplateComposer
          tenantId={tenant.id}
          isOwner={isOwner}
          initial={editTemplate.id ? editTemplate : null}
          onClose={() => setEditTemplate(null)}
        />
      ) : null}
    </div>
  );
}

/* ---------------- Campaign list ---------------- */

function CampaignList({ items, loading }: { items: CommCampaign[]; loading: boolean }) {
  const send = useSendCampaign();
  const cancel = useCancelCampaign();

  if (loading) {
    return <div className="text-sm text-muted-foreground p-6 text-center">Loading campaigns…</div>;
  }
  if (!items.length) {
    return (
      <Card className="p-10 text-center space-y-2">
        <Megaphone className="size-6 mx-auto text-muted-foreground" />
        <div className="text-sm font-semibold">No campaigns yet</div>
        <p className="text-xs text-muted-foreground">
          Create your first broadcast to notify your academy.
        </p>
      </Card>
    );
  }
  return (
    <div className="space-y-2.5">
      {items.map((c) => {
        const tone = statusTone(c.status);
        const total = c.recipient_count || 0;
        const pct = total > 0 ? Math.round((c.delivered_count / total) * 100) : 0;
        return (
          <Card key={c.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[11px] font-semibold uppercase tracking-wider rounded px-1.5 py-0.5 ${tone.className}`}
                  >
                    {tone.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground uppercase">
                    {c.category} · {c.message_type}
                  </span>
                </div>
                <div className="font-semibold text-[15px] truncate">{c.title}</div>
                {c.body ? (
                  <p className="text-sm text-muted-foreground line-clamp-2">{c.body}</p>
                ) : null}
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap pt-1">
                  <span className="inline-flex items-center gap-1">
                    <Users className="size-3.5" />
                    {audienceLabel(c.audience)}
                  </span>
                  <span>{c.channels.join(" · ")}</span>
                  {c.scheduled_for ? (
                    <span>Scheduled {new Date(c.scheduled_for).toLocaleString()}</span>
                  ) : null}
                  {c.sent_at ? <span>Sent {new Date(c.sent_at).toLocaleString()}</span> : null}
                </div>
                {total > 0 ? (
                  <div className="pt-2 space-y-1">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {c.delivered_count} delivered · {c.failed_count} failed · {total} total
                    </div>
                  </div>
                ) : null}
              </div>
              <div className="flex flex-col gap-1.5 shrink-0">
                {c.status === "draft" || c.status === "scheduled" ? (
                  <>
                    <Button
                      size="sm"
                      onClick={() =>
                        send.mutate(c.id, {
                          onSuccess: (r) => toast.success(`Sent to ${r.delivered}/${r.total}`),
                          onError: (e: Error) => toast.error(e.message),
                        })
                      }
                      disabled={send.isPending}
                    >
                      <Send className="size-3.5 mr-1" /> Send now
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        cancel.mutate(c.id, {
                          onSuccess: () => toast.success("Cancelled"),
                          onError: (e: Error) => toast.error(e.message),
                        })
                      }
                    >
                      Cancel
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ---------------- Templates ---------------- */

function TemplateList({
  items,
  loading,
  onEdit,
  tenantId,
}: {
  items: CommTemplate[];
  loading: boolean;
  onEdit: (t: CommTemplate) => void;
  tenantId: string;
}) {
  const del = useDeleteTemplate(tenantId);
  if (loading)
    return <div className="text-sm text-muted-foreground p-6 text-center">Loading templates…</div>;
  if (!items.length) {
    return (
      <Card className="p-10 text-center space-y-2">
        <FileText className="size-6 mx-auto text-muted-foreground" />
        <div className="text-sm font-semibold">No templates yet</div>
        <p className="text-xs text-muted-foreground">
          Save reusable messages with <code>{"{{student_name}}"}</code> variables.
        </p>
      </Card>
    );
  }
  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {items.map((t) => (
        <Card
          key={t.id}
          className="p-4 cursor-pointer hover:border-[color:var(--brand)]/40 transition"
          onClick={() => onEdit(t)}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-sm truncate">{t.name}</div>
              <div className="text-[11px] uppercase text-muted-foreground tracking-wider mt-0.5">
                {t.category}
              </div>
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{t.title_template}</p>
            </div>
            <button
              className="text-muted-foreground hover:text-rose-500 shrink-0 p-1"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm("Delete this template?")) {
                  del.mutate(t.id, { onError: (e: Error) => toast.error(e.message) });
                }
              }}
              aria-label="Delete template"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function TemplateComposer({
  tenantId,
  isOwner,
  initial,
  onClose,
}: {
  tenantId: string;
  isOwner: boolean;
  initial: CommTemplate | null;
  onClose: () => void;
}) {
  const save = useSaveTemplate();
  const [name, setName] = useState(initial?.name ?? "");
  const [category, setCategory] = useState<NotificationCategory>(initial?.category ?? "system");
  const [title, setTitle] = useState(initial?.title_template ?? "");
  const [body, setBody] = useState(initial?.body_template ?? "");

  const insertVar = (target: "title" | "body", v: string) => {
    const chip = `{{${v}}}`;
    if (target === "title") setTitle((t) => t + chip);
    else setBody((b) => (b ?? "") + chip);
  };

  return (
    <ModalShell onClose={onClose} title={initial?.id ? "Edit template" : "New template"}>
      <Field label="Name">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Fee due reminder"
        />
      </Field>
      <Field label="Category">
        <select
          className="w-full h-9 rounded-md border bg-transparent px-2 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value as NotificationCategory)}
        >
          {(
            [
              "system",
              "attendance",
              "match",
              "coach",
              "registration",
              "achievement",
              ...(isOwner ? ["billing"] : []),
            ] as NotificationCategory[]
          ).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Title">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Hi {{student_name}}"
        />
      </Field>
      <Field label="Body">
        <Textarea value={body ?? ""} onChange={(e) => setBody(e.target.value)} rows={4} />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        {VARIABLES.map((v) => (
          <button
            key={v}
            type="button"
            className="text-[11px] rounded-full border px-2 py-0.5 hover:bg-muted"
            onClick={() => insertVar("body", v)}
          >
            {`{{${v}}}`}
          </button>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={() =>
            save.mutate(
              {
                id: initial?.id,
                tenant_id: tenantId,
                name,
                category,
                title_template: title,
                body_template: body || null,
              } as never,
              {
                onSuccess: () => {
                  toast.success("Template saved");
                  onClose();
                },
                onError: (e: Error) => toast.error(e.message),
              },
            )
          }
          disabled={!name || !title || save.isPending}
        >
          Save template
        </Button>
      </div>
    </ModalShell>
  );
}

/* ---------------- Composer ---------------- */

function Composer({
  tenantId,
  isOwner,
  templates,
  onClose,
}: {
  tenantId: string;
  isOwner: boolean;
  templates: CommTemplate[];
  onClose: () => void;
}) {
  const create = useCreateCampaign();
  const send = useSendCampaign();
  const schedule = useScheduleCampaign();

  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<NotificationCategory>("system");
  const [messageType, setMessageType] = useState("announcement");
  const [audienceKind, setAudienceKind] = useState<Audience["kind"]>("all");
  const [channels, setChannels] = useState<Channel[]>(["in_app"]);
  const [scheduledFor, setScheduledFor] = useState("");
  const [templateId, setTemplateId] = useState("");

  const allowedTypes = MESSAGE_TYPES.filter((m) => !m.ownerOnly || isOwner);

  const applyTemplate = (id: string) => {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setTitle(t.title_template);
    setBody(t.body_template ?? "");
    setCategory(t.category);
    if (t.default_channels?.length) setChannels(t.default_channels);
  };

  const toggleChannel = (c: Channel) =>
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));

  const submit = async (mode: "send" | "schedule" | "draft") => {
    if (!title.trim()) return toast.error("Title required");
    if (!channels.length) return toast.error("Pick at least one channel");
    if (category === "billing" && !isOwner) {
      return toast.error("Only owners can send billing campaigns");
    }
    if (mode === "schedule" && !scheduledFor) {
      return toast.error("Pick a schedule time");
    }
    try {
      const audience: Audience = { kind: audienceKind };
      const campaign = await create.mutateAsync({
        tenant_id: tenantId,
        name: name || title,
        template_id: templateId || null,
        category,
        message_type: messageType,
        title,
        body,
        channels,
        audience,
        scheduled_for: mode === "schedule" ? new Date(scheduledFor).toISOString() : null,
      });
      if (mode === "send") {
        const r = await send.mutateAsync(campaign.id);
        toast.success(`Sent to ${r.delivered}/${r.total}`);
      } else if (mode === "schedule") {
        await schedule.mutateAsync({ id: campaign.id, when: new Date(scheduledFor).toISOString() });
        toast.success("Scheduled");
      } else {
        toast.success("Saved as draft");
      }
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <ModalShell onClose={onClose} title="New broadcast">
      {templates.length ? (
        <Field label="Start from template">
          <select
            className="w-full h-9 rounded-md border bg-transparent px-2 text-sm"
            value={templateId}
            onChange={(e) => applyTemplate(e.target.value)}
          >
            <option value="">— None —</option>
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field label="Campaign name (internal)">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="July holiday notice"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <select
            className="w-full h-9 rounded-md border bg-transparent px-2 text-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value as NotificationCategory)}
          >
            {(
              [
                "system",
                "attendance",
                "match",
                "coach",
                "registration",
                "achievement",
                ...(isOwner ? ["billing"] : []),
              ] as NotificationCategory[]
            ).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Message type">
          <select
            className="w-full h-9 rounded-md border bg-transparent px-2 text-sm"
            value={messageType}
            onChange={(e) => setMessageType(e.target.value)}
          >
            {allowedTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Title">
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Hi {{student_name}}, practice cancelled tomorrow"
        />
      </Field>
      <Field label="Body">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        {VARIABLES.map((v) => (
          <button
            key={v}
            type="button"
            className="text-[11px] rounded-full border px-2 py-0.5 hover:bg-muted"
            onClick={() => setBody((b) => b + `{{${v}}}`)}
          >
            {`{{${v}}}`}
          </button>
        ))}
      </div>

      <Field label="Audience">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "students", "parents", "admins"] as Audience["kind"][]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setAudienceKind(k)}
              className={`text-xs rounded-full border px-3 py-1 ${audienceKind === k ? "bg-[color:var(--brand)] text-white border-transparent" : "hover:bg-muted"}`}
            >
              {k}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Channels">
        <div className="flex flex-wrap gap-1.5">
          {CHANNELS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => toggleChannel(c.value)}
              className={`text-xs rounded-full border px-3 py-1 ${channels.includes(c.value) ? "bg-[color:var(--brand)] text-white border-transparent" : "hover:bg-muted"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-1">
          Push / WhatsApp / SMS / Email queue into notification_outbox — connect a delivery worker
          to fan out.
        </p>
      </Field>

      <Field label="Schedule (optional)">
        <Input
          type="datetime-local"
          value={scheduledFor}
          onChange={(e) => setScheduledFor(e.target.value)}
        />
      </Field>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onClose}>
          Discard
        </Button>
        <Button variant="outline" onClick={() => submit("draft")}>
          Save draft
        </Button>
        {scheduledFor ? (
          <Button onClick={() => submit("schedule")}>
            <Clock className="size-4 mr-1.5" /> Schedule
          </Button>
        ) : (
          <Button onClick={() => submit("send")}>
            <Sparkles className="size-4 mr-1.5" /> Send now
          </Button>
        )}
      </div>
    </ModalShell>
  );
}

/* ---------------- Layout primitives ---------------- */

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 grid place-items-end sm:place-items-center"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg bg-background rounded-t-2xl sm:rounded-2xl shadow-xl p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
