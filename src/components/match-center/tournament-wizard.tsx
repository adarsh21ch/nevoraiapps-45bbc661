/* ================================================================
 * Tournament Creation Wizard
 * ----------------------------------------------------------------
 * Multi-step form that produces a single mc_tournaments row.
 * Reuses createTournament + generateUniqueSlug from mc-tournaments.
 * No new business logic — the wizard is pure presentation over the
 * existing Tournament Engine.
 * ================================================================ */

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Trophy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import {
  createTournament,
  generateUniqueSlug,
  slugify,
  TOURNAMENT_TYPES,
  TOURNAMENT_FORMATS,
  TOURNAMENT_VISIBILITIES,
  type MCTournament,
} from "@/lib/mc-tournaments";
import { AGE_GROUPS } from "@/lib/mc-teams";

const STEPS = [
  { id: "basics", label: "Basics" },
  { id: "structure", label: "Structure" },
  { id: "schedule", label: "Schedule" },
  { id: "rules", label: "Rules & Points" },
  { id: "branding", label: "Branding" },
  { id: "review", label: "Review" },
] as const;

type StepId = (typeof STEPS)[number]["id"];

interface WizardState {
  name: string;
  description: string;
  season: string;
  ageGroup: string;
  tournamentType: string;
  format: string;
  overs: number;
  hasGroups: boolean;
  hasKnockout: boolean;
  thirdPlaceMatch: boolean;
  maxTeams: number;
  startDate: string;
  endDate: string;
  ground: string;
  city: string;
  country: string;
  pointsWin: number;
  pointsTie: number;
  pointsLoss: number;
  pointsNR: number;
  tiebreakRules: string[];
  logoUrl: string;
  bannerUrl: string;
  visibility: string;
  slug: string;
  slugTouched: boolean;
}

const TIEBREAKS = [
  { id: "nrr", label: "Net Run Rate" },
  { id: "head_to_head", label: "Head-to-Head" },
  { id: "wins", label: "Total Wins" },
  { id: "runs_scored", label: "Runs Scored" },
];

function initialState(): WizardState {
  return {
    name: "",
    description: "",
    season: String(new Date().getFullYear()),
    ageGroup: "Senior",
    tournamentType: "league",
    format: "T20",
    overs: 20,
    hasGroups: false,
    hasKnockout: false,
    thirdPlaceMatch: false,
    maxTeams: 16,
    startDate: "",
    endDate: "",
    ground: "",
    city: "",
    country: "",
    pointsWin: 2,
    pointsTie: 1,
    pointsLoss: 0,
    pointsNR: 1,
    tiebreakRules: ["nrr", "head_to_head"],
    logoUrl: "",
    bannerUrl: "",
    visibility: "internal",
    slug: "",
    slugTouched: false,
  };
}

