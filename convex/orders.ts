/**
 * Commandes — Joliba
 *
 * Une commande est un envoi d'articles décidé à un instant donné (DATA_MODEL.md §7). À l'envoi :
 *   1. les prix sont RECALCULÉS depuis la carte publiée et la disponibilité en direct (R14) ;
 *   2. chaque ligne fige son nom, ses options, son prix, sa taxe et son poste (R6) ;
 *   3. la commande se découpe en un bon par poste et par service (R11) ; un service « à suivre »
 *      naît `held` et n'apparaît en cuisine qu'au « fire » ;
 *   4. une clé d'idempotence empêche la double commande d'un double appui ou d'une file rejouée (R7).
 *
 * Une commande du PERSONNEL est acceptée d'office, quel que soit le mode de service : c'est lui
 * qui l'a saisie. Seule une commande du CLIENT peut attendre une validation (`order.accept`).
 * Aucun bon n'existe avant l'acceptation (R8).
 */

import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { writeAudit } from "./lib/audit";
import { getInVenue } from "./lib/catalogAccess";
import { conflict, forbidden, invalid } from "./lib/errors";
import { requirePermission, type MutationCtx, type VenueActor } from "./lib/guards";
import { loadLiveAvailability } from "./lib/guestMenu";
import {
  ORDER_LIMITS,
  indexPublishedProducts,
  lineTax,
  orderReference,
  orderTotals,
  priceLine,
  serviceDayKey,
  stationCode,
  type LineProblem,
  type LineRequest,
  type PricedLine,
  type TicketStatus,
} from "./lib/ordering";
import {
  advanceTicket,
  isOpenSession,
  loadOrderingMenus,
  nextCounter,
  recountTicket,
  refreshOrder,
  settingsOf,
  ticketsOf,
  touchSession,
  writeOrderEvent,
  type EventActor,
} from "./lib/service";
import { ensureDefaultStation, stationsOf } from "./stations";

const lineArg = v.object({
  productId: v.string(),
  variantId: v.optional(v.string()),
  optionIds: v.array(v.string()),
  quantity: v.number(),
  instructions: v.optional(v.string()),
  courseNumber: v.number(),
});

const REASON_MIN = 3;

function cleanReason(reason: string | undefined, required: boolean): string | undefined {
  const text = reason?.trim();
  if (required && (!text || text.length < REASON_MIN)) throw invalid("Indiquez le motif (quelques mots).");
  if (text && text.length > 200) throw invalid("Le motif tient en 200 caractères.");
  return text || undefined;
}

function assertIdempotencyKey(key: string) {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(key)) throw invalid("Clé d'envoi invalide.");
}

/**
 * La carte à commander : ce qui est EN LIGNE, avec les faits de disponibilité. L'écran applique
 * la disponibilité avec la même règle que la mutation qui refusera un plat épuisé.
 */
export const menu = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "order.create", { venueId: args.venueId });
    return {
      currency: actor.venue.currency,
      timezone: actor.venue.timezone,
      menus: await loadOrderingMenus(ctx, actor.venue._id),
      live: await loadLiveAvailability(ctx, actor.venue._id),
    };
  },
});

type Priced = { lines: PricedLine[]; problems: LineProblem[] };

async function priceRequest(ctx: MutationCtx, venue: Doc<"venues">, lines: LineRequest[], now: number): Promise<Priced> {
  if (lines.length === 0) throw invalid("La commande est vide.");
  if (lines.length > ORDER_LIMITS.linesPerOrder) throw invalid(`${ORDER_LIMITS.linesPerOrder} lignes au plus par envoi.`);
  const published = indexPublishedProducts(await loadOrderingMenus(ctx, venue._id));
  const live = await loadLiveAvailability(ctx, venue._id);
  const priced: Priced = { lines: [], problems: [] };
  for (const [i, request] of lines.entries()) {
    const result = priceLine(request, i, published, live, now, venue.timezone);
    if ("problem" in result) priced.problems.push(result.problem);
    else priced.lines.push(result.line);
  }
  return priced;
}

