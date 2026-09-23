import { createFileRoute } from "@tanstack/react-router";
import { logEvent } from "../../../convex/lib/log";

const MAX_BODY_BYTES = 4096;

/**
 * Remontée des erreurs du navigateur vers les journaux du serveur (DEPLOYMENT.md §6).
 * Le corps passe par la même liste d'inclusion que le backend : un champ inattendu — un
 * jeton, un code — est jeté, jamais écrit.
 */
export const Route = createFileRoute("/api/client-errors")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const text = await request.text();
        if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 413 });
        let body: Record<string, unknown>;
        try {
          body = JSON.parse(text) as Record<string, unknown>;
        } catch {
          return new Response(null, { status: 400 });
        }
        logEvent("error", "client.error", body);
        return new Response(null, { status: 204 });
      },
    },
  },
});
