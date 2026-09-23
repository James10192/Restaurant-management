/**
 * Le client à table — Joliba (T2, D-061)
 *
 * Par défaut (`staff_only`), le client compose un PANIER À MONTRER : rien ne part, l'écran le dit
 * en toutes lettres, et le serveur l'importe d'un geste dans sa propre saisie. Pas d'état en
 * attente, pas de commande qui dort. En `guest_with_approval` seulement, le client peut envoyer :
 * la commande attend alors la validation d'un serveur, sous trois garde-fous (message permanent,
 * alerte à tout le personnel à 90 secondes, expiration à 10 minutes).
 *
 * Appeler un serveur marche même avant l'ouverture de la table : c'est souvent le premier geste.
 * Délai anti-répétition par table et par type, plafond par QR.
 *
 * Chaque fonction est gardée par le laissez-passer (D-046), revérifié à chaque appel.
 */

import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { guestPresence, joinSession, resolveGuestTable } from "./lib/guestTable";
import type { ReadCtx } from "./lib/guards";
import { APPROVAL_EXPIRE_MS, CART_TTL_MS, type LineProblem, type LineRequest } from "./lib/ordering";
import { rateLimiter } from "./lib/rateLimits";
import { settingsOf, touchSession, writeOrderEvent } from "./lib/service";
import { createOrder, priceRequest } from "./orders";

export const CART_MAX_LINES = 30;
/** Motif posé sur une commande que personne n'a validée à temps : le client la lit « expirée ». */
const EXPIRED_REASON = "Personne n'a pu la valider à temps. Appelez un serveur.";

const guestArgs = { pass: v.string(), venueSlug: v.string(), guestKey: v.string() };
const lineArg = v.object({
  productId: v.string(),
  variantId: v.optional(v.string()),
  optionIds: v.array(v.string()),
  quantity: v.number(),
  instructions: v.optional(v.string()),
  courseNumber: v.optional(v.number()),
});

const GUEST_STATUS: Partial<Record<Doc<"orders">["status"], string>> = {
  pending_acceptance: "Pas encore en cuisine — en attente du serveur",
  accepted: "Reçue, bientôt en préparation",
  in_preparation: "En préparation",
  partially_ready: "En partie prête",
  ready: "Prête",
  partially_served: "En partie servie",
  served: "Servie",
  rejected: "Refusée",
  cancelled: "Annulée",
};

async function activeCartOf(ctx: ReadCtx, guest: Doc<"guestSessions">): Promise<Doc<"carts"> | null> {
  const carts = await ctx.db
    .query("carts")
    .withIndex("by_guest", (q) => q.eq("guestSessionId", guest._id))
    .collect();
  const cart = carts.find((c) => c.status === "active") ?? null;
  return cart && Date.now() - cart.updatedAt <= CART_TTL_MS ? cart : null;
}

export function cartLineRequests(items: readonly Doc<"cartItems">[]): LineRequest[] {
  return items.map((i) => ({
    productId: i.productId,
    ...(i.variantId ? { variantId: i.variantId } : {}),
    optionIds: i.modifierSelections,
    quantity: i.quantity,
    ...(i.instructions ? { instructions: i.instructions } : {}),
    courseNumber: i.courseNumber ?? 1,
  }));
}

async function cartItemsOf(ctx: ReadCtx, cartId: Id<"carts">) {
  return ctx.db
    .query("cartItems")
    .withIndex("by_cart", (q) => q.eq("cartId", cartId))
    .collect();
}

/**
 * Ce que voit le client à sa table : la table est-elle ouverte, son panier, ses commandes, et ce
 * qu'il peut faire selon le mode de l'établissement.
 */