/**
 * Crée la commande, ses lignes figées et — si elle est acceptée — ses bons. Partagé par l'envoi
 * du personnel et par celui du client (`guest.ts`), qui diffère seulement par son état initial.
 */
export async function createOrder(
  ctx: MutationCtx,
  params: {
    venue: Doc<"venues">;
    session: Doc<"tableSessions">;
    lines: PricedLine[];
    heldCourses: readonly number[];
    notes?: string;
    idempotencyKey: string;
    channel: "staff" | "guest";
    placedByUserId?: Id<"users">;
    placedByGuestSessionId?: Id<"guestSessions">;
    accepted: boolean;
    now: number;
  },
): Promise<{ orderId: Id<"orders">; reference: string }> {
  const { venue, session, now } = params;
  const settings = await settingsOf(ctx, venue._id);
  const rates = settings.tax.rates;
  const lines = [];
  for (const line of params.lines) {
    const product = await ctx.db.get(line.productId as Id<"products">);
    const codes = new Set(product?.taxCodes ?? []);
    lines.push({ ...line, tax: lineTax(line.lineTotal, rates.filter((r) => codes.has(r.code)), settings.tax.pricesIncludeTax), stationId: product?.prepStationId });
  }
  const reference = orderReference(await nextCounter(ctx, venue._id, `order:${serviceDayKey(now, venue.timezone)}`));
  const orderId = await ctx.db.insert("orders", {
    venueId: venue._id,
    tableSessionId: session._id,
    reference,
    status: params.accepted ? "accepted" : "pending_acceptance",
    channel: params.channel,
    ...(params.placedByUserId ? { placedByUserId: params.placedByUserId } : {}),
    ...(params.placedByGuestSessionId ? { placedByGuestSessionId: params.placedByGuestSessionId } : {}),
    ...(params.accepted && params.placedByUserId ? { acceptedByUserId: params.placedByUserId, acceptedAt: now } : {}),
    submittedAt: now,
    totals: orderTotals(lines, settings.tax.pricesIncludeTax),
    currency: venue.currency,
    idempotencyKey: params.idempotencyKey,
    ...(params.notes ? { notes: params.notes } : {}),
  });
  const itemIds: Id<"orderItems">[] = [];
  for (const line of lines) {
    itemIds.push(
      await ctx.db.insert("orderItems", {
        venueId: venue._id,
        orderId,
        tableSessionId: session._id,
        productId: line.productId as Id<"products">,
        ...(line.variantId ? { variantId: line.variantId as Id<"productVariants"> } : {}),
        nameSnapshot: line.nameSnapshot,
        ...(line.variantNameSnapshot ? { variantNameSnapshot: line.variantNameSnapshot } : {}),
        modifiers: line.modifiers,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        lineTotal: line.lineTotal,
        taxSnapshot: line.tax,
        ...(line.instructions ? { instructions: line.instructions } : {}),
        courseNumber: line.courseNumber,
        status: "ordered",
        assignedGuestSessionIds: params.placedByGuestSessionId ? [params.placedByGuestSessionId] : [],
      }),
    );
  }
  const actor: EventActor = params.channel === "staff" && params.placedByUserId ? { type: "staff", userId: params.placedByUserId } : { type: "guest" };
  await writeOrderEvent(ctx, { _id: orderId, venueId: venue._id }, "submitted", actor, { lines: lines.length });
  if (params.accepted) {
    await writeOrderEvent(ctx, { _id: orderId, venueId: venue._id }, "accepted", actor);
    await createTickets(ctx, venue, session, orderId, reference, params.heldCourses, now);
  }
  // Première opération financière : la devise de l'établissement se fige (R20).
  if (venue.currencyLockedAt === undefined) await ctx.db.patch(venue._id, { currencyLockedAt: now });
  const sessionPatch: Partial<Doc<"tableSessions">> = { lastActivityAt: now };
  if (session.status === "open" || session.status === "billing") sessionPatch.status = "ordering";
  if (params.placedByUserId && session.assignedWaiterUserId === undefined) sessionPatch.assignedWaiterUserId = params.placedByUserId;
  await ctx.db.patch(session._id, sessionPatch);
  return { orderId, reference };
}

