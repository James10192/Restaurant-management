/**
 * Les gestes du client à table, relayés par le serveur web — Joliba (D-046, D-061, D-068)
 *
 * Le laissez-passer vit dans un cookie `httpOnly`, limité au chemin `/r/<établissement>` : le
 * navigateur ne peut ni le lire ni l'envoyer à Convex lui-même. Les gestes du client passent
 * donc par un POST sur l'adresse de sa table (`/r/<établissement>/table`), seule adresse où le
 * cookie l'accompagne. Ce module lit le cookie, contrôle son échéance (D-057) et appelle
 * `convex/guestService.ts`, qui revérifie tout — la signature, le QR, la table, le mode.
 *
 * Module `.server.ts` : jamais embarqué dans le navigateur.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { guestPassExpiry } from "../../../convex/lib/guestPass";
import { logEvent } from "../../../convex/lib/log";
import { convexServerUrl, TABLE_COOKIE } from "./env.server";
import type { TableAction } from "./table-api";

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return rest.join("=");
  }
  return null;
}

const KEY = /^[A-Za-z0-9_-]{16,64}$/;
const ID = /^[A-Za-z0-9_-]{1,64}$/;

/** Le corps du geste, relu champ par champ : rien n'est transmis tel quel. */
function parseAction(body: unknown): TableAction | null {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b !== "object" || typeof b.guestKey !== "string" || !KEY.test(b.guestKey)) return null;
  const guestKey = b.guestKey;
  switch (b.action) {
    case "presence":
      return { action: "presence", guestKey };
    case "requestService":
      return typeof b.type === "string" && ID.test(b.type) ? { action: "requestService", guestKey, type: b.type } : null;
    case "submitCart":
      return typeof b.idempotencyKey === "string" && KEY.test(b.idempotencyKey) ? { action: "submitCart", guestKey, idempotencyKey: b.idempotencyKey } : null;
    case "saveCart": {
      if (!Array.isArray(b.lines) || b.lines.length > 30) return null;
      const lines = [];
      for (const raw of b.lines as unknown[]) {
        const l = raw as Record<string, unknown> | null;
        if (!l || typeof l.productId !== "string" || !ID.test(l.productId)) return null;
        if (l.variantId !== undefined && (typeof l.variantId !== "string" || !ID.test(l.variantId))) return null;
        if (!Array.isArray(l.optionIds) || l.optionIds.length > 40 || !l.optionIds.every((o) => typeof o === "string" && ID.test(o))) return null;
        if (typeof l.quantity !== "number" || !Number.isInteger(l.quantity)) return null;
        if (l.instructions !== undefined && (typeof l.instructions !== "string" || l.instructions.length > 500)) return null;
        lines.push({
          productId: l.productId,
          ...(typeof l.variantId === "string" ? { variantId: l.variantId } : {}),
          optionIds: l.optionIds as string[],
          quantity: l.quantity,
          ...(typeof l.instructions === "string" && l.instructions.trim() ? { instructions: l.instructions } : {}),
        });
      }
      return { action: "saveCart", guestKey, lines };
    }
    default:
      return null;
  }
}

export async function handleTableAction(request: Request, venueSlug: string): Promise<Response> {
  // Un geste vient de la page elle-même : JSON (donc pré-vol CORS depuis ailleurs) et même hôte.
  if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) return json({ error: "bad_request" }, 415);
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      if (new URL(origin).host !== (request.headers.get("x-forwarded-host") ?? request.headers.get("host"))) return json({ error: "forbidden" }, 403);
    } catch {
      return json({ error: "forbidden" }, 403);
    }
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }
  const action = parseAction(body);
  if (!action) return json({ error: "bad_request" }, 400);

  const pass = readCookie(request, TABLE_COOKIE);
  const expiresAt = pass ? guestPassExpiry(pass) : null;
  // Sans laissez-passer valable, le client doit rescanner : on le dit sans rien d'autre.
  if (!pass || expiresAt === null || expiresAt <= Date.now()) return json({ error: "no_pass" }, 401);

  const client = new ConvexHttpClient(convexServerUrl());
  const base = { pass, venueSlug, guestKey: action.guestKey };
  try {
    switch (action.action) {
      case "presence": {
        const result = await client.query(api.guestService.presence, base);
        return result ? json({ result }) : json({ error: "no_pass" }, 401);
      }
      case "saveCart":
        return json({ result: await client.mutation(api.guestService.saveCart, { ...base, lines: action.lines }) });
      case "submitCart":
        return json({ result: await client.mutation(api.guestService.submitCart, { ...base, idempotencyKey: action.idempotencyKey }) });
      case "requestService":
        return json({ result: await client.mutation(api.guestService.requestService, { ...base, type: action.type }) });
    }
  } catch {
    // Ni le laissez-passer ni la clé d'invité ne sont journalisés.
    logEvent("error", "guest.table_action_failed", { route: "/r/:slug/table", action: action.action });
    return json({ error: "unavailable" }, 502);
  }
}
