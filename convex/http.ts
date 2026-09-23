import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Routes Better Auth (/api/auth/*) servies par le déploiement Convex, CORS compris.
// Le frontend y accède par le proxy `/api/auth/$` de TanStack Start (même origine).
authComponent.registerRoutes(http, createAuth, { cors: true });

http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const started = Date.now();
    try {
      await ctx.runQuery(internal.health.ping, {});
      return Response.json({ status: "ok", database: "ok", latencyMs: Date.now() - started });
    } catch {
      return Response.json({ status: "degraded", database: "down" }, { status: 503 });
    }
  }),
});

export default http;
