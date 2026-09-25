/**
 * Service en salle — briques partagées — Joliba
 *
 * Ce qui est commun aux sessions de table, aux commandes et à l'écran de production : les
 * compteurs de références, la carte telle qu'on la commande, et SURTOUT les changements d'état
 * des bons, qui entraînent lignes, commande et session. Une seule fonction fait avancer un bon
 * (`advanceTicket`) : l'écran de cuisine, le serveur qui sert, le « fire » et l'annulation y
 * passent tous — aucune autre écriture de `kitchenTickets.status` n'existe.
 */

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, ReadCtx } from "./guards";
import { conflict, notFound } from "./errors";
import type { GuestMenu } from "./guestMenu";
import type { MenuSnapshot } from "./menuSnapshot";
import type { EventActor } from "./serviceActor";
import {
  deriveOrderStatus,
  itemStatusForTicket,
  kitchenItemStatus,
  nextTicketStatus,
  type OrderStatus,
  type TicketAction,
  type TicketStatus,
} from "./ordering";

/* ────────────────────────────────────────────────────────────────────────────
 * Compteurs
 * ──────────────────────────────────────────────────────────────────────────── */

/** Incrémente et renvoie le compteur. Deux appels concurrents sont sérialisés par Convex. */
export async function nextCounter(ctx: MutationCtx, venueId: Id<"venues">, key: string): Promise<number> {
  const existing = await ctx.db
    .query("venueCounters")
    .withIndex("by_venue_key", (q) => q.eq("venueId", venueId).eq("key", key))
    .unique();
  if (existing) {
    await ctx.db.patch(existing._id, { value: existing.value + 1 });
    return existing.value + 1;
  }
  await ctx.db.insert("venueCounters", { venueId, key, value: 1 });
  return 1;
}

/* ────────────────────────────────────────────────────────────────────────────
 * La carte telle qu'on la commande
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Les cartes PUBLIÉES, sans résoudre une seule photo : pour chiffrer une commande, seuls les
 * noms, prix et options comptent. Même forme que la carte du client, pour que les deux lisent
 * la même règle de disponibilité (`availabilityIndex`).
 */
export async function loadOrderingMenus(ctx: ReadCtx, venueId: Id<"venues">): Promise<GuestMenu[]> {
  const publications = await ctx.db
    .query("menuPublications")
    .withIndex("by_venue_current", (q) => q.eq("venueId", venueId).eq("isCurrent", true))
    .collect();
  const menus: GuestMenu[] = [];
  for (const publication of publications) {
    const menu = await ctx.db.get(publication.menuId);
    if (!menu || menu.status === "archived") continue;
    const snapshot = publication.snapshot as MenuSnapshot;
    menus.push({
      ...snapshot,
      publicationId: publication._id,
      version: publication.version,
      publishedAt: publication.publishedAt,
      sections: snapshot.sections.map((s) => ({
        ...s,
        products: s.products.map((p) => ({ ...p, images: [] })),
      })),
    });
  }
  return menus.sort((a, b) => a.menu.sortOrder - b.menu.sortOrder);
}

