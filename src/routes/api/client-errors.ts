import { createFileRoute } from "@tanstack/react-router";
import { logEvent } from "../../../convex/lib/log";

const MAX_BODY_BYTES = 4096;
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;

/**
 * Limite par client, en mémoire de l'instance. C'est une borne « au mieux » (chaque
 * instance sans serveur a la sienne), suffisante pour qu'un seul navigateur en boucle ne
 * remplisse pas les journaux. Les écritures sont de toute façon réduites aux champs de la
 * liste d'inclusion, tronqués.
 */
const recent = new Map<string, { count: number; since: number }>();

function allow(key: string, now: number): boolean {
  const entry = recent.get(key);
  if (!entry || now - entry.since > WINDOW_MS) {
    if (recent.size > 5000) recent.clear();
    recent.set(key, { count: 1, since: now });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_PER_WINDOW;
}

/**
 * Remontée des erreurs du navigateur vers les journaux du serveur (DEPLOYMENT.md §6).
 * Le corps passe par la même liste d'inclusion que le backend : un champ inattendu — un
 * jeton, un code — est jeté, jamais écrit.
 */
export const Route = createFileRoute("/api/client-errors")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const client =
          request.headers.get("x-vercel-forwarded-for") ?? request.headers.get("x-forwarded-for") ?? "inconnu";
        if (!allow(client, Date.now())) return new Response(null, { status: 429 });
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
