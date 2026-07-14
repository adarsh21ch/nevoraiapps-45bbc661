import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { allPoliciesQuery, POLICY_LABELS, type PolicyDocument, type PolicyKind } from "@/lib/site-queries";
import { CheckCircle2, FileText } from "lucide-react";

const KINDS: PolicyKind[] = ["terms", "privacy", "refund", "fee", "conduct", "leave", "medical"];

export function PoliciesEditor({ tenantId }: { tenantId: string }) {
  const q = useQuery(allPoliciesQuery(tenantId));
  const rows = q.data ?? [];

  return (
    <Tabs defaultValue={KINDS[0]}>
      <TabsList className="w-full flex-wrap h-auto">
        {KINDS.map((k) => (
          <TabsTrigger key={k} value={k}>{POLICY_LABELS[k]}</TabsTrigger>
        ))}
      </TabsList>
      {KINDS.map((k) => (
        <TabsContent key={k} value={k} className="pt-4">
          <PolicyKindEditor tenantId={tenantId} kind={k} rows={rows.filter((r) => r.kind === k)} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

function PolicyKindEditor({ tenantId, kind, rows }: { tenantId: string; kind: PolicyKind; rows: PolicyDocument[] }) {
  const qc = useQueryClient();
  const latest = rows[0]; // rows sorted DESC by version
  const [title, setTitle] = useState(latest?.title ?? POLICY_LABELS[kind]);
  const [body, setBody] = useState(latest?.body_md ?? "");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["policy_documents", "all", tenantId] });
    qc.invalidateQueries({ queryKey: ["policy_documents", "published", tenantId] });
  };

  const saveDraft = useMutation({
    mutationFn: async () => {
      const nextVersion = (rows[0]?.version ?? 0) + 1;
      const { error } = await (supabase as any).from("policy_documents").insert({
        tenant_id: tenantId, kind, version: nextVersion, title, body_md: body, is_published: false,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Draft saved"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const publish = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("policy_documents")
        .update({ is_published: true, published_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Published"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const publishNow = useMutation({
    mutationFn: async () => {
      const nextVersion = (rows[0]?.version ?? 0) + 1;
      const { error } = await (supabase as any).from("policy_documents").insert({
        tenant_id: tenantId, kind, version: nextVersion, title, body_md: body,
        is_published: true, published_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("New version published"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <Card className="p-5 space-y-3">
        <div className="flex items-center gap-2">
          <FileText className="size-4 text-muted-foreground" />
          <div className="text-sm font-semibold">Edit {POLICY_LABELS[kind]}</div>
        </div>
        <div className="space-y-1.5">
          <Label>Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Body (plain text or Markdown)</Label>
          <Textarea rows={14} value={body} onChange={(e) => setBody(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => saveDraft.mutate()} disabled={saveDraft.isPending || !title.trim()}>
            Save as draft
          </Button>
          <Button
            onClick={() => publishNow.mutate()}
            disabled={publishNow.isPending || !title.trim()}
            style={{ backgroundColor: "var(--brand)", color: "white" }}
          >
            Publish new version
          </Button>
        </div>
      </Card>

      {rows.length > 0 && (
        <Card className="p-5">
          <div className="mb-3 text-sm font-semibold">Version history</div>
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <div className="font-medium">v{r.version} — {r.title}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.is_published
                      ? <>Published {r.published_at ? new Date(r.published_at).toLocaleString() : ""}</>
                      : "Draft"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {r.is_published ? (
                    <Badge variant="secondary"><CheckCircle2 className="mr-1 size-3" /> Live</Badge>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => publish.mutate(r.id)} disabled={publish.isPending}>
                      Publish
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
