import { createFileRoute } from "@tanstack/react-router";

/**
 * Santé de l'application, vérifiée après chaque déploiement (DEPLOYMENT.md §4) :
 * version déployée, joignabilité du backend Convex, horodatage. Aucune donnée métier.
 */
export const Route = createFileRoute("/api/health")({
  server: {
    handlers: {
      GET: async () => {
        const siteUrl = (import.meta.env.VITE_CONVEX_SITE_URL as string | undefined) ?? process.env.VITE_CONVEX_SITE_URL;
        let backend = "unknown";
        if (siteUrl) {
          try {
            const res = await fetch(`${siteUrl}/health`, { signal: AbortSignal.timeout(3000) });
            backend = res.ok ? "ok" : "degraded";
          } catch {
            backend = "down";
          }
        }
        const ok = backend === "ok";
        return Response.json(
          {
            status: ok ? "ok" : "degraded",
            backend,
            version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "dev",
            at: new Date().toISOString(),
          },
          { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