/** Découpe une commande acceptée en bons : un par poste et par service. */
export async function createTickets(
  ctx: MutationCtx,
  venue: Doc<"venues">,
  session: Doc<"tableSessions">,
  orderId: Id<"orders">,
  reference: string,
  heldCourses: readonly number[],
  now: number,
): Promise<void> {
  const table = await ctx.db.get(session.tableId);
  const items = await ctx.db
    .query("orderItems")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .collect();
  const stations = (await stationsOf(ctx, venue._id)).filter((s) => s.isActive);
  const fallback = stations[0] ?? (await ensureDefaultStation(ctx, venue._id));
  const byKey = new Map<string, { station: Doc<"prepStations">; course: number; items: Doc<"orderItems">[] }>();
  for (const item of items) {
    if (item.status === "cancelled") continue;
    const product = await ctx.db.get(item.productId);
    const station = stations.find((s) => s._id === product?.prepStationId) ?? fallback;
    // Figé sur la ligne : changer plus tard le poste du produit ne rejoue pas le passé.
    await ctx.db.patch(item._id, { prepStationId: station._id });
    const key = `${station._id}:${item.courseNumber}`;
    const bucket = byKey.get(key) ?? { station, course: item.courseNumber, items: [] };
    bucket.items.push(item);
    byKey.set(key, bucket);
  }
  const multiCourse = new Set([...byKey.values()].map((b) => b.course)).size > 1;
  for (const { station, course, items: lines } of byKey.values()) {
    const held = heldCourses.includes(course);
    const allergies = new Set<string>();
    const products = new Map<Id<"products">, Doc<"products"> | null>();
    for (const line of lines) {
      if (!products.has(line.productId)) products.set(line.productId, await ctx.db.get(line.productId));
      for (const a of products.get(line.productId)?.allergens ?? []) allergies.add(a);
    }
    const ticketId = await ctx.db.insert("kitchenTickets", {
      venueId: venue._id,
      orderId,
      prepStationId: station._id,
      tableSessionId: session._id,
      reference: `${reference}-${stationCode(station.name)}${multiCourse ? `-${course}` : ""}`,
      tableNumber: table?.number ?? "?",
      status: held ? "held" : "queued",
      courseNumber: course,
      priority: 0,
      ...(held ? {} : { queuedAt: now }),
      allergyFlags: [...allergies],
      itemCount: lines.reduce((s, l) => s + l.quantity, 0),
    });
    for (const line of lines) {
      const lineAllergens = products.get(line.productId)?.allergens ?? [];
      await ctx.db.insert("kitchenTicketItems", {
        venueId: venue._id,
        kitchenTicketId: ticketId,
        orderItemId: line._id,
        nameSnapshot: line.nameSnapshot,
        ...(line.variantNameSnapshot ? { variantNameSnapshot: line.variantNameSnapshot } : {}),
        modifiersSnapshot: line.modifiers.map((m) => m.optionName),
        quantity: line.quantity,
        ...(line.instructions ? { instructions: line.instructions } : {}),
        status: "pending",
        ...(lineAllergens.length > 0 ? { allergyNote: lineAllergens.join(", ") } : {}),
      });
    }
  }
}

/**
 * Envoyer une commande saisie par le personnel. Renvoie les lignes refusées plutôt que de
 * lever : l'écran dit « Poulet braisé : épuisé » et garde le reste du panier.
 */
