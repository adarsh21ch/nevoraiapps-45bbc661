import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/public/sitemap/xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const platformBase = process.env.VITE_PLATFORM_BASE_DOMAIN || "nevorai.com";
        const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;
        
        const supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false },
        });

        // Fetch all active tenants for the sitemap
        const { data: tenants } = await supabase
          .from("tenants_public_directory")
          .select("slug, custom_domain")
          .eq("status", "active");

        const baseUrl = `https://${platformBase}`;
        
        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${baseUrl}/</loc><priority>1.0</priority></url>
  <url><loc>${baseUrl}/register</loc><priority>0.8</priority></url>`;

        for (const t of tenants || []) {
            const tUrl = t.custom_domain ? `https://${t.custom_domain}` : `https://${t.slug}.${platformBase}`;
            xml += `
  <url><loc>${tUrl}/</loc><priority>0.9</priority></url>
  <url><loc>${tUrl}/register</loc><priority>0.7</priority></url>`;
        }

        xml += `\n</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
