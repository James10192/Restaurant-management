import { createFileRoute } from "@tanstack/react-router";
import { siteOrigin } from "~/lib/guest/env.server";

/**
 * robots.txt — Joliba
 *
 * Servi par le serveur plutôt que posé en fichier : la ligne `Sitemap:` doit être une URL
 * ABSOLUE (protocole robots, RFC 9309), et l'origine dépend du déploiement.
 *
 * Les pages de table (/r/…) ne sont PAS interdites ici, et c'est voulu : elles portent
 * « noindex », et un moteur doit pouvoir les lire pour le voir (D-030).
 */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: () =>
        new Response(["User-agent: *", "Disallow: /app/", "Disallow: /api/", `Sitemap: ${siteOrigin()}/sitemap.xml`, ""].join("\n"), {
          headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
        }),
    },
  },
});
