/**
 * La table d'un client — Joliba
 *
 * Tout geste du client part de son laissez-passer (D-046), revérifié à chaque appel contre le QR,
 * la table et l'établissement. Au-dessus, deux notions :
 *
 *  - la SESSION DE TABLE, que seul le personnel ouvre (D-045) : sans elle, le client lit la carte
 *    et peut appeler un serveur, rien de plus ;
 *  - la SESSION D'INVITÉ, une par téléphone : une clé aléatoire tirée par le navigateur, dont seul
 *    le SHA-256 est gardé. Elle sépare les paniers des convives d'une même table. Ce n'est pas
 *    une identité : la perdre, c'est seulement repartir d'un panier vide.
 */

import { rateLimiter } from "./rateLimits";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx, ReadCtx } from "./guards";
import { verifyGuestPass } from "./guestPass";
import { activeSessionOf } from "./service";
import { sha256Hex } from "./tokens";

export type GuestTable = {
  venue: Doc<"venues">;
  table: Doc<"restaurantTables">;
  code: Doc<"tableQrCodes">;
};

/** La table que désigne ce laissez-passer, ou `null` sans dire pourquoi. */
export async function resolveGuestTable(ctx: ReadCtx, pass: string, venueSlug: string): Promise<GuestTable | null> {
  const payload = await verifyGuestPass(pass, Date.now());
  if (!payload) return null;
  const code = await ctx.db.get(payload.qrCodeId);
  if (!code || code.status !== "active" || code.version !== payload.qrVersion || code.tableId !== payload.tableId) return null;
  const venue = await ctx.db.get(payload.venueId);
  // L'adresse ne choisit pas la carte : un laissez-passer d'un autre établissement est refusé.
  if (!venue || venue._id !== code.venueId || venue.slug !== venueSlug) return null;
  if (venue.status === "archived" || venue.status === "paused") return null;
  const table = await ctx.db.get(payload.tableId);
  if (!table || !table.isActive || table.status === "out_of_service") return null;
  return { venue, table, code };
}

export function isGuestKey(value: string): boolean {
  return /^[A-Za-z0-9_-]{22,64}$/.test(value);
}

/** La session de table ouverte, et l'invité de ce téléphone s'il s'y est déjà joint. */
export async function guestPresence(
  ctx: ReadCtx,
  table: Doc<"restaurantTables">,
  guestKey: string,
): Promise<{ session: Doc<"tableSessions"> | null; guest: Doc<"guestSessions"> | null }> {
  const session = await activeSessionOf(ctx, table._id);
  if (!session || !isGuestKey(guestKey)) return { session, guest: null };
  const hash = await sha256Hex(guestKey);
  const guests = await ctx.db
    .query("guestSessions")
    .withIndex("by_session", (q) => q.eq("tableSessionId", session._id))
    .collect();
  return { session, guest: guests.find((g) => g.deviceFingerprintHash === hash) ?? null };
}

/** Au plus : au-delà d'une grande tablée, c'est une photo du QR qui circule. */
export const MAX_GUESTS_PER_SESSION = 40;
const COLORS = ["teal", "amber", "rose", "sky", "lime", "violet", "orange", "cyan"];

/** Rejoint la session ouverte (ou retrouve sa place). `null` si la table n'est pas ouverte. */
export async function joinSession(
  ctx: MutationCtx,
  guestTable: GuestTable,
  guestKey: string,
): Promise<{ session: Doc<"tableSessions">; guest: Doc<"guestSessions"> } | { error: "table_not_open" | "full" | "bad_key" }> {
  if (!isGuestKey(guestKey)) return { error: "bad_key" };
  const { session, guest } = await guestPresence(ctx, guestTable.table, guestKey);
  if (!session) return { error: "table_not_open" };
  const now = Date.now();
  if (guest) {
    if (now - guest.lastSeenAt > 60_000) await ctx.db.patch(guest._id, { lastSeenAt: now, status: "active" });
    return { session, guest };
  }
  const count = (
    await ctx.db
      .query("guestSessions")
      .withIndex("by_session", (q) => q.eq("tableSessionId", session._id))
      .collect()
  ).length;
  if (count >= MAX_GUESTS_PER_SESSION) return { error: "full" };
  // Faux convives en série (photo du QR, script) : la table est « complète » pour eux.
  if (!(await rateLimiter.limit(ctx, "guestJoin", { key: session._id })).ok) return { error: "full" };
  const id = await ctx.db.insert("guestSessions", {
    venueId: guestTable.venue._id,
    tableSessionId: session._id,
    colorKey: COLORS[count % COLORS.length]!,
    deviceFingerprintHash: await sha256Hex(guestKey),
    joinedAt: now,
    lastSeenAt: now,
    status: "active",
  });
  return { session, guest: (await ctx.db.get(id))! };
}
