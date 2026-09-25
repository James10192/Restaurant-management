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
import { lineGross, loadSessionBilling, negativeCheck } from "./lib/billing";
import { assertIntentsStillCovered } from "./lib/intents";
import { getInVenue } from "./lib/catalogAccess";
import { conflict, forbidden, invalid } from "./lib/errors";
import type { MutationCtx, ReadCtx } from "./lib/guards";
import { requireServiceActor, requireServiceMutation, type ServiceActor } from "./lib/serviceActor";
import { loadLiveAvailability } from "./lib/guestMenu";
import {
  APPROVAL_ESCALATE_MS,
  OFFLINE_AUTO_SEND_MAX_MS,
  OFFLINE_REPLAY_MAX_MS,
  ORDER_LIMITS,
  isClientRef,
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
  activeSessionOf,
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
  /** Reprise d'un panier montré : le convive à qui la ligne revient (D-101). Chaîne : la file hors ligne ne connaît pas les types. */
  guestSessionId: v.optional(v.string()),
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
    const actor = await requireServiceActor(ctx, "order.create", { venueId: args.venueId });
    return {
      currency: actor.venue.currency,
      timezone: actor.venue.timezone,
      menus: await loadOrderingMenus(ctx, actor.venue._id),
      live: await loadLiveAvailability(ctx, actor.venue._id),
    };
  },
});

type Priced = { lines: PricedLine[]; problems: LineProblem[] };

export async function priceRequest(ctx: ReadCtx, venue: Doc<"venues">, lines: LineRequest[], now: number): Promise<Priced> {
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
    placedByMemberId?: Id<"organizationMembers">;
    /** Qui l'écrit dans le journal : le membre, son appareil, sa session — ou le client. */
    actor: EventActor;
    placedByGuestSessionId?: Id<"guestSessions">;
    accepted: boolean;
    now: number;
    /** Préparée et servie sur papier pendant une coupure : enregistrée, jamais envoyée en cuisine. */
    enteredOffline?: boolean;
    clientCreatedAt?: number;
    /**
     * Le convive de chaque ligne, dans l'ordre des lignes : celui dont le panier a été repris
     * par le serveur (D-101). Absent : le convive qui envoie, ou personne.
     */
    lineGuests?: readonly (Id<"guestSessions"> | undefined)[];
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
  const reference = orderReference(await nextCounter(ctx, venue._id, `order:${serviceDayKey(now, venue.timezone, settings.service.serviceDayStartHour ?? 4)}`));
  // « Déjà préparée » ne vaut que pour ce qui a été fait sur papier : un service retenu
  // (le dessert « à suivre ») attend toujours l'appel du serveur.
  const servedOnPaper = (course: number) => params.enteredOffline === true && !params.heldCourses.includes(course);
  const anyHeld = params.lines.some((l) => params.heldCourses.includes(l.courseNumber));
  const orderId = await ctx.db.insert("orders", {
    venueId: venue._id,
    tableSessionId: session._id,
    reference,
    status: params.enteredOffline ? (anyHeld ? "partially_served" : "served") : params.accepted ? "accepted" : "pending_acceptance",
    channel: params.channel,
    ...(params.placedByMemberId ? { placedByMemberId: params.placedByMemberId } : {}),
    ...(params.placedByGuestSessionId ? { placedByGuestSessionId: params.placedByGuestSessionId } : {}),
    ...(params.accepted && params.placedByMemberId ? { acceptedByMemberId: params.placedByMemberId, acceptedAt: now } : {}),
    submittedAt: now,
    totals: orderTotals(lines, settings.tax.pricesIncludeTax),
    currency: venue.currency,
    idempotencyKey: params.idempotencyKey,
    ...(params.notes ? { notes: params.notes } : {}),
    ...(params.clientCreatedAt !== undefined ? { clientCreatedAt: params.clientCreatedAt } : {}),
    ...(params.enteredOffline ? { enteredOffline: true, ...(anyHeld ? {} : { servedAt: now, readyAt: now }) } : {}),
  });
  const itemIds: Id<"orderItems">[] = [];
  for (const [index, line] of lines.entries()) {
    const guest = params.lineGuests?.[index] ?? params.placedByGuestSessionId;
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
        taxIncluded: settings.tax.pricesIncludeTax,
        ...(line.instructions ? { instructions: line.instructions } : {}),
        courseNumber: line.courseNumber,
        status: servedOnPaper(line.courseNumber) ? "served" : "ordered",
        assignedGuestSessionIds: guest ? [guest] : [],
      }),
    );
  }
  const actor = params.actor;
  await writeOrderEvent(ctx, { _id: orderId, venueId: venue._id }, "submitted", actor, { lines: lines.length });
  if (params.accepted) {
    await writeOrderEvent(ctx, { _id: orderId, venueId: venue._id }, "accepted", actor);
    await createTickets(ctx, venue, session, orderId, reference, params.heldCourses, now, { recordOnly: params.enteredOffline === true });
    if (params.enteredOffline) await writeOrderEvent(ctx, { _id: orderId, venueId: venue._id }, "recorded_offline", actor);
  }
  // Première opération financière : la devise de l'établissement se fige (R20).
  if (venue.currencyLockedAt === undefined) await ctx.db.patch(venue._id, { currencyLockedAt: now });
  const sessionPatch: Partial<Doc<"tableSessions">> = { lastActivityAt: now };
  if (session.status === "open" || session.status === "billing") sessionPatch.status = "ordering";
  if (params.placedByMemberId && session.assignedWaiterMemberId === undefined) sessionPatch.assignedWaiterMemberId = params.placedByMemberId;
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
  options: { recordOnly?: boolean } = {},
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
    const served = options.recordOnly === true && !held;
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
      // Une commande déjà servie sur papier ne remonte jamais sur l'écran de cuisine.
      status: served ? "served" : held ? "held" : "queued",
      courseNumber: course,
      priority: 0,
      ...(held ? {} : { queuedAt: now }),
      ...(served ? { readyAt: now, servedAt: now } : {}),
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
        status: served ? "ready" : "pending",
        ...(lineAllergens.length > 0 ? { allergyNote: lineAllergens.join(", ") } : {}),
      });
    }
  }
}

