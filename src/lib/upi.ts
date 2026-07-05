import QRCode from "qrcode";

export function buildUpiUri(opts: { upiId: string; name: string; amount?: number; note?: string }) {
  const params = new URLSearchParams();
  params.set("pa", opts.upiId);
  params.set("pn", opts.name);
  if (opts.amount && opts.amount > 0) params.set("am", opts.amount.toFixed(2));
  params.set("cu", "INR");
  if (opts.note) params.set("tn", opts.note);
  return `upi://pay?${params.toString()}`;
}

export async function upiQrDataUrl(opts: Parameters<typeof buildUpiUri>[0], color?: string) {
  const uri = buildUpiUri(opts);
  return QRCode.toDataURL(uri, {
    width: 320,
    margin: 1,
    color: { dark: color ?? "#0f172a", light: "#ffffff" },
    errorCorrectionLevel: "M",
  });
}
