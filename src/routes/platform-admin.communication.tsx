import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCommProviders,
  listCommAccounts,
  listCommActive,
  listCommTemplates,
  listCommChannels,
  listRecentDeliveries,
  getGatewayHealth,
  getCommMonitor,
  setActiveProvider,
  setProviderPriority,
  upsertCommAccount,
  deleteCommAccount,
  upsertCommTemplate,
  previewCommTemplate,
  sendSandboxMessage,
} from "@/lib/automation/platform-comm.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Activity,
  BarChart3,
  CheckCircle2,
  Clock,
  Coins,
  Eye,
  FlaskConical,
  Gauge,
  Inbox,
  Layers,
  MessageSquare,
  Radio,
  ScrollText,
  Server,
  SlidersHorizontal,
  Send,
} from "lucide-react";
import { format } from "date-fns";
import {
  getBotBizStatus,
  runBotBizHealthCheck,
  sendBotBizTest,
  sendBotBizTestAttendance,
  getBotBizRecentDeliveries,
} from "@/lib/automation/botbiz-admin.functions";

export const Route = createFileRoute("/platform-admin/communication")({
  head: () => ({
    meta: [
      { title: "Communication Infrastructure · Platform Admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CommunicationInfrastructurePage,
});

type Provider = {
  id: string;
  channel: string;
  adapter_key: string;
  display_name: string;
  description: string | null;
  ready: boolean;
  enabled: boolean;
  priority: number;
};
type Account = {
  id: string;
  provider_id: string;
  label: string;
  status: string;
  health: string;
  credentials_ref: string | null;
  last_activity_at: string | null;
  messages_today: number;
  errors_today: number;
  notes: string | null;
};
type Active = { channel: string; provider_id: string | null; account_id: string | null };
type Template = {
  id: string;
  channel: string;
  key: string;
  name: string;
  body: string;
  enabled: boolean;
  category: string;
};
type Channel = { channel: string; display_name: string; description: string | null; enabled: boolean };
type Delivery = {
  id: string;
  tenant_id: string;
  recipient_name: string | null;
  recipient_number: string | null;
  channel: string;
  provider: string | null;
  status: string;
  duration_ms: number | null;
  attempts: number;
  created_at: string;
};

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: BarChart3 },
  { key: "channels", label: "Channels", icon: Radio },
  { key: "providers", label: "Providers", icon: Layers },
  { key: "priority", label: "Priority", icon: SlidersHorizontal },
  { key: "accounts", label: "Accounts", icon: Server },
  { key: "templates", label: "Templates", icon: MessageSquare },
  { key: "preview", label: "Preview", icon: Eye },
  { key: "sandbox", label: "Sandbox", icon: FlaskConical },
  { key: "botbiz", label: "BotBiz", icon: Send },
  { key: "monitor", label: "Monitor", icon: Gauge },
  { key: "queue", label: "Queue", icon: Inbox },
  { key: "logs", label: "Logs", icon: ScrollText },
  { key: "health", label: "Health", icon: Activity },
  { key: "costs", label: "Costs", icon: Coins },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function CommunicationInfrastructurePage() {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const qc = useQueryClient();

  const providersFn = useServerFn(listCommProviders);
  const accountsFn = useServerFn(listCommAccounts);
  const activeFn = useServerFn(listCommActive);
  const templatesFn = useServerFn(listCommTemplates);
  const channelsFn = useServerFn(listCommChannels);
  const deliveriesFn = useServerFn(listRecentDeliveries);
  const healthFn = useServerFn(getGatewayHealth);
  const monitorFn = useServerFn(getCommMonitor);

  const providers = useQuery({ queryKey: ["pc-providers"], queryFn: () => providersFn() });
  const accounts = useQuery({ queryKey: ["pc-accounts"], queryFn: () => accountsFn() });
  const active = useQuery({ queryKey: ["pc-active"], queryFn: () => activeFn() });
  const templates = useQuery({ queryKey: ["pc-templates"], queryFn: () => templatesFn() });
  const channelRegistry = useQuery({ queryKey: ["pc-channels"], queryFn: () => channelsFn() });
  const deliveries = useQuery({ queryKey: ["pc-deliveries"], queryFn: () => deliveriesFn() });
  const health = useQuery({ queryKey: ["pc-health"], queryFn: () => healthFn() });
  const monitor = useQuery({ queryKey: ["pc-monitor"], queryFn: () => monitorFn() });

  const providerList = (providers.data ?? []) as Provider[];
  const accountList = (accounts.data ?? []) as Account[];
  const activeList = (active.data ?? []) as Active[];
  const templateList = (templates.data ?? []) as Template[];
  const channelRows = (channelRegistry.data ?? []) as Channel[];
  const deliveryList = (deliveries.data ?? []) as Delivery[];

  const channels = useMemo(
    () => Array.from(new Set(providerList.map((p) => p.channel))),
    [providerList],
  );

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["pc-providers"] });
    qc.invalidateQueries({ queryKey: ["pc-accounts"] });
    qc.invalidateQueries({ queryKey: ["pc-active"] });
    qc.invalidateQueries({ queryKey: ["pc-templates"] });
  };

  return (
    <div className="p-6 space-y-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold text-white">Communication Infrastructure</h1>
        <p className="text-sm text-neutral-400">
          Platform-wide message routing. Tenants never see providers, adapters, or credentials.
        </p>
      </header>

      <div className="flex flex-wrap gap-1 border-b border-white/10">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm border-b-2 -mb-px transition-colors",
                tab === t.key
                  ? "border-primary text-white"
                  : "border-transparent text-neutral-400 hover:text-white",
              )}
            >
              <Icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "dashboard" && (
        <DashboardTab
          channels={channels}
          providers={providerList}
          active={activeList}
          accounts={accountList}
          health={health.data as Awaited<ReturnType<typeof getGatewayHealth>> | undefined}
        />
      )}
      {tab === "channels" && (
        <ChannelsTab
          channelRows={channelRows}
          providers={providerList}
          active={activeList}
        />
      )}
      {tab === "providers" && (
        <ProvidersTab
          channels={channels}
          providers={providerList}
          active={activeList}
          onChanged={invalidateAll}
        />
      )}
      {tab === "priority" && (
        <PriorityTab
          channels={channels}
          providers={providerList}
          onChanged={() => qc.invalidateQueries({ queryKey: ["pc-providers"] })}
        />
      )}
      {tab === "accounts" && (
        <AccountsTab providers={providerList} accounts={accountList} onChanged={invalidateAll} />
      )}
      {tab === "templates" && (
        <TemplatesTab templates={templateList} onChanged={invalidateAll} />
      )}
      {tab === "preview" && <PreviewTab templates={templateList} />}
      {tab === "sandbox" && (
        <SandboxTab
          templates={templateList}
          onSent={() => qc.invalidateQueries({ queryKey: ["pc-deliveries"] })}
        />
      )}
      {tab === "monitor" && (
        <MonitorTab
          monitor={monitor.data as Awaited<ReturnType<typeof getCommMonitor>> | undefined}
        />
      )}
      {tab === "queue" && <QueueTab deliveries={deliveryList} />}
      {tab === "logs" && <LogsTab deliveries={deliveryList} />}
      {tab === "health" && (
        <HealthTab health={health.data as Awaited<ReturnType<typeof getGatewayHealth>> | undefined} />
      )}
      {tab === "botbiz" && <BotBizTab />}
      {tab === "costs" && <CostsTab />}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <Card className="p-4 bg-neutral-900 border-white/10">
      <div className="text-xs uppercase tracking-wide text-neutral-400">{label}</div>
      <div className="text-2xl font-semibold text-white mt-1">{value}</div>
      {hint && <div className="text-xs text-neutral-500 mt-1">{hint}</div>}
    </Card>
  );
}

