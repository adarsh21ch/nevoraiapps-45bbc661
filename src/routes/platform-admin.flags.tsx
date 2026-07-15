import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTenants, pqk } from "@/lib/platform-queries";
import { setTenantFeature } from "@/lib/platform-support";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getFeatures } from "@/lib/tenant";

export const Route = createFileRoute("/platform-admin/flags")({
  component: Flags,
});

const FLAGS: { key: string; label: string }[] = [
  { key: "attendance", label: "Attendance" },
  { key: "fee_tracking", label: "Billing" },
  { key: "online_registration", label: "Registration" },
  { key: "whatsapp_reminders", label: "Comms · WhatsApp" },
  { key: "powered_by_badge", label: "Powered-by badge" },
];

function Flags() {
  const qc = useQueryClient();
  const { data: tenants = [], isLoading } = useQuery({
    queryKey: pqk.tenants,
    queryFn: fetchTenants,
  });

  const toggle = useMutation({
    mutationFn: async (v: { tenantId: string; key: string; enabled: boolean }) =>
      setTenantFeature(v.tenantId, v.key, v.enabled),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pqk.tenants });
      toast.success("Flag updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Sparkles className="size-6" /> Feature flags
        </h1>
        <p className="text-sm text-neutral-400">Toggle modules per academy. Writes are audited.</p>
      </header>

      <Card className="bg-neutral-900 border-white/10 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-widest text-neutral-400 border-b border-white/10">
            <tr>
              <th className="p-3 text-left">Academy</th>
              {FLAGS.map((f) => (
                <th key={f.key} className="p-3 text-center">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading && (
              <tr>
                <td colSpan={FLAGS.length + 1} className="p-6 text-center text-neutral-500">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading &&
              tenants.map((t) => {
                const feats = getFeatures(t as any) as Record<string, boolean>;
                return (
                  <tr key={t.id}>
                    <td className="p-3">
                      <div className="font-medium truncate">{t.name}</div>
                      <div className="text-xs text-neutral-500">/{t.slug}</div>
                    </td>
                    {FLAGS.map((f) => (
                      <td key={f.key} className="p-3 text-center">
                        <Switch
                          checked={!!feats[f.key]}
                          onCheckedChange={(enabled) =>
                            toggle.mutate({ tenantId: t.id, key: f.key, enabled })
                          }
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
