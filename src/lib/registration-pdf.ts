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
  email?: string | null;
  address?: string | null;
  batch_name?: string | null;
  fee_plan_name?: string | null;
  fee_amount?: number | null;
  player_id?: string | null;
  // Sport profile (kept sport-agnostic — cricket fields are optional)
  height_cm?: number | string | null;
  weight_kg?: number | string | null;
  batting_style?: string | null;
  bowling_style?: string | null;
  interests?: string | null;
  medical_notes?: string | null;
  terms_accepted?: boolean | null;
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
    doc.text(value && String(value).trim() !== "" ? String(value) : "—", margin + 150, y);
    y += 18;
  };

  row("Student name", reg.name);
  row("Date of birth", reg.dob);
  row("Gender", reg.gender ?? null);
  row("Guardian", reg.guardian_name);
  row("Contact phone", reg.phone);
  row("WhatsApp", reg.whatsapp);
  if (reg.email) row("Email", reg.email);
  if (reg.address) row("Address", reg.address);
  row("Batch", reg.batch_name ?? null);

  // Sport profile
  const height = reg.height_cm != null && String(reg.height_cm).trim() !== ""
    ? `${reg.height_cm} cm`
    : null;
  const weight = reg.weight_kg != null && String(reg.weight_kg).trim() !== ""
    ? `${reg.weight_kg} kg`
    : null;
  if (height) row("Height", height);
  if (weight) row("Weight", weight);
  if (reg.batting_style) row("Batting style", reg.batting_style);
  if (reg.bowling_style) row("Bowling style", reg.bowling_style);
  if (reg.interests) row("Interests / role", reg.interests);
  if (reg.medical_notes) row("Medical notes", reg.medical_notes);

  row(
    "Fee plan",
    reg.fee_plan_name
      ? `${reg.fee_plan_name}${reg.fee_amount != null ? "  —  Rs. " + reg.fee_amount.toLocaleString("en-IN") : ""}`
      : null,
  );
  if (reg.created_at) row("Registered on", new Date(reg.created_at).toLocaleString("en-IN"));

  // Terms & Conditions acceptance (explicit line)
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setTextColor(80);
  doc.text("Terms & Conditions", margin, y);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(20);
  const tick = reg.terms_accepted ? "[X]" : "[ ]";
  doc.text(`${tick}  Accepted by parent / guardian`, margin + 150, y);
  y += 18;

  // Policy acceptances
  if (reg.policy_acceptances && reg.policy_acceptances.length > 0) {
    y += 4;
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
    `I confirm the information provided is accurate. I have read and accepted the academy's Terms & Conditions and policies, and I take responsibility for the student's participation at ${tenant.name}.`,
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
  const h = doc.internal.pageSize.getHeight();
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

  y += 22;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(20);
  doc.text("Student Registration Form", margin, y);

  y += 20;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);

  const field = (label: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    doc.setDrawColor(200);
    doc.line(margin + 150, y + 2, w - margin, y + 2);
    y += 22;
  };

  // Two short fields on one row (label + line at half-width)
  const fieldPair = (labelA: string, labelB: string) => {
    const half = (w - margin * 2) / 2;
    doc.setFont("helvetica", "bold");
    doc.text(labelA, margin, y);
    doc.setDrawColor(200);
    doc.line(margin + 90, y + 2, margin + half - 12, y + 2);
    doc.text(labelB, margin + half, y);
    doc.line(margin + half + 90, y + 2, w - margin, y + 2);
    y += 22;
  };

  field("Student name");
  field("Date of birth");
  field("Gender");
  field("Guardian name");
  field("Guardian phone");
  field("WhatsApp number");
  field("Email");
  field("Address");
  fieldPair("Height (cm)", "Weight (kg)");

  // Cricket profile: batting / bowling / interests
  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text("Playing profile", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);

  const checkboxRow = (label: string, opts: string[]) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, margin, y);
    doc.setFont("helvetica", "normal");
    let x = margin + 110;
    for (const o of opts) {
      doc.rect(x, y - 8, 10, 10);
      doc.text(o, x + 14, y);
      x += 14 + doc.getTextWidth(o) + 16;
    }
    y += 18;
  };
  checkboxRow("Batting style", ["Right-hand", "Left-hand"]);
  checkboxRow("Bowling style", ["Right-arm", "Left-arm", "Spin", "Pace"]);
  checkboxRow("Role", ["Batter", "Bowler", "All-rounder", "Wicket-keeper"]);

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.text("Other interests", margin, y);
  doc.line(margin + 150, y + 2, w - margin, y + 2);
  y += 22;

  doc.setFont("helvetica", "bold");
  doc.text("Medical notes", margin, y);
  doc.line(margin + 150, y + 2, w - margin, y + 2);
  y += 22;

  y += 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text("Batch preference", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  batches.forEach((b) => {
    doc.rect(margin, y - 8, 10, 10);
    doc.text(`${b.name}${b.timing ? "  (" + b.timing + ")" : ""}`, margin + 18, y);
    y += 16;
  });

  y += 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text("Fee plan", margin, y);
  y += 14;
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
    y += 16;
  });

  // Terms & Conditions acknowledgement
  y += 8;
  doc.setDrawColor(220);
  doc.line(margin, y, w - margin, y);
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(20);
  doc.text("Terms & Conditions", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(80);
  const tcLines = doc.splitTextToSize(
    `I / We accept the Terms & Conditions of ${tenant.name}, including its policies on fees, refunds, code of conduct, medical care and use of images / videos. Full terms are available on the academy website.`,
    w - margin * 2 - 24,
  );
  doc.rect(margin, y - 9, 10, 10);
  doc.text(tcLines, margin + 18, y);
  y += tcLines.length * 12 + 8;

  y += 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text("Guardian signature", margin, y);
  doc.line(margin + 140, y + 2, margin + (w - margin * 2) / 2 - 12, y + 2);
  doc.text("Date", margin + (w - margin * 2) / 2, y);
  doc.line(margin + (w - margin * 2) / 2 + 40, y + 2, w - margin, y + 2);
  y += 26;
  doc.text("Student signature", margin, y);
  doc.line(margin + 140, y + 2, margin + (w - margin * 2) / 2 - 12, y + 2);

  // Footer (address / contact from tenant record — edit in Dashboard → Website → Contact & UPI)
  const footerY = h - 32;
  doc.setDrawColor(230);
  doc.line(margin, footerY - 10, w - margin, footerY - 10);
  doc.setFontSize(9);
  doc.setTextColor(140);
  const parts = [tenant.phone, tenant.email, tenant.address].filter(Boolean).join("  ·  ");
  if (parts) {
    const lines = doc.splitTextToSize(parts, w - margin * 2);
    doc.text(lines, margin, footerY);
  }

  doc.save(`${tenant.slug}-registration-form.pdf`);
}
