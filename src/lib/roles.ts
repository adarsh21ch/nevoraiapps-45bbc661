export type UserRole = "owner" | "coach";

export function isOwner(profile: { role?: string | null } | null | undefined): boolean {
  return profile?.role === "owner";
}

export function isCoach(profile: { role?: string | null } | null | undefined): boolean {
  return profile?.role === "coach";
}

export function normalizeRole(role: string | null | undefined): UserRole {
  return role === "coach" ? "coach" : "owner";
}
