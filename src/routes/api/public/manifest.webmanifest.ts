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

        type TenantRow = {
          name: string;
          slug: string;
          tagline: string | null;
          primary_color: string | null;
          secondary_color: string | null;
          logo_url: string | null;
          short_name: string | null;
        };
        let tenant: TenantRow | null = null;

        const COLS = "name, slug, tagline, primary_color, secondary_color, logo_url, short_name";

        try {
          const supabase = createClient(supabaseUrl, supabaseKey, {
            auth: { persistSession: false },
          });

          // Query the anon-readable public directory view. The base `tenants`
          // table is not granted to anon, so a direct select returns null and
          // the manifest silently falls back to platform defaults — which is
          // why every academy previously installed as "Academy OS" with the
          // Lovable favicon.
          const first = await (supabase.from("tenants_public_directory") as any)
            .select(COLS)
            .eq("custom_domain", hostname)
            .maybeSingle();
          let data = first.data as TenantRow | null;

          // Fallback: {slug}.{platformBase}
          if (!data && hostname.endsWith("." + platformBase)) {
            const slug = hostname
              .replace("." + platformBase, "")
              .split(".")
              .pop();
            if (slug) {
              const res = await (supabase.from("tenants_public_directory") as any)
                .select(COLS)
                .eq("slug", slug)
                .maybeSingle();
              data = res.data as TenantRow | null;
            }
          }

          tenant = data;
        } catch {
          // fall through to platform defaults
        }


        // Resolve logo → signed URL for icons if it's a storage path
        let iconUrl = tenant?.logo_url ?? "/favicon.ico";
        let iconType = "image/png";
        if (tenant?.logo_url && !tenant.logo_url.startsWith("http")) {
          try {
            const supabase = createClient(supabaseUrl, supabaseKey, {
              auth: { persistSession: false },
            });
            const { data: signed } = await supabase.storage
              .from("tenant-assets")
              .createSignedUrl(tenant.logo_url, 60 * 60 * 24 * 30);
            if (signed?.signedUrl) iconUrl = signed.signedUrl;
            const ext = tenant.logo_url.split(".").pop()?.toLowerCase() ?? "";
            iconType =
              ext === "webp"
                ? "image/webp"
                : ext === "svg"
                  ? "image/svg+xml"
                  : ext === "jpg" || ext === "jpeg"
                    ? "image/jpeg"
                    : ext === "ico"
                      ? "image/x-icon"
                      : "image/png";
          } catch {
            iconUrl = "/favicon.ico";
            iconType = "image/x-icon";
          }
        } else if (tenant?.logo_url) {
          const ext = tenant.logo_url.split(".").pop()?.toLowerCase() ?? "";
          if (ext === "webp") iconType = "image/webp";
          else if (ext === "svg") iconType = "image/svg+xml";
          else if (ext === "jpg" || ext === "jpeg") iconType = "image/jpeg";
        } else {
          iconType = "image/x-icon";
        }

        const name = tenant?.name ?? "Academy OS";
        const shortName =
          tenant?.short_name && tenant.short_name.trim()
            ? tenant.short_name.trim().slice(0, 12)
            : (tenant?.name ?? "Academy").slice(0, 12);
        const themeColor = tenant?.primary_color ?? "#0a0a0a";
        const bgColor = tenant?.secondary_color ?? "#0a0a0a";
        const description =
          tenant?.tagline ?? "Register, view fees, and stay in touch with your academy.";

        // Tenant PWAs (custom domain or {slug}.nevorai.com) should install as
        // the parent-facing academy website — hero video, CTAs, gallery — so
        // tapping the home-screen icon lands on the marketing home ("/"),
        // never on the owner login/router. The platform PWA on the bare
        // nevorai.com / lovable.app host keeps the /app-launch behaviour so
        // owners land in their dashboard.
        const startUrl = tenant ? "/" : "/app-launch";

        const manifest = {
          id: startUrl,
          name,
          short_name: shortName,
          description,
          start_url: startUrl,
          scope: "/",
          display: "standalone",
          display_override: ["standalone", "minimal-ui"],
          orientation: "portrait",
          theme_color: themeColor,
          background_color: bgColor,
          categories: ["sports", "education", "productivity"],
          lang: "en",
          dir: "ltr",
          prefer_related_applications: false,
          launch_handler: {
            client_mode: ["focus-existing", "navigate-existing", "auto"],
          },
          icons: [
            { src: iconUrl, sizes: "192x192", type: iconType, purpose: "any" },
            { src: iconUrl, sizes: "512x512", type: iconType, purpose: "any" },
            { src: iconUrl, sizes: "192x192", type: iconType, purpose: "maskable" },
            { src: iconUrl, sizes: "512x512", type: iconType, purpose: "maskable" },
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
