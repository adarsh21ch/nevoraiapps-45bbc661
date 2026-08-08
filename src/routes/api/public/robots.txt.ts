import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/robots/txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const platformBase = process.env.VITE_PLATFORM_BASE_DOMAIN || "nevorai.com";
        const sitemapUrl = `https://${platformBase}/api/public/sitemap.xml`;

        const content = `User-agent: *
Allow: /

Sitemap: ${sitemapUrl}
`;

        return new Response(content, {
          headers: {
            "Content-Type": "text/plain",
            "Cache-Control": "public, max-age=86400",
          },
        });
      },
    },
  },
});