/**
 * La table visée par une commande. Par sa référence d'appareil d'abord ; à défaut, la session
 * ouverte de la table : une ouverture hors ligne a pu rejoindre celle d'un collègue (R1).
 */
async function resolveSession(
  ctx: MutationCtx,
  venueId: Id<"venues">,
  args: { sessionId?: Id<"tableSessions">; sessionRef?: { clientRef: string; tableId: Id<"restaurantTables"> } },
  clientCreatedAt?: number,
): Promise<Doc<"tableSessions">> {
  if ((args.sessionId === undefined) === (args.sessionRef === undefined)) throw invalid("Désignez la table.");
  if (args.sessionId) return getInVenue(ctx, args.sessionId, venueId, "Cette table");
  const ref = args.sessionRef!;
  if (!isClientRef(ref.clientRef)) throw invalid("Référence d'appareil invalide.");
  const byRef = await ctx.db
    .query("tableSessions")
    .withIndex("by_venue_clientRef", (q) => q.eq("venueId", venueId).eq("clientRef", ref.clientRef))
    .unique();
  if (byRef) return byRef;
  const table = await getInVenue(ctx, ref.tableId, venueId, "Cette table");
  const active = await activeSessionOf(ctx, table._id);
  if (!active) throw conflict(`La table ${table.number} n'est pas ouverte.`);
  // Ouverte APRÈS la saisie : c'est une autre tablée. Commander chez elle mettrait la commande
  // sur l'addition de gens qui ne l'ont pas passée.
  if (clientCreatedAt !== undefined && active.openedAt > clientCreatedAt) {
    throw conflict(`La tablée de la table ${table.number} a changé depuis la saisie : ressaisissez la commande si elle vaut encore.`);
  }
  return active;
}

/**
 * Envoyer une commande saisie par le personnel. Renvoie les lignes refusées plutôt que de
 * lever : l'écran dit « Poulet braisé : épuisé » et garde le reste du panier.
 */
