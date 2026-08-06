/**
 * Canonical list of Indian states for consistent selection and ID card abbreviation.
 */
export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
] as const;

export type IndianState = (typeof INDIAN_STATES)[number];

const STATE_ABBREVIATIONS: Record<string, string> = {
  "Andhra Pradesh": "AP",
  "Arunachal Pradesh": "AR",
  "Assam": "AS",
  "Bihar": "BR",
  "Chhattisgarh": "CG",
  "Goa": "GA",
  "Gujarat": "GJ",
  "Haryana": "HR",
  "Himachal Pradesh": "HP",
  "Jharkhand": "JH",
  "Karnataka": "KA",
  "Kerala": "KL",
  "Madhya Pradesh": "MP",
  "Maharashtra": "MH",
  "Manipur": "MN",
  "Meghalaya": "ML",
  "Mizoram": "MZ",
  "Nagaland": "NL",
  "Odisha": "OR",
  "Punjab": "PB",
  "Rajasthan": "RJ",
  "Sikkim": "SK",
  "Tamil Nadu": "TN",
  "Telangana": "TG",
  "Tripura": "TR",
  "Uttar Pradesh": "UP",
  "Uttarakhand": "UK",
  "West Bengal": "WB",
  "Andaman and Nicobar Islands": "AN",
  "Chandigarh": "CH",
  "Dadra and Nagar Haveli and Daman and Diu": "DN",
  "Delhi": "DL",
  "Jammu and Kashmir": "JK",
  "Ladakh": "LA",
  "Lakshadweep": "LD",
  "Puducherry": "PY",
};

/**
 * Returns a short location string for display on ID cards.
 * Example: Maharajpur • Chhatarpur, MP
 */
export function formatShortLocation(
  villageLocality?: string | null,
  cityDistrict?: string | null,
  state?: string | null,
): string {
  const parts: string[] = [];
  
  if (villageLocality?.trim()) {
    parts.push(villageLocality.trim());
  }
  
  const cityStateParts: string[] = [];
  if (cityDistrict?.trim()) {
    cityStateParts.push(cityDistrict.trim());
  }
  
  if (state?.trim()) {
    const abbr = STATE_ABBREVIATIONS[state.trim()] || state.trim();
    cityStateParts.push(abbr);
  }
  
  const cityStateStr = cityStateParts.join(", ");
  
  if (parts.length > 0 && cityStateStr) {
    return `${parts[0]} • ${cityStateStr}`;
  }
  
  return cityStateStr || parts[0] || "";
}
