/* ================================================================
 * Tournament Export Utilities
 * ----------------------------------------------------------------
 * Centralized export helpers reused by every Tournament Center tab
 * (Fixtures, Points Table, Statistics, Awards, Bracket).
 *
 * All operations run in the browser — no server round-trip. Heavy
 * dependencies (`jspdf`, `qrcode`, `html2canvas`) are dynamically
 * imported so the initial route bundle stays small.
 *
 * Supported:
 *   - toCSV(rows)                → string
 *   - downloadCSV(name, rows)    → File download
 *   - printElement(el)           → Native print dialog scoped to node
 *   - captureElementPNG(el)      → PNG blob via html2canvas (dynamic)
 *   - downloadElementPNG(el, n)  → Save PNG
 *   - downloadElementPDF(el, n)  → Save PDF (jsPDF, image-based)
 *   - buildQRDataUrl(text)       → data:image/png QR
 *   - copyToClipboard(text)      → Promise<boolean>
 * ================================================================ */

/* ---------------- CSV ---------------- */

export function toCSV<T extends Record<string, unknown>>(rows: T[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => escape((r as Record<string, unknown>)[h])).join(","));
  }
  return lines.join("\n");
}

export function downloadBlob(filename: string, blob: Blob): void {
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadCSV<T extends Record<string, unknown>>(name: string, rows: T[]): void {
  const csv = toCSV(rows);
  downloadBlob(sanitizeFilename(name, "csv"), new Blob([csv], { type: "text/csv;charset=utf-8" }));
}

/* ---------------- QR ---------------- */

export async function buildQRDataUrl(text: string, size = 256): Promise<string> {
  const { default: QRCode } = await import("qrcode");
  return QRCode.toDataURL(text, { width: size, margin: 1, errorCorrectionLevel: "M" });
}

/* ---------------- Clipboard ---------------- */

export async function copyToClipboard(text: string): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallthrough
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    return true;
  } catch {
    return false;
  }
}

/* ---------------- Print ---------------- */

export function printElement(el: HTMLElement | null): void {
  if (!el || typeof window === "undefined") return;
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) {
    window.print();
    return;
  }
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((n) => n.outerHTML)
    .join("\n");
  w.document.write(`<!doctype html><html><head><title>Print</title>${styles}
    <style>body{margin:0;padding:24px;background:#fff;color:#000}
    .print-wrap{max-width:960px;margin:0 auto}</style></head>
    <body><div class="print-wrap">${el.outerHTML}</div>
    <script>window.onload=()=>{setTimeout(()=>{window.print();},300);}</script>
    </body></html>`);
  w.document.close();
}

/* ---------------- PNG / PDF via dynamic import ---------------- */

async function loadHtml2Canvas(): Promise<((el: HTMLElement, opts?: unknown) => Promise<HTMLCanvasElement>) | null> {
  try {
    // html2canvas is an OPTIONAL dependency; degrade gracefully when absent.
    const mod: { default: (el: HTMLElement, opts?: unknown) => Promise<HTMLCanvasElement> } =
      await import(/* @vite-ignore */ "html2canvas");
    return mod.default;
  } catch {
    return null;
  }
}

export async function downloadElementPNG(el: HTMLElement | null, name: string): Promise<boolean> {
  if (!el) return false;
  const html2canvas = await loadHtml2Canvas();
  if (!html2canvas) return false;
  const canvas = await html2canvas(el, { backgroundColor: "#ffffff", scale: 2 });
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
  if (!blob) return false;
  downloadBlob(sanitizeFilename(name, "png"), blob);
  return true;
}

export async function downloadElementPDF(el: HTMLElement | null, name: string): Promise<boolean> {
  if (!el) return false;
  const html2canvas = await loadHtml2Canvas();
  if (!html2canvas) return false;
  const { jsPDF } = await import("jspdf");
  const canvas = await html2canvas(el, { backgroundColor: "#ffffff", scale: 2 });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({ orientation: canvas.width > canvas.height ? "l" : "p", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const ratio = Math.min(pageW / canvas.width, pageH / canvas.height);
  const w = canvas.width * ratio;
  const h = canvas.height * ratio;
  pdf.addImage(imgData, "PNG", (pageW - w) / 2, (pageH - h) / 2, w, h);
  pdf.save(sanitizeFilename(name, "pdf"));
  return true;
}

/* ---------------- Public URL helper ---------------- */

export interface PublicUrlInput {
  academySlug: string | null;
  tournamentSlug: string | null;
  published: boolean;
}

export function tournamentPublicUrl(input: PublicUrlInput): string | null {
  if (!input.published || !input.academySlug || !input.tournamentSlug) return null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/academy/${input.academySlug}/tournaments/${input.tournamentSlug}`;
}

/* ---------------- Filename hygiene ---------------- */

export function sanitizeFilename(name: string, ext: string): string {
  const safe = name
    .toLowerCase()
    .replace(/[^a-z0-9-_\s.]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 80) || "export";
  return `${safe}.${ext}`;
}
