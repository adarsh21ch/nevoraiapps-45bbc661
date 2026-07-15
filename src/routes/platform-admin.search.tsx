import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { fetchTenants, pqk } from "@/lib/platform-queries";
import { supabase } from "@/integrations/supabase/client";
import { Search } from "lucide-react";

export const Route = createFileRoute("/platform-admin/search")({
  component: SearchPage,
});

function SearchPage() {
  const [q, setQ] = useState("");
  const { data: tenants = [] } = useQuery({ queryKey: pqk.tenants, queryFn: fetchTenants });

  const students = useQuery({
    enabled: q.length >= 2,
    queryKey: ["platform", "search", "students", q],
    queryFn: async () => {
      const { data } = await supabase
        .from("students")
        .select("id, name, player_id, tenant_id")
        .ilike("name", `%${q}%`)
        .limit(20);
      return data ?? [];
    },
  });

  const tenantHits = useMemo(() => {
    if (q.length < 2) return [];
    const needle = q.toLowerCase();
    return tenants.filter((t) =>
      `${t.name} ${t.slug} ${t.custom_domain ?? ""} ${t.email ?? ""}`
        .toLowerCase()
        .includes(needle),
    );
  }, [tenants, q]);

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
          <Search className="size-6" /> Global search
        </h1>
        <p className="text-sm text-neutral-400">
          Academies, domains and students across the platform.
        </p>
      </header>

      <Card className="p-3 bg-neutral-900 border-white/10">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search everything (min 2 chars)…"
          className="bg-neutral-950 border-white/10 text-white"
          autoFocus
        />
      </Card>

      {q.length >= 2 && (
        <>
          <Section title={`Academies · ${tenantHits.length}`}>
            {tenantHits.map((t) => (
              <Link
                key={t.id}
                to="/platform-admin/tenants/$id"
                params={{ id: t.id }}
                className="flex items-center justify-between p-3 hover:bg-white/5"
              >
                <div>
                  <div className="font-medium">{t.name}</div>
                  <div className="text-xs text-neutral-500">
                    /{t.slug} · {t.custom_domain ?? "no domain"}
                  </div>
                </div>
                <span className="text-xs text-neutral-400 capitalize">{t.status}</span>
              </Link>
            ))}
          </Section>

          <Section title={`Students · ${students.data?.length ?? 0}`}>
            {(students.data ?? []).map((s: any) => (
              <Link
                key={s.id}
                to="/platform-admin/tenants/$id"
                params={{ id: s.tenant_id }}
                className="flex items-center justify-between p-3 hover:bg-white/5"
              >
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-neutral-500 font-mono">{s.player_id ?? "—"}</div>
                </div>
                <span className="text-xs text-neutral-400">
                  {tenants.find((t) => t.id === s.tenant_id)?.name ?? ""}
                </span>
              </Link>
            ))}
          </Section>
        </>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-neutral-900 border-white/10 divide-y divide-white/5 overflow-hidden">
      <div className="p-3 text-xs uppercase tracking-widest text-neutral-400 border-b border-white/10">
        {title}
      </div>
      {children}
    </Card>
  );
}
