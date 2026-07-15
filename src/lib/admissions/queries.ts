import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const admissionsRegistrationsQuery = (tenantId: string, reviewStatus?: string) =>
  queryOptions({
    queryKey: ["admissions", "registrations", tenantId, reviewStatus ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("registrations")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (reviewStatus) q = q.eq("review_status", reviewStatus);
      const { data, error } = await q.limit(500);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

export const importedStudentsQuery = (tenantId: string) =>
  queryOptions({
    queryKey: ["admissions", "imported", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, name, phone, email, lifecycle_status, activation_sent_at, activated_at, import_batch_id, created_at")
        .eq("tenant_id", tenantId)
        .in("lifecycle_status", ["imported", "invitation_sent", "activated", "profile_completed"])
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

export const importBatchesQuery = (tenantId: string) =>
  queryOptions({
    queryKey: ["admissions", "batches", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_import_batches")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

export const myPendingRegistrationQuery = () =>
  queryOptions({
    queryKey: ["admissions", "my-pending"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const { data, error } = await supabase
        .from("registrations")
        .select("*")
        .eq("applicant_user_id", userData.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 15_000,
  });
