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
const R = 2.5;

export async function generateIdCardPdf(tenant: Tenant, r: IdCardData) {
  await new Promise(resolve => setTimeout(resolve, 50));
  
  const doc = new jsPDF({ 
    unit: "mm", 
    format: [CW, CH], 
    orientation: "portrait"
  });

  await drawCardFront(doc, tenant, r, 0, 0);

  doc.addPage([CW, CH], "portrait");
  await drawCardBack(doc, tenant, r, 0, 0);

  doc.save(`id-card-${r.playerId || r.name.replace(/\s+/g, "-")}.pdf`);
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

  // Header Background with Curve
  doc.setFillColor(br, bg, bb);
  doc.rect(fx, fy, CW, 20, "F");
  
  // Curved wave transition
  doc.setFillColor(br, bg, bb);
  doc.moveTo(fx, fy + 20);
  doc.curveTo(fx + CW/2, fy + 25, fx + CW/2, fy + 25, fx + CW, fy + 20);
  doc.lineTo(fx + CW, fy);
  doc.lineTo(fx, fy);
  doc.fill();

  // Logo & Name
  let ly = fy + 5;
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", fx + CW/2 - 5, ly, 10, 10);
      ly += 11;
    } catch {}
  }
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text((tenant.short_name || tenant.name || "ACADEMY").toUpperCase(), fx + CW/2, ly + 2, { align: "center" });

  // Photo
  const pw = 30;
  const ph = 30;
  const px = fx + (CW - pw) / 2;
  const py = fy + 24;
  doc.setFillColor(240, 240, 240);
  doc.roundedRect(px, py, pw, ph, 2, 2, "F");
  if (photoDataUrl) {
    try { doc.addImage(photoDataUrl, "JPEG", px, py, pw, ph); } catch {}
  }

  // Name
  doc.setTextColor(br, bg, bb);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  const nameLines = doc.splitTextToSize(r.name.toUpperCase(), CW - 6);
  doc.text(nameLines, fx + CW / 2, py + ph + 8, { align: "center" });

  // Details
  let dy = py + ph + 16;
  const field = (label: string, value: string) => {
    doc.setTextColor(100, 100, 100);
    doc.setFontSize(6);
    doc.text(label, fx + 6, dy);
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(8);
    doc.text(value, fx + 25, dy);
    dy += 5;
  };
  field("PLAYER ID", r.playerId || "—");
  field("DOB", fmtDate(r.dob));
  field("SPORT", (r.sport || "CRICKET").toUpperCase());
  field("CONTACT", r.phone || "—");
  
  // Address
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(6);
  doc.text("ADDRESS", fx + 6, dy);
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(7);
  const addrLines = doc.splitTextToSize(r.academyAddress || "—", CW - 28);
  doc.text(addrLines, fx + 25, dy);

  // Footer
  doc.setFillColor(br, bg, bb);
  doc.rect(fx, fy + CH - 8, CW, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6);
  doc.text("MEMBER SINCE: " + fmtMonthYear(r.joinedAt), fx + 5, fy + CH - 3);
  doc.setFontSize(6);
  doc.text("OFFICIAL ID", fx + CW - 5, fy + CH - 3, { align: "right" });
}

async function drawCardBack(doc: jsPDF, tenant: Tenant, r: IdCardData, fx: number, fy: number) {
  const brand = safeHex(tenant.primary_color, "#0f172a");
  const [br, bg, bb] = hexToRgb(brand);

  // Header (same as front)
  doc.setFillColor(br, bg, bb);
  doc.rect(fx, fy, CW, 15, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.text((tenant.short_name || tenant.name || "ACADEMY").toUpperCase(), fx + CW/2, fy + 9, { align: "center" });

  // QR
  doc.setTextColor(100, 100, 100);
  doc.setFontSize(7);
  doc.text("SCAN FOR ATTENDANCE", fx + CW/2, fy + 25, { align: "center" });
  
  const site = tenantSiteUrl(tenant);
  const qrPayload = r.cardToken ? `${site}/checkin?card=${r.cardToken}` : `${site}/?id=${encodeURIComponent(r.playerId || "")}`;
  try {
    const qrDataUrl = await QRCode.toDataURL(qrPayload, { margin: 1, width: 200 });
    doc.addImage(qrDataUrl, "PNG", fx + CW/2 - 20, fy + 30, 40, 40);
  } catch {}

  // Session
  doc.setTextColor(br, bg, bb);
  doc.setFontSize(7);
  doc.text("SESSION / BATCH", fx + CW/2, fy + 75, { align: "center" });
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text((r.batchName || "GENERAL").toUpperCase(), fx + CW/2, fy + 80, { align: "center" });

  // Footer
  doc.setFillColor(br, bg, bb);
  doc.rect(fx, fy + CH - 8, CW, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(6);
  doc.text("POWERED BY ACADEMY OS", fx + CW/2, fy + CH - 3, { align: "center" });
}
