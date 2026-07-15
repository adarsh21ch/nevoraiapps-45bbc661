import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { Tenant } from "./tenant";
import { signedUrl } from "./storage";

export type IdCardData = {
  playerId: string | null;
  name: string;
  guardianName: string | null;
  dob: string | null;
  phone: string;
  guardianPhone: string | null;
  batchName: string | null;
  joinedAt: string;
  photoPath: string | null;
};

async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function safeHex(input: string | null | undefined, fallback = "#111111"): string {
  const s = (input || "").trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s) ? s : fallback;
}

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

/**
 * Renders a single printable player ID card (credit-card sized, 85.6 x 54 mm)
 * front + back on an A4 page. Front: photo, name, ID, batch, brand strip.
 * Back: QR (encodes tenant slug + player id URL), academy details.
 */
export async function generateIdCardPdf(tenant: Tenant, r: IdCardData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const brand = safeHex(tenant.primary_color);
  const secondary = safeHex(tenant.secondary_color, brand);

  // Card dims (ISO/IEC 7810 ID-1)
  const CW = 85.6;
  const CH = 54;
  const marginX = 20;
  const topY = 20;
  const gap = 6;

  const frontX = marginX;
  const frontY = topY;
  const backX = marginX;
  const backY = topY + CH + gap;

  // ---------- FRONT ----------
  // Background
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(frontX, frontY, CW, CH, 3, 3, "F");
  // Brand strip left
  doc.setFillColor(brand);
  doc.roundedRect(frontX, frontY, 6, CH, 3, 3, "F");
  // Header band
  doc.setFillColor(brand);
  doc.rect(frontX + 6, frontY, CW - 6, 9, "F");
  doc.setTextColor(255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const shortName = (tenant.short_name || tenant.name).slice(0, 28);
  doc.text(shortName.toUpperCase(), frontX + 9, frontY + 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("PLAYER ID", frontX + CW - 3, frontY + 6, { align: "right" });

  // Photo box
  const photoSize = 22;
  const photoX = frontX + 9;
  const photoY = frontY + 13;
  doc.setFillColor(240, 240, 244);
  doc.roundedRect(photoX, photoY, photoSize, photoSize + 6, 2, 2, "F");
  let drewPhoto = false;
  if (r.photoPath) {
    try {
      const url = r.photoPath.startsWith("http") ? r.photoPath : await signedUrl(r.photoPath);
      if (url) {
        const dataUrl = await loadImageDataUrl(url);
        if (dataUrl) {
          const fmt = dataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
          doc.addImage(dataUrl, fmt, photoX, photoY, photoSize, photoSize + 6);
          drewPhoto = true;
        }
      }
    } catch {}
  }
  if (!drewPhoto) {
    const initials = r.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase();
    doc.setTextColor(160);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text(initials || "?", photoX + photoSize / 2, photoY + photoSize / 2 + 5, {
      align: "center",
    });
  }

  // Details right of photo
  const detX = photoX + photoSize + 4;
  let y = photoY + 3;
  doc.setTextColor(90);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text("NAME", detX, y);
  y += 3.5;
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  const nameLines = doc.splitTextToSize(r.name, CW - (detX - frontX) - 4);
  doc.text(nameLines.slice(0, 2), detX, y);
  y += nameLines.length > 1 ? 8 : 4.5;

  doc.setTextColor(90);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text("ID", detX, y);
  y += 3.3;
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(brand);
  doc.text(r.playerId || "—", detX, y);

  y += 4.5;
  doc.setTextColor(90);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text("BATCH", detX, y);
  y += 3.3;
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(r.batchName || "—", detX, y);

  // Footer strip
  doc.setDrawColor(230);
  doc.line(frontX + 9, frontY + CH - 6, frontX + CW - 3, frontY + CH - 6);
  doc.setTextColor(120);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text(`Joined ${fmtDate(r.joinedAt)}`, frontX + 9, frontY + CH - 2.5);
  if (tenant.phone) {
    doc.text(tenant.phone, frontX + CW - 3, frontY + CH - 2.5, { align: "right" });
  }

  // ---------- BACK ----------
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(backX, backY, CW, CH, 3, 3, "F");
  doc.setFillColor(secondary);
  doc.roundedRect(backX + CW - 6, backY, 6, CH, 3, 3, "F");
  doc.setFillColor(secondary);
  doc.rect(backX, backY, CW - 6, 6, "F");

  // QR
  const qrData = (() => {
    const host = tenant.custom_domain || `${tenant.slug}.nevorai.com`;
    return `https://${host}/?id=${encodeURIComponent(r.playerId || "")}`;
  })();
  try {
    const qrDataUrl = await QRCode.toDataURL(qrData, {
      margin: 0,
      width: 300,
      color: { dark: "#111111", light: "#ffffff" },
    });
    const qrSize = 26;
    doc.addImage(qrDataUrl, "PNG", backX + 4, backY + 10, qrSize, qrSize);
    doc.setTextColor(120);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.text("Scan to verify", backX + 4 + qrSize / 2, backY + 10 + qrSize + 3, {
      align: "center",
    });
  } catch {}

  // Details right of QR
  const bx = backX + 34;
  let by = backY + 12;
  doc.setTextColor(20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text(tenant.name, bx, by);
  by += 3.5;
  doc.setTextColor(110);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  if (tenant.tagline) {
    const lines = doc.splitTextToSize(tenant.tagline, CW - (bx - backX) - 8);
    doc.text(lines.slice(0, 2), bx, by);
    by += lines.length > 1 ? 6 : 3;
  }
  by += 2;
  const line = (label: string, value: string) => {
    doc.setTextColor(140);
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "normal");
    doc.text(label, bx, by);
    by += 2.6;
    doc.setTextColor(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.text(value, bx, by);
    by += 3.4;
  };
  if (r.guardianName) line("GUARDIAN", r.guardianName);
  if (r.guardianPhone || r.phone) line("PHONE", r.guardianPhone || r.phone);
  if (r.dob) line("DOB", fmtDate(r.dob));

  // Footer
  doc.setDrawColor(230);
  doc.line(backX + 4, backY + CH - 6, backX + CW - 9, backY + CH - 6);
  doc.setTextColor(130);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.5);
  doc.text("If found, please return to the academy.", backX + 4, backY + CH - 2.5);

  // Cut guide labels
  doc.setTextColor(180);
  doc.setFontSize(6);
  doc.text("FRONT", frontX + CW + 4, frontY + 4);
  doc.text("BACK", backX + CW + 4, backY + 4);

  doc.save(`id-card-${r.playerId || r.name.replace(/\s+/g, "-")}.pdf`);
}
