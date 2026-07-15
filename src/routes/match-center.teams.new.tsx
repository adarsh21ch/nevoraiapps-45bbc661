import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { ArrowLeft, Users2 } from "lucide-react";
import { PageHeader } from "@/components/match-center/MatchCenterLayout";
import { PlayerSelector } from "@/components/match-center/PlayerSelector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useDashboard } from "@/lib/dashboard-context";
import {
  AGE_GROUPS,
  addPlayersToTeam,
  createTeam,
  listStudents,
  TEAM_STATUSES,
} from "@/lib/mc-teams";
import { toast } from "sonner";

export const Route = createFileRoute("/match-center/teams/new")({
  head: () => ({
    meta: [{ title: "Create team · Match Center" }, { name: "robots", content: "noindex" }],
  }),
  component: CreateTeamPage,
});

const schema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  short_name: z.string().trim().max(12).optional().or(z.literal("")),
  age_group: z.string().max(20).optional(),
  age_group_custom: z.string().max(40).optional().or(z.literal("")),
  coach_name: z.string().trim().max(80).optional().or(z.literal("")),
  assistant_coach_name: z.string().trim().max(80).optional().or(z.literal("")),
  team_color: z.string().max(20).optional().or(z.literal("")),
  season: z.string().trim().max(40).optional().or(z.literal("")),
  description: z.string().max(600).optional().or(z.literal("")),
  status: z.enum(TEAM_STATUSES),
});

function CreateTeamPage() {
  const { tenant } = useDashboard();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    name: "",
    short_name: "",
    age_group: "U16",
    age_group_custom: "",
    coach_name: "",
    assistant_coach_name: "",
    team_color: "#E8873C",
    season: new Date().getFullYear().toString(),
    description: "",
    status: "active" as (typeof TEAM_STATUSES)[number],
  });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const studentsQ = useQuery({
    queryKey: ["mc-students", tenant.id],
    queryFn: () => listStudents(tenant.id),
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const create = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse(form);
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
      }
      const team = await createTeam({
        tenant_id: tenant.id,
        sport: "cricket",
        name: parsed.data.name,
        short_name: parsed.data.short_name || null,
        age_group: parsed.data.age_group || null,
        age_group_custom:
          parsed.data.age_group === "Custom" ? parsed.data.age_group_custom || null : null,
        coach_name: parsed.data.coach_name || null,
        assistant_coach_name: parsed.data.assistant_coach_name || null,
        team_color: parsed.data.team_color || null,
        season: parsed.data.season || null,
        description: parsed.data.description || null,
        status: parsed.data.status,
      });
      if (selectedIds.length) {
        await addPlayersToTeam(tenant.id, team.id, selectedIds);
      }
      return team;
    },
    onSuccess: (team) => {
      toast.success("Team created");
      qc.invalidateQueries({ queryKey: ["mc-teams", tenant.id] });
      navigate({ to: "/match-center/teams/$teamId", params: { teamId: team.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <PageHeader
        title="Create team"
        description="Set up a reusable squad. You'll pick a Playing XI later, per match."
        breadcrumbs={[
          { label: "Match Center", to: "/match-center/dashboard" },
          { label: "Teams", to: "/match-center/teams" },
          { label: "New" },
        ]}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/match-center/teams">
                <ArrowLeft className="size-4 mr-1.5" /> Cancel
              </Link>
            </Button>
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending || !form.name.trim()}
            >
              {create.isPending ? "Creating…" : "Create team"}
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Section title="Team details">
            <Grid>
              <Field label="Team name" required>
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="U16 Blue"
                  maxLength={80}
                />
              </Field>
              <Field label="Short name" hint="Shown on scoreboards. Up to 12 chars.">
                <Input
                  value={form.short_name}
                  onChange={(e) => set("short_name", e.target.value)}
                  placeholder="U16B"
                  maxLength={12}
                />
              </Field>
              <Field label="Age group">
                <SelectNative
                  value={form.age_group}
                  onChange={(v) => set("age_group", v)}
                  options={AGE_GROUPS.map((a) => ({ value: a, label: a }))}
                />
              </Field>
              {form.age_group === "Custom" && (
                <Field label="Custom age group">
                  <Input
                    value={form.age_group_custom}
                    onChange={(e) => set("age_group_custom", e.target.value)}
                    placeholder="e.g. Corporate League"
                    maxLength={40}
                  />
                </Field>
              )}
              <Field label="Season">
                <Input
                  value={form.season}
                  onChange={(e) => set("season", e.target.value)}
                  placeholder="2026"
                  maxLength={40}
                />
              </Field>
              <Field label="Status">
                <SelectNative
                  value={form.status}
                  onChange={(v) => set("status", v as (typeof TEAM_STATUSES)[number])}
                  options={TEAM_STATUSES.map((s) => ({ value: s, label: cap(s) }))}
                />
              </Field>
            </Grid>
          </Section>

          <Section title="Staff & branding">
            <Grid>
              <Field label="Coach">
                <Input
                  value={form.coach_name}
                  onChange={(e) => set("coach_name", e.target.value)}
                  placeholder="Head coach name"
                  maxLength={80}
                />
              </Field>
              <Field label="Assistant coach">
                <Input
                  value={form.assistant_coach_name}
                  onChange={(e) => set("assistant_coach_name", e.target.value)}
                  placeholder="Assistant coach name"
                  maxLength={80}
                />
              </Field>
              <Field label="Team color">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.team_color}
                    onChange={(e) => set("team_color", e.target.value)}
                    className="h-10 w-14 rounded-md border border-border cursor-pointer"
                  />
                  <Input
                    value={form.team_color}
                    onChange={(e) => set("team_color", e.target.value)}
                    className="flex-1"
                    maxLength={20}
                  />
                </div>
              </Field>
              <Field label="Description" wide>
                <Textarea
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="Short note about this team…"
                  maxLength={600}
                  rows={3}
                />
              </Field>
            </Grid>
          </Section>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <Section
            title="Squad"
            action={
              <span className="text-xs text-muted-foreground">{selectedIds.length} selected</span>
            }
          >
            <p className="mb-3 text-xs text-muted-foreground">
              Players come from your academy roster. This is your reusable squad — Playing XI is
              chosen at match time.
            </p>
            {studentsQ.isLoading ? (
              <div className="rounded-2xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                Loading academy roster…
              </div>
            ) : (studentsQ.data ?? []).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-10 text-center">
                <Users2 className="mx-auto size-6 mb-2 text-muted-foreground" />
                <div className="text-sm font-medium">No students yet</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Add students in the Academy module first — they become your player pool.
                </div>
                <Button asChild size="sm" variant="outline" className="mt-4">
                  <Link to="/dashboard/students">Manage students</Link>
                </Button>
              </div>
            ) : (
              <PlayerSelector
                students={studentsQ.data ?? []}
                selectedIds={selectedIds}
                onChange={setSelectedIds}
              />
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({
  label,
  hint,
  required,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <Label className="text-xs font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      <div className="mt-1.5">{children}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function SelectNative({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function cap(s: string) {
  return s[0].toUpperCase() + s.slice(1);
}
