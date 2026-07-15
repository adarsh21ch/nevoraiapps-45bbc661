import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/platform-admin/sports")({
  component: SportsPage,
});

type Sport = {
  id: string;
  key: string;
  name: string;
  icon: string;
  status: "enabled" | "disabled";
  version: string;
  launch_date: string | null;
  blurb: string | null;
  sort_order: number;
};

function SportsPage() {
  const qc = useQueryClient();
  const { data: sports = [], isLoading } = useQuery({
    queryKey: ["platform_sports", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_sports")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as Sport[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (row: Partial<Sport> & { key: string; name: string }) => {
      const { error } = await supabase.from("platform_sports").upsert(row, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform_sports"] });
      toast.success("Saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-5 max-w-4xl">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Supported sports</h1>
          <p className="text-sm text-neutral-400">
            Sports enabled here appear in the onboarding wizard. Disable a sport to hide it from new tenants.
          </p>
        </div>
        <Button onClick={() => setAdding(true)} className="gap-1"><Plus className="size-4" /> Add sport</Button>
      </header>

      {adding && (
        <SportEditor
          initial={{ key: "", name: "", icon: "🎯", status: "disabled", version: "v0", launch_date: null, blurb: "", sort_order: (sports.at(-1)?.sort_order ?? 0) + 10 }}
          onCancel={() => setAdding(false)}
          onSave={async (row) => { await upsert.mutateAsync(row); setAdding(false); }}
        />
      )}

      {isLoading ? (
        <Card className="bg-neutral-900 border-white/10 text-neutral-300 p-6">Loading…</Card>
      ) : (
        <div className="grid gap-3">
          {sports.map((s) => (
            <SportRow key={s.id} sport={s} onSave={(patch) => upsert.mutateAsync({ ...s, ...patch })} />
          ))}
        </div>
      )}
    </div>
  );
}

function SportRow({ sport, onSave }: { sport: Sport; onSave: (patch: Partial<Sport>) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <SportEditor
        initial={sport}
        lockKey
        onCancel={() => setEditing(false)}
        onSave={async (row) => { await onSave(row); setEditing(false); }}
      />
    );
  }
  return (
    <Card className="bg-neutral-900 border-white/10 text-neutral-100 p-4 flex items-center gap-4">
      <div className="text-3xl">{sport.icon}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-semibold">{sport.name}</div>
          <Badge variant="outline" className={sport.status === "enabled" ? "border-emerald-500/40 text-emerald-300" : "border-white/10 text-neutral-400"}>
            {sport.status}
          </Badge>
          <span className="text-xs text-neutral-500">{sport.version}</span>
          {sport.launch_date && <span className="text-xs text-neutral-500">· launches {sport.launch_date}</span>}
        </div>
        {sport.blurb && <div className="text-xs text-neutral-400 mt-0.5 line-clamp-1">{sport.blurb}</div>}
      </div>
      <div className="flex items-center gap-2">
        <Switch
          checked={sport.status === "enabled"}
          onCheckedChange={(v) => onSave({ status: v ? "enabled" : "disabled" })}
        />
        <Button variant="ghost" className="text-white hover:bg-white/10" onClick={() => setEditing(true)}>Edit</Button>
      </div>
    </Card>
  );
}

function SportEditor({
  initial, onSave, onCancel, lockKey = false,
}: {
  initial: Partial<Sport> & { key: string; name: string };
  onSave: (row: Partial<Sport> & { key: string; name: string }) => Promise<void>;
  onCancel: () => void;
  lockKey?: boolean;
}) {
  const [row, setRow] = useState({ ...initial });
  return (
    <Card className="bg-neutral-900 border-white/10 text-neutral-100 p-4 space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label className="text-neutral-300">Key *</Label>
          <Input disabled={lockKey} value={row.key ?? ""} onChange={(e) => setRow({ ...row, key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })} placeholder="e.g. football" className="bg-neutral-950 border-white/10 text-white" />
        </div>
        <div>
          <Label className="text-neutral-300">Name *</Label>
          <Input value={row.name ?? ""} onChange={(e) => setRow({ ...row, name: e.target.value })} className="bg-neutral-950 border-white/10 text-white" />
        </div>
        <div>
          <Label className="text-neutral-300">Icon (emoji)</Label>
          <Input value={row.icon ?? "🎯"} onChange={(e) => setRow({ ...row, icon: e.target.value })} className="bg-neutral-950 border-white/10 text-white" />
        </div>
        <div>
          <Label className="text-neutral-300">Version</Label>
          <Input value={row.version ?? "v1"} onChange={(e) => setRow({ ...row, version: e.target.value })} className="bg-neutral-950 border-white/10 text-white" />
        </div>
        <div>
          <Label className="text-neutral-300">Launch date</Label>
          <Input type="date" value={row.launch_date ?? ""} onChange={(e) => setRow({ ...row, launch_date: e.target.value || null })} className="bg-neutral-950 border-white/10 text-white" />
        </div>
        <div>
          <Label className="text-neutral-300">Sort order</Label>
          <Input type="number" value={row.sort_order ?? 100} onChange={(e) => setRow({ ...row, sort_order: parseInt(e.target.value || "100", 10) })} className="bg-neutral-950 border-white/10 text-white" />
        </div>
      </div>
      <div>
        <Label className="text-neutral-300">Blurb</Label>
        <Textarea rows={2} value={row.blurb ?? ""} onChange={(e) => setRow({ ...row, blurb: e.target.value })} className="bg-neutral-950 border-white/10 text-white" />
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={row.status === "enabled"} onCheckedChange={(v) => setRow({ ...row, status: v ? "enabled" : "disabled" })} />
        <span className="text-sm text-neutral-300">{row.status === "enabled" ? "Enabled — visible in onboarding" : "Disabled — hidden from onboarding"}</span>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="ghost" className="text-white hover:bg-white/10" onClick={onCancel}>Cancel</Button>
        <Button
          onClick={() => {
            if (!row.key || !row.name) { toast.error("Key and name are required"); return; }
            onSave(row as Partial<Sport> & { key: string; name: string });
          }}
        >Save</Button>
      </div>
    </Card>
  );
}
