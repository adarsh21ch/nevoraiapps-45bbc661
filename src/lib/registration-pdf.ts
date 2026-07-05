import jsPDF from "jspdf";
import type { Tenant, FeePlan, Batch } from "./tenant";

export function generateBlankRegistrationPdf(
  tenant: Tenant,
  fees: FeePlan[],
  batches: Batch[],
) {
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
    doc.text(`${f.name}  —  Rs. ${f.amount.toLocaleString("en-IN")}${f.type === "monthly" ? " / month" : ""}`, margin + 18, y);
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
