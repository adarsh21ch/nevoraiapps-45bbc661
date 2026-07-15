import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/lib/dashboard-context";
import { fetchBatches, fetchFeePlans, fetchStudents, qk } from "@/lib/dashboard-queries";
import { detectDuplicates } from "@/lib/students-manage";
import { bulkImportStudents } from "@/lib/admissions/admissions.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, FileSpreadsheet, Check, AlertTriangle, Download, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Row = {
  name: string;
  phone: string;
  email?: string;
  guardian_name?: string;
  guardian_phone?: string;
  dob?: string;
  gender?: string;
  playing_role?: string;
  batting_style?: string;
  bowling_style?: string;
  city?: string;
  state?: string;
  school_college?: string;
  blood_group?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  batch?: string;
  fee_plan?: string;
  coach_name?: string;
  status?: string;
};

type FieldKey = keyof Row;

const FIELD_OPTIONS: { key: FieldKey; label: string; required?: boolean }[] = [
  { key: "name", label: "Name", required: true },
  { key: "phone", label: "Mobile", required: true },
  { key: "email", label: "Email" },
  { key: "guardian_name", label: "Guardian Name" },
  { key: "guardian_phone", label: "Guardian Phone" },
  { key: "dob", label: "Date of Birth" },
  { key: "gender", label: "Gender" },
  { key: "playing_role", label: "Playing Role" },
  { key: "batting_style", label: "Batting Style" },
  { key: "bowling_style", label: "Bowling Style" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "school_college", label: "School / College" },
  { key: "blood_group", label: "Blood Group" },
  { key: "emergency_contact_name", label: "Emergency Contact" },
  { key: "emergency_contact_phone", label: "Emergency Phone" },
  { key: "batch", label: "Batch" },
  { key: "fee_plan", label: "Fee Plan" },
  { key: "coach_name", label: "Coach" },
  { key: "status", label: "Status" },
];

const HEADER_ALIASES: Record<string, FieldKey> = {
  name: "name", "full name": "name", "player name": "name", "student name": "name",
  phone: "phone", mobile: "phone", "phone number": "phone", "mobile number": "phone",
  email: "email",
  guardian: "guardian_name", "guardian name": "guardian_name", "parent name": "guardian_name",
  "guardian phone": "guardian_phone", "parent phone": "guardian_phone", "parent mobile": "guardian_phone",
  "emergency contact": "emergency_contact_name", "emergency name": "emergency_contact_name",
  "emergency phone": "emergency_contact_phone",
  dob: "dob", "date of birth": "dob",
  gender: "gender", role: "playing_role", "playing role": "playing_role",
  batting: "batting_style", "batting style": "batting_style",
  bowling: "bowling_style", "bowling style": "bowling_style",
  city: "city", state: "state",
  school: "school_college", college: "school_college", "school / college": "school_college", "school/college": "school_college",
  "blood group": "blood_group", blood: "blood_group",
  coach: "coach_name", "coach name": "coach_name",
  batch: "batch", "batch name": "batch",
  "fee plan": "fee_plan", plan: "fee_plan",
  status: "status",
};

function autoDetect(headers: string[]): Record<string, FieldKey | "">
{
  const map: Record<string, FieldKey | ""> = {};
  for (const h of headers) {
    map[h] = HEADER_ALIASES[h.trim().toLowerCase()] ?? "";
  }
  return map;
}

function applyMapping(
  raw: Record<string, unknown>[],
  mapping: Record<string, FieldKey | "">,
): Row[] {
  return raw
    .map((r) => {
      const out: Row = { name: "", phone: "" };
      for (const [h, v] of Object.entries(r)) {
        const key = mapping[h];
        if (!key) continue;
        (out as any)[key] = v == null ? "" : String(v).trim();
      }
      return out;
    })
    .filter((r) => r.name || r.phone);
}

type ParsedRow = { row: Row; issues: string[]; dupe: boolean };
type Step = "upload" | "map" | "preview";