export const presence = query({
  args: guestArgs,
  handler: async (ctx, args) => {
    // garde : laissez-passer revérifié contre le QR, la table et l'établissement
    const resolved = await resolveGuestTable(ctx, args.pass, args.venueSlug);
    if (!resolved) return null;
    const settings = await settingsOf(ctx, resolved.venue._id);
    const { session, guest } = await guestPresence(ctx, resolved.table, args.guestKey);
    const cart = guest ? await activeCartOf(ctx, guest) : null;
    const items = cart ? await cartItemsOf(ctx, cart._id) : [];
    const orders: { reference: string; status: string; label: string; rejectedReason: string | null; expired: boolean; items: { name: string; quantity: number }[] }[] = [];
    if (guest && session) {
      const mine = await ctx.db
        .query("carts")
        .withIndex("by_guest", (q) => q.eq("guestSessionId", guest._id))
        .collect();
      const orderIds = new Set(mine.map((c) => c.orderId).filter((id): id is Id<"orders"> => id !== undefined));
      const placed = (
        await ctx.db
          .query("orders")
          .withIndex("by_session", (q) => q.eq("tableSessionId", session._id))
          .collect()
      ).filter((o) => o.placedByGuestSessionId === guest._id || orderIds.has(o._id));
      for (const order of placed.sort((a, b) => a.submittedAt - b.submittedAt)) {
        const lines = await ctx.db
          .query("orderItems")
          .withIndex("by_order", (q) => q.eq("orderId", order._id))
          .collect();
        orders.push({
          reference: order.reference,
          status: order.status,
          label: GUEST_STATUS[order.status] ?? "Enregistrée",
          rejectedReason: order.rejectedReason ?? null,
          expired: order.status === "rejected" && order.rejectedReason === EXPIRED_REASON,
          items: lines.filter((l) => l.status !== "cancelled").map((l) => ({ name: l.nameSnapshot, quantity: l.quantity })),
        });
      }
    }
    return {
      tableOpen: session !== null,
      joined: guest !== null,
      mode: settings.service.orderingMode,
      /** `staff_only` : panier à montrer. `guest_with_approval` : le client peut envoyer. */
      canSend: settings.service.orderingMode === "guest_with_approval",
      requestTypes: settings.serviceRequestTypes.filter((t) => t.enabled).map((t) => ({ key: t.key, label: t.label })),
      cart: cart
        ? {
            updatedAt: cart.updatedAt,
            expiresAt: cart.updatedAt + CART_TTL_MS,
            lines: items.map((i) => ({
              productId: i.productId,
              variantId: i.variantId ?? null,
              optionIds: i.modifierSelections,
              quantity: i.quantity,
              instructions: i.instructions ?? null,
              courseNumber: i.courseNumber ?? 1,
              estimatedUnitPrice: i.estimatedUnitPrice,
            })),
            estimatedTotal: items.reduce((s, i) => s + i.estimatedUnitPrice * i.quantity, 0),
          }
        : null,
      orders,
    };
  },
});

/**
 * Enregistre le panier de ce téléphone (il REMPLACE le précédent). Les prix sont recalculés
 * ici pour l'affichage ; ils le seront de nouveau à l'import ou à l'envoi (R14).
 */
export const saveCart = mutation({
  args: { ...guestArgs, lines: v.array(lineArg) },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { ok: true; problems: LineProblem[] }
    | { ok: false; reason: "invalid_pass" | "table_not_open" | "full" | "bad_key" | "too_many_lines" }
    | { ok: false; reason: "rate_limited"; retryAfter: number }
  > => {
    // garde : laissez-passer revérifié ; la table doit avoir été ouverte par le personnel
    const resolved = await resolveGuestTable(ctx, args.pass, args.venueSlug);
    if (!resolved) return { ok: false, reason: "invalid_pass" };
    if (args.lines.length > CART_MAX_LINES) return { ok: false, reason: "too_many_lines" };
    const limit = await rateLimiter.limit(ctx, "guestCart", { key: resolved.code._id });
    if (!limit.ok) return { ok: false, reason: "rate_limited", retryAfter: limit.retryAfter };
    const joined = await joinSession(ctx, resolved, args.guestKey);
    if ("error" in joined) return { ok: false, reason: joined.error };
    const now = Date.now();
    const requests: LineRequest[] = args.lines.map((l) => ({ ...l, courseNumber: l.courseNumber ?? 1 }));
    const priced = requests.length > 0 ? await priceRequest(ctx, resolved.venue, requests, now) : { lines: [], problems: [] };
    let cart = await activeCartOf(ctx, joined.guest);
    if (!cart) {
      const id = await ctx.db.insert("carts", {
        venueId: resolved.venue._id,
        tableSessionId: joined.session._id,
        guestSessionId: joined.guest._id,
        status: "active",
        updatedAt: now,
      });
      cart = (await ctx.db.get(id))!;
    }
    for (const item of await cartItemsOf(ctx, cart._id)) await ctx.db.delete(item._id);
    // On ne garde que les lignes valables ; les autres sont dites au client, ligne par ligne.
    // Les lignes chiffrées suivent l'ordre des demandes, moins celles en défaut.
    const failed = new Set(priced.problems.map((p) => p.index));
    const accepted = requests.filter((_, i) => !failed.has(i));
    for (const [i, line] of priced.lines.entries()) {
      await ctx.db.insert("cartItems", {
        venueId: resolved.venue._id,
        cartId: cart._id,
        productId: line.productId as Id<"products">,
        ...(line.variantId ? { variantId: line.variantId as Id<"productVariants"> } : {}),
        modifierSelections: accepted[i]!.optionIds.map((o) => o as Id<"modifierOptions">),
        quantity: line.quantity,
        ...(line.instructions ? { instructions: line.instructions } : {}),
        addedByGuestSessionId: joined.guest._id,
        courseNumber: line.courseNumber,
        estimatedUnitPrice: line.unitPrice,
      });
    }
    await ctx.db.patch(cart._id, { updatedAt: now, tableSessionId: joined.session._id });
    return { ok: true, problems: priced.problems };
  },
});

/**
 * Envoyer son panier pour validation — seulement en `guest_with_approval`. Aucun bon n'est créé
 * avant qu'un serveur accepte (R8) ; sans réponse, la commande expire à 10 minutes.
 */