export const submit = mutation({
  args: {
    venueId: v.id("venues"),
    /** La table, par son identifiant… */
    sessionId: v.optional(v.id("tableSessions")),
    /** …ou, rejouée d'une file hors ligne, par la référence de l'appareil qui l'a ouverte (D-062). */
    sessionRef: v.optional(v.object({ clientRef: v.string(), tableId: v.id("restaurantTables") })),
    lines: v.array(lineArg),
    heldCourses: v.array(v.number()),
    notes: v.optional(v.string()),
    idempotencyKey: v.string(),
    /** Heure du geste sur l'appareil, pour un rejeu. */
    clientCreatedAt: v.optional(v.number()),
    /** « Déjà préparée » : enregistrer sans envoyer en cuisine (liste « À régulariser »). */
    recordOnly: v.optional(v.boolean()),
    /** Une personne a relu cette commande restée plus de 3 min en file, et l'envoie quand même. */
    lateConfirmed: v.optional(v.boolean()),
    actingMemberId: v.optional(v.id("organizationMembers")),
    /** Les paniers montrés repris dans cette saisie : ils pointeront vers la commande (D-101). */
    fromCartIds: v.optional(v.array(v.string())),
  },
  handler: async (
    ctx,
    args,
  ): Promise<
    | { ok: true; orderId: Id<"orders">; reference: string; replayed: boolean }
    | { ok: false; problems: LineProblem[] }
    | { ok: false; late: true }
  > => {
    const actor = await requireServiceMutation(ctx, "order.create", { venueId: args.venueId, actingMemberId: args.actingMemberId });
    assertIdempotencyKey(args.idempotencyKey);
    // Rejouée (double appui, file hors ligne) : on renvoie la commande déjà créée.
    const previous = await ctx.db
      .query("orders")
      .withIndex("by_venue_idempotency", (q) => q.eq("venueId", actor.venue._id).eq("idempotencyKey", args.idempotencyKey))
      .unique();
    if (previous) {
      return { ok: true, orderId: previous._id, reference: previous.reference, replayed: true };
    }
    const now = Date.now();
    if (args.clientCreatedAt !== undefined && now - args.clientCreatedAt > OFFLINE_REPLAY_MAX_MS) {
      throw invalid("Commande saisie il y a plus de six heures : un gérant doit la relire et la ressaisir.");
    }
    // Au-delà de trois minutes, elle a pu être faite sur papier : elle ne part pas seule en
    // cuisine, même renvoyée d'elle-même par le client à la reconnexion. Une personne décide.
    if (args.clientCreatedAt !== undefined && now - args.clientCreatedAt > OFFLINE_AUTO_SEND_MAX_MS && !args.recordOnly && !args.lateConfirmed) {
      return { ok: false, late: true };
    }
    if (args.recordOnly && !actor.permissions.has("order.serve")) throw forbidden();
    const session = await resolveSession(ctx, actor.venue._id, args, args.clientCreatedAt);
    if (!isOpenSession(session)) throw conflict("Cette table est clôturée : ouvrez-la de nouveau pour commander.");
    const notes = args.notes?.trim() || undefined;
    if (notes && notes.length > ORDER_LIMITS.note) throw invalid(`La note tient en ${ORDER_LIMITS.note} caractères.`);
    const heldCourses = [...new Set(args.heldCourses)];
    if (heldCourses.some((c) => !Number.isInteger(c) || c < 2 || c > ORDER_LIMITS.courses)) {
      throw invalid("Seuls les services 2 à 4 peuvent attendre.");
    }
    const priced = await priceRequest(ctx, actor.venue, args.lines.map(({ guestSessionId: _g, ...line }) => line), now);
    if (priced.problems.length > 0) return { ok: false, problems: priced.problems };
    const lineGuests = await guestsOfLines(ctx, session, args.lines);
    const created = await createOrder(ctx, {
      venue: actor.venue,
      session,
      lines: priced.lines,
      lineGuests,
      heldCourses,
      ...(notes ? { notes } : {}),
      idempotencyKey: args.idempotencyKey,
      channel: "staff",
      ...(actor.member ? { placedByMemberId: actor.member._id } : {}),
      actor: actor.event,
      accepted: true,
      now,
      ...(args.recordOnly ? { enteredOffline: true } : {}),
      ...(args.clientCreatedAt !== undefined ? { clientCreatedAt: args.clientCreatedAt } : {}),
    });
    await linkTakenCarts(ctx, session, args.fromCartIds ?? [], created.orderId);
    return { ok: true, ...created, replayed: false };
  },
});

/**
 * Le convive de chaque ligne reprise d'un panier. Une référence qui ne désigne pas un convive de
 * CETTE tablée est ignorée, sans échec : la saisie vient peut-être d'une file hors ligne rejouée.
 */
async function guestsOfLines(ctx: MutationCtx, session: Doc<"tableSessions">, lines: readonly { guestSessionId?: string }[]) {
  const known = new Map<string, Id<"guestSessions"> | undefined>();
  const result: (Id<"guestSessions"> | undefined)[] = [];
  for (const line of lines) {
    const raw = line.guestSessionId;
    if (raw === undefined) {
      result.push(undefined);
      continue;
    }
    if (!known.has(raw)) {
      const id = ctx.db.normalizeId("guestSessions", raw);
      const guest = id ? await ctx.db.get(id) : null;
      known.set(raw, guest && guest.tableSessionId === session._id ? guest._id : undefined);
    }
    result.push(known.get(raw));
  }
  return result;
}