export function BulkImportStudents() {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("upload");
  const [raw, setRaw] = useState<Record<string, unknown>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, FieldKey | "">>({});
  const [fileName, setFileName] = useState("");
  const [skipDupes, setSkipDupes] = useState(true);
  const [markImported, setMarkImported] = useState(true);
  const bulkImport = useServerFn(bulkImportStudents);

  const rows = useMemo(() => applyMapping(raw, mapping), [raw, mapping]);

  const batches = useQuery({
    queryKey: qk.batches(tenant.id),
    queryFn: () => fetchBatches(tenant.id),
  });
  const plans = useQuery({
    queryKey: qk.feePlans(tenant.id),
    queryFn: () => fetchFeePlans(tenant.id),
  });
  const existing = useQuery({
    queryKey: qk.students(tenant.id),
    queryFn: () => fetchStudents(tenant.id),
    enabled: open,
  });

  const dupes = useMemo(
    () =>
      detectDuplicates(
        rows.map((r) => ({ name: r.name, phone: r.phone })),
        (existing.data ?? []) as any[],
      ),
    [rows, existing.data],
  );

  const parsed: ParsedRow[] = useMemo(() => {
    return rows.map((r) => {
      const issues: string[] = [];
      if (!r.name) issues.push("Missing name");
      if (!r.phone) issues.push("Missing mobile");
      const phone = (r.phone || "").replace(/\s+/g, "");
      const isDupe = phone.length > 0 && (dupes.phoneDupes.get(phone) ?? 0) > 0;
      if (isDupe) issues.push("Mobile already exists");
      const similar = dupes.similarNames.get(r.name);
      if (similar && similar.length > 0 && !isDupe) issues.push(`Similar name: ${similar[0]}`);
      return { row: r, issues, dupe: isDupe };
    });
  }, [rows, dupes]);

  const validCount = parsed.filter((p) => p.issues.length === 0).length;
  const dupeCount = parsed.filter((p) => p.dupe).length;
  const invalidCount = parsed.filter((p) => p.issues.some((i) => i.startsWith("Missing"))).length;

  const mappedFields = useMemo(
    () => new Set(Object.values(mapping).filter(Boolean)),
    [mapping],
  );
  const unmappedRequired = FIELD_OPTIONS.filter((f) => f.required && !mappedFields.has(f.key));

  const onFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    const hdrs = json.length > 0 ? Object.keys(json[0]) : [];
    setRaw(json);
    setHeaders(hdrs);
    setMapping(autoDetect(hdrs));
    setFileName(file.name);
    setStep("map");
  };

  const clear = () => {
    setRaw([]);
    setHeaders([]);
    setMapping({});
    setFileName("");
    setStep("upload");
  };

  const downloadErrors = () => {
    const bad = parsed.filter((p) => p.issues.length > 0);
    if (bad.length === 0) {
      toast.info("No errors to export");
      return;
    }
    const ws = XLSX.utils.json_to_sheet(
      bad.map((p) => ({ ...p.row, _issues: p.issues.join(" · ") })),
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Errors");
    XLSX.writeFile(wb, `import-errors-${Date.now()}.xlsx`);
  };

  const importer = useMutation({
    mutationFn: async () => {
      const batchByName = new Map((batches.data ?? []).map((b) => [b.name.toLowerCase(), b.id]));
      const planByName = new Map((plans.data ?? []).map((p) => [p.name.toLowerCase(), p.id]));
      const eligible = parsed.filter((p) => {
        if (p.issues.some((i) => i.startsWith("Missing"))) return false;
        if (skipDupes && p.dupe) return false;
        return true;
      });
      if (eligible.length === 0) throw new Error("Nothing to import after filtering");

      if (markImported) {
        const rowsPayload = eligible.map(({ row: r }) => ({
          name: r.name,
          phone: r.phone,
          email: r.email || null,
          guardian_name: r.guardian_name || null,
          guardian_phone: r.guardian_phone || null,
          dob: r.dob || null,
          address: null,
          batch_id: r.batch ? (batchByName.get(r.batch.toLowerCase()) ?? null) : null,
          fee_plan_id: r.fee_plan ? (planByName.get(r.fee_plan.toLowerCase()) ?? null) : null,
          roll_number: null,
        }));
        const res: any = await bulkImport({
          data: { tenantId: tenant.id, fileName, rows: rowsPayload },
        });
        return res.success ?? rowsPayload.length;
      }

      const payload = eligible.map(({ row: r }) => ({
        tenant_id: tenant.id,
        name: r.name,
        phone: r.phone,
        email: r.email || null,
        guardian_name: r.guardian_name || null,
        guardian_phone: r.guardian_phone || null,
        emergency_contact_name: r.emergency_contact_name || null,
        emergency_contact_phone: r.emergency_contact_phone || null,
        dob: r.dob || null,
        gender: r.gender ? r.gender.toLowerCase() : null,
        playing_role: r.playing_role || null,
        batting_style: r.batting_style || null,
        bowling_style: r.bowling_style || null,
        city: r.city || null,
        state: r.state || null,
        school_college: r.school_college || null,
        blood_group: r.blood_group || null,
        coach_name: r.coach_name || null,
        batch_id: r.batch ? (batchByName.get(r.batch.toLowerCase()) ?? null) : null,
        fee_plan_id: r.fee_plan ? (planByName.get(r.fee_plan.toLowerCase()) ?? null) : null,
        status: (r.status || "active").toLowerCase(),
      }));
      const { error } = await supabase.from("students").insert(payload);
      if (error) throw error;
      return payload.length;
    },
    onSuccess: (n) => {
      toast.success(`Imported ${n} players`);
      qc.invalidateQueries({ queryKey: qk.students(tenant.id) });
      clear();
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      {
        name: "Rahul Sharma",
        phone: "9876543210",
        email: "rahul@example.com",
        dob: "2010-05-15",
        gender: "male",
        playing_role: "Batter",
        batting_style: "Right-hand",
        bowling_style: "Right-arm off-spin",
        guardian_name: "Amit Sharma",
        guardian_phone: "9876500000",
        emergency_contact_name: "Priya Sharma",
        emergency_contact_phone: "9876511111",
        city: "Mumbai",
        state: "Maharashtra",
        school_college: "St. Xavier's",
        blood_group: "O+",
        batch: "Morning",
        fee_plan: "Monthly",
        coach_name: "Coach Rajesh",
        status: "active",
      },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Players");
    XLSX.writeFile(wb, "players-template.xlsx");
  };

  const importable = validCount + (skipDupes ? 0 : dupeCount);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) clear();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0 rounded-full h-9">
          <Upload className="size-4 sm:mr-1.5" />
          <span className="hidden sm:inline">Import</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk import players</DialogTitle>
        </DialogHeader>

        {/* Wizard stepper */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <StepChip label="Upload" active={step === "upload"} done={step !== "upload"} />
          <div className="h-px flex-1 bg-border" />
          <StepChip label="Map columns" active={step === "map"} done={step === "preview"} />
          <div className="h-px flex-1 bg-border" />
          <StepChip label="Preview & Import" active={step === "preview"} done={false} />
        </div>

        <div className="space-y-3">
          {step === "upload" && (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  Upload an <span className="font-medium">.xlsx</span> or{" "}
                  <span className="font-medium">.csv</span>. Column headers are matched loosely — see
                  the template for supported fields.
                </p>
                <Button variant="ghost" size="sm" onClick={downloadTemplate} className="text-xs shrink-0">
                  <Download className="size-3.5 mr-1" /> Template
                </Button>
              </div>
              <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl px-4 py-8 cursor-pointer hover:bg-muted/40 transition-colors">
                <FileSpreadsheet className="size-8 text-muted-foreground" />
                <div className="text-sm font-medium">Choose a spreadsheet</div>
                <div className="text-xs text-muted-foreground">Click to browse .xlsx or .csv</div>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onFile(f);
                  }}
                />
              </label>
            </>
          )}

          {step !== "upload" && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-3 py-2 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-medium">{fileName}</span>
                <span className="text-muted-foreground">{raw.length} rows · {headers.length} columns</span>
              </div>
              <button type="button" onClick={clear} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>
          )}

          {step === "map" && (
            <>
              <p className="text-xs text-muted-foreground">
                Review the auto-detected mapping and adjust if needed. Unmapped columns will be ignored.
              </p>
              <div className="rounded-lg border max-h-72 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-left sticky top-0">
                    <tr>
                      <th className="px-3 py-2 font-medium">Your column</th>
                      <th className="px-3 py-2 font-medium">Sample</th>
                      <th className="px-3 py-2 font-medium">Maps to</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headers.map((h) => {
                      const key = mapping[h] ?? "";
                      const sample = raw.slice(0, 3).map((r) => (r as any)[h]).filter(Boolean).join(", ");
                      return (
                        <tr key={h} className={cn("border-t", !key && "bg-amber-50/40")}>
                          <td className="px-3 py-1.5 font-medium">{h}</td>
                          <td className="px-3 py-1.5 text-muted-foreground truncate max-w-[180px]">{sample || "—"}</td>
                          <td className="px-3 py-1.5">
                            <select
                              className="w-full rounded border bg-background px-2 py-1 text-xs"
                              value={key}
                              onChange={(e) => setMapping({ ...mapping, [h]: e.target.value as FieldKey | "" })}
                            >
                              <option value="">— ignore —</option>
                              {FIELD_OPTIONS.map((f) => (
                                <option key={f.key} value={f.key}>
                                  {f.label}{f.required ? " *" : ""}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {unmappedRequired.length > 0 && (
                <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle className="size-3.5 inline mr-1" />
                  Please map required fields: {unmappedRequired.map((f) => f.label).join(", ")}
                </div>
              )}
            </>
          )}

          {step === "preview" && (
            <>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <SummaryTile label="Ready to import" value={validCount} tone="emerald" />
                <SummaryTile label="Duplicates" value={dupeCount} tone="amber" />
                <SummaryTile label="Invalid rows" value={invalidCount} tone="rose" />
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={markImported}
                    onChange={(e) => setMarkImported(e.target.checked)}
                    className="size-4 accent-current"
                  />
                  Mark as imported (activation tokens + rollback)
                </label>
                {invalidCount + dupeCount > 0 && (
                  <Button size="sm" variant="ghost" onClick={downloadErrors} className="text-xs">
                    <Download className="size-3.5 mr-1" /> Error report
                  </Button>
                )}
              </div>
              {dupeCount > 0 && (
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipDupes}
                    onChange={(e) => setSkipDupes(e.target.checked)}
                    className="size-4 accent-current"
                  />
                  Skip duplicates (matched by mobile number)
                </label>
              )}

              <div className="rounded-lg border max-h-72 overflow-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 text-left">
                    <tr>
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Mobile</th>
                      <th className="px-3 py-2 font-medium">Batch</th>
                      <th className="px-3 py-2 font-medium">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.slice(0, 20).map((p, i) => {
                      const bad = p.issues.some((x) => x.startsWith("Missing"));
                      return (
                        <tr key={i} className={cn("border-t", bad && "bg-rose-50/60", !bad && p.dupe && "bg-amber-50/60")}>
                          <td className="px-3 py-1.5">{p.row.name || <em className="text-rose-600">missing</em>}</td>
                          <td className="px-3 py-1.5 tabular-nums">{p.row.phone || <em className="text-rose-600">missing</em>}</td>
                          <td className="px-3 py-1.5 text-muted-foreground">{p.row.batch ?? ""}</td>
                          <td className="px-3 py-1.5 text-[11px]">
                            {p.issues.length === 0 ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700">
                                <Check className="size-3" /> OK
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-700">
                                <AlertTriangle className="size-3" /> {p.issues.join(" · ")}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {parsed.length > 20 && (
                  <div className="p-2 text-center text-[11px] text-muted-foreground">
                    Showing first 20 of {parsed.length} rows
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          {step === "map" && (
            <Button
              onClick={() => setStep("preview")}
              disabled={unmappedRequired.length > 0}
            >
              Continue to preview
            </Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
              <Button
                onClick={() => importer.mutate()}
                disabled={importer.isPending || importable === 0}
                style={{ backgroundColor: "var(--brand)", color: "white" }}
              >
                {importer.isPending ? "Importing…" : `Import ${importable || ""}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StepChip({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] whitespace-nowrap",
        active && "bg-primary text-primary-foreground",
        done && !active && "bg-emerald-500/15 text-emerald-700",
        !active && !done && "bg-muted text-muted-foreground",
      )}
    >
      {label}
    </span>
  );
}

function SummaryTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "emerald" | "amber" | "rose";
}) {
  const cls = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
  }[tone];
  return (
    <div className={cn("rounded-lg border px-3 py-2", cls)}>
      <div className="text-lg font-bold tabular-nums leading-none">{value}</div>
      <div className="text-[10.5px] uppercase tracking-wide mt-1 opacity-80">{label}</div>
    </div>
  );
}
