import jsPDF from "jspdf";
import type { Tenant } from "./tenant";
import { signedUrl } from "./storage";

export type ReportCardData = {
  playerId: string | null;
  name: string;
  guardianName: string | null;
  dob: string | null;
  address: string | null;
  phone: string;
  guardianPhone: string | null;
  batchName: string | null;
  planName: string | null;
  fee: number | null;
  joinedAt: string;
  photoPath: string | null;
};

async function loadImageDataUrl(url: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const bitmap = await createImageBitmap(blob);
    return { dataUrl, w: bitmap.width, h: bitmap.height };
  } catch {
    return null;
  }
}

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

function safeHex(input: string | null | undefined, fallback = "#111111"): string {
  const s = (input || "").trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s) ? s : fallback;
}

export async function generateReportCardPdf(tenant: Tenant, r: ReportCardData) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 48;
  const brandHex = safeHex(tenant.primary_color);

  // Brand strip
  doc.setFillColor(brandHex);
  doc.rect(0, 0, w, 8, "F");

  // Academy header
  let y = margin + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(20);
  doc.text(tenant.name, margin, y);
  if (tenant.tagline) {
    y += 16;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(tenant.tagline, margin, y);
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(90);
  doc.text("PLAYER CARD", w - margin, margin + 12, { align: "right" });
  if (r.playerId) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`ID: ${r.playerId}`, w - margin, margin + 28, { align: "right" });
  }

  y = margin + 60;
  doc.setDrawColor(230);
  doc.line(margin, y, w - margin, y);

  // Photo
  const photoSize = 130;
  const photoX = margin;
  const photoY = y + 24;
  doc.setFillColor(245, 245, 247);
  doc.roundedRect(photoX, photoY, photoSize, photoSize, 10, 10, "F");
  if (r.photoPath) {
    try {
      const url = r.photoPath.startsWith("http") ? r.photoPath : await signedUrl(r.photoPath);
      if (url) {
        const img = await loadImageDataUrl(url);
        if (img) {
          const fmt = img.dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
          doc.addImage(img.dataUrl, fmt, photoX, photoY, photoSize, photoSize);
        }
      }
    } catch {}
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(48);
    doc.setTextColor(180);
    const initials = r.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase();
    doc.text(initials || "?", photoX + photoSize / 2, photoY + photoSize / 2 + 16, {
      align: "center",
    });
  }

  // Name + Player ID big
  const infoX = photoX + photoSize + 24;
  let iy = photoY + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(20);
  doc.text(r.name, infoX, iy);
  iy += 22;
  if (r.playerId) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(brandHex);
    doc.text(r.playerId, infoX, iy);
    iy += 18;
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(110);
  const meta = [
    r.batchName ? `Batch: ${r.batchName}` : null,
    r.planName ? `Plan: ${r.planName}` : null,
  ]
    .filter(Boolean)
    .join("   ·   ");
  if (meta) {
    doc.text(meta, infoX, iy);
    iy += 14;
  }
  doc.text(`Joined ${fmtDate(r.joinedAt)}`, infoX, iy);

  // Details section
  y = photoY + photoSize + 40;
  doc.setDrawColor(230);
  doc.line(margin, y, w - margin, y);
  y += 24;

  const rowH = 22;
  const drawRow = (label: string, value: string) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(120);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30);
    const lines = doc.splitTextToSize(value || "—", w - margin - (margin + 140));
    doc.text(lines, margin + 140, y);
    y += Math.max(rowH, lines.length * 14 + 6);
  };

  drawRow("Player ID", r.playerId ?? "—");
  drawRow("Guardian", r.guardianName ?? "—");
  drawRow("Date of birth", fmtDate(r.dob));
  drawRow("Phone", r.phone);
  if (r.guardianPhone) drawRow("Guardian phone", r.guardianPhone);
  drawRow("Address", r.address ?? "—");
  drawRow("Batch", r.batchName ?? "—");
  drawRow(
    "Monthly fee",
    r.fee != null ? `Rs. ${Number(r.fee).toLocaleString("en-IN")}` : "—",
  );

  // Footer
  const footerY = h - 40;
  doc.setDrawColor(240);
  doc.line(margin, footerY - 14, w - margin, footerY - 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(140);
  const parts = [tenant.phone, tenant.email, tenant.address].filter(Boolean).join("  ·  ");
  if (parts) {
    doc.text(doc.splitTextToSize(parts, w - margin * 2), margin, footerY);
  }

  doc.save(
    `${tenant.slug}-${(r.playerId || r.name).replace(/\s+/g, "-").toLowerCase()}-card.pdf`,
  );
}
