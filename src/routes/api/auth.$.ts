import { createFileRoute } from "@tanstack/react-router";
import { handler } from "~/lib/auth-server";

// Relais des requêtes Better Auth vers le déploiement Convex (cookies et jeton compris).
export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => handler(request),
      POST: ({ request }) => handler(request),
    },
  },
});
