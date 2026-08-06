/**
 * AcademyOS — printable player ID card.
 *
 * Renders a colourful, credit-card sized (ISO/IEC 7810 ID-1, 85.6 x 54 mm)
 * single-sided badge on an A4 page with cut guides, so an academy can print,
 * cut and laminate it.

 *
 * The QR printed on the card encodes the player's private card token. An
 * owner / admin / coach scans it from the dashboard ("Scan ID card") and the
 * canonical `staff_scan_student_card` RPC records check-in, then check-out on
 * the next scan — so players without a phone still get real attendance.
 */
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
  /** students.card_token — what the attendance QR encodes. */
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

const mix = (a: string, b: string, t: number): [number, number, number] => {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return [
    Math.round(r1 + (r2 - r1) * t),
    Math.round(g1 + (g2 - g1) * t),
    Math.round(b1 + (b2 - b1) * t),
  ];
};

/** Rounded gradient panel — jsPDF has no gradients, so we paint thin strips. */
function gradientRect(
  doc: jsPDF,
  x: number,
  y: number,
  w: number,
  h: number,
  from: string,
  to: string,
  steps = 80,
) {
  const rad = Math.min(R, h / 2);
  // Base in the start colour so the left rounded corners are clean.
  doc.setFillColor(...hexToRgb(from));
  doc.roundedRect(x, y, w, h, rad, rad, "F");

  // Strips across the straight middle section.
  const gx = x + rad;
  const gw = w - 2 * rad;
  const sw = gw / steps;
  for (let i = 0; i < steps; i++) {
    const t = Math.min(1, (rad + i * sw) / w);
    const [r, g, b] = mix(from, to, t);
    doc.setFillColor(r, g, b);
    doc.rect(gx + i * sw, y, sw + 0.15, h, "F");
  }

  // End cap last, so it covers the strip edge and keeps the right corners round.
  doc.setFillColor(...hexToRgb(to));
  doc.roundedRect(x + w - 2 * rad, y, 2 * rad, h, rad, rad, "F");
}

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

const CW = 85.6;
const CH = 54;
const R = 3.2;

export async function generateIdCardPdf(tenant: Tenant, r: IdCardData) {
  // ISO/IEC 7810 ID-1 is 85.6 x 54 mm
  const doc = new jsPDF({ 
    unit: "mm", 
    format: [CW + 40, CH + 60], 
    orientation: "landscape"
  });

  const canvasW = CW + 40;
  const canvasH = CH + 60;
  const fx = (canvasW - CW) / 2;
  const fy = (canvasH - CH) / 2;

  // Page 1: FRONT
  await drawCardFront(doc, tenant, r, fx, fy);
  
  // Cut guide and label for Front
  drawPrintUtilities(doc, fx, fy, "FRONT SIDE");

  // Page 2: BACK
  doc.addPage([CW + 40, CH + 60], "landscape");
  await drawCardBack(doc, tenant, r, fx, fy);

  // Cut guide and label for Back
  drawPrintUtilities(doc, fx, fy, "BACK SIDE");

  doc.save(`id-card-${r.playerId || r.name.replace(/\s+/g, "-")}.pdf`);
}

function drawPrintUtilities(doc: jsPDF, fx: number, fy: number, label: string) {
  // Cut guide
  doc.setDrawColor(205, 210, 218);
  doc.setLineWidth(0.15);
  doc.setLineDashPattern([1, 1], 0);
  doc.roundedRect(fx, fy, CW, CH, R, R, "S");
  doc.setLineDashPattern([], 0);

  // Label
  doc.setTextColor(185, 190, 198);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text(label, fx, fy - 4);
  doc.setFontSize(5);
  doc.setFont("helvetica", "normal");
  doc.text("Cut along the dotted line after printing", fx, fy - 1.5);
}

