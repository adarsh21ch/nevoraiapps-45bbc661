import { useMemo, useState } from "react";
import { Search, Check, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StoragedImage } from "@/components/site/StoragedImage";
import { ageFromDob, type StudentLite } from "@/lib/mc-teams";

/**
 * PlayerSelector — searchable multi-select of academy students.
 * Users never type names. They pick from academy roster only.
 */
export function PlayerSelector({
  students,
  selectedIds,
  onChange,
  excludeIds = [],
  ageFilter = "all",
  maxHeight = 420,
}: {
  students: StudentLite[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  excludeIds?: string[];
  ageFilter?: string;
  maxHeight?: number;
}) {
  const [q, setQ] = useState("");
  const [ageBand, setAgeBand] = useState<string>(ageFilter);
  const [gender, setGender] = useState<string>("all");

  const excludeSet = useMemo(() => new Set(excludeIds), [excludeIds]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return students
      .filter((s) => !excludeSet.has(s.id))
      .filter((s) => {
        if (!query) return true;
        return (
          s.name.toLowerCase().includes(query) ||
          (s.player_id ?? "").toLowerCase().includes(query) ||
          (s.phone ?? "").toLowerCase().includes(query)
        );
      })
      .filter((s) => {
        if (ageBand === "all") return true;
        const age = ageFromDob(s.dob);
        if (age === null) return false;
        if (ageBand === "U10") return age < 10;
        if (ageBand === "U12") return age < 12;
        if (ageBand === "U14") return age < 14;
        if (ageBand === "U16") return age < 16;
        if (ageBand === "U19") return age < 19;
        if (ageBand === "Senior") return age >= 19;
        return true;
      })
      .filter((s) => {
        if (gender === "all") return true;
        return (s.gender ?? "").toLowerCase() === gender;
      });
  }, [students, q, ageBand, gender, excludeSet]);

  const toggle = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectAllVisible = () => {
    const visibleIds = filtered.map((s) => s.id);
    const combined = Array.from(new Set([...selectedIds, ...visibleIds]));
    onChange(combined);
  };

  const clearAll = () => onChange([]);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="p-3 border-b border-border space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name, player ID or phone…"
            className="pl-9 h-10"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SelectPill value={ageBand} onChange={setAgeBand} label="Age" options={[
            { value: "all", label: "All ages" },
            { value: "U10", label: "U10" },
            { value: "U12", label: "U12" },
            { value: "U14", label: "U14" },
            { value: "U16", label: "U16" },
            { value: "U19", label: "U19" },
            { value: "Senior", label: "Senior" },
          ]} />
          <SelectPill value={gender} onChange={setGender} label="Gender" options={[
            { value: "all", label: "All" },
            { value: "male", label: "Male" },
            { value: "female", label: "Female" },
          ]} />
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground">
              {selectedIds.length} selected
            </span>
            <Button type="button" size="sm" variant="ghost" onClick={selectAllVisible}>
              Select all
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
              Clear
            </Button>
          </div>
        </div>
      </div>

      <ul className="overflow-y-auto divide-y divide-border" style={{ maxHeight }}>
        {filtered.length === 0 && (
          <li className="p-8 text-center text-sm text-muted-foreground">
            <UserIcon className="mx-auto size-6 mb-2 opacity-50" />
            No matching students. Add players to the academy first.
          </li>
        )}
        {filtered.map((s) => {
          const selected = selectedSet.has(s.id);
          const age = ageFromDob(s.dob);
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => toggle(s.id)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
                  selected ? "bg-accent/40" : "hover:bg-accent/30",
                )}
              >
                <div
                  className={cn(
                    "size-9 shrink-0 rounded-full grid place-items-center overflow-hidden text-xs font-semibold",
                    selected ? "bg-primary text-primary-foreground" : "bg-accent/60 text-foreground/70",
                  )}
                >
                  {selected ? (
                    <Check className="size-4" />
                  ) : s.photo_url ? (
                    <StoragedImage
                      path={s.photo_url}
                      alt={s.name}
                      className="w-full h-full object-cover"
                      fallback={<span>{s.name.slice(0, 2).toUpperCase()}</span>}
                    />
                  ) : (
                    <span>{s.name.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.name}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {s.player_id && <span>{s.player_id}</span>}
                    {age !== null && <span> · {age}y</span>}
                    {s.gender && <span> · {s.gender}</span>}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SelectPill({
  value,
  onChange,
  label,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent outline-none font-medium"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
