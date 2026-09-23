/**
 * Laissez-passer de table — Joliba
 *
 * Le scan d'un QR ÉCHANGE son jeton contre ce laissez-passer, signé (HMAC-SHA-256) avec un
 * secret qui ne quitte jamais Convex (`GUEST_PASS_SECRET`). Le serveur web le dépose en
 * cookie `httpOnly` et le renvoie tel quel à Convex à chaque rendu : il ne sait ni le
 * fabriquer ni le lire. Convex le vérifie, puis vérifie encore que le QR qui l'a émis est
 * TOUJOURS actif et de la même version — révoquer un QR coupe donc aussi les clients déjà
 * connectés par lui (D-023, ADR 0004).
 *
 * Le laissez-passer ne porte AUCUNE donnée personnelle : un établissement, une table, un QR
 * et une échéance.
 */

import type { Id } from "../_generated/dataModel";

export type GuestPassPayload = {
  venueId: Id<"venues">;
  tableId: Id<"restaurantTables">;
  qrCodeId: Id<"tableQrCodes">;
  qrVersion: number;
  expiresAt: number;
};

/** Un repas, largement. Au-delà, on rescanne : c'est un geste d'une seconde. */
export const GUEST_PASS_TTL_MS = 12 * 60 * 60 * 1000;
const PREFIX = "gp1";

function secret(): string {
  const value = process.env.GUEST_PASS_SECRET;
  // Refuser plutôt que signer avec un secret faible ou absent : un laissez-passer
  // falsifiable ouvrirait la table à n'importe qui.
  if (!value || value.length < 32) throw new Error("GUEST_PASS_SECRET est absent ou trop court (32 caractères minimum).");
  return value;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signGuestPass(payload: GuestPassPayload): Promise<string> {
  const body = toBase64Url(
    new TextEncoder().encode(
      JSON.stringify({ v: payload.venueId, t: payload.tableId, q: payload.qrCodeId, n: payload.qrVersion, e: payload.expiresAt }),
    ),
  );
  const signed = `${PREFIX}.${body}`;
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(signed)));
  return `${signed}.${toBase64Url(signature)}`;
}

/**
 * Vérifie la signature et l'échéance. `null` pour tout défaut, sans dire lequel : un
 * laissez-passer falsifié et un laissez-passer expiré se traitent de la même façon.
 */
export async function verifyGuestPass(pass: string, now: number): Promise<GuestPassPayload | null> {
  if (pass.length > 1024) return null;
  const parts = pass.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const signature = fromBase64Url(parts[2]!);
  const body = fromBase64Url(parts[1]!);
  if (!signature || !body) return null;
  // `verify` compare en temps constant : pas de fuite par la durée de la comparaison.
  const valid = await crypto.subtle.verify("HMAC", await hmacKey(), signature, new TextEncoder().encode(`${PREFIX}.${parts[1]}`));
  if (!valid) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(body)) as { v: string; t: string; q: string; n: number; e: number };
    if (typeof data.e !== "number" || data.e <= now) return null;
    return {
      venueId: data.v as Id<"venues">,
      tableId: data.t as Id<"restaurantTables">,
      qrCodeId: data.q as Id<"tableQrCodes">,
      qrVersion: data.n,
      expiresAt: data.e,
    };
  } catch {
    return null;
  }
}

/**
 * L'échéance écrite dans un laissez-passer, SANS vérifier la signature — pour le serveur web,
 * qui n'a pas le secret. Une requête Convex mise en cache ne se réévalue pas quand l'heure
 * passe : l'échéance doit aussi être contrôlée là où chaque requête HTTP est servie. La
 * signature, elle, reste vérifiée par Convex.
 */
export function guestPassExpiry(pass: string): number | null {
  const parts = pass.split(".");
  if (parts.length !== 3 || parts[0] !== PREFIX) return null;
  const body = fromBase64Url(parts[1]!);
  if (!body) return null;
  try {
    const data = JSON.parse(new TextDecoder().decode(body)) as { e?: unknown };
    return typeof data.e === "number" ? data.e : null;
  } catch {
    return null;
  }
}
