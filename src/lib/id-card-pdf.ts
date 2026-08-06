import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { Tenant } from "./tenant";
import { tenantSiteUrl } from "./tenant";
import { signedUrl } from "./storage";
import { formatShortLocation } from "./location";

export type IdCardData = {
  playerId: string | null;
  name: string;
  guardianName: string | null;
  dob: string | null;
  phone: string;
  city: string | null;
  state: string | null;
  guardianPhone: string | null;
  batchName: string | null;
  sport: string | null;
  villageLocality?: string | null;
  joinedAt: string;
  photoPath: string | null;
  batchTiming: string | null;
  academyPhone: string | null;
  academyName: string | null;
  academyLogo: string | null;
  academyAddress?: string | null;
  cardToken?: string | null;
};

async function loadImageDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(new Error("FileReader failed"));
      r.readAsDataURL(blob);
    });
  } catch (err) {
    console.warn("Failed to load image for ID card:", url, err);
    return null;
  }
}

function safeHex(input: string | null | undefined, fallback = "#0f172a"): string {
  const s = (input || "").trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(s) ? s : fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()
    : "—";

const fmtMonthYear = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric" }).toUpperCase()
    : "—";

const CW = 54;
const CH = 86;
const R = 3.2;

export async function generateIdCardPdf(tenant: Tenant, r: IdCardData) {
  // Use a slight delay to ensure UI feedback (isDownloading state) is visible
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const doc = new jsPDF({ 
    unit: "mm", 
    format: [CW + 40, CH + 60], 
    orientation: "portrait"
  });

  const fx = 20;
  const fy = 30;

  await drawCardFront(doc, tenant, r, fx, fy);
  drawPrintUtilities(doc, fx, fy, "FRONT SIDE");

  doc.addPage([CW + 40, CH + 60], "landscape");
  await drawCardBack(doc, tenant, r, fx, fy);
  drawPrintUtilities(doc, fx, fy, "BACK SIDE");

  doc.save(`id-card-${r.playerId || r.name.replace(/\s+/g, "-")}.pdf`);
}

function drawPrintUtilities(doc: jsPDF, fx: number, fy: number, label: string) {
  doc.setDrawColor(205, 210, 218);
  doc.setLineWidth(0.15);
  doc.setLineDashPattern([1, 1], 0);
  doc.roundedRect(fx, fy, CW, CH, R, R, "S");
  doc.setLineDashPattern([], 0);

  doc.setTextColor(185, 190, 198);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text(label, fx, fy - 4);
}

export async function generateIdCardsPdf(tenant: Tenant, rows: IdCardData[]) {
  const doc = new jsPDF({ unit: "mm", format: [CW + 40, CH + 60], orientation: "portrait" });
  const fx = 20;
  const fy = 30;
  
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) doc.addPage([CW + 40, CH + 60], "portrait");
    await drawCardFront(doc, tenant, rows[i], fx, fy);
    drawPrintUtilities(doc, fx, fy, `PLAYER: ${rows[i].name} (FRONT)`);
    
    doc.addPage([CW + 40, CH + 60], "portrait");
    await drawCardBack(doc, tenant, rows[i], fx, fy);
    drawPrintUtilities(doc, fx, fy, `PLAYER: ${rows[i].name} (BACK)`);
  }
  doc.save(`id-cards-batch-${tenant.slug || "academy"}.pdf`);
}