export const submit = mutation({
  args: {
    venueId: v.id("venues"),
    sessionId: v.id("tableSessions"),
    lines: v.array(lineArg),
    heldCourses: v.array(v.number()),
    notes: v.optional(v.string()),
    idempotencyKey: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ ok: true; orderId: Id<"orders">; reference: string; replayed: boolean } | { ok: false; problems: LineProblem[] }> => {
    const actor = await requirePermission(ctx, "order.create", { venueId: args.venueId });
    assertIdempotencyKey(args.idempotencyKey);
    // Rejouée (double appui, file hors ligne) : on renvoie la commande déjà créée.
    const previous = await ctx.db
      .query("orders")
      .withIndex("by_venue_idempotency", (q) => q.eq("venueId", actor.venue._id).eq("idempotencyKey", args.idempotencyKey))
      .unique();
    if (previous) {
      return { ok: true, orderId: previous._id, reference: previous.reference, replayed: true };
    }
    const session = await getInVenue(ctx, args.sessionId, actor.venue._id, "Cette table");
    if (!isOpenSession(session)) throw conflict("Cette table est clôturée : ouvrez-la de nouveau pour commander.");
    const notes = args.notes?.trim() || undefined;
    if (notes && notes.length > ORDER_LIMITS.note) throw invalid(`La note tient en ${ORDER_LIMITS.note} caractères.`);
    const heldCourses = [...new Set(args.heldCourses)];
    if (heldCourses.some((c) => !Number.isInteger(c) || c < 2 || c > ORDER_LIMITS.courses)) {
      throw invalid("Seuls les services 2 à 4 peuvent attendre.");
    }
    const now = Date.now();
    const priced = await priceRequest(ctx, actor.venue, args.lines, now);
    if (priced.problems.length > 0) return { ok: false, problems: priced.problems };
    const created = await createOrder(ctx, {
      venue: actor.venue,
      session,
      lines: priced.lines,
      heldCourses,
      ...(notes ? { notes } : {}),
      idempotencyKey: args.idempotencyKey,
      channel: "staff",
      placedByUserId: actor.user._id,
      accepted: true,
      now,
    });
    return { ok: true, ...created, replayed: false };
  },
});

/** « Envoyez la suite » : les bons en attente d'un service partent en cuisine. */
export const fireCourse = mutation({
  args: { venueId: v.id("venues"), sessionId: v.id("tableSessions"), courseNumber: v.number() },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "order.course.fire", { venueId: args.venueId });
    const session = await getInVenue(ctx, args.sessionId, actor.venue._id, "Cette table");
    const held = (
      await ctx.db
        .query("kitchenTickets")
        .withIndex("by_session", (q) => q.eq("tableSessionId", session._id))
        .collect()
    ).filter((t) => t.status === "held" && t.courseNumber === args.courseNumber);
    for (const ticket of held) await advanceTicket(ctx, ticket, "fire", { type: "staff", userId: actor.user._id });
    return held.length;
  },
});

/** Porter à table : un bon prêt devient servi, ses lignes aussi. */
export const serveTicket = mutation({
  args: { venueId: v.id("venues"), ticketId: v.id("kitchenTickets") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "order.serve", { venueId: args.venueId });
    const ticket = await getInVenue(ctx, args.ticketId, actor.venue._id, "Ce bon");
    await advanceTicket(ctx, ticket, "serve", { type: "staff", userId: actor.user._id });
  },
});

/** Ce qui attend d'être porté, le plus ancien d'abord : l'écran « À servir » du serveur. */
export const readyToServe = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "order.read", { venueId: args.venueId });
    const tickets = await ctx.db
      .query("kitchenTickets")
      .withIndex("by_venue_status", (q) => q.eq("venueId", actor.venue._id).eq("status", "ready"))
      .collect();
    const result = [];
    for (const t of tickets.sort((a, b) => (a.readyAt ?? 0) - (b.readyAt ?? 0))) {
      const items = (
        await ctx.db
          .query("kitchenTicketItems")
          .withIndex("by_ticket", (q) => q.eq("kitchenTicketId", t._id))
          .collect()
      ).filter((i) => i.status !== "cancelled");
      const session = await ctx.db.get(t.tableSessionId);
      result.push({
        _id: t._id,
        reference: t.reference,
        tableNumber: t.tableNumber,
        sessionId: t.tableSessionId,
        station: (await ctx.db.get(t.prepStationId))?.name ?? "Poste",
        readyAt: t.readyAt ?? null,
        isMine: session?.assignedWaiterUserId === actor.user._id,
        items: items.map((i) => ({ name: i.nameSnapshot, variantName: i.variantNameSnapshot ?? null, quantity: i.quantity })),
      });
    }
    return { tickets: result, canServe: actor.permissions.has("order.serve") };
  },
});

