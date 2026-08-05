/**
 * AcademyOS — printable player ID card.
 *
 * Renders a colourful, credit-card sized (ISO/IEC 7810 ID-1, 85.6 x 54 mm)
 * badge — front + back — on a single A4 page with cut guides, so an academy
 * can print, cut and laminate it.
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
  guardianPhone: string | null;
  batchName: string | null;
  joinedAt: string;
  photoPath: string | null;
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
  doc.setFillColor(...hexToRgb(to));
  doc.rect(x + w - 2 * rad, y + rad, rad, Math.max(0, h - 2 * rad), "F");
}

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

const CW = 85.6;
const CH = 54;
const R = 3.2;

export async function generateIdCardPdf(tenant: Tenant, r: IdCardData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await drawCardPair(doc, tenant, r);
  doc.save(`id-card-${r.playerId || r.name.replace(/\s+/g, "-")}.pdf`);
}

/** Many players, two cards (front+back) per A4 page. */
export async function generateIdCardsPdf(tenant: Tenant, rows: IdCardData[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) doc.addPage();
    await drawCardPair(doc, tenant, rows[i]);
  }
  doc.save(`id-cards-${tenant.slug || "academy"}.pdf`);
}

async function drawCardPair(doc: jsPDF, tenant: Tenant, r: IdCardData) {
  const brand = safeHex(tenant.primary_color, "#0f172a");
  const accent = safeHex(tenant.secondary_color, "#f59e0b");
  const dark = mix(brand, "#000000", 0.35);

  const marginX = 20;
  const frontY = 24;
  const backY = frontY + CH + 10;

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

  // ---------------------------------------------------------------- FRONT ---
  const fx = marginX;
  const fy = frontY;

  gradientRect(
    doc,
    fx,
    fy,
    CW,
    CH,
    brand,
    `#${dark.map((n) => n.toString(16).padStart(2, "0")).join("")}`,
  );

  // Accent rule under the header
  doc.setFillColor(...hexToRgb(accent));
  doc.roundedRect(fx + 6, fy + 14.2, 22, 1.1, 0.55, 0.55, "F");

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
  doc.setTextColor(255, 255, 255);
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
  const dw = CW - (dx - fx) - 26;
  let y = py + 3;
  doc.setTextColor(140, 146, 158);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.4);
  doc.text("PLAYER", dx, y);
  y += 3.6;
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const nameLines = doc.splitTextToSize(r.name, dw) as string[];
  doc.text(nameLines.slice(0, 2), dx, y);
  y += nameLines.length > 1 ? 8.4 : 4.6;

  doc.setTextColor(140, 146, 158);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.4);
  doc.text("PLAYER ID", dx, y);
  y += 3.4;
  doc.setTextColor(...hexToRgb(brand));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(r.playerId || "—", dx, y);

  y += 4.6;
  doc.setTextColor(140, 146, 158);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.4);
  doc.text("SESSION", dx, y);
  y += 3.3;
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.6);
  doc.text((r.batchName || "—").slice(0, 26), dx, y);

  // Front QR (small, for a quick scan without flipping the card)
  if (qrDataUrl) {
    const qs = 17;
    const qx = fx + CW - qs - 7;
    const qy = fy + 19.5;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(qx - 1.4, qy - 1.4, qs + 2.8, qs + 2.8, 1.6, 1.6, "F");
    doc.addImage(qrDataUrl, "PNG", qx, qy, qs, qs);
    doc.setTextColor(120, 126, 138);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(4.6);
    doc.text("SCAN FOR ATTENDANCE", qx + qs / 2, qy + qs + 3, { align: "center" });
  }

  // Bottom strip
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.4);
  doc.text(`JOINED ${fmtDate(r.joinedAt).toUpperCase()}`, fx + 6, fy + CH - 1.8);
  if (tenant.phone) {
    doc.text(tenant.phone, fx + CW - 6, fy + CH - 1.8, { align: "right" });
  }

  // ----------------------------------------------------------------- BACK ---
  const bx = marginX;
  const by = backY;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(bx, by, CW, CH, R, R, "F");
  gradientRect(doc, bx, by, CW, 7, accent, brand);

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.2);
  doc.text("ATTENDANCE PASS", bx + 6, by + 4.6);

  // Big QR
  if (qrDataUrl) {
    const qs = 30;
    const qx = bx + 6;
    const qy = by + 11;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(qx - 2, qy - 2, qs + 4, qs + 4, 2, 2, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(qx - 2, qy - 2, qs + 4, qs + 4, 2, 2, "S");
    doc.addImage(qrDataUrl, "PNG", qx, qy, qs, qs);
  }

  const tx = bx + 42;
  let ty = by + 13;
  doc.setTextColor(17, 24, 39);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.4);
  const tName = doc.splitTextToSize(tenant.name, CW - (tx - bx) - 6) as string[];
  doc.text(tName.slice(0, 2), tx, ty);
  ty += tName.length > 1 ? 6.4 : 3.6;

  doc.setTextColor(...hexToRgb(brand));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(5.6);
  doc.text("HOW IT WORKS", tx, ty);
  ty += 3.2;
  doc.setTextColor(90, 96, 108);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(5.4);
  const how = doc.splitTextToSize(
    "Show this card at the gate. First scan of the day = check-in, next scan = check-out.",
    CW - (tx - bx) - 6,
  ) as string[];
  doc.text(how.slice(0, 4), tx, ty);
  ty += how.slice(0, 4).length * 2.5 + 2;

  const line = (label: string, value: string) => {
    doc.setTextColor(150, 156, 166);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5);
    doc.text(label, tx, ty);
    ty += 2.5;
    doc.setTextColor(30, 36, 48);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.6);
    doc.text(value.slice(0, 28), tx, ty);
    ty += 3.4;
  };
  if (r.guardianName) line("GUARDIAN", r.guardianName);
  if (r.guardianPhone || r.phone) line("EMERGENCY", r.guardianPhone || r.phone);
  if (r.dob) line("DOB", fmtDate(r.dob));

  doc.setTextColor(140, 146, 158);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(4.8);
  doc.text("Property of the academy. If found, please return.", bx + 6, by + CH - 3);

  // Cut guides
  doc.setDrawColor(205, 210, 218);
  doc.setLineWidth(0.15);
  doc.setLineDashPattern([1, 1], 0);
  doc.roundedRect(fx, fy, CW, CH, R, R, "S");
  doc.roundedRect(bx, by, CW, CH, R, R, "S");
  doc.setLineDashPattern([], 0);
  doc.setTextColor(185, 190, 198);
  doc.setFontSize(5.6);
  doc.text("FRONT — cut along the dotted line", fx, fy - 2.5);
  doc.text("BACK — print on the reverse side", bx, by - 2.5);
}
