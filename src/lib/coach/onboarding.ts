import { supabase } from "@/integrations/supabase/client";

export const onboardingKeys = {
  status: (userId: string) => ["coach", "onboarding", userId] as const,
};

export async function fetchOnboardingStatus(userId: string): Promise<string | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("profiles")
    .select("coach_onboarded_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data?.coach_onboarded_at as string | null) ?? null;
}

export async function markOnboardingComplete(userId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("profiles")
    .update({ coach_onboarded_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) throw error;
}
