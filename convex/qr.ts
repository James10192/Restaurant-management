/**
 * QR de table — Joliba
 *
 * Le QR porte un jeton OPAQUE (128 bits d'aléa, D-008). Ce jeton n'est jamais une session :
 * le scan l'échange contre un laissez-passer signé, déposé en cookie, puis redirige vers une
 * adresse sans secret (D-023, `guest.ts`).
 *
 * Le jeton est stocké EN CLAIR, et c'est un choix (D-046) : un restaurant réimprime ses QR —
 * une table cassée, une planche perdue. Ne garder que son empreinte obligerait à révoquer à
 * chaque réimpression, donc à rendre inutilisables les QR encore collés sur les autres
 * tables. Ce que le jeton ouvre est borné : la carte de CETTE table. Une photo qui circule se
 * neutralise en révoquant (`rotate`) : l'ancien jeton ne vaut plus rien, et les laissez-passer
 * déjà émis non plus, puisqu'ils portent la version du QR.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { getInVenue } from "./lib/catalogAccess";
import { invalid } from "./lib/errors";
import { requirePermission, type MutationCtx } from "./lib/guards";
import { generateToken } from "./lib/tokens";

/** 16 octets = 128 bits, 22 caractères : un QR plus petit se lit de plus loin. */
const QR_TOKEN_BYTES = 16;

export async function createQrCode(
  ctx: MutationCtx,
  venueId: Id<"venues">,
  tableId: Id<"restaurantTables">,
  userId: Id<"users">,
  version: number,
): Promise<Id<"tableQrCodes">> {
  return ctx.db.insert("tableQrCodes", {
    venueId,
    tableId,
    token: generateToken(QR_TOKEN_BYTES),
    version,
    status: "active",
    createdByUserId: userId,
    scanCount: 0,
  });
}

/** Révoque tous les QR actifs d'une table ; renvoie la plus haute version rencontrée. */
export async function revokeQrCodes(ctx: MutationCtx, tableId: Id<"restaurantTables">): Promise<number> {
  const codes = await ctx.db
    .query("tableQrCodes")
    .withIndex("by_table", (q) => q.eq("tableId", tableId))
    .collect();
  const now = Date.now();
  for (const code of codes) {
    if (code.status === "active") await ctx.db.patch(code._id, { status: "revoked", revokedAt: now });
  }
  return codes.reduce((max, c) => Math.max(max, c.version), 0);
}

/**
 * La planche à imprimer : un QR par table active, avec son numéro. C'est le seul endroit où
 * le jeton sort de la base — d'où la permission dédiée.
 */
export const sheet = query({
  args: { venueId: v.id("venues"), serviceAreaId: v.optional(v.id("serviceAreas")) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "table.qr.manage", { venueId: args.venueId });
    const areas = (
      await ctx.db
        .query("serviceAreas")
        .withIndex("by_venue_sort", (q) => q.eq("venueId", actor.venue._id))
        .collect()
    ).filter((a) => a.isActive && (args.serviceAreaId === undefined || a._id === args.serviceAreaId));
    if (args.serviceAreaId !== undefined && areas.length === 0) throw invalid("Cette zone est introuvable.");
    const result = [];
    for (const area of areas) {
      const tables = (
        await ctx.db
          .query("restaurantTables")
          .withIndex("by_area", (q) => q.eq("serviceAreaId", area._id))
          .collect()
      ).filter((t) => t.isActive);
      const cards = [];
      let missing = 0;
      for (const table of tables) {
        const code = (
          await ctx.db
            .query("tableQrCodes")
            .withIndex("by_table", (q) => q.eq("tableId", table._id))
            .collect()
        ).find((c) => c.status === "active");
        if (!code) {
          missing++;
          continue;
        }
        cards.push({ tableId: table._id, number: table.number, label: table.label ?? null, token: code.token, version: code.version });
      }
      cards.sort((a, b) => a.number.localeCompare(b.number, "fr", { numeric: true }));
      result.push({ _id: area._id, name: area.name, cards, missing });
    }
    return { venueName: actor.venue.name, venueSlug: actor.venue.slug, areas: result };
  },
});

/** Donne un QR aux tables qui n'en ont pas (créées par quelqu'un sans le droit sur les QR). */
export const ensure = mutation({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "table.qr.manage", { venueId: args.venueId });
    const tables = (
      await ctx.db
        .query("restaurantTables")
        .withIndex("by_venue_status", (q) => q.eq("venueId", actor.venue._id))
        .collect()
    ).filter((t) => t.isActive);
    let created = 0;
    for (const table of tables) {
      const codes = await ctx.db
        .query("tableQrCodes")
        .withIndex("by_table", (q) => q.eq("tableId", table._id))
        .collect();
      if (codes.some((c) => c.status === "active")) continue;
      await createQrCode(ctx, actor.venue._id, table._id, actor.user._id, codes.reduce((m, c) => Math.max(m, c.version), 0) + 1);
      created++;
    }
    return { created };
  },
});

/**
 * Révoque le QR d'une table et en crée un nouveau. Geste de sécurité : les QR imprimés pour
 * cette table cessent de fonctionner, et les clients déjà connectés par l'ancien aussi.
 */
export const rotate = mutation({
  args: { venueId: v.id("venues"), tableId: v.id("restaurantTables") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "table.qr.manage", { venueId: args.venueId });
    const table = await getInVenue(ctx, args.tableId, actor.venue._id, "Cette table");
    if (!table.isActive) throw invalid("Cette table a été retirée.");
    const previous = await revokeQrCodes(ctx, table._id);
    const qrId = await createQrCode(ctx, actor.venue._id, table._id, actor.user._id, previous + 1);
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      action: "table.qr.rotate",
      resourceType: "tableQrCode",
      resourceId: qrId,
      after: { table: table.number, version: previous + 1 },
    });
    return { version: previous + 1 };
  },
});