export async function settingsOf(ctx: ReadCtx, venueId: Id<"venues">): Promise<Doc<"venueSettings">> {
  const settings = await ctx.db
    .query("venueSettings")
    .withIndex("by_venue", (q) => q.eq("venueId", venueId))
    .unique();
  if (!settings) throw notFound("Les réglages de cet établissement");
  return settings;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Sessions
 * ──────────────────────────────────────────────────────────────────────────── */

export const OPEN_SESSION: readonly Doc<"tableSessions">["status"][] = ["open", "ordering", "billing", "settling"];

export function isOpenSession(session: Doc<"tableSessions">): boolean {
  return OPEN_SESSION.includes(session.status);
}

/** La session non terminale d'une table, s'il y en a une (R1 : au plus une). */
export async function activeSessionOf(ctx: ReadCtx, tableId: Id<"restaurantTables">): Promise<Doc<"tableSessions"> | null> {
  for (const status of OPEN_SESSION) {
    const session = await ctx.db
      .query("tableSessions")
      .withIndex("by_table_status", (q) => q.eq("tableId", tableId).eq("status", status))
      .first();
    if (session) return session;
  }
  return null;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Bons, lignes, commande — l'état se propage dans un seul sens
 * ──────────────────────────────────────────────────────────────────────────── */

/** Relit les lignes et recalcule l'état de la commande (R12). Pose les jalons au passage. */
export async function refreshOrder(ctx: MutationCtx, orderId: Id<"orders">, actor: EventActor): Promise<Doc<"orders">> {
  const order = (await ctx.db.get(orderId))!;
  const items = await ctx.db
    .query("orderItems")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .collect();
  const next = deriveOrderStatus(order.status as OrderStatus, items.map((i) => i.status));
  if (next === order.status) return order;
  const now = Date.now();
  const patch: Partial<Doc<"orders">> = { status: next };
  if (next === "ready" && order.readyAt === undefined) patch.readyAt = now;
  if (next === "served") patch.servedAt = now;
  await ctx.db.patch(orderId, patch);
  if (next === "ready" || next === "served" || next === "cancelled") {
    await writeOrderEvent(ctx, order, next, actor);
  }
  return { ...order, ...patch };
}

export type { EventActor } from "./serviceActor";

export async function writeOrderEvent(
  ctx: MutationCtx,
  order: Pick<Doc<"orders">, "_id" | "venueId">,
  type: string,
  actor: EventActor,
  payload?: Record<string, unknown>,
): Promise<void> {
  await ctx.db.insert("orderEvents", {
    venueId: order.venueId,
    orderId: order._id,
    type,
    actorType: actor.type,
    ...(actor.type === "staff" ? { actorMemberId: actor.memberId } : {}),
    ...((actor.type === "staff" || actor.type === "device") && actor.deviceId ? { actorDeviceId: actor.deviceId } : {}),
    ...(actor.type === "staff" && actor.operatorSessionId ? { actorOperatorSessionId: actor.operatorSessionId } : {}),
    ...(payload ? { payload } : {}),
    at: Date.now(),
  });
}

/** Ce que l'écran dit quand un bon a déjà bougé : on nomme l'état réel, pas une erreur vague. */
const STATUS_LABEL: Record<TicketStatus, string> = {
  held: "en attente d'envoi",
  queued: "en file",
  started: "en préparation",
  ready: "prêt",
  recalled: "rappelé",
  served: "servi",
  cancelled: "annulé",
};

/**
 * Au-delà, un geste de service n'a pas été envoyé en direct : la file l'a gardé pendant une
 * coupure (D-163, constante D-148). Un aller-retour normal prend moins d'une seconde.
 */
const REPLAYED_GESTURE_MS = 15_000;

/** L'heure que chaque pas pose sur le bon : de quoi dire, au renvoi d'un geste, quand il a vraiment été appliqué. */
const DONE_AT = { start: "startedAt", ready: "readyAt", serve: "servedAt", recall: "recalledAt" } as const;

/** L'état qu'aurait déjà produit cette action : la rejouer (double appui, file hors ligne) est sans effet. */
const ALREADY: Record<TicketAction, TicketStatus> = {
  fire: "queued",
  start: "started",
  ready: "ready",
  recall: "recalled",
  serve: "served",
  cancel: "cancelled",
};

/**
 * Fait avancer un bon. Idempotent : une action déjà appliquée ne fait rien et ne lève pas —
 * c'est ce qui rend sûr le rejeu d'une file de gestes après une coupure. Une action
 * IMPOSSIBLE depuis l'état réel lève `CONFLICT` en disant cet état.
 */
export async function advanceTicket(
  ctx: MutationCtx,
  ticket: Doc<"kitchenTickets">,
  action: TicketAction,
  actor: EventActor,
  /** L'âge du geste à l'envoi, mesuré sur l'horloge de l'appareil ; posé par la file d'envoi (D-164). */
  ageMs?: number,
): Promise<{ changed: boolean; ticket: Doc<"kitchenTickets"> }> {
  const current = ticket.status as TicketStatus;
  const now = Date.now();
  const next = current === ALREADY[action] ? null : nextTicketStatus(current, action);
  if (next === null) {
    // Ce geste a déjà eu lieu : double appui, ou renvoi d'un geste dont la réponse s'est perdue —
    // parfois après que le bon est allé plus loin. C'est sans effet, pas un refus. Seul un bon
    // annulé, ou qui n'a jamais franchi ce pas, refuse en disant son état réel.
    const doneAt = action === "start" || action === "ready" || action === "serve" || action === "recall" ? ticket[DONE_AT[action]] : undefined;
    if (current !== ALREADY[action] && (current === "cancelled" || doneAt === undefined)) throw conflict(`Ce bon est déjà ${STATUS_LABEL[current]}.`);
    // Le pas a été posé bien après le geste : c'était la copie restée dans la file du client
    // Convex, rejouée au retour du réseau avec un âge nul. Ce renvoi-ci porte le vrai âge (D-164).
    if (ageMs !== undefined && ageMs > REPLAYED_GESTURE_MS && doneAt !== undefined && doneAt - (now - ageMs) > REPLAYED_GESTURE_MS && !ticket.timesFromReplay) {
      await ctx.db.patch(ticket._id, { timesFromReplay: true });
    }
    return { changed: false, ticket };
  }
  const memberId = actor.type === "staff" ? actor.memberId : undefined;
  const patch: Partial<Doc<"kitchenTickets">> = { status: next };
  if (action === "fire") patch.queuedAt = now;
  if (action === "start") {
    patch.startedAt = ticket.startedAt ?? now;
    if (memberId) patch.startedByMemberId = memberId;
  }
  if (action === "ready") {
    patch.readyAt = now;
    if (memberId) patch.readyByMemberId = memberId;
    if (ticket.startedAt === undefined) patch.startedAt = now;
  }
  if (action === "recall") patch.recalledAt = now;
  if (action === "serve") {
    patch.servedAt = now;
    if (memberId) patch.servedByMemberId = memberId;
  }
  // Arrivé bien après avoir été fait : un geste rejoué au retour du réseau, daté à la réception.
  // Les délais du bon ne mesurent plus rien ; il sort des délais, et le compte le dit (D-164).
  if (ageMs !== undefined && ageMs > REPLAYED_GESTURE_MS) patch.timesFromReplay = true;
  await ctx.db.patch(ticket._id, patch);

  // Les lignes du bon suivent. Une ligne annulée reste annulée ; une ligne servie reste servie
  // (un rappel concerne ce qui est encore en cuisine, pas ce qui est déjà à table).
  const ticketItems = await ctx.db
    .query("kitchenTicketItems")
    .withIndex("by_ticket", (q) => q.eq("kitchenTicketId", ticket._id))
    .collect();
  for (const ti of ticketItems) {
    if (ti.status === "cancelled") continue;
    await ctx.db.patch(ti._id, { status: kitchenItemStatus(next) });
    const item = await ctx.db.get(ti.orderItemId);
    if (!item || item.status === "cancelled" || (item.status === "served" && action !== "serve")) continue;
    await ctx.db.patch(item._id, { status: itemStatusForTicket(next) });
  }
  const order = (await ctx.db.get(ticket.orderId))!;
  await writeOrderEvent(ctx, order, `ticket_${action}`, actor, { ticketId: ticket._id, reference: ticket.reference });
  await refreshOrder(ctx, order._id, actor);
  await touchSession(ctx, ticket.tableSessionId, now);
  return { changed: true, ticket: { ...ticket, ...patch } };
}

export async function touchSession(ctx: MutationCtx, sessionId: Id<"tableSessions">, at = Date.now()): Promise<void> {
  const session = await ctx.db.get(sessionId);
  if (session && isOpenSession(session)) await ctx.db.patch(sessionId, { lastActivityAt: at });
}

/** Les bons d'une commande. */
export async function ticketsOf(ctx: ReadCtx, orderId: Id<"orders">): Promise<Doc<"kitchenTickets">[]> {
  return ctx.db
    .query("kitchenTickets")
    .withIndex("by_order", (q) => q.eq("orderId", orderId))
    .collect();
}

/** Recalcule le nombre d'articles et les allergies d'un bon après une annulation de ligne. */
export async function recountTicket(ctx: MutationCtx, ticket: Doc<"kitchenTickets">): Promise<number> {
  const items = (
    await ctx.db
      .query("kitchenTicketItems")
      .withIndex("by_ticket", (q) => q.eq("kitchenTicketId", ticket._id))
      .collect()
  ).filter((i) => i.status !== "cancelled");
  const flags = new Set<string>();
  for (const i of items) {
    if (i.allergyNote) for (const a of i.allergyNote.split(", ")) flags.add(a);
  }
  await ctx.db.patch(ticket._id, { itemCount: items.reduce((s, i) => s + i.quantity, 0), allergyFlags: [...flags] });
  return items.length;
}

/**
 * Le nom affiché d'un membre : celui qu'il porte sans compte, sinon le nom de son compte, sinon
 * le début de son adresse. Jamais l'adresse entière : ce nom s'affiche sur les tablettes
 * partagées de la salle.
 */
export async function memberDisplayName(ctx: ReadCtx, member: Doc<"organizationMembers">): Promise<string> {
  if (member.displayName) return member.displayName;
  const user = member.userId ? await ctx.db.get(member.userId) : null;
  return user?.name ?? user?.email.split("@")[0] ?? "Membre";
}

export async function memberName(ctx: ReadCtx, memberId: Id<"organizationMembers"> | undefined): Promise<string | null> {
  if (!memberId) return null;
  const member = await ctx.db.get(memberId);
  return member ? memberDisplayName(ctx, member) : null;
}
