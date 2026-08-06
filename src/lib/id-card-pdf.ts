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
  cardToken?: string | null;
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

const CW = 85.6;
const CH = 54;
const R = 3.2;

export async function generateIdCardPdf(tenant: Tenant, r: IdCardData) {
  const doc = new jsPDF({ 
    unit: "mm", 
    format: [CW + 40, CH + 60], 
    orientation: "landscape"
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
  const doc = new jsPDF({ unit: "mm", format: [CW + 40, CH + 60], orientation: "landscape" });
  const fx = 20;
  const fy = 30;
  
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) doc.addPage([CW + 40, CH + 60], "landscape");
    await drawCardFront(doc, tenant, rows[i], fx, fy);
    drawPrintUtilities(doc, fx, fy, `PLAYER: ${rows[i].name} (FRONT)`);
    
    doc.addPage([CW + 40, CH + 60], "landscape");
    await drawCardBack(doc, tenant, rows[i], fx, fy);
    drawPrintUtilities(doc, fx, fy, `PLAYER: ${rows[i].name} (BACK)`);
  }
  doc.save(`id-cards-batch-${tenant.slug || "academy"}.pdf`);
}

async function drawCardFront(doc: jsPDF, tenant: Tenant, r: IdCardData, fx: number, fy: number) {
  const brand = safeHex(tenant.primary_color, "#0f172a");
  const accent = safeHex(tenant.secondary_color, "#f59e0b");
  const [br, bg, bb] = hexToRgb(brand);
  const [ar, ag, ab] = hexToRgb(accent);

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

  // Header
  doc.setFillColor(br, bg, bb);
  doc.roundedRect(fx, fy, CW, 14, R, R, "F");
  doc.rect(fx, fy + 7, CW, 7, "F");

  let hx = fx + 5;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", hx, fy + 3, 8, 8);
      hx += 10;
    } catch {}
  }

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text((tenant.short_name || tenant.name).toUpperCase(), hx, fy + 7);
  doc.setFontSize(5);
  doc.setFont("helvetica", "normal");
  doc.text("PLAYER IDENTITY CARD", hx, fy + 10);

  // Player ID in Header
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(4);
  doc.text("PLAYER ID", fx + CW - 5, fy + 6, { align: "right" });
  doc.setTextColor(ar, ag, ab);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(r.playerId || "—", fx + CW - 5, fy + 10, { align: "right" });

  // Body
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(fx, fy + 14, CW, 30, 0, 0, "F");

  // Photo
  const px = fx + 6;
  const py = fy + 17;
  const pw = 20;
  const ph = 26;
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(px, py, pw, ph, 2, 2, "F");
  if (photoDataUrl) {
    try {
      doc.addImage(photoDataUrl, "JPEG", px, py, pw, ph);
    } catch {}
  } else {
    doc.setTextColor(200, 205, 215);
    doc.setFontSize(15);
    const initials = r.name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
    doc.text(initials || "?", px + pw/2, py + ph/2 + 3, { align: "center" });
  }

  // Details
  const dx = px + pw + 5;
  let dy = py + 3;

  doc.setTextColor(17, 24, 39);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  const nameLines = doc.splitTextToSize(r.name.toUpperCase(), CW - (dx - fx) - 6);
  doc.text(nameLines, dx, dy);
  dy += (nameLines.length * 4) + 2;

  const fieldLabel = (label: string, x: number, y: number) => {
    doc.setTextColor(156, 163, 175);
    doc.setFontSize(4.5);
    doc.setFont("helvetica", "bold");
    doc.text(label, x, y);
  };
  const fieldValue = (val: string, x: number, y: number, color = [31, 41, 55]) => {
    doc.setTextColor(color[0], color[1], color[2]);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text(val, x, y);
  };

  fieldLabel("DATE OF BIRTH", dx, dy);
  fieldLabel("SPORT", dx + 22, dy);
  dy += 3.5;
  fieldValue(fmtDate(r.dob), dx, dy);
  fieldValue((r.sport || "CRICKET").toUpperCase(), dx + 22, dy, [ar, ag, ab]);

  const location = formatShortLocation(r.villageLocality, r.city, r.state);
  if (location) {
    dy += 6;
    fieldLabel("LOCATION", dx, dy);
    dy += 3.5;
    fieldValue(location.toUpperCase(), dx, dy);
  }

  // Footer
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(fx, fy + CH - 10, CW, 10, R, R, "F");
  doc.rect(fx, fy + CH - 10, CW, 5, "F");

  doc.setTextColor(156, 163, 175);
  doc.setFontSize(5);
  doc.setFont("helvetica", "bold");
  doc.text(`MEMBER SINCE · ${fmtMonthYear(r.joinedAt)}`, fx + 6, fy + CH - 4);
  doc.text("OFFICIAL PLAYER ID CARD", fx + CW - 6, fy + CH - 4, { align: "right" });
}

