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
} from "lucide-react";
import { format } from "date-fns";

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

  return (
    <div className="grid gap-3">
      {templates.map((t) => (
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
            onChange={(e) => setEdits((s) => ({ ...s, [t.id]: e.target.value }))}
            rows={3}
            className="bg-neutral-950 border-white/10 text-sm text-white"
          />
        </Card>
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
