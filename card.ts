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
type Tenant=any;
const tenantSiteUrl=(t:any)=>"https://x.test";
const signedUrl=async(_p:string)=>null;

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
  await drawCard(doc, tenant, r);
  doc.save(`id-card-${r.playerId || r.name.replace(/\s+/g, "-")}.pdf`);
}

/** Many players, one single-sided card per A4 page. */
export async function generateIdCardsPdf(tenant: Tenant, rows: IdCardData[]) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  for (let i = 0; i < rows.length; i++) {
    if (i > 0) doc.addPage();
    await drawCard(doc, tenant, rows[i]);
  }
  doc.save(`id-cards-${tenant.slug || "academy"}.pdf`);
}

/** Single-sided card: everything the gate needs lives on the front. */
async function drawCard(doc: jsPDF, tenant: Tenant, r: IdCardData) {
  const brand = safeHex(tenant.primary_color, "#0f172a");
  const accent = safeHex(tenant.secondary_color, "#f59e0b");
  const dark = mix(brand, "#000000", 0.35);

  const fx = 20;
  const fy = 30;

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
  const dw = CW - (dx - fx) - 30;
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
  doc.text((r.batchName || "—").slice(0, 22), dx, y);

  if (r.guardianPhone || r.phone) {
    y += 4.4;
    doc.setTextColor(140, 146, 158);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.4);
    doc.text("EMERGENCY", dx, y);
    y += 3.2;
    doc.setTextColor(17, 24, 39);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.2);
    doc.text((r.guardianPhone || r.phone).slice(0, 20), dx, y);
  }

  // The only QR — check-in / check-out at the gate.
  if (qrDataUrl) {
    const qs = 21;
    const qx = fx + CW - qs - 7;
    const qy = fy + 19;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(qx - 1.4, qy - 1.4, qs + 2.8, qs + 2.8, 1.6, 1.6, "F");
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(qx - 1.4, qy - 1.4, qs + 2.8, qs + 2.8, 1.6, 1.6, "S");
    doc.addImage(qrDataUrl, "PNG", qx, qy, qs, qs);
    doc.setTextColor(120, 126, 138);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(4.4);
    doc.text("SCAN: IN / OUT", qx + qs / 2, qy + qs + 2.8, { align: "center" });
  }

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

const doc: any = new (jsPDF as any)({ unit: "mm", format: "a4" });
await (globalThis as any).__draw?.(doc);