export function TournamentWizard({
  open,
  onOpenChange,
  tenantId,
  createdBy,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId: string;
  createdBy: string | null;
  onCreated: (t: MCTournament) => void;
}) {
  const [step, setStep] = useState<StepId>("basics");
  const [state, setState] = useState<WizardState>(initialState);

  const setField = <K extends keyof WizardState>(k: K, v: WizardState[K]) =>
    setState((s) => ({ ...s, [k]: v }));

  // Auto-derive structure toggles from tournament type unless user overrides.
  const derivedType = useMemo(() => {
    switch (state.tournamentType) {
      case "league":
      case "round_robin":
      case "practice_series":
        return { hasGroups: false, hasKnockout: false };
      case "knockout":
        return { hasGroups: false, hasKnockout: true };
      case "league_knockout":
        return { hasGroups: true, hasKnockout: true };
      default:
        return null;
    }
  }, [state.tournamentType]);

  const idx = STEPS.findIndex((s) => s.id === step);
  const isLast = idx === STEPS.length - 1;
  const isFirst = idx === 0;

  const reset = () => {
    setState(initialState());
    setStep("basics");
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!state.name.trim()) throw new Error("Tournament name is required");
      const baseSlug = state.slugTouched ? slugify(state.slug) : slugify(state.name);
      const slug = await generateUniqueSlug(tenantId, baseSlug);
      const hasGroups = derivedType?.hasGroups ?? state.hasGroups;
      const hasKnockout = derivedType?.hasKnockout ?? state.hasKnockout;
      return await createTournament({
        tenant_id: tenantId,
        name: state.name.trim(),
        description: state.description.trim() || null,
        slug,
        season: state.season.trim() || null,
        age_group: state.ageGroup,
        tournament_type: state.tournamentType,
        format: state.format,
        overs: state.overs,
        has_groups: hasGroups,
        has_knockout: hasKnockout,
        third_place_match: state.thirdPlaceMatch,
        max_teams: state.maxTeams,
        start_date: state.startDate || null,
        end_date: state.endDate || null,
        ground_name: state.ground.trim() || null,
        city: state.city.trim() || null,
        country: state.country.trim() || null,
        points_for_win: state.pointsWin,
        points_for_tie: state.pointsTie,
        points_for_loss: state.pointsLoss,
        points_for_no_result: state.pointsNR,
        tiebreak_rules: state.tiebreakRules,
        logo_url: state.logoUrl.trim() || null,
        banner_url: state.bannerUrl.trim() || null,
        visibility: state.visibility,
        published: false,
        created_by: createdBy,
      });
    },
    onSuccess: (t) => {
      toast.success("Tournament created");
      onCreated(t);
      onOpenChange(false);
      reset();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create tournament"),
  });

  const canAdvance = (): boolean => {
    if (step === "basics") return state.name.trim().length > 0;
    return true;
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="size-5" />
            Create tournament
          </DialogTitle>
        </DialogHeader>

        <Stepper current={idx} />

        <div className="mt-2 min-h-[280px]">
          {step === "basics" && <StepBasics state={state} setField={setField} />}
          {step === "structure" && (
            <StepStructure state={state} setField={setField} derived={derivedType} />
          )}
          {step === "schedule" && <StepSchedule state={state} setField={setField} />}
          {step === "rules" && <StepRules state={state} setField={setField} />}
          {step === "branding" && <StepBranding state={state} setField={setField} />}
          {step === "review" && <StepReview state={state} derived={derivedType} />}
        </div>

        <div className="mt-4 flex items-center justify-between border-t pt-4">
          <Button
            variant="ghost"
            onClick={() => {
              if (isFirst) {
                onOpenChange(false);
                reset();
              } else {
                setStep(STEPS[idx - 1].id);
              }
            }}
          >
            <ChevronLeft className="size-4 mr-1" />
            {isFirst ? "Cancel" : "Back"}
          </Button>
          {!isLast ? (
            <Button onClick={() => setStep(STEPS[idx + 1].id)} disabled={!canAdvance()}>
              Next
              <ChevronRight className="size-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={() => create.mutate()}
              disabled={create.isPending || !state.name.trim()}
            >
              {create.isPending ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Create tournament
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ================================================================
 * Stepper
 * ================================================================ */

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-1 overflow-x-auto pb-2 text-xs">
      {STEPS.map((s, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <li key={s.id} className="flex items-center gap-1">
            <span
              className={
                "flex size-6 items-center justify-center rounded-full border text-[11px] font-semibold " +
                (active
                  ? "border-foreground bg-foreground text-background"
                  : done
                    ? "border-foreground/40 bg-muted"
                    : "border-border text-muted-foreground")
              }
            >
              {i + 1}
            </span>
            <span
              className={
                "whitespace-nowrap " +
                (active ? "font-medium text-foreground" : "text-muted-foreground")
              }
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && <span className="mx-1 h-px w-4 bg-border" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

/* ================================================================
 * Steps
 * ================================================================ */

type StepProps = {
  state: WizardState;
  setField: <K extends keyof WizardState>(k: K, v: WizardState[K]) => void;
};

function StepBasics({ state, setField }: StepProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Tournament name *" className="md:col-span-2">
        <Input
          value={state.name}
          onChange={(e) => setField("name", e.target.value)}
          placeholder="Summer Cup 2026"
          autoFocus
        />
      </Field>
      <Field label="Season">
        <Input
          value={state.season}
          onChange={(e) => setField("season", e.target.value)}
          placeholder="2026"
        />
      </Field>
      <Field label="Age group">
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={state.ageGroup}
          onChange={(e) => setField("ageGroup", e.target.value)}
        >
          {AGE_GROUPS.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Public slug" className="md:col-span-2">
        <Input
          value={state.slugTouched ? state.slug : slugify(state.name)}
          onChange={(e) => {
            setField("slug", e.target.value);
            setField("slugTouched", true);
          }}
          placeholder="summer-cup-2026"
        />
        <p className="mt-1 text-[11px] text-muted-foreground">
          Used only for the public tournament URL. Uniqueness is checked when you create the
          tournament.
        </p>
      </Field>
      <Field label="Description" className="md:col-span-2">
        <Textarea
          value={state.description}
          onChange={(e) => setField("description", e.target.value)}
          rows={3}
          placeholder="Short overview shown on the tournament page"
        />
      </Field>
    </div>
  );
}

function StepStructure({
  state,
  setField,
  derived,
}: StepProps & {
  derived: { hasGroups: boolean; hasKnockout: boolean } | null;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Tournament type">
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={state.tournamentType}
          onChange={(e) => setField("tournamentType", e.target.value)}
        >
          {TOURNAMENT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Match format">
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={state.format}
          onChange={(e) => setField("format", e.target.value)}
        >
          {TOURNAMENT_FORMATS.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Overs per innings">
        <Input
          type="number"
          min={1}
          max={90}
          value={state.overs}
          onChange={(e) => setField("overs", Number(e.target.value) || 20)}
        />
      </Field>
      <Field label="Max teams">
        <Input
          type="number"
          min={2}
          max={128}
          value={state.maxTeams}
          onChange={(e) => setField("maxTeams", Number(e.target.value) || 16)}
        />
      </Field>
      <div className="md:col-span-2 rounded-lg border border-border/60 bg-muted/30 p-3">
        <div className="mb-2 text-xs font-medium text-muted-foreground">
          Structure
          {derived && (
            <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px]">
              auto from type
            </span>
          )}
        </div>
        <div className="grid gap-2 md:grid-cols-3">
          <Toggle
            label="Group stage"
            checked={derived?.hasGroups ?? state.hasGroups}
            disabled={!!derived}
            onChange={(v) => setField("hasGroups", v)}
          />
          <Toggle
            label="Knockout stage"
            checked={derived?.hasKnockout ?? state.hasKnockout}
            disabled={!!derived}
            onChange={(v) => setField("hasKnockout", v)}
          />
          <Toggle
            label="Third-place match"
            checked={state.thirdPlaceMatch}
            disabled={!(derived?.hasKnockout ?? state.hasKnockout)}
            onChange={(v) => setField("thirdPlaceMatch", v)}
          />
        </div>
      </div>
    </div>
  );
}

function StepSchedule({ state, setField }: StepProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Start date">
        <Input
          type="date"
          value={state.startDate}
          onChange={(e) => setField("startDate", e.target.value)}
        />
      </Field>
      <Field label="End date">
        <Input
          type="date"
          value={state.endDate}
          onChange={(e) => setField("endDate", e.target.value)}
        />
      </Field>
      <Field label="Primary ground" className="md:col-span-2">
        <Input
          value={state.ground}
          onChange={(e) => setField("ground", e.target.value)}
          placeholder="Additional venues can be added later"
        />
      </Field>
      <Field label="City">
        <Input value={state.city} onChange={(e) => setField("city", e.target.value)} />
      </Field>
      <Field label="Country">
        <Input value={state.country} onChange={(e) => setField("country", e.target.value)} />
      </Field>
    </div>
  );
}

function StepRules({ state, setField }: StepProps) {
  const toggleTiebreak = (id: string) => {
    const has = state.tiebreakRules.includes(id);
    setField(
      "tiebreakRules",
      has ? state.tiebreakRules.filter((r) => r !== id) : [...state.tiebreakRules, id],
    );
  };
  return (
    <div className="grid gap-3 md:grid-cols-4">
      <Field label="Points: Win">
        <Input
          type="number"
          value={state.pointsWin}
          onChange={(e) => setField("pointsWin", Number(e.target.value))}
        />
      </Field>
      <Field label="Tie">
        <Input
          type="number"
          value={state.pointsTie}
          onChange={(e) => setField("pointsTie", Number(e.target.value))}
        />
      </Field>
      <Field label="Loss">
        <Input
          type="number"
          value={state.pointsLoss}
          onChange={(e) => setField("pointsLoss", Number(e.target.value))}
        />
      </Field>
      <Field label="No Result">
        <Input
          type="number"
          value={state.pointsNR}
          onChange={(e) => setField("pointsNR", Number(e.target.value))}
        />
      </Field>
      <div className="md:col-span-4">
        <Label className="text-xs">Tiebreakers (in priority order)</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {TIEBREAKS.map((t) => {
            const active = state.tiebreakRules.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTiebreak(t.id)}
                className={
                  "rounded-full border px-3 py-1 text-xs transition-colors " +
                  (active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground/40")
                }
              >
                {active ? `${state.tiebreakRules.indexOf(t.id) + 1}. ${t.label}` : t.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function StepBranding({ state, setField }: StepProps) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <Field label="Logo URL">
        <Input
          value={state.logoUrl}
          onChange={(e) => setField("logoUrl", e.target.value)}
          placeholder="https://…"
        />
      </Field>
      <Field label="Banner URL">
        <Input
          value={state.bannerUrl}
          onChange={(e) => setField("bannerUrl", e.target.value)}
          placeholder="https://…"
        />
      </Field>
      <Field label="Visibility" className="md:col-span-2">
        <select
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={state.visibility}
          onChange={(e) => setField("visibility", e.target.value)}
        >
          {TOURNAMENT_VISIBILITIES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Public tournaments become viewable at
          <code className="mx-1">/academy/:academySlug/tournaments/:slug</code>
          once you publish them.
        </p>
      </Field>
    </div>
  );
}

function StepReview({
  state,
  derived,
}: {
  state: WizardState;
  derived: { hasGroups: boolean; hasKnockout: boolean } | null;
}) {
  const hasGroups = derived?.hasGroups ?? state.hasGroups;
  const hasKnockout = derived?.hasKnockout ?? state.hasKnockout;
  const finalSlug = state.slugTouched ? slugify(state.slug) : slugify(state.name);
  const rows: [string, string][] = [
    ["Name", state.name || "—"],
    ["Slug", finalSlug],
    ["Season", state.season || "—"],
    ["Age group", state.ageGroup],
    [
      "Type / Format",
      `${TOURNAMENT_TYPES.find((t) => t.value === state.tournamentType)?.label ?? state.tournamentType} · ${state.format} · ${state.overs} overs`,
    ],
    [
      "Structure",
      [
        hasGroups ? "Groups" : null,
        hasKnockout ? "Knockout" : null,
        state.thirdPlaceMatch ? "3rd-place match" : null,
      ]
        .filter(Boolean)
        .join(" · ") || "Single stage",
    ],
    ["Max teams", String(state.maxTeams)],
    [
      "Dates",
      state.startDate || state.endDate
        ? `${state.startDate || "TBD"} → ${state.endDate || "TBD"}`
        : "TBD",
    ],
    ["Venue", [state.ground, state.city, state.country].filter(Boolean).join(", ") || "—"],
    [
      "Points (W/T/L/NR)",
      `${state.pointsWin} / ${state.pointsTie} / ${state.pointsLoss} / ${state.pointsNR}`,
    ],
    [
      "Tiebreakers",
      state.tiebreakRules
        .map((id, i) => `${i + 1}. ${TIEBREAKS.find((t) => t.id === id)?.label ?? id}`)
        .join(", ") || "—",
    ],
    ["Visibility", state.visibility],
  ];
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-4">
      <div className="mb-3 text-sm font-medium">Review & create</div>
      <dl className="grid gap-2 text-sm md:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex flex-col">
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{k}</dt>
            <dd className="font-medium">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-[11px] text-muted-foreground">
        Teams, groups, venues and officials are added after creation in the Tournament Workspace.
      </p>
    </div>
  );
}

/* ================================================================
 * Small presentational helpers
 * ================================================================ */

function Field({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label
      className={
        "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm " +
        (disabled
          ? "cursor-not-allowed opacity-60"
          : checked
            ? "border-foreground bg-foreground/5"
            : "border-border hover:border-foreground/40")
      }
    >
      <input
        type="checkbox"
        className="size-4"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
