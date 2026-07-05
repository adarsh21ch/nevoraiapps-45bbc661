import { supabase } from "@/integrations/supabase/client";

const BUCKET = "tenant-assets";

export async function uploadTenantFile(
  tenantId: string,
  folder: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "bin";
  const path = `${tenantId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function signedUrl(path: string, expiresIn = 60 * 60 * 24 * 365): Promise<string> {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) return "";
  return data.signedUrl;
}

export async function deleteTenantFile(path: string) {
  if (!path || path.startsWith("http")) return;
  await supabase.storage.from(BUCKET).remove([path]);
}

export const TENANT_BUCKET = BUCKET;
