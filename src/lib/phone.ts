// Shared phone normalization.
// Default country: India (+91). Accepts inputs with spaces, dashes, parens,
// leading "+", or a bare 10-digit local number.
// Returns `null` when the digits don't look like a plausible international
// phone number (< 8 or > 15 digits after stripping).
export function toE164(raw: string, defaultCountry: "IN" = "IN"): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D+/g, "");
  if (!digits) return null;
  if (hasPlus) {
    if (digits.length < 8 || digits.length > 15) return null;
    return `+${digits}`;
  }
  // No leading + — apply default country rules.
  if (defaultCountry === "IN") {
    // 10-digit Indian mobile
    if (digits.length === 10) return `+91${digits}`;
    // Already includes country code (91XXXXXXXXXX)
    if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
    // Leading 0 + 10 digits (0XXXXXXXXXX)
    if (digits.length === 11 && digits.startsWith("0")) return `+91${digits.slice(1)}`;
  }
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

export function isLikelyEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
