import { createFileRoute } from "@tanstack/react-router";
import { PRODUCTS, SOLUTIONS, SITE } from "@/lib/site/content";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: () => {
        const paths = [
          "/",
          "/product",
          "/pricing",
          "/tools",
          "/tools/cedar-hollow",
          "/about",
          "/methodology",
          "/security",
          "/privacy",
          "/contact",
          ...PRODUCTS.map((p) => `/product/${p.slug}`),
          ...SOLUTIONS.map((s) => `/solutions/${s.slug}`),
        ];
        const urls = paths
          .map((p) => `  <url><loc>${SITE.url}${p}</loc></url>`)
          .join("\n");
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
        return new Response(xml, {
          headers: { "content-type": "application/xml; charset=utf-8" },
        });
      },
    },
  },
});
