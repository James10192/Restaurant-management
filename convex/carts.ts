/**
 * Paniers à montrer, côté serveur — Joliba (D-061)
 *
 * Le client a composé ; le serveur, à la table, voit « Panier préparé : 3 articles » et l'importe
 * d'un geste dans sa propre saisie. La commande est alors CELLE DU SERVEUR (canal `staff`),
 * acceptée d'office : pas de notification, pas d'attente, pas de commande qui dort.
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { getInVenue } from "./lib/catalogAccess";
import { conflict, invalid } from "./lib/errors";
import { CART_TTL_MS, indexPublishedProducts, type LineProblem } from "./lib/ordering";
import { isOpenSession, loadOrderingMenus } from "./lib/service";
import { requireServiceActor, requireServiceMutation } from "./lib/serviceActor";
import { cartLineRequests } from "./guestService";
import { createOrder, priceRequest } from "./orders";

/** Les paniers préparés à cette table, avec ce qu'ils contiennent. */
export const forSession = query({
  args: { venueId: v.id("venues"), sessionId: v.id("tableSessions") },
  handler: async (ctx, args) => {
    const actor = await requireServiceActor(ctx, "order.create", { venueId: args.venueId });
    const session = await getInVenue(ctx, args.sessionId, actor.venue._id, "Cette table");
    const now = Date.now();
    const carts = (
      await ctx.db
        .query("carts")
        .withIndex("by_session", (q) => q.eq("tableSessionId", session._id))
        .collect()
    ).filter((c) => c.status === "active" && now - c.updatedAt <= CART_TTL_MS);
    const published = indexPublishedProducts(await loadOrderingMenus(ctx, actor.venue._id));
    const result = [];
    for (const cart of carts.sort((a, b) => a.updatedAt - b.updatedAt)) {
      const items = await ctx.db
        .query("cartItems")
        .withIndex("by_cart", (q) => q.eq("cartId", cart._id))
        .collect();
      if (items.length === 0) continue;
      const guest = cart.guestSessionId ? await ctx.db.get(cart.guestSessionId) : null;
      result.push({
        _id: cart._id,
        colorKey: guest?.colorKey ?? null,
        updatedAt: cart.updatedAt,
        items: items.map((i) => {
          const product = published.get(i.productId)?.product;
          const variant = product?.variants.find((x) => x.id === i.variantId);
          return {
            name: product?.name ?? "Plat retiré de la carte",
            variantName: variant?.name ?? null,
            quantity: i.quantity,
            instructions: i.instructions ?? null,
            estimatedUnitPrice: i.estimatedUnitPrice,
          };
        }),
        estimatedTotal: items.reduce((s, i) => s + i.estimatedUnitPrice * i.quantity, 0),
      });
    }
    return result;
  },
});

/** Importer un panier : il devient une commande du serveur, chiffrée de nouveau (R14). */
export const importCart = mutation({
  args: { venueId: v.id("venues"), cartId: v.id("carts"), idempotencyKey: v.string(), heldCourses: v.optional(v.array(v.number())) },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: true; orderId: Id<"orders">; reference: string } | { ok: false; problems: LineProblem[] }> => {
    const actor = await requireServiceMutation(ctx, "order.create", { venueId: args.venueId });
    const cart = await getInVenue(ctx, args.cartId, actor.venue._id, "Ce panier");
    if (cart.status === "submitted" && cart.orderId) {
      const order = (await ctx.db.get(cart.orderId))!;
      return { ok: true, orderId: order._id, reference: order.reference }; // rejoué
    }
    if (cart.status !== "active" || Date.now() - cart.updatedAt > CART_TTL_MS) throw conflict("Ce panier n'est plus d'actualité.");
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(args.idempotencyKey)) throw invalid("Clé d'envoi invalide.");
    const session = (await ctx.db.get(cart.tableSessionId))!;
    if (!isOpenSession(session)) throw conflict("Cette table est clôturée.");
    const items = await ctx.db
      .query("cartItems")
      .withIndex("by_cart", (q) => q.eq("cartId", cart._id))
      .collect();
    const now = Date.now();
    const priced = await priceRequest(ctx, actor.venue, cartLineRequests(items), now);
    if (priced.problems.length > 0) return { ok: false, problems: priced.problems };
    const heldCourses = [...new Set(args.heldCourses ?? [])];
    if (heldCourses.some((c) => !Number.isInteger(c) || c < 2 || c > 4)) throw invalid("Seuls les services 2 à 4 peuvent attendre.");
    const created = await createOrder(ctx, {
      venue: actor.venue,
      session,
      lines: priced.lines,
      heldCourses,
      idempotencyKey: args.idempotencyKey,
      channel: "staff",
      ...(actor.member ? { placedByMemberId: actor.member._id } : {}),
      actor: actor.event,
      accepted: true,
      now,
    });
    await ctx.db.patch(cart._id, { status: "submitted", orderId: created.orderId, updatedAt: now });
    return { ok: true, ...created };
  },
});

/** Ignorer un panier : le client le voit disparaître, rien n'est commandé. */
export const dismissCart = mutation({
  args: { venueId: v.id("venues"), cartId: v.id("carts") },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "order.create", { venueId: args.venueId });
    const cart = await getInVenue(ctx, args.cartId, actor.venue._id, "Ce panier");
    if (cart.status === "active") await ctx.db.patch(cart._id, { status: "dismissed", updatedAt: Date.now() });
  },
});