async function drawCardFront(doc: jsPDF, tenant: Tenant, r: IdCardData, fx: number, fy: number) {
  const brand = safeHex(tenant.primary_color, "#0f172a");
  const [br, bg, bb] = hexToRgb(brand);

  let logoDataUrl: string | null = null;
  if (tenant.logo_url) {
    try {
      const url = tenant.logo_url.startsWith("http") ? tenant.logo_url : await signedUrl(tenant.logo_url);
      if (url) logoDataUrl = await loadImageDataUrl(url);
    } catch {}
  }

  let photoDataUrl: string | null = null;
  if (r.photoPath) {
    try {
      const url = r.photoPath.startsWith("http") ? r.photoPath : await signedUrl(r.photoPath);
      if (url) photoDataUrl = await loadImageDataUrl(url);
    } catch {}
  }

  // Header Background
  doc.setFillColor(br, bg, bb);
  doc.roundedRect(fx, fy, CW, 18, R, R, "F");
  doc.rect(fx, fy + 9, CW, 9, "F"); // Flatten bottom corners of header bg

  // Logo & Academy Name
  let ly = fy + 3;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", fx + CW/2 - 4.5, ly, 9, 9);
      ly += 11;
    } catch {
      ly += 2;
    }
  } else {
    ly += 5;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const academyName = (tenant.short_name || tenant.name || "ACADEMY").toUpperCase();
  const academyLines = doc.splitTextToSize(academyName, CW - 10);
  doc.text(academyLines, fx + CW / 2, ly, { align: "center" });

  // White Body
  doc.setFillColor(255, 255, 255);
  doc.rect(fx, fy + 18, CW, CH - 18 - 12, "F");

  // Player Photo
  const pw = 28;
  const ph = 35;
  const px = fx + (CW - pw) / 2;
  const py = fy + 22;
  
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(px, py, pw, ph, 2, 2, "F");
  if (photoDataUrl) {
    try {
      doc.addImage(photoDataUrl, "JPEG", px, py, pw, ph);
    } catch {}
  } else {
    doc.setTextColor(200, 205, 215);
    doc.setFontSize(20);
    doc.text("?", px + pw/2, py + ph/2 + 5, { align: "center" });
  }

  // Player Name
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  const nameLines = doc.splitTextToSize(r.name.toUpperCase(), CW - 10);
  doc.text(nameLines, fx + CW / 2, py + ph + 6, { align: "center" });

  // Details Area
  let dy = py + ph + (nameLines.length * 4.5) + 4;
  const lx = fx + 6;
  const vx = fx + 22;

  const field = (label: string, value: string, boldValue = true) => {
    doc.setTextColor(br, bg, bb);
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "bold");
    doc.text(label, lx, dy);
    
    doc.setTextColor(31, 41, 55);
    doc.setFontSize(7);
    doc.setFont("helvetica", boldValue ? "bold" : "normal");
    const valLines = doc.splitTextToSize(value || "—", CW - (vx - fx) - 6);
    doc.text(valLines, vx, dy);
    dy += (valLines.length * 3.5) + 0.5;
  };

  field("PLAYER ID", r.playerId || "—");
  field("DOB", fmtDate(r.dob));
  field("SPORT", (r.sport || "CRICKET").toUpperCase());
  field("CONTACT", r.phone || "—");
  field("ADDRESS", r.academyAddress || "—", false);

  // Footer
  const footerH = 12;
  doc.setFillColor(br, bg, bb);
  doc.roundedRect(fx, fy + CH - footerH, CW, footerH, R, R, "F");
  doc.rect(fx, fy + CH - footerH, CW, footerH / 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(4.5);
  doc.setFont("helvetica", "bold");
  doc.text("MEMBER SINCE", fx + 5, fy + CH - 7);
  doc.setFontSize(7);
  doc.text(fmtMonthYear(r.joinedAt), fx + 5, fy + CH - 3);

  doc.setFontSize(6.5);
  doc.text("OFFICIAL PLAYER ID CARD", fx + CW - 5, fy + CH - 4, { align: "right" });
}

async function drawCardBack(doc: jsPDF, tenant: Tenant, r: IdCardData, fx: number, fy: number) {
  const brand = safeHex(tenant.primary_color, "#0f172a");
  const [br, bg, bb] = hexToRgb(brand);

  let logoDataUrl: string | null = null;
  if (tenant.logo_url) {
    try {
      const url = tenant.logo_url.startsWith("http") ? tenant.logo_url : await signedUrl(tenant.logo_url);
      if (url) logoDataUrl = await loadImageDataUrl(url);
    } catch {}
  }

  // Header Background
  doc.setFillColor(br, bg, bb);
  doc.roundedRect(fx, fy, CW, 18, R, R, "F");
  doc.rect(fx, fy + 9, CW, 9, "F");

  // Logo & Academy Name
  let ly = fy + 3;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", fx + CW/2 - 4.5, ly, 9, 9);
      ly += 11;
    } catch {
      ly += 2;
    }
  } else {
    ly += 5;
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  const academyName = (tenant.short_name || tenant.name || "ACADEMY").toUpperCase();
  const academyLines = doc.splitTextToSize(academyName, CW - 10);
  doc.text(academyLines, fx + CW / 2, ly, { align: "center" });

  // Body
  doc.setFillColor(255, 255, 255);
  doc.rect(fx, fy + 18, CW, CH - 18 - 10, "F");

  // QR Label
  doc.setTextColor(107, 114, 128);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.text("SCAN FOR ATTENDANCE", fx + CW / 2, fy + 26, { align: "center" });

  // QR
  const site = tenantSiteUrl(tenant);
  const qrPayload = r.cardToken
    ? `${site}/checkin?card=${r.cardToken}`
    : `${site}/?id=${encodeURIComponent(r.playerId || "")}`;
  
  try {
    const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 250 });
    doc.addImage(qrDataUrl, "PNG", fx + (CW - 35) / 2, fy + 28, 35, 35);
  } catch {}

  // Session / Batch
  doc.setTextColor(br, bg, bb);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.text("SESSION / BATCH", fx + CW / 2, fy + 68, { align: "center" });

  doc.setTextColor(31, 41, 55);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  const batchName = (r.batchName || "GENERAL SESSION").toUpperCase();
  const displayBatch = batchName.includes("BOTH SESSION") ? "MORNING + EVENING" : batchName;
  const batchLines = doc.splitTextToSize(displayBatch, CW - 10);
  doc.text(batchLines, fx + CW / 2, fy + 74, { align: "center" });

  // Footer
  const footerH = 10;
  doc.setFillColor(br, bg, bb);
  doc.roundedRect(fx, fy + CH - footerH, CW, footerH, R, R, "F");
  doc.rect(fx, fy + CH - footerH, CW, footerH / 2, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.text("POWERED BY ACADEMY OS", fx + CW / 2, fy + CH - 4, { align: "center" });
}