async function drawCardBack(doc: jsPDF, tenant: Tenant, r: IdCardData, fx: number, fy: number) {
  const brand = safeHex(tenant.primary_color, "#0f172a");
  const accent = safeHex(tenant.secondary_color, "#f59e0b");
  const [br, bg, bb] = hexToRgb(brand);
  const [ar, ag, ab] = hexToRgb(accent);

  let logoDataUrl: string | null = null;
  if (tenant.logo_url) {
    try {
      const url = tenant.logo_url.startsWith("http") ? tenant.logo_url : await signedUrl(tenant.logo_url);
      if (url) logoDataUrl = await loadImageDataUrl(url);
    } catch {}
  }

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(fx, fy, CW, CH, R, R, "F");

  // Header
  doc.setFillColor(br, bg, bb);
  doc.roundedRect(fx, fy, CW, 12, R, R, "F");
  doc.rect(fx, fy + 6, CW, 6, "F");

  let hx = fx + 5;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", hx, fy + 2.5, 7, 7);
      hx += 9;
    } catch {}
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text((tenant.short_name || tenant.name).toUpperCase(), hx, fy + 7.5);

  // QR
  const site = tenantSiteUrl(tenant);
  const qrPayload = r.cardToken
    ? `${site}/checkin?card=${r.cardToken}`
    : `${site}/?id=${encodeURIComponent(r.playerId || "")}`;
  
  try {
    const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 200 });
    doc.addImage(qrDataUrl, "PNG", fx + 8, fy + 16, 24, 24);
  } catch {}

  doc.setTextColor(ar, ag, ab);
  doc.setFontSize(5.5);
  doc.setFont("helvetica", "bold");
  doc.text("SCAN FOR ATTENDANCE", fx + 20, fy + 43, { align: "center" });

  // Info Column
  const ix = fx + 42;
  let iy = fy + 20;

  const backField = (label: string, val: string, color = [31, 41, 55]) => {
    doc.setTextColor(156, 163, 175);
    doc.setFontSize(4.5);
    doc.text(label, ix, iy);
    iy += 3.5;
    doc.setTextColor(color[0], color[1], color[2]);
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text(val.toUpperCase(), ix, iy);
    iy += 6;
  };

  backField("PLAYER ID", r.playerId || "—");
  backField("SESSION / BATCH", (r.batchName || "GENERAL").slice(0, 25), [ar, ag, ab]);
  backField("TRAINING TIME", (r.batchTiming || "AS PER BATCH").slice(0, 25));

  // Footer
  doc.setDrawColor(243, 244, 246);
  doc.line(fx + 5, fy + CH - 8, fx + CW - 5, fy + CH - 8);

  doc.setTextColor(107, 114, 128);
  doc.setFontSize(6);
  doc.text(r.academyPhone || "—", fx + 6, fy + CH - 4);

  doc.setTextColor(209, 213, 219);
  doc.setFontSize(5);
  doc.text("POWERED BY ACADEMY OS", fx + CW - 6, fy + CH - 4, { align: "right" });
}