export const submitCart = mutation({
  args: { ...guestArgs, idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    // garde : laissez-passer revérifié, mode de l'établissement vérifié côté serveur
    const resolved = await resolveGuestTable(ctx, args.pass, args.venueSlug);
    if (!resolved) return { ok: false as const, reason: "invalid_pass" as const };
    const settings = await settingsOf(ctx, resolved.venue._id);
    if (settings.service.orderingMode !== "guest_with_approval") return { ok: false as const, reason: "not_allowed" as const };
    if (!/^[A-Za-z0-9_-]{16,64}$/.test(args.idempotencyKey)) return { ok: false as const, reason: "invalid_key" as const };
    const replay = await ctx.db
      .query("orders")
      .withIndex("by_venue_idempotency", (q) => q.eq("venueId", resolved.venue._id).eq("idempotencyKey", args.idempotencyKey))
      .unique();
    if (replay) return { ok: true as const, reference: replay.reference };
    const limit = await rateLimiter.limit(ctx, "guestOrder", { key: resolved.code._id });
    if (!limit.ok) return { ok: false as const, reason: "rate_limited" as const, retryAfter: limit.retryAfter };
    const joined = await joinSession(ctx, resolved, args.guestKey);
    if ("error" in joined) return { ok: false as const, reason: joined.error };
    const cart = await activeCartOf(ctx, joined.guest);
    if (!cart) return { ok: false as const, reason: "empty" as const };
    const items = await cartItemsOf(ctx, cart._id);
    if (items.length === 0) return { ok: false as const, reason: "empty" as const };
    const now = Date.now();
    const priced = await priceRequest(ctx, resolved.venue, cartLineRequests(items), now);
    if (priced.problems.length > 0) return { ok: false as const, reason: "problems" as const, problems: priced.problems };
    const { orderId, reference } = await createOrder(ctx, {
      venue: resolved.venue,
      session: joined.session,
      lines: priced.lines,
      heldCourses: [],
      idempotencyKey: args.idempotencyKey,
      channel: "guest",
      placedByGuestSessionId: joined.guest._id,
      actor: { type: "guest" },
      accepted: false,
      now,
    });
    await ctx.db.patch(cart._id, { status: "submitted", orderId, updatedAt: now });
    await ctx.scheduler.runAfter(APPROVAL_EXPIRE_MS, internal.guestService.expirePending, { orderId });
    return { ok: true as const, reference };
  },
});

/** Une commande du client que personne n'a validée en 10 minutes est refusée, et il le lit. */
export const expirePending = internalMutation({
  args: { orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const order = await ctx.db.get(args.orderId);
    if (!order || order.status !== "pending_acceptance") return;
    const reason = EXPIRED_REASON;
    await ctx.db.patch(order._id, { status: "rejected", rejectedReason: reason });
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    for (const item of items) await ctx.db.patch(item._id, { status: "cancelled", cancelledReason: reason });
    await writeOrderEvent(ctx, order, "expired", { type: "system" });
  },
});

/** Appeler un serveur, demander l'addition… Même avant l'ouverture de la table. */
export const requestService = mutation({
  args: { ...guestArgs, type: v.string() },
  handler: async (ctx, args) => {
    // garde : laissez-passer revérifié ; délai par table et par type, plafond par QR
    const resolved = await resolveGuestTable(ctx, args.pass, args.venueSlug);
    if (!resolved) return { ok: false as const, reason: "invalid_pass" as const };
    const settings = await settingsOf(ctx, resolved.venue._id);
    const type = settings.serviceRequestTypes.find((t) => t.key === args.type && t.enabled);
    if (!type) return { ok: false as const, reason: "unknown_type" as const };
    const now = Date.now();
    const recent = await ctx.db
      .query("serviceRequests")
      .withIndex("by_table_created", (q) => q.eq("tableId", resolved.table._id).gte("createdAt", now - type.cooldownSeconds * 1000))
      .collect();
    const pending = recent.find((r) => r.type === type.key && (r.status === "open" || r.status === "acknowledged"));
    if (pending) return { ok: true as const, already: true, retryAfter: pending.createdAt + type.cooldownSeconds * 1000 - now };
    const limit = await rateLimiter.limit(ctx, "guestRequest", { key: resolved.code._id });
    if (!limit.ok) return { ok: false as const, reason: "rate_limited" as const, retryAfter: limit.retryAfter };
    const { session, guest } = await guestPresence(ctx, resolved.table, args.guestKey);
    await ctx.db.insert("serviceRequests", {
      venueId: resolved.venue._id,
      tableId: resolved.table._id,
      ...(session ? { tableSessionId: session._id } : {}),
      ...(guest ? { guestSessionId: guest._id } : {}),
      type: type.key,
      status: "open",
      createdAt: now,
    });
    if (session) await touchSession(ctx, session._id, now);
    return { ok: true as const, already: false, retryAfter: type.cooldownSeconds * 1000 };
  },
});