/** Le panier repris pointe vers la commande : le client la retrouve dans « Mes commandes » (D-101). */
async function linkTakenCarts(ctx: MutationCtx, session: Doc<"tableSessions">, cartIds: readonly string[], orderId: Id<"orders">) {
  for (const raw of cartIds.slice(0, 10)) {
    const id = ctx.db.normalizeId("carts", raw);
    const cart = id ? await ctx.db.get(id) : null;
    if (!cart || cart.tableSessionId !== session._id || cart.status !== "submitted" || cart.orderId !== undefined) continue;
    await ctx.db.patch(cart._id, { orderId });
  }
}

/** « Envoyez la suite » : les bons en attente d'un service partent en cuisine. */
export const fireCourse = mutation({
  args: {
    venueId: v.id("venues"),
    sessionId: v.id("tableSessions"),
    courseNumber: v.number(),
    clientCreatedAt: v.optional(v.number()),
    lateConfirmed: v.optional(v.boolean()),
    actingMemberId: v.optional(v.id("organizationMembers")),
  },
  handler: async (ctx, args): Promise<number | { ok: false; late: true }> => {
    const actor = await requireServiceMutation(ctx, "order.course.fire", { venueId: args.venueId, actingMemberId: args.actingMemberId });
    // Même règle que l'envoi d'une commande : un « envoyez la suite » vieux de plus de trois
    // minutes a pu être crié en cuisine ; une personne décide (D-062).
    if (args.clientCreatedAt !== undefined && Date.now() - args.clientCreatedAt > OFFLINE_AUTO_SEND_MAX_MS && !args.lateConfirmed) {
      return { ok: false, late: true };
    }
    const session = await getInVenue(ctx, args.sessionId, actor.venue._id, "Cette table");
    const held = (
      await ctx.db
        .query("kitchenTickets")
        .withIndex("by_session", (q) => q.eq("tableSessionId", session._id))
        .collect()
    ).filter((t) => t.status === "held" && t.courseNumber === args.courseNumber);
    for (const ticket of held) await advanceTicket(ctx, ticket, "fire", actor.event);
    return held.length;
  },
});

/** Porter à table : un bon prêt devient servi, ses lignes aussi. */
export const serveTicket = mutation({
  args: { venueId: v.id("venues"), ticketId: v.id("kitchenTickets"), actingMemberId: v.optional(v.id("organizationMembers")), },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "order.serve", { venueId: args.venueId, actingMemberId: args.actingMemberId });
    const ticket = await getInVenue(ctx, args.ticketId, actor.venue._id, "Ce bon");
    await advanceTicket(ctx, ticket, "serve", actor.event);
  },
});

/** Ce qui attend d'être porté, le plus ancien d'abord : l'écran « À servir » du serveur. */
export const readyToServe = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requireServiceActor(ctx, "order.read", { venueId: args.venueId });
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
        isMine: actor.member !== null && session?.assignedWaiterMemberId === actor.member._id,
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
    const actor = await requireServiceMutation(ctx, "order.read", { venueId: args.venueId });
    const item = await getInVenue(ctx, args.itemId, actor.venue._id, "Cette ligne");
    if (item.status === "cancelled") return;
    if (item.status === "served") throw conflict("Ce plat est déjà servi : un geste commercial se fait sur l'addition.");
    const ticketItem = await ctx.db
      .query("kitchenTicketItems")
      .withIndex("by_order_item", (q) => q.eq("orderItemId", item._id))
      .unique();
    const ticket = ticketItem ? await ctx.db.get(ticketItem.kitchenTicketId) : null;
    const inProduction = inKitchen(ticket);
    const permission = inProduction ? "order.modify.after_fire" : "order.modify";
    if (!actor.permissions.has(permission)) {
      throw forbidden(inProduction ? "Ce plat est déjà en préparation : l'annuler demande un droit que vous n'avez pas." : undefined);
    }
    const reason = cleanReason(args.reason, inProduction);
    await assertNotPaid(ctx, item.tableSessionId, [item._id]);
    await cancelLine(ctx, actor, item, ticketItem, ticket, reason, inProduction);
    await refreshOrder(ctx, item.orderId, actor.event);
    await touchSession(ctx, item.tableSessionId);
  },
});

