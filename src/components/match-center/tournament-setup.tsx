/* ================================================================
 * Tournament Setup UI — Progress + Groups / Venues / Officials
 * ----------------------------------------------------------------
 * Presentation-only; delegates to src/lib/mc-tournament-setup.ts.
 * Reused by the Tournament Workspace and consumed by the Fixture
 * Engine's pre-flight check (Step 4).
 * ================================================================ */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  AlertCircle,
  CircleX,
  Loader2,
  Plus,
  Trash2,
  Wand2,
  Users,
  MapPin,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/match-center/ui";
import {
  listGroups,
  createGroup,
  deleteGroup,
  updateGroup,
  autoGenerateGroups,
  assignTeamToGroup,
  listVenues,
  createVenue,
  updateVenue,
  deleteVenue,
  listOfficials,
  createOfficial,
  deleteOfficial,
  evaluateReadiness,
  OFFICIAL_ROLES,
  PITCH_TYPES,
  type SetupCheck,
} from "@/lib/mc-tournament-setup";
import { listTournamentTeams } from "@/lib/mc-tournaments";

/* ================================================================
 * Setup Progress
 * ================================================================ */

export function SetupProgress({
  tournamentId,
  hasGroups,
}: {
  tournamentId: string;
  hasGroups: boolean;
}) {
  const q = useQuery({
    queryKey: ["mc-tournament-readiness", tournamentId, hasGroups],
    queryFn: () => evaluateReadiness({ tournamentId, hasGroups }),
  });

  if (q.isLoading || !q.data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">
        <Loader2 className="mr-2 inline size-4 animate-spin" /> Checking setup…
      </div>
    );
  }

  const okCount = q.data.checks.filter((c) => c.status === "ok").length;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Setup progress</div>
          <div className="text-xs text-muted-foreground">
            {okCount}/{q.data.checks.length} checks passing
          </div>
        </div>
        <span
          className={
            "rounded-full px-2 py-1 text-[11px] font-semibold uppercase tracking-wider " +
            (q.data.canGenerateFixtures
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-amber-500/10 text-amber-600")
          }
        >
          {q.data.canGenerateFixtures ? "Ready for fixtures" : "Setup required"}
        </span>
      </div>
      <ul className="grid gap-2 md:grid-cols-2">
        {q.data.checks.map((c) => (
          <CheckRow key={c.id} check={c} />
        ))}
      </ul>
    </div>
  );
}

function CheckRow({ check }: { check: SetupCheck }) {
  const Icon =
    check.status === "ok"
      ? CheckCircle2
      : check.status === "warn"
        ? AlertCircle
        : CircleX;
  const tone =
    check.status === "ok"
      ? "text-emerald-600"
      : check.status === "warn"
        ? "text-amber-600"
        : "text-rose-600";
  return (
    <li className="flex items-start gap-2 rounded-lg border border-border/60 bg-background p-2 text-sm">
      <Icon className={"mt-0.5 size-4 shrink-0 " + tone} />
      <div>
        <div className="font-medium">{check.label}</div>
        {check.detail ? (
          <div className="text-xs text-muted-foreground">{check.detail}</div>
        ) : null}
      </div>
    </li>
  );
}

/* ================================================================
 * Groups tab
 * ================================================================ */