/** Many players, two-sided cards. */
export async function generateIdCardsPdf(tenant: Tenant, rows: IdCardData[]) {
  const canvasW = CW + 40;
  const canvasH = CH + 60;
  const doc = new jsPDF({ unit: "mm", format: [canvasW, canvasH], orientation: "landscape" });
  
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) doc.addPage([canvasW, canvasH], "landscape");
    const fx = (canvasW - CW) / 2;
    const fy = (canvasH - CH) / 2;
    
    await drawCardFront(doc, tenant, rows[i], fx, fy);
    drawPrintUtilities(doc, fx, fy, `PLAYER: ${rows[i].name} (FRONT)`);
    
    doc.addPage([canvasW, canvasH], "landscape");
    await drawCardBack(doc, tenant, rows[i], fx, fy);
    drawPrintUtilities(doc, fx, fy, `PLAYER: ${rows[i].name} (BACK)`);
  }
  doc.save(`id-cards-batch-${tenant.slug || "academy"}.pdf`);
}

/** Helper to get common brand colors and mixed variations */
function getCardTheme(tenant: Tenant) {
  const brand = safeHex(tenant.primary_color, "#0f172a");
  const accent = safeHex(tenant.secondary_color, "#f59e0b");
  const dark = mix(brand, "#000000", 0.35);
  const darkHex = `#${dark.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
  return { brand, accent, dark, darkHex };
}

/** Helper to load common assets (logo, photo) */
async function loadCardAssets(tenant: Tenant, r: IdCardData) {
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

  return { logoDataUrl, photoDataUrl };
}

/** FRONT side: Identity focused */
async function drawCardFront(doc: jsPDF, tenant: Tenant, r: IdCardData, fx: number, fy: number) {
  const { brand, accent, darkHex } = getCardTheme(tenant);
  const { logoDataUrl, photoDataUrl } = await loadCardAssets(tenant, r);

  // Gradient background
  gradientRect(doc, fx, fy, CW, CH, brand, darkHex);

  // Header
  let hx = fx + 6;
  if (logoDataUrl) {
    const fmt = logoDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
    try {
      doc.addImage(logoDataUrl, fmt, hx, fy + 4, 8, 8);
      hx += 10;
    } catch {}
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text((tenant.short_name || tenant.name).slice(0, 30).toUpperCase(), hx, fy + 8.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.6);
  doc.text("PLAYER IDENTITY CARD", hx, fy + 12);

  // Player ID in Header (Right side)
  doc.setTextColor(255, 255, 255, 0.4);
  doc.setFontSize(4.5);
  doc.text("PLAYER ID", fx + CW - 6, fy + 7.5, { align: "right" });
  doc.setTextColor(...hexToRgb(accent));
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text(r.playerId || "—", fx + CW - 6, fy + 11.5, { align: "right" });

  // White body panel
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(fx + 4, fy + 15, CW - 8, CH - 20, 2.4, 2.4, "F");

  // Photo (Left side)
  const pw = 20;
  const ph = 26;
  const px = fx + 7.5;
  const py = fy + 17.5;
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(px, py, pw, ph, 2, 2, "F");
  
  let drewPhoto = false;
  if (photoDataUrl) {
    try {
      const fmt = photoDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(photoDataUrl, fmt, px, py, pw, ph);
      drewPhoto = true;
    } catch {}
  }
  if (!drewPhoto) {
    const initials = r.name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join("").toUpperCase();
    doc.setTextColor(...hexToRgb(brand));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text(initials || "?", px + pw / 2, py + ph / 2 + 2, { align: "center" });
  }
  doc.setDrawColor(240, 242, 245);
  doc.setLineWidth(0.3);
  doc.roundedRect(px, py, pw, ph, 2, 2, "S");

  // Details (Centered relative to the info section)
  const dx = px + pw + 5;
  const dw = CW - (dx - fx) - 7;
  let y = py + 3.5;
  
  // Name
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const nameLines = (doc.splitTextToSize(r.name.toUpperCase(), dw) as string[]).slice(0, 2);
  doc.text(nameLines, dx, y);
  
  y += nameLines.length > 1 ? 9 : 5.5;
  
  // DOB
  doc.setTextColor(140, 146, 158);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.8);
  doc.text("DATE OF BIRTH", dx, y);
  y += 3.5;
  doc.setTextColor(55, 65, 81);
  doc.setFontSize(7.5);
  doc.text(fmtDate(r.dob).toUpperCase(), dx, y);

  y += 5.5;
  
  // Category
  doc.setTextColor(140, 146, 158);
  doc.setFontSize(4.8);
  doc.text("CATEGORY", dx, y);
  y += 3.5;
  doc.setTextColor(...hexToRgb(accent));
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text(`${r.sport || "CRICKET"} • ${r.batchName || "GENERAL"}`.toUpperCase(), dx, y);
  
  const location = formatShortLocation(r.villageLocality, r.city, r.state);
  if (location) {
    y += 5.5;
    doc.setTextColor(107, 114, 128);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.text(location.toUpperCase(), dx, y);
  }

  // Footer
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(5.4);
  doc.setFont("helvetica", "bold");
  doc.text(`JOINED ${fmtDate(r.joinedAt).toUpperCase()}`, fx + 6, fy + CH - 1.8);
  doc.text("OFFICIAL ID", fx + CW - 6, fy + CH - 1.8, { align: "right" });
}

/** BACK side: Utility focused (QR, Batch, Contact) */
async function drawCardBack(doc: jsPDF, tenant: Tenant, r: IdCardData, fx: number, fy: number) {
  const { brand, accent, darkHex } = getCardTheme(tenant);
  const { logoDataUrl } = await loadCardAssets(tenant, r);

  // Background
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(fx, fy, CW, CH, R, R, "F");

  // Compact Header
  doc.setFillColor(...hexToRgb(brand));
  doc.roundedRect(fx, fy, CW, 12, R, R, "F");
  doc.rect(fx, fy + 6, CW, 6, "F"); // Flatten bottom corners of header

  let hx = fx + 6;
  if (logoDataUrl) {
    const fmt = logoDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
    try {
      doc.addImage(logoDataUrl, fmt, hx, fy + 2.5, 7, 7);
      hx += 9;
    } catch {}
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text((tenant.short_name || tenant.name).slice(0, 30).toUpperCase(), hx, fy + 7.5);

  // QR Implementation
  const site = tenantSiteUrl(tenant);
  const qrPayload = r.cardToken
    ? `${site}/checkin?card=${r.cardToken}`
    : `${site}/?id=${encodeURIComponent(r.playerId || "")}`;
  
  try {
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      margin: 1,
      width: 400,
      errorCorrectionLevel: "M",
    });
    doc.addImage(qrDataUrl, "PNG", fx + (CW/2 - 13), fy + 14, 26, 26);
  } catch {}

  doc.setTextColor(...hexToRgb(accent));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("SCAN FOR ATTENDANCE", fx + CW/2, fy + 43, { align: "center" });

  // Player & Batch Details
  const bx = fx + 6;
  const bw = (CW - 12) / 2;
  let by = fy + 48;

  // Row 1
  doc.setTextColor(140, 146, 158);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.5);
  doc.text("PLAYER ID", bx, by);
  doc.text("ACADEMY CONTACT", bx + bw + 2, by);
  
  by += 3;
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text(r.playerId || "—", bx, by);
  doc.text(r.academyPhone || "—", bx + bw + 2, by);

  by += 5;
  // Row 2
  doc.setTextColor(140, 146, 158);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.5);
  doc.text("SESSION / BATCH", bx, by);
  doc.text("TRAINING TIME", bx + bw + 2, by);
  
  by += 3;
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text((r.batchName || "GENERAL").toUpperCase(), bx, by);
  doc.text((r.batchTiming || "REGULAR").toUpperCase(), bx + bw + 2, by);

  // Footer branding
  doc.setTextColor(200, 205, 215);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(4.5);
  doc.text("POWERED BY ACADEMY OS", fx + CW/2, fy + CH - 2, { align: "center" });
}