/**
 * Annuler ce qui est déjà encaissé ferait devoir de l'argent au client, en silence : refusé. On
 * rembourse d'abord (T3) — c'est un geste nommé, avec son motif et son auteur.
 */
async function assertNotPaid(ctx: MutationCtx, sessionId: Id<"tableSessions">, itemIds: Id<"orderItems">[]) {
  if (itemIds.length === 0) return;
  const session = await ctx.db.get(sessionId);
  if (!session) return;
  const after = await loadSessionBilling(ctx, session, { excludeItems: new Set(itemIds) });
  if (negativeCheck(after)) {
    throw conflict("Ce qui est annulé est déjà encaissé : remboursez d'abord, puis annulez.");
  }
  // Un paiement en ligne en cours porte un montant figé : l'annulation ne le rendrait pas trop grand (D-114).
  await assertIntentsStillCovered(ctx, session._id, after);
}

/** Un bon démarré, rappelé ou prêt a coûté des denrées : l'annuler est une perte. */
function inKitchen(ticket: Doc<"kitchenTickets"> | null): boolean {
  return ticket !== null && ["started", "recalled", "ready"].includes(ticket.status);
}

/**
 * `afterFire` dit si la ligne était déjà en cuisine (le rapport en fait une perte) ; `auditLine`
 * si elle mérite sa propre entrée au journal — l'annulation d'une commande entière en écrit une
 * seule, pour toute la commande.
 */