/**
 * Annuler une ligne. Avant production, c'est corriger une saisie (`order.modify`). Une fois en
 * cuisine, cela coûte des denrées : droit distinct, motif obligatoire, journal d'audit.
 * Une ligne servie ne s'annule pas ici — c'est un geste commercial sur l'addition (T3).
 */
export const cancelItem = mutation({
  args: { venueId: v.id("venues"), itemId: v.id("orderItems"), reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "order.read", { venueId: args.venueId });
    const item = await getInVenue(ctx, args.itemId, actor.venue._id, "Cette ligne");
    if (item.status === "cancelled") return;
    if (item.status === "served") throw conflict("Ce plat est déjà servi : un geste commercial se fait sur l'addition.");
    const ticketItem = await ctx.db
      .query("kitchenTicketItems")
      .withIndex("by_order_item", (q) => q.eq("orderItemId", item._id))
      .unique();
    const ticket = ticketItem ? await ctx.db.get(ticketItem.kitchenTicketId) : null;
    const inProduction = ticket !== null && ["started", "recalled", "ready"].includes(ticket.status);
    const permission = inProduction ? "order.modify.after_fire" : "order.modify";
    if (!actor.permissions.has(permission)) {
      throw forbidden(inProduction ? "Ce plat est déjà en préparation : l'annuler demande un droit que vous n'avez pas." : undefined);
    }
    const reason = cleanReason(args.reason, inProduction);
    await cancelLine(ctx, actor, item, ticketItem, ticket, reason, inProduction);
    await refreshOrder(ctx, item.orderId, { type: "staff", userId: actor.user._id });
    await touchSession(ctx, item.tableSessionId);
  },
});

async function cancelLine(
  ctx: MutationCtx,
  actor: VenueActor,
  item: Doc<"orderItems">,
  ticketItem: Doc<"kitchenTicketItems"> | null,
  ticket: Doc<"kitchenTickets"> | null,
  reason: string | undefined,
  audited: boolean,
) {
  await ctx.db.patch(item._id, {
    status: "cancelled",
    cancelledByUserId: actor.user._id,
    ...(reason ? { cancelledReason: reason } : {}),
  });
  if (ticketItem) await ctx.db.patch(ticketItem._id, { status: "cancelled" });
  if (ticket) {
    const remaining = await recountTicket(ctx, ticket);
    if (remaining === 0 && !["served", "cancelled"].includes(ticket.status)) {
      await advanceTicket(ctx, ticket, "cancel", { type: "staff", userId: actor.user._id });
    }
  }
  const order = (await ctx.db.get(item.orderId))!;
  const totals = { ...order.totals };
  totals.subtotal -= item.lineTotal;
  const itemTax = item.taxSnapshot.reduce((s, t) => s + t.amount, 0);
  totals.tax -= itemTax;
  totals.total -= item.lineTotal + (totals.total === totals.subtotal + item.lineTotal ? 0 : itemTax);
  await ctx.db.patch(order._id, { totals });
  await writeOrderEvent(ctx, order, "item_cancelled", { type: "staff", userId: actor.user._id }, {
    item: item.nameSnapshot,
    quantity: item.quantity,
    ...(reason ? { reason } : {}),
  });
  if (audited) {
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      action: "order.item.cancel_after_fire",
      resourceType: "orderItem",
      resourceId: item._id,
      before: { name: item.nameSnapshot, quantity: item.quantity, lineTotal: item.lineTotal },
      ...(reason ? { reason } : {}),
    });
  }
}

