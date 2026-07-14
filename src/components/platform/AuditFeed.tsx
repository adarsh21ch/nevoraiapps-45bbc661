import { useQuery } from "@tanstack/react-query";
import { auditKeys, fetchAuditLog } from "@/lib/platform-audit";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollText } from "lucide-react";

export function AuditFeed({ tenantId, limit = 50 }: { tenantId?: string; limit?: number }) {
  const { data = [], isLoading } = useQuery({
    queryKey: auditKeys.list(tenantId ?? null),
    queryFn: () => fetchAuditLog(tenantId ?? null, limit),
  });

  return (
    <Card className="bg-neutral-900 border-white/10 text-neutral-100 overflow-hidden">
      <div className="p-3 border-b border-white/10 flex items-center gap-2 text-sm font-semibold">
        <ScrollText className="size-4" /> Audit trail
      </div>
      {isLoading ? (
        <div className="p-3 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 bg-white/5" />
          ))}
        </div>
      ) : data.length === 0 ? (
        <div className="p-6 text-center text-xs text-neutral-500">No audit events yet.</div>
      ) : (
        <div className="divide-y divide-white/5 max-h-[420px] overflow-y-auto">
          {data.map((row) => (
            <div key={row.id} className="p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-neutral-200">{row.action}</span>
                <span className="text-neutral-500">{new Date(row.created_at).toLocaleString()}</span>
              </div>
              <div className="mt-1 text-neutral-400 truncate">
                {row.target_type}
                {row.target_id ? ` · ${row.target_id.slice(0, 8)}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
