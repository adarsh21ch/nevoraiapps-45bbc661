import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  Award,
  Check,
  X,
  Edit2,
  Trash2,
  Plus,
  Search,
  Play,
  RefreshCw,
  FileText,
  Sparkles,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { SectionTitle, EmptyState } from "@/components/match-center/ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDashboard } from "@/lib/dashboard-context";
import { supabase } from "@/integrations/supabase/client";
import { listAthletes } from "@/lib/mc-athletes";
import {
  listRecognitions,
  approveRecognition,
  publishRecognition,
  rejectRecognition,
  updateRecognition,
  createCustomRecognition,
  processMonthlyRecognitions,
  processYearlyRecognitions,
  listCertificateTemplates,
  upsertCertificateTemplate,
  deleteCertificateTemplate,
  renderCertificateSVG,
  listAcademyTimeline,
  searchRecognitions,
  RECOGNITION_BADGES,
  type MCRecognition,
  type MCCertificateTemplate,
  type MCAcademyTimelineRow,
  type RecognitionSearchHit,
} from "@/lib/mc-recognition-engine";

export const Route = createFileRoute("/match-center/recognition")({
  head: () => ({
    meta: [
      { title: "Recognition · Match Center" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RecognitionPage,
});

function currentMonthPeriod() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function currentYearPeriod() {
  return String(new Date().getFullYear());
}

function RecognitionPage() {
  const { tenant } = useDashboard();
  const tenantId = tenant.id;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);

  const suggestionsQ = useQuery({
    queryKey: ["mc-recog", tenantId, "suggested"],
    queryFn: () => listRecognitions(tenantId, { status: "suggested" }),
  });
  const publishedQ = useQuery({
    queryKey: ["mc-recog", tenantId, "published"],
    queryFn: async () => {
      const [approved, published] = await Promise.all([
        listRecognitions(tenantId, { status: "approved" }),
        listRecognitions(tenantId, { status: "published" }),
      ]);
      return [...published, ...approved];
    },
  });
  const templatesQ = useQuery({
    queryKey: ["mc-recog-templates", tenantId],
    queryFn: () => listCertificateTemplates(tenantId),
  });
  const timelineQ = useQuery({
    queryKey: ["mc-academy-timeline", tenantId],
    queryFn: () => listAcademyTimeline(tenantId, 200),
  });
  const searchQ = useQuery({
    queryKey: ["mc-recog-search", tenantId, search],
    queryFn: () => searchRecognitions(tenantId, search),
    enabled: search.trim().length >= 2,
  });

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["mc-recog", tenantId] });
    queryClient.invalidateQueries({ queryKey: ["mc-academy-timeline", tenantId] });
  };

  const monthlyMut = useMutation({
    mutationFn: () => processMonthlyRecognitions(tenantId, currentMonthPeriod()),
    onSuccess: (r) => {
      toast.success(`Monthly: ${r.inserted} suggested, ${r.skipped} skipped`);
      invalidateAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });
  const yearlyMut = useMutation({
    mutationFn: () => processYearlyRecognitions(tenantId, currentYearPeriod()),
    onSuccess: (r) => {
      toast.success(`Yearly: ${r.inserted} suggested, ${r.skipped} skipped`);
      invalidateAll();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div>
      <PageHeader
        title="Recognition"
        description="Automatic award suggestions, certificates and digital badges."
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Recognition" },
        ]}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => monthlyMut.mutate()} disabled={monthlyMut.isPending}>
              <RefreshCw className={`size-4 mr-1.5 ${monthlyMut.isPending ? "animate-spin" : ""}`} />
              Monthly
            </Button>
            <Button size="sm" variant="outline" onClick={() => yearlyMut.mutate()} disabled={yearlyMut.isPending}>
              <Sparkles className="size-4 mr-1.5" />
              Yearly
            </Button>
            <CustomRecognitionDialog tenantId={tenantId} onCreated={invalidateAll} />
          </div>
        }
      />

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search awards, certificates, players…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>
      {search.trim().length >= 2 && (
        <SearchResults hits={searchQ.data ?? []} loading={searchQ.isLoading} />
      )}

      <Tabs defaultValue="suggestions" className="mt-4">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="suggestions">
            Suggestions
            {suggestionsQ.data && suggestionsQ.data.length > 0 && (
              <Badge variant="secondary" className="ml-1.5">
                {suggestionsQ.data.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="published">Published</TabsTrigger>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="badges">Badges</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions" className="mt-4">
          <SuggestionsTab
            items={suggestionsQ.data ?? []}
            loading={suggestionsQ.isLoading}
            tenantId={tenantId}
            onChanged={invalidateAll}
          />
        </TabsContent>
        <TabsContent value="published" className="mt-4">
          <PublishedTab
            items={publishedQ.data ?? []}
            loading={publishedQ.isLoading}
            onChanged={invalidateAll}
          />
        </TabsContent>
        <TabsContent value="certificates" className="mt-4">
          <CertificatesTab
            recognitions={publishedQ.data ?? []}
            templates={templatesQ.data ?? []}
            academyName={tenant.name ?? "Academy"}
          />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <TemplatesTab
            tenantId={tenantId}
            templates={templatesQ.data ?? []}
            onChanged={() =>
              queryClient.invalidateQueries({ queryKey: ["mc-recog-templates", tenantId] })
            }
          />
        </TabsContent>
        <TabsContent value="badges" className="mt-4">
          <BadgesTab published={publishedQ.data ?? []} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-4">
          <TimelineTab items={timelineQ.data ?? []} loading={timelineQ.isLoading} />
        </TabsContent>
        <TabsContent value="settings" className="mt-4">
          <SettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- Suggestions ---------- */

function SuggestionsTab({
  items,
  loading,
  tenantId,
  onChanged,
}: {
  items: Array<MCRecognition & { athleteName?: string }>;
  loading: boolean;
  tenantId: string;
  onChanged: () => void;
}) {
  if (loading) return <Skeleton className="h-40" />;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Award}
        title="No pending suggestions"
        description="Finalize a match — the Recognition Engine will suggest awards automatically."
      />
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {items.map((r) => (
        <SuggestionCard key={r.id} recognition={r} tenantId={tenantId} onChanged={onChanged} />
      ))}
    </div>
  );
}

function SuggestionCard({
  recognition,
  tenantId,
  onChanged,
}: {
  recognition: MCRecognition & { athleteName?: string };
  tenantId: string;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(recognition.title);
  const [description, setDescription] = useState(recognition.description ?? "");
  const [athleteId, setAthleteId] = useState<string | null>(recognition.athlete_profile_id);
  const [busy, setBusy] = useState(false);

  const athletesQ = useQuery({
    queryKey: ["mc-athletes-picker", tenantId],
    queryFn: () => listAthletes(tenantId),
    enabled: editing,
  });

  const act = async (fn: () => Promise<void>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <Badge variant="outline" className="mb-1">
            {recognition.recognition_type.replace(/_/g, " ")}
          </Badge>
          {editing ? (
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mb-2" />
          ) : (
            <div className="font-semibold">{recognition.title}</div>
          )}
          <div className="text-xs text-muted-foreground">
            {recognition.athleteName ?? "—"}
            {recognition.badge ? <> · {recognition.badge}</> : null}
          </div>
        </div>
      </div>
      {editing ? (
        <div className="space-y-2">
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Recipient</Label>
            <Select value={athleteId ?? ""} onValueChange={(v) => setAthleteId(v || null)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose recipient" />
              </SelectTrigger>
              <SelectContent>
                {(athletesQ.data ?? []).map((a) => {
                  const name =
                    (a as unknown as { students?: { name?: string } }).students?.name ?? a.id;
                  return (
                    <SelectItem key={a.id} value={a.id}>
                      {name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : recognition.description ? (
        <p className="text-sm text-muted-foreground">{recognition.description}</p>
      ) : null}

      <div className="flex gap-2 pt-1">
        {editing ? (
          <>
            <Button
              size="sm"
              onClick={() =>
                act(async () => {
                  await updateRecognition(recognition.id, {
                    title,
                    description,
                    athlete_profile_id: athleteId,
                  });
                  setEditing(false);
                }, "Saved")
              }
              disabled={busy}
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              onClick={() => act(async () => await publishRecognition(recognition.id, null), "Published")}
              disabled={busy}
            >
              <Check className="size-4 mr-1" /> Publish
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => act(async () => await approveRecognition(recognition.id, null), "Approved")}
              disabled={busy}
            >
              Approve
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
              <Edit2 className="size-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => act(async () => await rejectRecognition(recognition.id), "Rejected")}
              disabled={busy}
            >
              <X className="size-4 text-destructive" />
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

/* ---------- Published ---------- */

function PublishedTab({
  items,
  loading,
  onChanged,
}: {
  items: Array<MCRecognition & { athleteName?: string }>;
  loading: boolean;
  onChanged: () => void;
}) {
  if (loading) return <Skeleton className="h-40" />;
  if (items.length === 0) {
    return (
      <EmptyState icon={Award} title="No published awards" description="Approve suggestions to publish them." />
    );
  }
  return (
    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {items.map((r) => (
        <Card key={r.id} className="p-4">
          <div className="flex items-start justify-between">
            <div>
              <Badge variant="outline">{r.status}</Badge>
              <div className="font-semibold mt-1">{r.title}</div>
              <div className="text-xs text-muted-foreground">
                {r.athleteName ?? "—"}
                {r.period ? ` · ${r.period}` : ""}
              </div>
            </div>
            {r.badge ? <div className="text-xl">{r.badge.split(" ")[0]}</div> : null}
          </div>
          {r.description ? (
            <p className="text-sm text-muted-foreground mt-2">{r.description}</p>
          ) : null}
          <div className="flex gap-2 mt-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={async () => {
                try {
                  await rejectRecognition(r.id);
                  toast.success("Withdrawn");
                  onChanged();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              }}
            >
              Withdraw
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Certificates ---------- */

function CertificatesTab({
  recognitions,
  templates,
  academyName,
}: {
  recognitions: Array<MCRecognition & { athleteName?: string }>;
  templates: MCCertificateTemplate[];
  academyName: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(
    templates.find((t) => t.is_default)?.id ?? templates[0]?.id ?? null,
  );
  const rec = recognitions.find((r) => r.id === selected) ?? recognitions[0];
  const tmpl = templates.find((t) => t.id === templateId) ?? null;

  if (recognitions.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No certificates yet"
        description="Publish a recognition to generate a certificate."
      />
    );
  }

  const svg = rec
    ? renderCertificateSVG({
        template: tmpl,
        recipientName: rec.athleteName ?? "Recipient",
        awardTitle: rec.title,
        description: rec.description ?? undefined,
        issueDate: rec.awarded_at
          ? new Date(rec.awarded_at).toLocaleDateString()
          : new Date().toLocaleDateString(),
        certificateNumber: rec.id.slice(0, 8).toUpperCase(),
        academyName,
      })
    : "";

  const download = () => {
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `certificate-${rec?.athleteName ?? "recipient"}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="space-y-3">
        <div>
          <Label className="text-xs">Recipient</Label>
          <Select
            value={rec?.id ?? ""}
            onValueChange={(v) => setSelected(v)}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {recognitions.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.athleteName ?? "—"} · {r.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Template</Label>
          <Select value={templateId ?? ""} onValueChange={(v) => setTemplateId(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Default" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
              {templates.length === 0 && (
                <SelectItem value="none" disabled>No templates</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={download} size="sm">
          <FileText className="size-4 mr-1.5" /> Download SVG
        </Button>
      </div>
      <Card className="p-2 overflow-auto">
        {rec ? (
          <div dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <div className="p-6 text-sm text-muted-foreground">Select a recipient.</div>
        )}
      </Card>
    </div>
  );
}

/* ---------- Templates CRUD ---------- */

function TemplatesTab({
  tenantId,
  templates,
  onChanged,
}: {
  tenantId: string;
  templates: MCCertificateTemplate[];
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState<Partial<MCCertificateTemplate> | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          size="sm"
          onClick={() =>
            setEditing({
              tenant_id: tenantId,
              name: "New template",
              template_type: "generic",
              primary_color: "#0f172a",
              secondary_color: "#f59e0b",
              is_default: templates.length === 0,
            })
          }
        >
          <Plus className="size-4 mr-1.5" /> New template
        </Button>
      </div>
      {templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No templates yet"
          description="Create a certificate template to customise your awards."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">{t.name}</div>
                {t.is_default && <Badge variant="secondary">default</Badge>}
              </div>
              <div className="flex gap-2 mt-2">
                <div
                  className="h-8 w-8 rounded"
                  style={{ backgroundColor: t.primary_color }}
                />
                <div
                  className="h-8 w-8 rounded"
                  style={{ backgroundColor: t.secondary_color }}
                />
              </div>
              <div className="flex gap-2 mt-3">
                <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>
                  <Edit2 className="size-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await deleteCertificateTemplate(t.id);
                      toast.success("Deleted");
                      onChanged();
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : "Failed");
                    }
                  }}
                >
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <TemplateEditor
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          onChanged();
        }}
      />
    </div>
  );
}

function TemplateEditor({
  editing,
  onClose,
  onSaved,
}: {
  editing: Partial<MCCertificateTemplate> | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [state, setState] = useState<Partial<MCCertificateTemplate> | null>(null);
  const active = state ?? editing;

  const save = async () => {
    const data = state ?? editing;
    if (!data?.tenant_id || !data.name) return;
    try {
      await upsertCertificateTemplate({
        ...data,
        tenant_id: data.tenant_id,
        name: data.name,
      });
      toast.success("Saved");
      setState(null);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <Dialog open={!!editing} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Certificate template</DialogTitle>
          <DialogDescription>Reusable design for certificates.</DialogDescription>
        </DialogHeader>
        {active && (
          <div className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input
                value={active.name ?? ""}
                onChange={(e) => setState({ ...active, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Primary color</Label>
                <Input
                  type="color"
                  value={active.primary_color ?? "#0f172a"}
                  onChange={(e) => setState({ ...active, primary_color: e.target.value })}
                />
              </div>
              <div>
                <Label>Accent color</Label>
                <Input
                  type="color"
                  value={active.secondary_color ?? "#f59e0b"}
                  onChange={(e) => setState({ ...active, secondary_color: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Signature name</Label>
              <Input
                value={active.signature_name ?? ""}
                onChange={(e) => setState({ ...active, signature_name: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={!!active.is_default}
                onCheckedChange={(v) => setState({ ...active, is_default: v })}
              />
              <Label>Default template</Label>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Badges ---------- */

function BadgesTab({
  published,
}: {
  published: Array<MCRecognition & { athleteName?: string }>;
}) {
  const badgeMap = useMemo(() => {
    const map = new Map<string, { athletes: Set<string>; count: number }>();
    for (const r of published) {
      const key = r.badge ?? RECOGNITION_BADGES[r.recognition_type] ?? "";
      if (!key) continue;
      const entry = map.get(key) ?? { athletes: new Set<string>(), count: 0 };
      if (r.athleteName) entry.athletes.add(r.athleteName);
      entry.count += 1;
      map.set(key, entry);
    }
    return Array.from(map.entries());
  }, [published]);

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle title="Badges available" />
        <div className="grid gap-2 md:grid-cols-3">
          {Object.entries(RECOGNITION_BADGES).map(([k, v]) => (
            <Card key={k} className="p-3 flex items-center gap-2">
              <div className="text-xl">{v.split(" ")[0]}</div>
              <div className="text-sm">{v.substring(v.indexOf(" ") + 1)}</div>
            </Card>
          ))}
        </div>
      </div>
      <div>
        <SectionTitle title="Badges awarded" />
        {badgeMap.length === 0 ? (
          <EmptyState icon={Trophy} title="None yet" description="Publish recognitions to award badges." />
        ) : (
          <div className="grid gap-2 md:grid-cols-2">
            {badgeMap.map(([badge, entry]) => (
              <Card key={badge} className="p-3">
                <div className="flex items-center gap-2">
                  <div className="text-2xl">{badge.split(" ")[0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{badge.substring(badge.indexOf(" ") + 1)}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {Array.from(entry.athletes).slice(0, 4).join(", ")}
                    </div>
                  </div>
                  <Badge variant="secondary">{entry.count}</Badge>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Timeline ---------- */

function TimelineTab({
  items,
  loading,
}: {
  items: MCAcademyTimelineRow[];
  loading: boolean;
}) {
  if (loading) return <Skeleton className="h-40" />;
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="No academy timeline yet"
        description="Timeline is appended each time a recognition is published."
      />
    );
  }
  return (
    <div className="space-y-2">
      {items.map((r) => (
        <Card key={r.id} className="p-3 flex items-start gap-3">
          <Trophy className="size-4 text-amber-500 mt-0.5" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{r.title}</div>
            {r.description ? (
              <div className="text-xs text-muted-foreground">{r.description}</div>
            ) : null}
          </div>
          <div className="text-xs text-muted-foreground tabular-nums">
            {new Date(r.created_at).toLocaleDateString()}
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ---------- Settings ---------- */

function SettingsTab() {
  const [autoApprove, setAutoApprove] = useState(false);
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Switch checked={autoApprove} onCheckedChange={setAutoApprove} />
        <div>
          <Label>Auto-approve suggestions</Label>
          <p className="text-xs text-muted-foreground">
            When enabled, match recognition suggestions are published automatically without coach approval.
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Setting is local to this session. Persist to tenant preferences in the next iteration.
      </p>
    </Card>
  );
}

/* ---------- Custom recognition + search ---------- */

function CustomRecognitionDialog({
  tenantId,
  onCreated,
}: {
  tenantId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [athleteId, setAthleteId] = useState<string>("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const athletesQ = useQuery({
    queryKey: ["mc-athletes-picker", tenantId],
    queryFn: () => listAthletes(tenantId),
    enabled: open,
  });

  const submit = async () => {
    if (!title.trim()) {
      toast.error("Title required");
      return;
    }
    try {
      await createCustomRecognition({
        tenantId,
        athleteProfileId: athleteId || null,
        title: title.trim(),
        description: description.trim() || undefined,
      });
      toast.success("Recognition awarded");
      onCreated();
      setOpen(false);
      setTitle("");
      setDescription("");
      setAthleteId("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4 mr-1.5" /> Custom
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Custom recognition</DialogTitle>
          <DialogDescription>Award something outside the automatic flow.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Player</Label>
            <Select value={athleteId} onValueChange={setAthleteId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose player" />
              </SelectTrigger>
              <SelectContent>
                {(athletesQ.data ?? []).map((a) => {
                  const name =
                    (a as unknown as { students?: { name?: string } }).students?.name ?? a.id;
                  return (
                    <SelectItem key={a.id} value={a.id}>
                      {name}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit}>Award</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SearchResults({ hits, loading }: { hits: RecognitionSearchHit[]; loading: boolean }) {
  if (loading) return <Skeleton className="h-16 w-full" />;
  if (hits.length === 0) {
    return <Card className="p-3 text-sm text-muted-foreground">No matches.</Card>;
  }
  return (
    <Card className="p-2 space-y-1 max-h-72 overflow-auto">
      {hits.map((h) => (
        <div key={h.kind + h.id} className="flex items-center gap-2 p-2 hover:bg-muted/40 rounded">
          <Badge variant="outline" className="text-[10px] uppercase">{h.kind}</Badge>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{h.title}</div>
            {h.subtitle ? (
              <div className="text-xs text-muted-foreground truncate">{h.subtitle}</div>
            ) : null}
          </div>
        </div>
      ))}
    </Card>
  );
}
