import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { Tenant, FeePlan, Batch } from "./tenant";
import { tenantSiteUrl } from "./tenant";

export type FilledRegistrationInput = {
  name: string;
  phone: string | null;
  dob: string | null;
  gender?: string | null;
  guardian_name: string | null;
  guardian_phone?: string | null;
  whatsapp: string | null;
  address?: string | null;
  batch_name?: string | null;
  fee_plan_name?: string | null;
  fee_amount?: number | null;
  player_id?: string | null;
  policy_acceptances?: Array<{ kind: string; version: number; accepted_at: string }> | null;
  photo_data_url?: string | null;
  created_at?: string | null;
};

export async function generateFilledRegistrationPdf(tenant: Tenant, reg: FilledRegistrationInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const margin = 48;
  let y = margin;

  // Header
  doc.setFillColor(tenant.primary_color ?? "#0ea5e9");
  doc.rect(0, 0, w, 8, "F");
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20);
  doc.text(tenant.name, margin, y);
  if (tenant.tagline) {
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(tenant.tagline, margin, y);
  }

  // QR (link to academy site) top-right
  try {
    const url = tenantSiteUrl(tenant, "nevorai.com");
    const qrData = await QRCode.toDataURL(url, { margin: 0, scale: 6 });
    doc.addImage(qrData, "PNG", w - margin - 72, margin - 8, 72, 72);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text("Scan for academy site", w - margin - 72, margin + 74);
  } catch {
    // QR generation failed - continue without it
  }

  // Photo (optional)
  if (reg.photo_data_url) {
    try {
      doc.addImage(reg.photo_data_url, "JPEG", margin, margin + 40, 72, 90);
    } catch {
      // ignore invalid photo
    }
  }

  y = margin + 140;
  doc.setDrawColor(220);
  doc.line(margin, y, w - margin, y);

  y += 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text("Student Registration", margin, y);
  if (reg.player_id) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(`Player ID: ${reg.player_id}`, w - margin, y, { align: "right" });
  }

  y += 20;
  doc.setFontSize(10);

  const row = (label: string, value: string | null | undefined) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(80);
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(20);
    doc.text(value && value.trim() !== "" ? value : "—", margin + 150, y);
    y += 20;
  };

  row("Student name", reg.name);
  row("Date of birth", reg.dob);
  row("Gender", reg.gender ?? null);
  row("Guardian", reg.guardian_name);
  row("Contact phone", reg.phone);
  row("WhatsApp", reg.whatsapp);
  if (reg.address) row("Address", reg.address);
  row("Batch", reg.batch_name ?? null);
  row(
    "Fee plan",
    reg.fee_plan_name
      ? `${reg.fee_plan_name}${reg.fee_amount != null ? "  —  Rs. " + reg.fee_amount.toLocaleString("en-IN") : ""}`
      : null,
  );
  if (reg.created_at) row("Registered on", new Date(reg.created_at).toLocaleString("en-IN"));

  // Policy acceptances
  if (reg.policy_acceptances && reg.policy_acceptances.length > 0) {
    y += 8;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(20);
    doc.text("Policies accepted", margin, y);
    y += 14;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(80);
    for (const a of reg.policy_acceptances) {
      doc.text(
        `• ${a.kind}  ·  v${a.version}  ·  ${new Date(a.accepted_at).toLocaleString("en-IN")}`,
        margin,
        y,
      );
      y += 14;
    }
  }

  // Declaration
  y = Math.max(y + 16, h - 180);
  doc.setDrawColor(220);
  doc.line(margin, y, w - margin, y);
  y += 18;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text("Declaration", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80);
  const decl = doc.splitTextToSize(
    `I confirm the information provided is accurate. I have read and accepted the academy's policies and take responsibility for the student's participation at ${tenant.name}.`,
    w - margin * 2,
  );
  doc.text(decl, margin, y);
  y += decl.length * 12 + 16;

  doc.setFont("helvetica", "bold");
  doc.text("Parent / Guardian signature", margin, y);
  doc.line(margin + 180, y + 2, margin + 380, y + 2);
  doc.text("Date", margin + 400, y);
  doc.line(margin + 440, y + 2, w - margin, y + 2);
  y += 26;
  doc.text("Student signature", margin, y);
  doc.line(margin + 180, y + 2, margin + 380, y + 2);

  // Footer
  const footerY = h - 28;
  doc.setFontSize(8);
  doc.setTextColor(140);
  const parts = [tenant.phone, tenant.email, tenant.address].filter(Boolean).join("  ·  ");
  if (parts) doc.text(parts, margin, footerY);

  const filename = `${tenant.slug}-registration-${(reg.name || "student").replace(/\s+/g, "-").toLowerCase()}.pdf`;
  doc.save(filename);
}

export function generateBlankRegistrationPdf(tenant: Tenant, fees: FeePlan[], batches: Batch[]) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const margin = 48;
  let y = margin;

  // Header band
  doc.setFillColor(tenant.primary_color);
  doc.rect(0, 0, w, 8, "F");

  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(20);
  doc.text(tenant.name, margin, y);

  if (tenant.tagline) {
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(110);
    doc.text(tenant.tagline, margin, y);
  }

  y += 28;
  doc.setDrawColor(220);
  doc.line(margin, y, w - margin, y);

  y += 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text("Student Registration Form", margin, y);

  y += 24;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);

  const field = (label: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setDrawColor(200);
    doc.line(margin + 140, y + 2, w - margin, y + 2);
    y += 26;
  };

  field("Student name");
  field("Date of birth");
  field("Guardian name");
  field("Guardian phone");
  field("WhatsApp number");
  field("Address");

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text("Batch preference", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  batches.forEach((b) => {
    doc.rect(margin, y - 8, 10, 10);
    doc.text(`${b.name}${b.timing ? "  (" + b.timing + ")" : ""}`, margin + 18, y);
    y += 18;
  });

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text("Fee plan", margin, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  fees.forEach((f) => {
    doc.rect(margin, y - 8, 10, 10);
    doc.text(
      `${f.name}  —  Rs. ${f.amount.toLocaleString("en-IN")}${f.type === "monthly" ? " / month" : ""}`,
      margin + 18,
      y,
    );
    y += 18;
  });

  y += 20;
  doc.setDrawColor(220);
  doc.line(margin, y, w - margin, y);
  y += 20;
  doc.setFont("helvetica", "bold");
  doc.text("Guardian signature", margin, y);
  doc.line(margin + 140, y + 2, w - margin, y + 2);
  y += 26;
  doc.text("Date", margin, y);
  doc.line(margin + 140, y + 2, w - margin, y + 2);

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 32;
  doc.setFontSize(9);
  doc.setTextColor(140);
  const parts = [tenant.phone, tenant.email, tenant.address].filter(Boolean).join("  ·  ");
  if (parts) doc.text(parts, margin, footerY);

  doc.save(`${tenant.slug}-registration-form.pdf`);
}