/** Annuler toute une commande encore en cours. Motif obligatoire, audité. */
export const cancelOrder = mutation({
  args: { venueId: v.id("venues"), orderId: v.id("orders"), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "order.cancel", { venueId: args.venueId });
    const order = await getInVenue(ctx, args.orderId, actor.venue._id, "Cette commande");
    if (["cancelled", "rejected", "closed"].includes(order.status)) return;
    const reason = cleanReason(args.reason, true)!;
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    for (const item of items) {
      if (item.status === "cancelled" || item.status === "served") continue;
      const ticketItem = await ctx.db
        .query("kitchenTicketItems")
        .withIndex("by_order_item", (q) => q.eq("orderItemId", item._id))
        .unique();
      const ticket = ticketItem ? await ctx.db.get(ticketItem.kitchenTicketId) : null;
      await cancelLine(ctx, actor, item, ticketItem, ticket ? ((await ctx.db.get(ticket._id)) ?? ticket) : null, reason, false);
    }
    // Une commande en attente de validation n'a pas de lignes à dériver : on la clôt directement.
    if (order.status === "pending_acceptance") await ctx.db.patch(order._id, { status: "cancelled" });
    await refreshOrder(ctx, order._id, { type: "staff", userId: actor.user._id });
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      actorUserId: actor.user._id,
      action: "order.cancel",
      resourceType: "order",
      resourceId: order._id,
      before: { reference: order.reference, status: order.status, total: order.totals.total },
      reason,
    });
  },
});

/** Accepter une commande du client : ses bons partent alors en cuisine (R8). */
export const accept = mutation({
  args: { venueId: v.id("venues"), orderId: v.id("orders") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "order.accept", { venueId: args.venueId });
    const order = await getInVenue(ctx, args.orderId, actor.venue._id, "Cette commande");
    if (order.status !== "pending_acceptance") {
      if (order.status === "rejected" || order.status === "cancelled") throw conflict("Cette commande a déjà été refusée.");
      return; // déjà acceptée
    }
    const session = (await ctx.db.get(order.tableSessionId))!;
    if (!isOpenSession(session)) throw conflict("Cette table est clôturée.");
    const now = Date.now();
    await ctx.db.patch(order._id, { status: "accepted", acceptedByUserId: actor.user._id, acceptedAt: now });
    await writeOrderEvent(ctx, order, "accepted", { type: "staff", userId: actor.user._id });
    await createTickets(ctx, actor.venue, session, order._id, order.reference, [], now);
    const patch: Partial<Doc<"tableSessions">> = { lastActivityAt: now };
    if (session.assignedWaiterUserId === undefined) patch.assignedWaiterUserId = actor.user._id;
    await ctx.db.patch(session._id, patch);
  },
});

/** Refuser une commande du client, en lui disant pourquoi. */
export const reject = mutation({
  args: { venueId: v.id("venues"), orderId: v.id("orders"), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "order.accept", { venueId: args.venueId });
    const order = await getInVenue(ctx, args.orderId, actor.venue._id, "Cette commande");
    if (order.status === "rejected") return;
    if (order.status !== "pending_acceptance") throw conflict("Cette commande est déjà acceptée : annulez-la plutôt.");
    const reason = cleanReason(args.reason, true)!;
    await ctx.db.patch(order._id, { status: "rejected", rejectedReason: reason });
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    for (const item of items) await ctx.db.patch(item._id, { status: "cancelled", cancelledReason: reason, cancelledByUserId: actor.user._id });
    await writeOrderEvent(ctx, order, "rejected", { type: "staff", userId: actor.user._id }, { reason });
  },
});

/** Les commandes des clients en attente de validation, les plus anciennes d'abord. */
export const pendingAcceptance = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requirePermission(ctx, "order.accept", { venueId: args.venueId });
    const orders = await ctx.db
      .query("orders")
      .withIndex("by_venue_status_submitted", (q) => q.eq("venueId", actor.venue._id).eq("status", "pending_acceptance"))
      .collect();
    const result = [];
    for (const order of orders) {
      const session = await ctx.db.get(order.tableSessionId);
      const table = session ? await ctx.db.get(session.tableId) : null;
      const items = await ctx.db
        .query("orderItems")
        .withIndex("by_order", (q) => q.eq("orderId", order._id))
        .collect();
      result.push({
        _id: order._id,
        reference: order.reference,
        tableNumber: table?.number ?? "?",
        sessionId: order.tableSessionId,
        submittedAt: order.submittedAt,
        total: order.totals.total,
        notes: order.notes ?? null,
        items: items.map((i) => ({ name: i.nameSnapshot, variantName: i.variantNameSnapshot ?? null, quantity: i.quantity, modifiers: i.modifiers.map((m) => m.optionName) })),
      });
    }
    return result;
  },
});

export type { TicketStatus };
