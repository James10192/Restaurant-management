/**
 * Appareils enrôlés — Joliba (D-060)
 *
 * Le jeton d'appareil (32 octets aléatoires) ne quitte l'appareil que pour prouver qu'il est
 * lui ; seul son SHA-256 est stocké, et c'est ce hachage qui sert de clé de recherche. Il ne
 * donne AUCUN droit métier à lui seul : il permet de voir la liste des personnes de
 * l'établissement et de tenter un PIN. Les gestes exigent ensuite un jeton d'opérateur.
 */

import type { Doc } from "../_generated/dataModel";
import { unauthenticated } from "./errors";
import { loadActiveVenue, type ReadCtx } from "./guards";
import { sha256Hex } from "./tokens";

export type DeviceContext = { device: Doc<"trustedDevices">; venue: Doc<"venues">; organization: Doc<"organizations"> };

/** L'appareil qui présente ce jeton, non révoqué, dans un établissement en service. */
export async function requireDevice(ctx: ReadCtx, deviceToken: string): Promise<DeviceContext> {
  if (typeof deviceToken !== "string" || deviceToken.length < 32 || deviceToken.length > 128) throw unauthenticated();
  const tokenHash = await sha256Hex(deviceToken);
  const device = await ctx.db
    .query("trustedDevices")
    .withIndex("by_token", (q) => q.eq("tokenHash", tokenHash))
    .unique();
  if (!device || device.revokedAt !== undefined) throw unauthenticated();
  const { venue, organization } = await loadActiveVenue(ctx, device.venueId).catch(() => {
    throw unauthenticated();
  });
  return { device, venue, organization };
}
