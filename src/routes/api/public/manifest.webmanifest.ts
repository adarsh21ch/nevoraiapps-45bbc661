import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

/**
 * Per-tenant Web App Manifest.
 * Resolves the tenant from the incoming Host header (custom_domain or {slug}.nevorai.com)
 * so each academy installs to the phone home screen with its own name, icon, and colors.
 */
export const Route = createFileRoute("/api/public/manifest/webmanifest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const hostname = (request.headers.get("host") ?? url.hostname).split(":")[0].toLowerCase();
        const platformBase = process.env.VITE_PLATFORM_BASE_DOMAIN ?? "nevorai.com";
        const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!;
        const supabaseKey =
          process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY!;

        let tenant: {
          name: string;
          slug: string;
          tagline: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          logo_url: string | null;
        } | null = null;

        try {
          const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false },
          });

          // Try custom_domain match first
          let { data } = await supabase
            .from("tenants")
            .select("name, slug, tagline, primary_color, secondary_color, logo_url")
            .eq("custom_domain", hostname)
            .maybeSingle();

          // Fallback: {slug}.{platformBase}
          if (!data && hostname.endsWith("." + platformBase)) {
            const slug = hostname.replace("." + platformBase, "").split(".").pop();
            if (slug) {
              const res = await supabase
                .from("tenants")
                .select("name, slug, tagline, primary_color, secondary_color, logo_url")
                .eq("slug", slug)
                .maybeSingle();
              data = res.data;
            }
          }

          tenant = data;
        } catch {
          // fall through to platform defaults
        }

        // Resolve logo → signed URL for icons if it's a storage path
        let iconUrl = tenant?.logo_url ?? "/favicon.ico";
        if (tenant?.logo_url && !tenant.logo_url.startsWith("http")) {
          try {
            const supabase = createClient(supabaseUrl, supabaseKey, {
              auth: { persistSession: false },
            });
            const { data: signed } = await supabase.storage
              .from("tenant-assets")
              .createSignedUrl(tenant.logo_url, 60 * 60 * 24 * 30);
            if (signed?.signedUrl) iconUrl = signed.signedUrl;
          } catch {
            iconUrl = "/favicon.ico";
          }
        }

        const name = tenant?.name ?? "Academy OS";
        const shortName = (tenant?.name ?? "Academy").slice(0, 12);
        const themeColor = tenant?.primary_color ?? "#0a0a0a";
        const bgColor = tenant?.secondary_color ?? "#0a0a0a";
        const description =
          tenant?.tagline ?? "Register, view fees, and stay in touch with your academy.";

        const manifest = {
          name,
          short_name: shortName,
          description,
          start_url: "/",
          scope: "/",
          display: "standalone",
          orientation: "portrait",
          theme_color: themeColor,
          background_color: bgColor,
          icons: [
            { src: iconUrl, sizes: "192x192", type: "image/png", purpose: "any" },
            { src: iconUrl, sizes: "512x512", type: "image/png", purpose: "any maskable" },
          ],
        };

        return new Response(JSON.stringify(manifest), {
          status: 200,
          headers: {
            "content-type": "application/manifest+json; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        });
      },
    },
  },
});
