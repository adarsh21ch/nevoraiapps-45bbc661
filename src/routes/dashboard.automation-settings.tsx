import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useDashboard } from "@/lib/dashboard-context";
import { OwnerOnly } from "@/components/dashboard/OwnerOnly";
import { ModuleHeader } from "@/components/shared/ModuleHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  loadWhatsAppConfig,
  saveWhatsAppConfig,
  loadWhatsAppRuleStatus,
  toggleWhatsAppRules,
} from "@/lib/automation/whatsapp-admin.functions";

export const Route = createFileRoute("/dashboard/automation-settings")({
  head: () => ({
    meta: [
      { title: "Automation Settings · AcademyOS" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <OwnerOnly>
      <AutomationSettingsPage />
    </OwnerOnly>
  ),
});

type AdapterKey = "mock" | "meta" | "botbiz";

const ADAPTERS: {
  key: AdapterKey;
  label: string;
  description: string;
  ready: boolean;
}[] = [
  {
    key: "mock",
    label: "Mock (simulated delivery)",
    description:
      "Simulates the full Queued → Sending → Delivered lifecycle. Safe for demos and testing.",
    ready: true,
  },
  {
    key: "meta",
    label: "Meta Cloud API",
    description: "Scaffolded — credentials not wired yet. Coming soon.",
    ready: false,
  },
  {
    key: "botbiz",
    label: "BotBiz",
    description: "Scaffolded — credentials not wired yet. Coming soon.",
    ready: false,
  },
];

function AutomationSettingsPage() {
  const { tenant } = useDashboard();
  const load = useServerFn(loadWhatsAppConfig);
  const save = useServerFn(saveWhatsAppConfig);
  const loadRules = useServerFn(loadWhatsAppRuleStatus);
  const toggleRules = useServerFn(toggleWhatsAppRules);

  const [adapter, setAdapter] = useState<AdapterKey>("mock");
  const [enabled, setEnabled] = useState(true);
  const [checkIn, setCheckIn] = useState(false);
  const [checkOut, setCheckOut] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [cfg, rules] = await Promise.all([
          load({ data: { tenantId: tenant.id } }),
          loadRules({ data: { tenantId: tenant.id } }),
        ]);
        if (!alive) return;
        setAdapter((cfg.adapter as AdapterKey) || "mock");
        setEnabled(cfg.enabled);
        setCheckIn(rules.checkIn);
        setCheckOut(rules.checkOut);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load settings");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [tenant.id, load, loadRules]);

  async function persist(next: { adapter?: AdapterKey; enabled?: boolean }) {
    setSaving(true);
    try {
      const finalAdapter = next.adapter ?? adapter;
      const finalEnabled = next.enabled ?? enabled;
      await save({
        data: { tenantId: tenant.id, adapter: finalAdapter, enabled: finalEnabled },
      });
      setAdapter(finalAdapter);
      setEnabled(finalEnabled);
      toast.success("WhatsApp provider updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function persistRules(next: { checkIn?: boolean; checkOut?: boolean }) {
    setSaving(true);
    try {
      const c = next.checkIn ?? checkIn;
      const o = next.checkOut ?? checkOut;
      await toggleRules({ data: { tenantId: tenant.id, checkIn: c, checkOut: o } });
      setCheckIn(c);
      setCheckOut(o);
      toast.success("Automation rules updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Automation Settings"
        description="Choose the WhatsApp provider and enable parent notifications."
      />

      <Card className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">WhatsApp Provider</h2>
            <p className="text-sm text-muted-foreground">
              Only the active adapter dispatches messages. Others are scaffolded.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Enabled</span>
            <Switch
              disabled={loading || saving}
              checked={enabled}
              onCheckedChange={(v) => persist({ enabled: v })}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {ADAPTERS.map((a) => {
            const active = adapter === a.key;
            return (
              <button
                key={a.key}
                type="button"
                disabled={loading || saving || !a.ready}
                onClick={() => persist({ adapter: a.key })}
                className={
                  "text-left rounded-lg border p-4 transition " +
                  (active
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-muted-foreground/30") +
                  (!a.ready ? " opacity-70 cursor-not-allowed" : "")
                }
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{a.label}</span>
                  {a.ready ? (
                    <Badge variant="secondary">Ready</Badge>
                  ) : (
                    <Badge variant="outline">Soon</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{a.description}</p>
                {active ? (
                  <p className="mt-2 text-xs font-medium text-primary">Selected</p>
                ) : null}
              </button>
            );
          })}
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold">Parent Notifications</h2>
          <p className="text-sm text-muted-foreground">
            When these rules are enabled, parents are notified automatically as
            students check in and out.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="font-medium">Check-in WhatsApp</div>
              <div className="text-xs text-muted-foreground">
                Triggered on <code>attendance.marked</code>
              </div>
            </div>
            <Switch
              disabled={loading || saving}
              checked={checkIn}
              onCheckedChange={(v) => persistRules({ checkIn: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <div className="font-medium">Check-out WhatsApp</div>
              <div className="text-xs text-muted-foreground">
                Triggered on <code>student.check_out</code>
              </div>
            </div>
            <Switch
              disabled={loading || saving}
              checked={checkOut}
              onCheckedChange={(v) => persistRules({ checkOut: v })}
            />
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" asChild size="sm">
            <a href="/dashboard/automation-test">Send test message</a>
          </Button>
          <Button variant="outline" asChild size="sm">
            <a href="/dashboard/automation">View delivery history</a>
          </Button>
        </div>
      </Card>
    </div>
  );
}
