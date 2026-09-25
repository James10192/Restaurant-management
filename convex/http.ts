import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { authComponent, createAuth } from "./auth";
import { logEvent } from "./lib/log";
import { readWaveEvent } from "./lib/providers/wave";
import { openSecret } from "./lib/secretBox";
import { sha256Hex } from "./lib/tokens";
import { verifyWaveSignature } from "./lib/waveSignature";

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

/** Un corps de webhook Wave tient en quelques Ko ; au-delà, ce n'est pas Wave. */
const MAX_WEBHOOK_BODY = 64 * 1024;

/**
 * Lit le corps en s'arrêtant à la limite, même sans `content-length` : un envoi sans fin ne doit
 * pas être lu en entier avant d'être refusé. `null` : trop long.
 */
async function readLimited(request: Request, max: number): Promise<string | null> {
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(size);
  let offset = 0;
  for (const c of chunks) {
    all.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

/**
 * Le webhook Wave — D-118. Répond vite (Wave attend moins de 5 s) et sans appel sortant : tout le
 * traitement tient dans UNE mutation. L'ordre compte :
 *  1. le compte, par l'adresse (aléatoire) — inconnue : 404, rien d'écrit ;
 *  2. le corps BRUT, jamais relu puis réécrit ;
 *  3. la signature (mode signature seulement : un `Authorization: Bearer` n'est pas accepté) et
 *     l'horodatage à ±5 min — refusés : 401, rien d'enregistré sinon un compteur d'échecs ;
 *  4. le traitement, dédoublonné par (compte, événement) ;
 *  5. 200, y compris pour un doublon ou un type inconnu : sinon Wave réessaie trois jours.
 * Aucun journal n'écrit le corps, les en-têtes ni la signature (D-127).
 */
http.route({
  pathPrefix: "/webhooks/wave/",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const pathId = new URL(request.url).pathname.slice("/webhooks/wave/".length);
    const account = await ctx.runQuery(internal.paymentAccounts.forWebhook, { webhookPathId: pathId });
    if (!account) return new Response(null, { status: 404 });
    const length = Number(request.headers.get("content-length") ?? "0");
    if (length > MAX_WEBHOOK_BODY) return new Response(null, { status: 413 });
    const body = await readLimited(request, MAX_WEBHOOK_BODY);
    if (body === null) return new Response(null, { status: 413 });
    // Chaque secret s'ouvre seul : un ANCIEN secret illisible (clé maîtresse retirée) ne doit pas
    // faire refuser les webhooks signés par le secret en cours.
    let current: string | null = null;
    try {
      if (account.webhookSecret) current = await openSecret(account.webhookSecret, { accountId: account.accountId, field: "webhookSecret" });
    } catch {
      logEvent("error", "payment.webhook_secret_unreadable", { operation: "payment.webhook" });
      return new Response(null, { status: 503 });
    }
    let previous: string | null = null;
    if (account.webhookSecretPrevious) {
      try {
        // L'ancien secret a été chiffré sous le champ « webhookSecret » : il y a été déplacé tel quel.
        previous = await openSecret(account.webhookSecretPrevious, { accountId: account.accountId, field: "webhookSecret" });
      } catch {
        logEvent("warn", "payment.webhook_previous_secret_unreadable", { operation: "payment.webhook" });
      }
    }
    if (current === null && previous === null) return new Response(null, { status: 401 });
    const check = await verifyWaveSignature({ header: request.headers.get("wave-signature"), body, secrets: [current ?? "", previous ?? ""], now: Date.now() });
    if (!check.ok) {
      if (check.reason !== "stale") await ctx.runMutation(internal.paymentAccounts.noteSignatureFailure, { accountId: account.accountId });
      logEvent("warn", "payment.webhook_rejected", { operation: "payment.webhook", code: check.reason });
      return new Response(null, { status: 401 });
    }
    const event = readWaveEvent(body);
    if (!event) return new Response(null, { status: 400 });
    await ctx.runMutation(internal.onlinePayments.processWebhookEvent, {
      accountId: account.accountId,
      eventId: event.eventId,
      eventType: event.type,
      kind: event.kind,
      session: event.session,
      bodyHash: await sha256Hex(body),
      // Seul le secret EN COURS prouve un compte : un événement de test signé de l'ancien, pendant
      // une rotation, ne réactive rien.
      signedByCurrent: check.secretIndex === 0,
    });
    return new Response(null, { status: 200 });
  }),
});

export default http;
