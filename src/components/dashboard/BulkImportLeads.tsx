import { useState } from "react";
import * as XLSX from "xlsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDashboard } from "@/lib/dashboard-context";
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
  message?: string;
  source?: string;
  status?: string;
  notes?: string;
};

const ALIASES: Record<string, keyof Row> = {
  name: "name",
  "lead name": "name",
  phone: "phone",
  mobile: "phone",
  "phone number": "phone",
  message: "message",
  enquiry: "message",
  source: "source",
  status: "status",
  notes: "notes",
};

function normalize(rows: Record<string, unknown>[]): Row[] {
  return rows
    .map((r) => {
      const out: Row = { name: "", phone: "" };
      for (const [k, v] of Object.entries(r)) {
        const key = ALIASES[k.trim().toLowerCase()];
        if (!key) continue;
        out[key] = v == null ? "" : String(v).trim();
      }
      return out;
    })
    .filter((r) => r.name && r.phone);
}

export function BulkImportLeads() {
  const { tenant } = useDashboard();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [fileName, setFileName] = useState("");

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
      const payload = rows.map((r) => ({
        tenant_id: tenant.id,
        name: r.name,
        phone: r.phone,
        message: r.message || null,
        source: r.source || "import",
        status: (r.status || "new").toLowerCase(),
        notes: r.notes || null,
      }));
      const { error } = await supabase.from("leads" as never).insert(payload as never);
      if (error) throw error;
      return payload.length;
    },
    onSuccess: (n) => {
      toast.success(`Imported ${n} leads`);
      qc.invalidateQueries({ queryKey: ["d", "leads", tenant.id] });
      setRows([]);
      setFileName("");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const downloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([
      { name: "Priya Verma", phone: "9876543210", message: "Interested in evening batch", source: "instagram", status: "new", notes: "" },
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Leads");
    XLSX.writeFile(wb, "leads-template.xlsx");
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
          <DialogTitle>Bulk import leads</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Upload an <span className="font-medium">.xlsx</span> or <span className="font-medium">.csv</span> with columns:{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">name, phone, message, source, status, notes</code>.
          </p>

          <Button variant="ghost" size="sm" onClick={downloadTemplate} className="text-xs">
            <Download className="size-3.5 mr-1" /> Download template
          </Button>

          <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl px-4 py-8 cursor-pointer hover:bg-muted/40 transition-colors">
            <FileSpreadsheet className="size-8 text-muted-foreground" />
            <div className="text-sm font-medium">{fileName || "Choose a spreadsheet"}</div>
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
                    {r.name} · {r.phone} {r.source ? `· ${r.source}` : ""}
                  </div>
                ))}
                {rows.length > 5 && <div className="text-muted-foreground">…and {rows.length - 5} more</div>}
              </div>
            </div>
          )}

          {rows.length === 0 && fileName && (
            <div className="flex items-center gap-2 text-sm text-amber-600">
              <AlertTriangle className="size-4" /> No valid rows found. Check column headers.
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
