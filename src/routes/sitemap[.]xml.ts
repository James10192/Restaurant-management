import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { isIndexable } from "../../convex/lib/indexability";
import { convexServerUrl, siteOrigin } from "~/lib/guest/env.server";

/**
 * Plan du site — Joliba
 *
 * N'y figurent que les cartes publiques qui franchissent la porte de qualité, évaluée à
 * l'heure de la requête : une carte qui n'a pas été mise à jour depuis six mois en sort
 * d'elle-même. Jamais une page de table.
 */
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const now = Date.now();
        const origin = siteOrigin();
        const entries = await new ConvexHttpClient(convexServerUrl()).query(api.guest.sitemap, {});
        const urls = [
          `<url><loc>${origin}/</loc></url>`,
          ...entries
            .filter((e) => isIndexable(e.facts, now))
            .map(
              (e) =>
                `<url><loc>${origin}/menu/${e.slug}</loc><lastmod>${new Date(e.facts.lastPublishedAt ?? now).toISOString().slice(0, 10)}</lastmod></url>`,
            ),
        ];
        const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
        return new Response(body, {
          headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=0, s-maxage=3600" },
        });
      },
    },
  },
});