function DashboardTab({
  channels,
  providers,
  active,
  accounts,
  health,
}: {
  channels: string[];
  providers: Provider[];
  active: Active[];
  accounts: Account[];
  health: Awaited<ReturnType<typeof getGatewayHealth>> | undefined;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Channels" value={channels.length} />
        <StatCard label="Providers" value={providers.length} />
        <StatCard label="Accounts" value={accounts.length} />
        <StatCard label="Queue" value={health?.queueSize ?? "—"} />
        <StatCard label="Messages 24h" value={health?.total ?? "—"} />
        <StatCard label="Success rate" value={health ? `${health.successRate}%` : "—"} />
        <StatCard label="Failed" value={health?.failed ?? "—"} />
        <StatCard label="Avg latency" value={health ? `${health.avgDurationMs} ms` : "—"} />
      </div>
      <Card className="p-4 bg-neutral-900 border-white/10">
        <div className="text-sm font-medium text-white mb-3">Active provider per channel</div>
        <div className="grid gap-2">
          {channels.map((ch) => {
            const a = active.find((x) => x.channel === ch);
            const p = providers.find((pp) => pp.id === a?.provider_id);
            return (
              <div
                key={ch}
                className="flex items-center justify-between rounded border border-white/10 px-3 py-2 text-sm"
              >
                <span className="text-neutral-300 capitalize">{ch}</span>
                <span className="text-white flex items-center gap-2">
                  {p ? p.display_name : <span className="text-neutral-500">Not configured</span>}
                  {p && !p.ready && (
                    <Badge variant="outline" className="border-amber-400/40 text-amber-300">
                      Scaffold
                    </Badge>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function ProvidersTab({
  channels,
  providers,
  active,
  onChanged,
}: {
  channels: string[];
  providers: Provider[];
  active: Active[];
  onChanged: () => void;
}) {
  const setActiveFn = useServerFn(setActiveProvider);
  const mutate = useMutation({
    mutationFn: (v: { channel: string; providerId: string | null }) =>
      setActiveFn({ data: v }),
    onSuccess: () => {
      toast.success("Active provider updated");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {channels.map((ch) => {
        const a = active.find((x) => x.channel === ch);
        const list = providers.filter((p) => p.channel === ch);
        return (
          <Card key={ch} className="p-4 bg-neutral-900 border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-white capitalize">{ch}</div>
              <Badge variant="outline" className="border-white/20 text-neutral-300">
                {list.length} adapter{list.length === 1 ? "" : "s"}
              </Badge>
            </div>
            <div className="grid gap-2">
              {list.map((p) => {
                const isActive = a?.provider_id === p.id;
                return (
                  <div
                    key={p.id}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded border px-3 py-2 text-sm",
                      isActive
                        ? "border-emerald-500/40 bg-emerald-500/5"
                        : "border-white/10 bg-neutral-950/40",
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-white flex items-center gap-2">
                        {p.display_name}
                        {p.ready ? (
                          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                            Ready
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-amber-400/40 text-amber-300"
                          >
                            Scaffold
                          </Badge>
                        )}
                        {isActive && (
                          <Badge className="bg-sky-500/15 text-sky-300 border-sky-500/30">
                            Active
                          </Badge>
                        )}
                      </div>
                      {p.description && (
                        <div className="text-xs text-neutral-500 mt-0.5">{p.description}</div>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={isActive ? "secondary" : "outline"}
                      disabled={isActive || mutate.isPending}
                      onClick={() =>
                        mutate.mutate({ channel: ch, providerId: p.id })
                      }
                    >
                      {isActive ? "Active" : "Set active"}
                    </Button>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function AccountsTab({
  providers,
  accounts,
  onChanged,
}: {
  providers: Provider[];
  accounts: Account[];
  onChanged: () => void;
}) {
  const [providerId, setProviderId] = useState("");
  const [label, setLabel] = useState("");
  const [credentialsRef, setCredentialsRef] = useState("");
  const [notes, setNotes] = useState("");

  const upsertFn = useServerFn(upsertCommAccount);
  const deleteFn = useServerFn(deleteCommAccount);

  const createMut = useMutation({
    mutationFn: () =>
      upsertFn({ data: { providerId, label, credentialsRef, notes } }),
    onSuccess: () => {
      toast.success("Account added");
      setLabel("");
      setCredentialsRef("");
      setNotes("");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Account removed");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-neutral-900 border-white/10">
        <div className="text-sm font-semibold text-white mb-3">Add account</div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label className="text-neutral-400">Provider</Label>
            <Select value={providerId} onValueChange={setProviderId}>
              <SelectTrigger className="bg-neutral-950 border-white/10">
                <SelectValue placeholder="Select provider…" />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.channel} · {p.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-neutral-400">Label</Label>
            <Input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Business Account A"
              className="bg-neutral-950 border-white/10"
            />
          </div>
          <div>
            <Label className="text-neutral-400">Credentials secret name</Label>
            <Input
              value={credentialsRef}
              onChange={(e) => setCredentialsRef(e.target.value)}
              placeholder="META_WABA_TOKEN_A"
              className="bg-neutral-950 border-white/10"
            />
            <div className="text-xs text-neutral-500 mt-1">
              Never paste secrets here. Store the value via Add Secret and reference its
              environment variable name.
            </div>
          </div>
          <div>
            <Label className="text-neutral-400">Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="bg-neutral-950 border-white/10"
            />
          </div>
        </div>
        <div className="mt-3">
          <Button
            disabled={!providerId || !label || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            Add account
          </Button>
        </div>
      </Card>

      <Card className="p-0 bg-neutral-900 border-white/10 overflow-hidden">
        <div className="p-4 text-sm font-semibold text-white">Accounts</div>
        <div className="divide-y divide-white/10">
          {accounts.length === 0 && (
            <div className="p-6 text-sm text-neutral-500 text-center">
              No accounts yet. Add one above.
            </div>
          )}
          {accounts.map((a) => {
            const p = providers.find((pp) => pp.id === a.provider_id);
            return (
              <div
                key={a.id}
                className="p-4 flex flex-wrap items-center gap-3 text-sm"
              >
                <div className="flex-1 min-w-[200px]">
                  <div className="text-white">{a.label}</div>
                  <div className="text-xs text-neutral-500">
                    {p ? `${p.channel} · ${p.display_name}` : a.provider_id}
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "border-white/20",
                    a.status === "connected" && "border-emerald-500/40 text-emerald-300",
                    a.status === "disconnected" && "border-neutral-500/40 text-neutral-300",
                    a.status === "error" && "border-rose-500/40 text-rose-300",
                  )}
                >
                  {a.status}
                </Badge>
                <div className="text-xs text-neutral-500">
                  {a.messages_today} msgs · {a.errors_today} errors
                </div>
                <div className="text-xs text-neutral-500">
                  {a.last_activity_at
                    ? format(new Date(a.last_activity_at), "MMM d, HH:mm")
                    : "no activity"}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => deleteMut.mutate(a.id)}
                  disabled={deleteMut.isPending}
                >
                  Remove
                </Button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function TemplatesTab({
  templates,
  onChanged,
}: {
  templates: Template[];
  onChanged: () => void;
}) {
  const upsertFn = useServerFn(upsertCommTemplate);
  const [edits, setEdits] = useState<Record<string, string>>({});

  const saveMut = useMutation({
    mutationFn: (t: Template) =>
      upsertFn({
        data: {
          id: t.id,
          channel: t.channel,
          key: t.key,
          name: t.name,
          body: edits[t.id] ?? t.body,
          enabled: t.enabled,
        },
      }),
    onSuccess: () => {
      toast.success("Template saved");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const g = new Map<string, Template[]>();
    for (const t of templates) {
      const arr = g.get(t.category) ?? [];
      arr.push(t);
      g.set(t.category, arr);
    }
    return Array.from(g.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [templates]);

  return (
    <div className="space-y-6">
      {grouped.map(([category, items]) => (
        <div key={category} className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-neutral-500">
            {category}
          </div>
          <div className="grid gap-3">
            {items.map((t) => (
              <Card key={t.id} className="p-4 bg-neutral-900 border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-white text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-neutral-500">
                      {t.channel} · {t.key}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => saveMut.mutate(t)}
                    disabled={saveMut.isPending}
                  >
                    Save
                  </Button>
                </div>
                <Textarea
                  defaultValue={t.body}
                  onChange={(e) =>
                    setEdits((s) => ({ ...s, [t.id]: e.target.value }))
                  }
                  rows={3}
                  className="bg-neutral-950 border-white/10 text-sm text-white"
                />
              </Card>
            ))}
          </div>
        </div>
      ))}
      {templates.length === 0 && (
        <Card className="p-6 text-center text-sm text-neutral-500 bg-neutral-900 border-white/10">
          No templates.
        </Card>
      )}
    </div>
  );
}

function DeliveryTable({
  deliveries,
  emptyLabel,
}: {
  deliveries: Delivery[];
  emptyLabel: string;
}) {
  return (
    <Card className="p-0 bg-neutral-900 border-white/10 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-neutral-950/60 text-xs uppercase text-neutral-500">
            <tr>
              <th className="text-left p-3">Time</th>
              <th className="text-left p-3">Tenant</th>
              <th className="text-left p-3">Recipient</th>
              <th className="text-left p-3">Channel</th>
              <th className="text-left p-3">Provider</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Duration</th>
              <th className="text-left p-3">Retries</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {deliveries.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-neutral-500">
                  {emptyLabel}
                </td>
              </tr>
            )}
            {deliveries.map((d) => (
              <tr key={d.id} className="text-neutral-300">
                <td className="p-3 whitespace-nowrap">
                  {format(new Date(d.created_at), "MMM d, HH:mm:ss")}
                </td>
                <td className="p-3 font-mono text-xs">{d.tenant_id.slice(0, 8)}</td>
                <td className="p-3">{d.recipient_number ?? d.recipient_name ?? "—"}</td>
                <td className="p-3 capitalize">{d.channel}</td>
                <td className="p-3">{d.provider ?? "—"}</td>
                <td className="p-3">
                  <Badge
                    variant="outline"
                    className={cn(
                      "border-white/20",
                      d.status === "delivered" && "border-emerald-500/40 text-emerald-300",
                      d.status === "sent" && "border-sky-500/40 text-sky-300",
                      d.status === "failed" && "border-rose-500/40 text-rose-300",
                      d.status === "queued" && "border-neutral-500/40 text-neutral-300",
                    )}
                  >
                    {d.status}
                  </Badge>
                </td>
                <td className="p-3">{d.duration_ms ? `${d.duration_ms} ms` : "—"}</td>
                <td className="p-3">{d.attempts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function QueueTab({ deliveries }: { deliveries: Delivery[] }) {
  const queued = deliveries.filter((d) => d.status === "queued" || d.status === "sent");
  return <DeliveryTable deliveries={queued} emptyLabel="Queue empty." />;
}

function LogsTab({ deliveries }: { deliveries: Delivery[] }) {
  return <DeliveryTable deliveries={deliveries} emptyLabel="No deliveries recorded." />;
}

function HealthTab({
  health,
}: {
  health: Awaited<ReturnType<typeof getGatewayHealth>> | undefined;
}) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <StatCard label="Messages 24h" value={health?.total ?? "—"} />
      <StatCard label="Delivered" value={health?.success ?? "—"} />
      <StatCard label="Failed" value={health?.failed ?? "—"} />
      <StatCard
        label="Success %"
        value={health ? `${health.successRate}%` : "—"}
      />
      <StatCard label="Avg delivery" value={health ? `${health.avgDurationMs} ms` : "—"} />
      <StatCard label="Queue size" value={health?.queueSize ?? "—"} />
      <StatCard label="API status" value="Nominal" hint="No provider alerts" />
      <StatCard label="Webhook status" value="Nominal" hint="No provider alerts" />
    </div>
  );
}

function CostsTab() {
  return (
    <Card className="p-8 text-center bg-neutral-900 border-white/10">
      <Coins className="h-8 w-8 mx-auto text-neutral-500 mb-2" />
      <div className="text-white font-medium">Cost tracking coming soon</div>
      <div className="text-sm text-neutral-500 mt-1 max-w-md mx-auto">
        Provider cost routing, per-tenant usage, and monthly invoicing are scaffolded and will
        light up once real adapters (Meta, BotBiz, Twilio) are activated.
      </div>
      <div className="mt-4 flex items-center justify-center gap-3 text-xs text-neutral-500">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="h-3 w-3 text-emerald-400" /> Gateway ready
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3 text-amber-400" /> Metering pending
        </span>
      </div>
    </Card>
  );
}

function ChannelsTab({
  channelRows,
  providers,
  active,
}: {
  channelRows: Channel[];
  providers: Provider[];
  active: Active[];
}) {
  const list = channelRows.length
    ? channelRows
    : (Array.from(new Set(providers.map((p) => p.channel))).map((c) => ({
        channel: c,
        display_name: c,
        description: null,
        enabled: true,
      })) as Channel[]);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {list.map((c) => {
        const chProviders = providers.filter((p) => p.channel === c.channel);
        const act = active.find((a) => a.channel === c.channel);
        const activeProv = providers.find((p) => p.id === act?.provider_id);
        return (
          <Card key={c.channel} className="p-4 bg-neutral-900 border-white/10">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-white text-sm font-semibold capitalize">
                  {c.display_name}
                </div>
                {c.description && (
                  <div className="text-xs text-neutral-500">{c.description}</div>
                )}
              </div>
              <Badge
                variant="outline"
                className={cn(
                  "border-white/20",
                  c.enabled ? "text-emerald-300 border-emerald-500/40" : "text-neutral-400",
                )}
              >
                {c.enabled ? "Enabled" : "Disabled"}
              </Badge>
            </div>
            <div className="grid gap-1 text-xs text-neutral-400">
              <div>
                Active provider:{" "}
                <span className="text-white">
                  {activeProv ? activeProv.display_name : "Not configured"}
                </span>
              </div>
              <div>Adapters available: {chProviders.length}</div>
              <div>
                Automation event type:{" "}
                <code className="text-neutral-300">notification.{c.channel}</code>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function PriorityTab({
  channels,
  providers,
  onChanged,
}: {
  channels: string[];
  providers: Provider[];
  onChanged: () => void;
}) {
  const setPriorityFn = useServerFn(setProviderPriority);
  const mutate = useMutation({
    mutationFn: (v: { providerId: string; priority: number }) =>
      setPriorityFn({ data: v }),
    onSuccess: () => {
      toast.success("Priority updated");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <Card className="p-4 bg-amber-500/5 border-amber-500/30">
        <div className="text-sm font-medium text-amber-200">Failover not yet wired</div>
        <div className="text-xs text-amber-200/70 mt-1">
          Providers are ordered here for future priority routing, cost routing, and automatic
          failover. Today the lowest-priority Active provider is used.
        </div>
      </Card>
      {channels.map((ch) => {
        const list = [...providers]
          .filter((p) => p.channel === ch)
          .sort((a, b) => a.priority - b.priority);
        return (
          <Card key={ch} className="p-4 bg-neutral-900 border-white/10">
            <div className="text-sm font-semibold text-white mb-3 capitalize">{ch}</div>
            <div className="grid gap-2">
              {list.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 rounded border border-white/10 px-3 py-2 text-sm"
                >
                  <span className="w-6 text-neutral-500">#{i + 1}</span>
                  <div className="flex-1">
                    <div className="text-white">{p.display_name}</div>
                    <div className="text-xs text-neutral-500">
                      {p.adapter_key} · priority {p.priority}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={mutate.isPending || i === 0}
                      onClick={() =>
                        mutate.mutate({
                          providerId: p.id,
                          priority: Math.max(0, p.priority - 10),
                        })
                      }
                    >
                      Up
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={mutate.isPending || i === list.length - 1}
                      onClick={() =>
                        mutate.mutate({
                          providerId: p.id,
                          priority: p.priority + 10,
                        })
                      }
                    >
                      Down
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function PreviewTab({ templates }: { templates: Template[] }) {
  const previewFn = useServerFn(previewCommTemplate);
  const [templateId, setTemplateId] = useState("");
  const [parent, setParent] = useState("Priya Sharma");
  const [student, setStudent] = useState("Arjun Sharma");
  const [rendered, setRendered] = useState<string | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      previewFn({
        data: {
          templateId,
          variables: { ParentName: parent, StudentName: student },
        },
      }),
    onSuccess: (r) => setRendered(r.rendered),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-4 bg-neutral-900 border-white/10 space-y-3">
        <div>
          <Label className="text-neutral-400">Template</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger className="bg-neutral-950 border-white/10">
              <SelectValue placeholder="Select…" />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.category} · {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-neutral-400">Sample parent</Label>
          <Input
            value={parent}
            onChange={(e) => setParent(e.target.value)}
            className="bg-neutral-950 border-white/10"
          />
        </div>
        <div>
          <Label className="text-neutral-400">Sample student</Label>
          <Input
            value={student}
            onChange={(e) => setStudent(e.target.value)}
            className="bg-neutral-950 border-white/10"
          />
        </div>
        <Button
          disabled={!templateId || mut.isPending}
          onClick={() => mut.mutate()}
        >
          Render preview
        </Button>
      </Card>
      <Card className="p-4 bg-neutral-900 border-white/10">
        <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
          Rendered message
        </div>
        <div className="min-h-[120px] whitespace-pre-wrap text-sm text-white">
          {rendered ?? (
            <span className="text-neutral-500">Pick a template and press Render.</span>
          )}
        </div>
      </Card>
    </div>
  );
}

function SandboxTab({
  templates,
  onSent,
}: {
  templates: Template[];
  onSent: () => void;
}) {
  const sendFn = useServerFn(sendSandboxMessage);
  const [channel, setChannel] = useState<"whatsapp" | "email" | "sms" | "push" | "webhook">(
    "whatsapp",
  );
  const [recipient, setRecipient] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [message, setMessage] = useState("");
  const [last, setLast] = useState<Awaited<
    ReturnType<typeof sendSandboxMessage>
  > | null>(null);

  const mut = useMutation({
    mutationFn: () =>
      sendFn({
        data: {
          channel,
          recipient,
          templateId: templateId || undefined,
          message: message || undefined,
        },
      }),
    onSuccess: (r) => {
      setLast(r);
      toast.success("Sent through gateway");
      onSent();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const eligibleTemplates = templates.filter((t) => t.channel === channel);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="p-4 bg-neutral-900 border-white/10 space-y-3">
        <div className="text-sm font-semibold text-white">Provider Sandbox</div>
        <div className="text-xs text-neutral-500 -mt-1">
          Requests pass through the Communication Gateway exactly like production.
        </div>
        <div>
          <Label className="text-neutral-400">Channel</Label>
          <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
            <SelectTrigger className="bg-neutral-950 border-white/10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["whatsapp", "email", "sms", "push", "webhook"].map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-neutral-400">Recipient</Label>
          <Input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="+91 90000 00000"
            className="bg-neutral-950 border-white/10"
          />
        </div>
        <div>
          <Label className="text-neutral-400">Template (optional)</Label>
          <Select value={templateId} onValueChange={setTemplateId}>
            <SelectTrigger className="bg-neutral-950 border-white/10">
              <SelectValue placeholder="No template — free-form message" />
            </SelectTrigger>
            <SelectContent>
              {eligibleTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.category} · {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-neutral-400">Message (if no template)</Label>
          <Textarea
            rows={3}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="bg-neutral-950 border-white/10 text-white"
          />
        </div>
        <Button
          disabled={!recipient || mut.isPending}
          onClick={() => mut.mutate()}
        >
          Send test
        </Button>
      </Card>
      <Card className="p-4 bg-neutral-900 border-white/10 text-sm space-y-2">
        <div className="text-xs uppercase tracking-wide text-neutral-500">Last request</div>
        {!last && (
          <div className="text-neutral-500">
            No test sent yet. Sends will surface observability details here.
          </div>
        )}
        {last && (
          <div className="space-y-1 text-neutral-300">
            <div>
              Request ID: <code className="text-white">{last.requestId}</code>
            </div>
            <div>Channel: {last.resolution.channel}</div>
            <div>
              Adapter:{" "}
              <span className="text-white">{last.resolution.adapterKey ?? "—"}</span>
            </div>
            <div>Account: {last.resolution.accountLabel ?? "—"}</div>
            <div>
              Provider ready:{" "}
              {last.resolution.ready ? (
                <span className="text-emerald-300">yes</span>
              ) : (
                <span className="text-amber-300">no (scaffold)</span>
              )}
            </div>
            <div>Secondaries prepared: {last.resolution.secondaryCount}</div>
            <div>
              Result:{" "}
              {last.result.ok ? (
                <span className="text-emerald-300">delivered</span>
              ) : (
                <span className="text-rose-300">{last.result.error ?? "failed"}</span>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function MonitorTab({
  monitor,
}: {
  monitor: Awaited<ReturnType<typeof getCommMonitor>> | undefined;
}) {
  if (!monitor) {
    return (
      <Card className="p-6 bg-neutral-900 border-white/10 text-neutral-400">
        Loading monitor…
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total 24h" value={monitor.total} />
        <StatCard label="Delivered" value={monitor.delivered} />
        <StatCard label="Failed" value={monitor.failed} />
        <StatCard label="Queued" value={monitor.queued} />
        <StatCard label="Retrying" value={monitor.retrying} />
        <StatCard label="Avg delivery" value={`${monitor.avgDurationMs} ms`} />
        <StatCard label="Queue size" value={monitor.queueSize} />
        <StatCard
          label="Last success"
          value={monitor.lastSuccessAt ? format(new Date(monitor.lastSuccessAt), "HH:mm") : "—"}
          hint={
            monitor.lastSuccessAt
              ? format(new Date(monitor.lastSuccessAt), "MMM d")
              : undefined
          }
        />
      </div>

      {monitor.lastError && (
        <Card className="p-4 bg-rose-500/5 border-rose-500/30 text-sm">
          <div className="text-rose-200 font-medium">
            Last error — {monitor.lastError.provider ?? "unknown"}
          </div>
          <div className="text-rose-200/80 text-xs mt-1">
            {format(new Date(monitor.lastError.at), "MMM d HH:mm")} —{" "}
            {monitor.lastError.message}
          </div>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <BreakdownCard title="Per channel" rows={monitor.byChannel} />
        <BreakdownCard title="Per provider" rows={monitor.byProvider} />
        <BreakdownCard title="Per tenant" rows={monitor.byTenant} />
      </div>
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
}: {
  title: string;
  rows: Array<{ key: string; total: number; delivered: number; failed: number }>;
}) {
  return (
    <Card className="p-4 bg-neutral-900 border-white/10">
      <div className="text-sm font-semibold text-white mb-2">{title}</div>
      <div className="space-y-1 text-sm">
        {rows.length === 0 && (
          <div className="text-neutral-500 text-xs">No data yet.</div>
        )}
        {rows.map((r) => (
          <div key={r.key} className="flex items-center justify-between gap-2">
            <span className="text-neutral-300 truncate">{r.key}</span>
            <span className="text-xs text-neutral-500">
              <span className="text-emerald-300">{r.delivered}</span> /{" "}
              <span className="text-rose-300">{r.failed}</span> / {r.total}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
