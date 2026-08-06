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

/** Single-sided card: everything the gate needs lives on the front. */
async function drawCard(doc: jsPDF, tenant: Tenant, r: IdCardData, fx: number, fy: number) {
  const brand = safeHex(tenant.primary_color, "#0f172a");
  const accent = safeHex(tenant.secondary_color, "#f59e0b");
  const dark = mix(brand, "#000000", 0.35);

  // QR payload — private card token; falls back to a verify link.
  const site = tenantSiteUrl(tenant);
  const qrPayload = r.cardToken
    ? `${site}/checkin?card=${r.cardToken}`
    : `${site}/?id=${encodeURIComponent(r.playerId || "")}`;
  let qrDataUrl: string | null = null;
  try {
    qrDataUrl = await QRCode.toDataURL(qrPayload, {
      margin: 0,
      width: 600,
      errorCorrectionLevel: "M",
      color: { dark: "#0b1220", light: "#ffffff" },
    });
  } catch {
    /* card still prints without the QR */
  }

  let logoDataUrl: string | null = null;
  if (tenant.logo_url) {
    try {
      const url = tenant.logo_url.startsWith("http")
        ? tenant.logo_url
        : await signedUrl(tenant.logo_url);
      if (url) logoDataUrl = await loadImageDataUrl(url);
    } catch {
      /* ignore */
    }
  }

  let photoDataUrl: string | null = null;
  if (r.photoPath) {
    try {
      const url = r.photoPath.startsWith("http") ? r.photoPath : await signedUrl(r.photoPath);
      if (url) photoDataUrl = await loadImageDataUrl(url);
    } catch {
      /* ignore */
    }
  }

  gradientRect(
    doc,
    fx,
    fy,
    CW,
    CH,
    brand,
    `#${dark.map((n) => n.toString(16).padStart(2, "0")).join("")}`,
  );

  // Accent rule removed as requested

  // Header — logo + academy name
  let hx = fx + 6;
  if (logoDataUrl) {
    const fmt = logoDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
    try {
      doc.addImage(logoDataUrl, fmt, hx, fy + 4.5, 8, 8);
      hx += 10;
    } catch {
      /* ignore */
    }
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text((tenant.short_name || tenant.name).slice(0, 26).toUpperCase(), hx, fy + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.6);
  doc.text("PLAYER IDENTITY CARD", hx, fy + 12.6);

  // White body panel
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(fx + 4, fy + 16, CW - 8, CH - 21, 2.4, 2.4, "F");

  // Photo
  const pw = 20;
  const ph = 24;
  const px = fx + 7.5;
  const py = fy + 18.5;
  doc.setFillColor(238, 240, 245);
  doc.roundedRect(px, py, pw, ph, 2, 2, "F");
  let drewPhoto = false;
  if (photoDataUrl) {
    try {
      const fmt = photoDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(photoDataUrl, fmt, px, py, pw, ph);
      drewPhoto = true;
    } catch {
      /* ignore */
    }
  }
  if (!drewPhoto) {
    const initials = r.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase();
    doc.setTextColor(...hexToRgb(brand));
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(initials || "?", px + pw / 2, py + ph / 2 + 2.5, { align: "center" });
  }
  doc.setDrawColor(...hexToRgb(accent));
  doc.setLineWidth(0.5);
  doc.roundedRect(px, py, pw, ph, 2, 2, "S");
  doc.setLineWidth(0.2);

  // Details
  const dx = px + pw + 4;
  const dw = CW - (dx - fx) - 7; // Increased width
  let y = py + 5;
  doc.setTextColor(140, 146, 158);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.4);
  doc.text("PLAYER", dx, y);
  y += 3.8;
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  const nameLines = (doc.splitTextToSize(r.name, dw) as string[]).slice(0, 2);
  doc.text(nameLines, dx, y);
  y += nameLines.length > 1 ? 8.2 : 4.6;

  doc.setTextColor(140, 146, 158);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.4);
  doc.text("PLAYER ID", dx, y);
  y += 3.5;
  doc.setTextColor(...hexToRgb(accent));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(r.playerId || "—", dx, y);

  y += 4.5;
  doc.setTextColor(140, 146, 158);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.4);
  doc.text("DOB", dx, y);
  y += 3.5;
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.4);
  doc.text(fmtDate(r.dob), dx, y);

  y += 4.5;
  doc.setTextColor(140, 146, 158);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.4);
  doc.text("CATEGORY", dx, y);
  y += 3.5;
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.2);
  doc.text(`CRICKET • ${r.batchName || "JUNIOR"}`.toUpperCase(), dx, y);

  const location = [r.city, r.state].filter(Boolean).join(", ");
  if (location) {
    y += 4.5;
    doc.setTextColor(140, 146, 158);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.4);
    doc.text(location.toUpperCase(), dx, y);
  }

  // No QR on Front in Phase 1
  /*
  if (qrDataUrl) {
    ...
  }
  */

  // Bottom strip
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.4);
  doc.text(`JOINED ${fmtDate(r.joinedAt).toUpperCase()}`, fx + 6, fy + CH - 1.8);
  if (tenant.phone) {
    doc.text(tenant.phone, fx + CW - 6, fy + CH - 1.8, { align: "right" });
  }

  // Cut guide
  doc.setDrawColor(205, 210, 218);
  doc.setLineWidth(0.15);
  doc.setLineDashPattern([1, 1], 0);
  doc.roundedRect(fx, fy, CW, CH, R, R, "S");
  doc.setLineDashPattern([], 0);
  doc.setTextColor(185, 190, 198);
  doc.setFontSize(5.6);
  doc.text("Cut along the dotted line — single-sided card", fx, fy - 2.5);
}