async function cancelLine(
  ctx: MutationCtx,
  actor: ServiceActor,
  item: Doc<"orderItems">,
  ticketItem: Doc<"kitchenTicketItems"> | null,
  ticket: Doc<"kitchenTickets"> | null,
  reason: string | undefined,
  afterFire: boolean,
  auditLine: boolean = afterFire,
) {
  await ctx.db.patch(item._id, {
    status: "cancelled",
    ...(actor.member ? { cancelledByMemberId: actor.member._id } : {}),
    ...(reason ? { cancelledReason: reason } : {}),
  });
  if (ticketItem) await ctx.db.patch(ticketItem._id, { status: "cancelled" });
  if (ticket) {
    const remaining = await recountTicket(ctx, ticket);
    if (remaining === 0 && !["served", "cancelled"].includes(ticket.status)) {
      await advanceTicket(ctx, ticket, "cancel", actor.event);
    }
  }
  const order = (await ctx.db.get(item.orderId))!;
  const totals = { ...order.totals };
  const itemTax = item.taxSnapshot.reduce((s, t) => s + t.amount, 0);
  totals.subtotal -= item.lineTotal;
  totals.tax -= itemTax;
  // Lu sur la ligne, jamais deviné en comparant des totaux : l'addition en dépend (T3).
  totals.total -= lineGross(item);
  await ctx.db.patch(order._id, { totals });
  await writeOrderEvent(ctx, order, "item_cancelled", actor.event, {
    item: item.nameSnapshot,
    quantity: item.quantity,
    amount: lineGross(item),
    /** Déjà en cuisine : des denrées perdues, que le rapport de fin de service montre. */
    afterFire,
    ...(reason ? { reason } : {}),
  });
  if (auditLine) {
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      ...actor.audit,
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
    const actor = await requireServiceMutation(ctx, "order.cancel", { venueId: args.venueId });
    const order = await getInVenue(ctx, args.orderId, actor.venue._id, "Cette commande");
    if (["cancelled", "rejected", "closed"].includes(order.status)) return;
    const reason = cleanReason(args.reason, true)!;
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    // Annuler toute la commande ne contourne pas le droit d'annuler un plat déjà en cuisine :
    // un rôle personnalisé peut avoir l'un sans l'autre.
    if (items.some((i) => i.status === "preparing" || i.status === "ready") && !actor.permissions.has("order.modify.after_fire")) {
      throw forbidden("Des plats sont déjà en préparation : les annuler demande un droit que vous n'avez pas.");
    }
    await assertNotPaid(ctx, order.tableSessionId, items.filter((i) => i.status !== "cancelled" && i.status !== "served").map((i) => i._id));
    for (const item of items) {
      if (item.status === "cancelled" || item.status === "served") continue;
      const ticketItem = await ctx.db
        .query("kitchenTicketItems")
        .withIndex("by_order_item", (q) => q.eq("orderItemId", item._id))
        .unique();
      // Relu à chaque ligne : annuler la précédente a pu clore le bon qu'elles partagent.
      const ticket = ticketItem ? await ctx.db.get(ticketItem.kitchenTicketId) : null;
      // Chaque ligne déjà en cuisine est une perte, comme si on l'avait annulée seule (D-145).
      await cancelLine(ctx, actor, item, ticketItem, ticket, reason, inKitchen(ticket), false);
    }
    // Une commande en attente de validation n'a pas de lignes à dériver : on la clôt directement.
    if (order.status === "pending_acceptance") await ctx.db.patch(order._id, { status: "cancelled" });
    await refreshOrder(ctx, order._id, actor.event);
    await writeAudit(ctx, {
      organizationId: actor.organization._id,
      venueId: actor.venue._id,
      ...actor.audit,
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
    const actor = await requireServiceMutation(ctx, "order.accept", { venueId: args.venueId });
    const order = await getInVenue(ctx, args.orderId, actor.venue._id, "Cette commande");
    if (order.status !== "pending_acceptance") {
      if (order.status === "rejected" || order.status === "cancelled") throw conflict("Cette commande a déjà été refusée.");
      return; // déjà acceptée
    }
    const session = (await ctx.db.get(order.tableSessionId))!;
    if (!isOpenSession(session)) throw conflict("Cette table est clôturée.");
    const now = Date.now();
    await ctx.db.patch(order._id, { status: "accepted", ...(actor.member ? { acceptedByMemberId: actor.member._id } : {}), acceptedAt: now });
    await writeOrderEvent(ctx, order, "accepted", actor.event);
    await createTickets(ctx, actor.venue, session, order._id, order.reference, [], now);
    const patch: Partial<Doc<"tableSessions">> = { lastActivityAt: now };
    if (session.assignedWaiterMemberId === undefined && actor.member) patch.assignedWaiterMemberId = actor.member._id;
    await ctx.db.patch(session._id, patch);
  },
});

/** Refuser une commande du client, en lui disant pourquoi. */
export const reject = mutation({
  args: { venueId: v.id("venues"), orderId: v.id("orders"), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireServiceMutation(ctx, "order.accept", { venueId: args.venueId });
    const order = await getInVenue(ctx, args.orderId, actor.venue._id, "Cette commande");
    if (order.status === "rejected") return;
    if (order.status !== "pending_acceptance") throw conflict("Cette commande est déjà acceptée : annulez-la plutôt.");
    const reason = cleanReason(args.reason, true)!;
    await ctx.db.patch(order._id, { status: "rejected", rejectedReason: reason });
    const items = await ctx.db
      .query("orderItems")
      .withIndex("by_order", (q) => q.eq("orderId", order._id))
      .collect();
    for (const item of items) await ctx.db.patch(item._id, { status: "cancelled", cancelledReason: reason, ...(actor.member ? { cancelledByMemberId: actor.member._id } : {}) });
    await writeOrderEvent(ctx, order, "rejected", actor.event, { reason });
  },
});

/**
 * Cette commande en file est-elle arrivée ? Avant de décider d'une commande « à régulariser »,
 * l'écran le demande : un envoi a pu aboutir sans que l'appareil en reçoive la réponse.
 */
export const lookupSubmission = query({
  args: { venueId: v.id("venues"), idempotencyKey: v.string() },
  handler: async (ctx, args) => {
    const actor = await requireServiceActor(ctx, "order.read", { venueId: args.venueId });
    const order = await ctx.db
      .query("orders")
      .withIndex("by_venue_idempotency", (q) => q.eq("venueId", actor.venue._id).eq("idempotencyKey", args.idempotencyKey))
      .unique();
    return order ? { reference: order.reference, status: order.status, submittedAt: order.submittedAt } : null;
  },
});

/** Les commandes des clients en attente de validation, les plus anciennes d'abord. */
export const pendingAcceptance = query({
  args: { venueId: v.id("venues") },
  handler: async (ctx, args) => {
    const actor = await requireServiceActor(ctx, "order.accept", { venueId: args.venueId });
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
        /** Au-delà de 90 secondes, l'alerte passe à tout le personnel de la salle (D-061). */
        escalated: Date.now() - order.submittedAt > APPROVAL_ESCALATE_MS,
        total: order.totals.total,
        notes: order.notes ?? null,
        items: items.map((i) => ({ name: i.nameSnapshot, variantName: i.variantNameSnapshot ?? null, quantity: i.quantity, modifiers: i.modifiers.map((m) => m.optionName) })),
      });
    }
    return result;
  },
});

export type { TicketStatus };
