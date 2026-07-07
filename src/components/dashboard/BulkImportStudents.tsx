import { useState } from "react";
import * as XLSX from "xlsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/lib/dashboard-context";
import { fetchBatches, fetchFeePlans, qk } from "@/lib/dashboard-queries";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, FileSpreadsheet, Check, AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";

type Row = {
  name: string;
  phone: string;
  guardian_name?: string;
  guardian_phone?: string;
  dob?: string;
  batch?: string;
  fee_plan?: string;
  status?: string;
};

const HEADER_ALIASES: Record<string, keyof Row> = {
  name: "name",
  "student name": "name",
  phone: "phone",
  mobile: "phone",
  "phone number": "phone",
  guardian: "guardian_name",
  "guardian name": "guardian_name",
  "guardian phone": "guardian_phone",
  "parent phone": "guardian_phone",
  dob: "dob",
  "date of birth": "dob",
  batch: "batch",
  "batch name": "batch",
  "fee plan": "fee_plan",
  plan: "fee_plan",
  status: "status",
};

function normalize(rows: Record<string, unknown>[]): Row[] {
  return rows.map((r) => {
    const out: Row = { name: "", phone: "" };
    for (const [k, v] of Object.entries(r)) {
      const key = HEADER_ALIASES[k.trim().toLowerCase()];
      if (!key) continue;
      out[key] = v == null ? "" : String(v).trim();
    }
    return out;
  }).filter((r) => r.name && r.phone);
}

export function BulkImportStudents() {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");

  const batches = useQuery({ queryKey: qk.batches(tenant.id), queryFn: () => fetchBatches(tenant.id) });
  const plans = useQuery({ queryKey: qk.feePlans(tenant.id), queryFn: () => fetchFeePlans(tenant.id) });

  const onFile = async (file: File) => {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    setRows(normalize(json));
    setFileName(file.name);
  };

  const importer = useMutation({
    mutationFn: async () => {
      const batchByName = new Map(
        (batches.data ?? []).map((b) => [b.name.toLowerCase(), b.id])
      );
      const planByName = new Map(
        (plans.data ?? []).map((p) => [p.name.toLowerCase(), p.id])
      );
      const payload = rows.map((r) => ({
        tenant_id: tenant.id,
        name: r.name,
        phone: r.phone,
        guardian_name: r.guardian_name || null,
        guardian_phone: r.guardian_phone || null,
        dob: r.dob || null,
        batch_id: r.batch ? batchByName.get(r.batch.toLowerCase()) ?? null : null,
        fee_plan_id: r.fee_plan ? planByName.get(r.fee_plan.toLowerCase()) ?? null : null,
        status: (r.status || "active").toLowerCase(),
      }));
      const { error } = await supabase.from("students").insert(payload);
      if (error) throw error;
      return payload.length;
    },
    onSuccess: (n) => {
      toast.success(`Imported ${n} students`);
      qc.invalidateQueries({ queryKey: qk.students(tenant.id) });
      setRows([]);
      setFileName("");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { name: "Rahul Sharma", phone: "9876543210", guardian_name: "Amit Sharma", guardian_phone: "9876500000", dob: "2010-05-15", batch: "Morning", fee_plan: "Monthly", status: "active" },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Students");
    XLSX.writeFile(wb, "students-template.xlsx");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0 rounded-full">
          <Upload className="size-4 mr-1.5" /> Import
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Bulk import students</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Upload an <span className="font-medium">.xlsx</span> or <span className="font-medium">.csv</span> with columns:{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">name, phone, guardian_name, guardian_phone, dob, batch, fee_plan, status</code>.
            Batch and fee plan are matched by name.
          </p>

          <Button variant="ghost" size="sm" onClick={downloadTemplate} className="text-xs">
            <Download className="size-3.5 mr-1" /> Download template
          </Button>

          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl px-4 py-8 cursor-pointer hover:bg-muted/40 transition-colors">
            <FileSpreadsheet className="size-8 text-muted-foreground" />
            <div className="text-sm font-medium">
              {fileName || "Choose a spreadsheet"}
            </div>
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

          {rows.length > 0 && (
            <div className="rounded-lg border p-3 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Check className="size-4 text-emerald-600" />
                <span className="font-medium">{rows.length}</span> valid rows detected
              </div>
              <div className="max-h-32 overflow-auto text-xs">
                {rows.slice(0, 5).map((r, i) => (
                  <div key={i} className="text-muted-foreground truncate">
                    {r.name} · {r.phone} {r.batch ? `· ${r.batch}` : ""}
                  </div>
                ))}
                {rows.length > 5 && <div className="text-muted-foreground">…and {rows.length - 5} more</div>}
              </div>
            </div>
          )}

          {rows.length === 0 && fileName && (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertTriangle className="size-4" />
              No valid rows found. Check column headers.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            onClick={() => importer.mutate()}
            disabled={importer.isPending || rows.length === 0}
            style={{ backgroundColor: "var(--brand)", color: "white" }}
          >
            {importer.isPending ? "Importing…" : `Import ${rows.length || ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