export function GroupsTab({
  tenantId,
  tournamentId,
}: {
  tenantId: string;
  tournamentId: string;
}) {
  const qc = useQueryClient();
  const groupsQ = useQuery({
    queryKey: ["mc-tournament-groups", tournamentId],
    queryFn: () => listGroups(tournamentId),
  });
  const teamsQ = useQuery({
    queryKey: ["mc-tournament-teams", tournamentId],
    queryFn: () => listTournamentTeams(tournamentId),
  });

  const [count, setCount] = useState(2);
  const [qualify, setQualify] = useState(2);
  const [newName, setNewName] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["mc-tournament-groups", tournamentId] });
    qc.invalidateQueries({ queryKey: ["mc-tournament-teams", tournamentId] });
    qc.invalidateQueries({ queryKey: ["mc-tournament-readiness", tournamentId] });
  };

  const auto = useMutation({
    mutationFn: async () => {
      const teamIds = (teamsQ.data ?? []).map((t) => t.id);
      if (teamIds.length < 2) throw new Error("Register teams first");
      await autoGenerateGroups({
        tenantId,
        tournamentId,
        groupCount: count,
        teamIds,
        qualifyPerGroup: qualify,
      });
    },
    onSuccess: () => {
      toast.success("Groups generated");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const add = useMutation({
    mutationFn: async () => {
      const name = newName.trim();
      if (!name) throw new Error("Group name required");
      await createGroup({
        tenant_id: tenantId,
        tournament_id: tournamentId,
        name,
        display_order: (groupsQ.data ?? []).length,
        qualify_count: qualify,
      });
    },
    onSuccess: () => {
      setNewName("");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteGroup(id),
    onSuccess: invalidate,
  });

  const rename = useMutation({
    mutationFn: async (v: { id: string; name: string }) => {
      await updateGroup(v.id, { name: v.name });
    },
    onSuccess: invalidate,
  });

  const setQualifyMut = useMutation({
    mutationFn: async (v: { id: string; qualify_count: number }) => {
      await updateGroup(v.id, { qualify_count: v.qualify_count });
    },
    onSuccess: invalidate,
  });

  const assign = useMutation({
    mutationFn: async (v: { regId: string; groupId: string | null }) => {
      await assignTeamToGroup(v.regId, v.groupId);
    },
    onSuccess: invalidate,
  });

  const groups = groupsQ.data ?? [];
  const teams = teamsQ.data ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 text-sm font-semibold">Auto-generate groups</div>
        <div className="grid gap-2 md:grid-cols-4">
          <div>
            <Label className="text-xs">Number of groups</Label>
            <Input
              type="number"
              min={1}
              max={16}
              value={count}
              onChange={(e) => setCount(Number(e.target.value) || 2)}
            />
          </div>
          <div>
            <Label className="text-xs">Qualify per group</Label>
            <Input
              type="number"
              min={1}
              max={8}
              value={qualify}
              onChange={(e) => setQualify(Number(e.target.value) || 2)}
            />
          </div>
          <div className="md:col-span-2 flex items-end">
            <Button
              onClick={() => auto.mutate()}
              disabled={auto.isPending || teams.length < 2}
              className="w-full md:w-auto"
            >
              {auto.isPending ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Wand2 className="mr-2 size-4" />
              )}
              Distribute {teams.length} team{teams.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Uses a snake distribution so seeded strengths balance across groups.
          Re-running clears existing group assignments.
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 flex items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Add group manually (e.g. Group C)"
            className="max-w-xs"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => add.mutate()}
            disabled={add.isPending}
          >
            <Plus className="mr-1 size-4" /> Add
          </Button>
        </div>
      </div>

      {groups.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No groups yet"
          description="Auto-generate groups or add one manually."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((g) => {
            const inGroup = teams.filter((t) => t.group_id === g.id);
            return (
              <div
                key={g.id}
                className="rounded-2xl border border-border bg-card p-3"
              >
                <div className="mb-2 flex items-center gap-2">
                  <Input
                    defaultValue={g.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== g.name) rename.mutate({ id: g.id, name: v });
                    }}
                    className="h-8 text-sm font-semibold"
                  />
                  <div className="flex items-center gap-1">
                    <Label className="text-[11px] text-muted-foreground">
                      Qual
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      max={8}
                      defaultValue={g.qualify_count}
                      onBlur={(e) => {
                        const v = Number(e.target.value) || 1;
                        if (v !== g.qualify_count)
                          setQualifyMut.mutate({
                            id: g.id,
                            qualify_count: v,
                          });
                      }}
                      className="h-8 w-14 text-sm"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Delete group"
                    onClick={() => del.mutate(g.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                {inGroup.length === 0 ? (
                  <div className="rounded-md border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
                    No teams assigned yet.
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {inGroup.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1 text-sm"
                      >
                        <span>{t.team?.name ?? "Team"}</span>
                        <select
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                          value={g.id}
                          onChange={(e) =>
                            assign.mutate({
                              regId: t.id,
                              groupId: e.target.value || null,
                            })
                          }
                        >
                          {groups.map((gg) => (
                            <option key={gg.id} value={gg.id}>
                              {gg.name}
                            </option>
                          ))}
                          <option value="">Unassigned</option>
                        </select>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}

          {/* Unassigned teams */}
          {teams.some((t) => !t.group_id) && (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-3">
              <div className="mb-2 text-sm font-semibold">Unassigned</div>
              <ul className="space-y-1">
                {teams
                  .filter((t) => !t.group_id)
                  .map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between rounded-md bg-background px-2 py-1 text-sm"
                    >
                      <span>{t.team?.name ?? "Team"}</span>
                      <select
                        className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                        value=""
                        onChange={(e) =>
                          assign.mutate({
                            regId: t.id,
                            groupId: e.target.value || null,
                          })
                        }
                      >
                        <option value="">Assign to group…</option>
                        {groups.map((gg) => (
                          <option key={gg.id} value={gg.id}>
                            {gg.name}
                          </option>
                        ))}
                      </select>
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================
 * Venues tab
 * ================================================================ */

export function VenuesTab({
  tenantId,
  tournamentId,
}: {
  tenantId: string;
  tournamentId: string;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["mc-tournament-venues", tournamentId],
    queryFn: () => listVenues(tournamentId),
  });

  const [form, setForm] = useState({
    name: "",
    city: "",
    address: "",
    pitch_type: "Turf",
    capacity: "",
    notes: "",
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["mc-tournament-venues", tournamentId] });
    qc.invalidateQueries({ queryKey: ["mc-tournament-readiness", tournamentId] });
  };

  const add = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name required");
      await createVenue({
        tenant_id: tenantId,
        tournament_id: tournamentId,
        name: form.name.trim(),
        city: form.city.trim() || null,
        address: form.address.trim() || null,
        pitch_type: form.pitch_type || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        notes: form.notes.trim() || null,
      });
    },
    onSuccess: () => {
      setForm({
        name: "",
        city: "",
        address: "",
        pitch_type: "Turf",
        capacity: "",
        notes: "",
      });
      toast.success("Venue added");
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteVenue(id),
    onSuccess: invalidate,
  });

  const save = useMutation({
    mutationFn: async (v: {
      id: string;
      patch: Parameters<typeof updateVenue>[1];
    }) => {
      await updateVenue(v.id, v.patch);
    },
    onSuccess: invalidate,
  });

  const venues = q.data ?? [];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 text-sm font-semibold">Add venue</div>
        <div className="grid gap-2 md:grid-cols-3">
          <div className="md:col-span-1">
            <Label className="text-xs">Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Ground name"
            />
          </div>
          <div>
            <Label className="text-xs">City</Label>
            <Input
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Pitch</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.pitch_type}
              onChange={(e) => setForm({ ...form, pitch_type: e.target.value })}
            >
              {PITCH_TYPES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">Address</Label>
            <Input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Capacity</Label>
            <Input
              type="number"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
            />
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs">Notes</Label>
            <Textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Boundary size, floodlights, availability windows…"
            />
          </div>
        </div>
        <div className="mt-2 flex justify-end">
          <Button onClick={() => add.mutate()} disabled={add.isPending}>
            {add.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Plus className="mr-2 size-4" />
            )}
            Add venue
          </Button>
        </div>
      </div>

      {venues.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="No venues yet"
          description="Add at least one venue so fixtures can be scheduled."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {venues.map((v) => (
            <div
              key={v.id}
              className="rounded-2xl border border-border bg-card p-3"
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Input
                    defaultValue={v.name}
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      if (val && val !== v.name)
                        save.mutate({ id: v.id, patch: { name: val } });
                    }}
                    className="h-8 text-sm font-semibold"
                  />
                  <div className="mt-1 text-xs text-muted-foreground">
                    {[v.city, v.pitch_type, v.capacity ? `cap ${v.capacity}` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete venue"
                  onClick={() => del.mutate(v.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
              {v.address ? (
                <div className="text-xs text-muted-foreground">{v.address}</div>
              ) : null}
              {v.notes ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  {v.notes}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
 * Officials tab
 * ================================================================ */

export function OfficialsTab({
  tenantId,
  tournamentId,
}: {
  tenantId: string;
  tournamentId: string;
}) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["mc-tournament-officials", tournamentId],
    queryFn: () => listOfficials(tournamentId),
  });

  const [form, setForm] = useState({
    name: "",
    role: "umpire",
    contact: "",
    notes: "",
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["mc-tournament-officials", tournamentId] });
    qc.invalidateQueries({ queryKey: ["mc-tournament-readiness", tournamentId] });
  };

  const add = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Name required");
      await createOfficial({
        tenant_id: tenantId,
        tournament_id: tournamentId,
        name: form.name.trim(),
        role: form.role,
        contact: form.contact.trim() || null,
        notes: form.notes.trim() || null,
      });
    },
    onSuccess: () => {
      setForm({ name: "", role: form.role, contact: "", notes: "" });
      invalidate();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteOfficial(id),
    onSuccess: invalidate,
  });

  const officials = q.data ?? [];
  const byRole = OFFICIAL_ROLES.map((r) => ({
    ...r,
    people: officials.filter((o) => o.role === r.value),
  }));

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-2 text-sm font-semibold">Add official</div>
        <div className="grid gap-2 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label className="text-xs">Name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <Label className="text-xs">Role</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
            >
              {OFFICIAL_ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs">Contact</Label>
            <Input
              value={form.contact}
              onChange={(e) => setForm({ ...form, contact: e.target.value })}
              placeholder="Phone / email"
            />
          </div>
          <div className="md:col-span-4">
            <Label className="text-xs">Notes</Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Availability or accreditation"
            />
          </div>
        </div>
        <div className="mt-2 flex justify-end">
          <Button onClick={() => add.mutate()} disabled={add.isPending}>
            {add.isPending ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Plus className="mr-2 size-4" />
            )}
            Add official
          </Button>
        </div>
      </div>

      {officials.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="No officials yet"
          description="Add umpires, scorers and match referees before generating fixtures."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {byRole
            .filter((r) => r.people.length > 0)
            .map((r) => (
              <div
                key={r.value}
                className="rounded-2xl border border-border bg-card p-3"
              >
                <div className="mb-2 text-sm font-semibold">
                  {r.label}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {r.people.length}
                  </span>
                </div>
                <ul className="space-y-1">
                  {r.people.map((o) => (
                    <li
                      key={o.id}
                      className="flex items-center justify-between rounded-md bg-muted/40 px-2 py-1 text-sm"
                    >
                      <div>
                        <div className="font-medium">{o.name}</div>
                        {o.contact ? (
                          <div className="text-[11px] text-muted-foreground">
                            {o.contact}
                          </div>
                        ) : null}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove official"
                        onClick={() => del.mutate(o.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Per-match official assignment (with conflict detection) unlocks alongside
        the Fixture Engine in the next step; the tournament-level roster you
        build here is the source of truth.
      </p>
    </div>
  );
}
