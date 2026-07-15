import { Badge } from "@/components/ui/badge";

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    suspended: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    trial: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  };
  return (
    <Badge
      variant="outline"
      className={`capitalize ${map[status] ?? "bg-white/5 text-neutral-300 border-white/10"}`}
    >
      {status}
    </Badge>
  );
}

export function SubChip({ sub }: { sub: string }) {
  const map: Record<string, string> = {
    paid: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    due: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    overdue: "bg-rose-500/15 text-rose-300 border-rose-500/30",
  };
  return (
    <Badge
      variant="outline"
      className={`capitalize ${map[sub] ?? "bg-white/5 text-neutral-300 border-white/10"}`}
    >
      {sub}
    </Badge>
  );
}
