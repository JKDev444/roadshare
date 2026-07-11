import { createFileRoute } from "@tanstack/react-router";
import { SITE } from "@/lib/site/content";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(
          `User-agent: *\nAllow: /\n\nSitemap: ${SITE.url}/sitemap.xml\n`,
          { headers: { "content-type": "text/plain; charset=utf-8" } },
        ),
    },
  },
});
